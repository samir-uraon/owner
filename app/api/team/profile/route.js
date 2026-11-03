import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { ObjectId } from "mongodb";

import clientPromise from "@/lib/mongodb";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

const TEAM_ROLES = ["doctor", "staff"];

const CATEGORY_CONFIG = {
  clinic: {
    collection: "clinics",
    idFields: ["clinicId"],
  },
  saloon: {
    collection: "saloons",
    idFields: ["saloonId", "salonId"],
  },
  salon: {
    collection: "saloons",
    idFields: ["saloonId", "salonId"],
  },
  "beauty-parlour": {
    collection: "parlour",
    idFields: ["parlourId", "beautyParlourId"],
  },
  "beauty-parlor": {
    collection: "parlour",
    idFields: ["parlourId", "beautyParlourId"],
  },
  diagnostic: {
    collection: "diagnostic",
    idFields: ["diagnosticId"],
  },
  "diagnostic-centre": {
    collection: "diagnostic",
    idFields: ["diagnosticId"],
  },
};

const BUSINESS_ID_FIELDS = [
  "clinicId",
  "saloonId",
  "salonId",
  "parlourId",
  "beautyParlourId",
  "diagnosticId",
  "businessId",
];

function json(data, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store, max-age=0",
    },
  });
}

function normalizeRole(role) {
  return String(role || "").trim().toLowerCase();
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidPhone(phone) {
  return /^[6-9]\d{9}$/.test(phone);
}

function isObjectId(value) {
  return (
    typeof value === "string" &&
    ObjectId.isValid(value) &&
    String(new ObjectId(value)) === value
  );
}

/**
 * Returns today's date in the Asia/Kolkata timezone.
 * Format: YYYY-MM-DD
 */
function getIndiaDateString(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const values = Object.fromEntries(
    parts.map(({ type, value }) => [type, value])
  );

  return `${values.year}-${values.month}-${values.day}`;
}

/**
 * Validates multiple holiday dates.
 * Accepted format: YYYY-MM-DD
 * Maximum: 365 unique dates
 */
function normalizeHolidayDates(dates) {
  if (!Array.isArray(dates)) {
    return null;
  }

  if (dates.length > 365) {
    return null;
  }

  const validDates = [];
  const seen = new Set();

  for (const value of dates) {
    if (typeof value !== "string") {
      return null;
    }

    const date = value.trim();

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return null;
    }

    const parsed = new Date(`${date}T00:00:00.000Z`);

    if (
      Number.isNaN(parsed.getTime()) ||
      parsed.toISOString().slice(0, 10) !== date
    ) {
      return null;
    }

    if (!seen.has(date)) {
      seen.add(date);
      validDates.push(date);
    }
  }

  return validDates.sort();
}

/**
 * Returns only today and future holiday dates.
 */
function getActiveHolidayDates(dates) {
  const today = getIndiaDateString();

  return (Array.isArray(dates) ? dates : [])
    .filter(
      (date) =>
        typeof date === "string" &&
        /^\d{4}-\d{2}-\d{2}$/.test(date) &&
        date >= today
    )
    .sort();
}

/**
 * Finds the authenticated doctor/staff account.
 */
async function getTeamMember(team, sessionUser) {
  const role = normalizeRole(sessionUser.role);
  const id = String(sessionUser.id || sessionUser._id || "").trim();

  if (id) {
    const identityConditions = [];

    if (isObjectId(id)) {
      identityConditions.push({
        _id: new ObjectId(id),
      });
    }

    identityConditions.push(
      { teamMemberId: id },
      { employeeId: id },
      { id }
    );

    const member = await team.findOne({
      $or: identityConditions,
    });

    if (member) {
      return normalizeRole(member.role) === role ? member : null;
    }
  }

  const email = String(sessionUser.email || "")
    .trim()
    .toLowerCase();

  if (email) {
    const member = await team.findOne({
      role: {
        $regex: `^${escapeRegex(role)}$`,
        $options: "i",
      },
      $or: [
        {
          email: {
            $regex: `^${escapeRegex(email)}$`,
            $options: "i",
          },
        },
        {
          emailAddress: {
            $regex: `^${escapeRegex(email)}$`,
            $options: "i",
          },
        },
      ],
    });

    if (member) return member;
  }

  return null;
}

/**
 * Resolves the business name from the correct collection.
 */
async function getBusinessName(db, member) {
  const category = String(member.category || "")
    .trim()
    .toLowerCase();

  const config = CATEGORY_CONFIG[category];
  if (!config) return "";

  const businessId =
    config.idFields
      .map((field) => member[field])
      .find((value) => value != null && String(value).trim()) ??
    BUSINESS_ID_FIELDS
      .map((field) => member[field])
      .find((value) => value != null && String(value).trim());

  if (businessId == null) return "";

  const id = String(businessId).trim();
  const collection = db.collection(config.collection);

  const identityConditions = [
    { _id: id },
    { businessId: id },
    { clinicId: id },
    { saloonId: id },
    { salonId: id },
    { parlourId: id },
    { beautyParlourId: id },
    { diagnosticId: id },
  ];

  if (isObjectId(id)) {
    identityConditions.push({
      _id: new ObjectId(id),
    });
  }

  const business = await collection.findOne(
    {
      $or: identityConditions,
    },
    {
      projection: {
        name: 1,
        businessName: 1,
        clinicName: 1,
        saloonName: 1,
        salonName: 1,
        parlourName: 1,
        diagnosticName: 1,
      },
    }
  );

  return (
    business?.businessName ||
    business?.name ||
    business?.clinicName ||
    business?.saloonName ||
    business?.salonName ||
    business?.parlourName ||
    business?.diagnosticName ||
    ""
  );
}

/**
 * Converts the MongoDB team document to the public profile representation.
 */
function serializeProfile(member, businessName = "") {
  return {
    id: String(member._id),
    name: member.name || member.fullName || "",
    email: member.email || member.emailAddress || "",
    phone: member.phone || member.mobile || "",
    role: normalizeRole(member.role),
    category: member.category || "",

    clinicId: member.clinicId ? String(member.clinicId) : "",

    businessName,

    profileImage:
      member.profileImage ||
      member.image ||
      member.imageUrl ||
      member.photo ||
      "",

    experience: member.experience ?? null,
    specialization: member.specialization || "",

    fee: member.fee ?? member.checkupFee ?? member.charge ?? "",

    duration: member.duration ?? member.checkupDuration ?? null,

    services: Array.isArray(member.services) ? member.services : [],

    schedule: member.schedule || {},

    holidayDates: getActiveHolidayDates(member.holidayDates),
  };
}

/**
 * Shared authentication and database context.
 */
async function getContext() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return {
      error: json({ message: "Please log in first." }, 401),
    };
  }

  const role = normalizeRole(session.user.role);

  if (!TEAM_ROLES.includes(role)) {
    return {
      error: json(
        {
          message:
            "Only doctor and staff accounts can access this profile.",
        },
        403
      ),
    };
  }

  const client = await clientPromise;
  const db = client.db(process.env.MONGODB);
  const team = db.collection("team");

  const member = await getTeamMember(team, session.user);

  if (!member) {
    return {
      error: json({ message: "Team member account not found." }, 404),
    };
  }

  return {
    db,
    team,
    member,
    role,
  };
}

// GET /api/team/profile
export async function GET() {
  try {
    const context = await getContext();
    if (context.error) return context.error;

    const { db, member } = context;
    const businessName = await getBusinessName(db, member);

    return json({
      success: true,
      profile: serializeProfile(member, businessName),
    });
  } catch (error) {
    console.error("GET team profile error:", error);

    return json({ message: "Failed to load your profile." }, 500);
  }
}

// PUT /api/team/profile
export async function PUT(request) {
  try {
    const context = await getContext();
    if (context.error) return context.error;

    const { db, team, member, role } = context;

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ message: "Invalid JSON request body." }, 400);
    }

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return json({ message: "Invalid request body." }, 400);
    }

    if (
      body.role !== undefined &&
      normalizeRole(body.role) !== role
    ) {
      return json({ message: "Forbidden: role mismatch." }, 403);
    }

    const update = {};
    const unset = {};

    // Name
    if (body.name !== undefined) {
      const name = String(body.name || "").trim();

      if (!name || name.length > 100) {
        return json(
          {
            message:
              "Name is required and must be under 100 characters.",
          },
          400
        );
      }

      update.name = name;
    }

    // Email
    if (body.email !== undefined) {
      const email = String(body.email || "")
        .trim()
        .toLowerCase();

      if (email && !isValidEmail(email)) {
        return json({ message: "Please enter a valid email." }, 400);
      }

      update.email = email || null;

      if (Object.hasOwn(member, "emailAddress")) {
        update.emailAddress = email || null;
      }
    }

    // Phone
    if (body.phone !== undefined) {
      const phone = String(body.phone || "").replace(/\s+/g, "");

      if (phone && !isValidPhone(phone)) {
        return json(
          {
            message:
              "Enter a valid 10-digit Indian mobile number.",
          },
          400
        );
      }

      update.phone = phone || null;

      if (Object.hasOwn(member, "mobile")) {
        update.mobile = phone || null;
      }
    }

    // Experience
    if (body.experience !== undefined) {
      if (body.experience === null || body.experience === "") {
        update.experience = null;
      } else {
        const experience = Number(body.experience);

        if (
          !Number.isFinite(experience) ||
          experience < 0 ||
          experience > 100
        ) {
          return json(
            {
              message:
                "Experience must be between 0 and 100 years.",
            },
            400
          );
        }

        update.experience = experience;
      }
    }

    // Profile image handling: Updates MongoDB properly
    if (body.profileImage !== undefined) {
      const imageUrl = String(body.profileImage || "").trim();

      if (imageUrl) {
        try {
          const parsedUrl = new URL(imageUrl);

          if (
            parsedUrl.protocol !== "https:" ||
            parsedUrl.hostname !== "res.cloudinary.com" ||
            parsedUrl.username ||
            parsedUrl.password
          ) {
            return json(
              {
                message:
                  "Please provide a valid Cloudinary image URL.",
              },
              400
            );
          }
        } catch {
          return json(
            { message: "Invalid profile image URL." },
            400
          );
        }

        update.profileImage = imageUrl;
        // Clean legacy fields so profileImage is canonical
        if (Object.hasOwn(member, "image")) update.image = imageUrl;
        if (Object.hasOwn(member, "imageUrl")) update.imageUrl = imageUrl;
        if (Object.hasOwn(member, "photo")) update.photo = imageUrl;
      } else {
        update.profileImage = null;
        if (Object.hasOwn(member, "image")) update.image = null;
        if (Object.hasOwn(member, "imageUrl")) update.imageUrl = null;
        if (Object.hasOwn(member, "photo")) update.photo = null;
      }
    }

    // Doctor-specific fields
    if (role === "doctor") {
      if (body.specialization !== undefined) {
        const specialization = String(body.specialization || "").trim();

        if (specialization.length > 150) {
          return json(
            { message: "Specialization is too long." },
            400
          );
        }

        update.specialization = specialization;
      }

      if (body.fee !== undefined) {
        const fee = Number(body.fee);

        if (!Number.isFinite(fee) || fee < 0) {
          return json(
            { message: "Fee must be zero or greater." },
            400
          );
        }

        update.fee = fee;
      }

      if (body.duration !== undefined) {
        if (body.duration === null || body.duration === "") {
          update.duration = null;
        } else {
          const duration = Number(body.duration);

          if (
            !Number.isInteger(duration) ||
            duration < 1 ||
            duration > 480
          ) {
            return json(
              {
                message:
                  "Duration must be between 1 and 480 minutes.",
              },
              400
            );
          }

          update.duration = duration;
        }
      }
    }

    // Services
    if (body.services !== undefined) {
      if (!Array.isArray(body.services)) {
        return json(
          { message: "Services must be an array." },
          400
        );
      }

      const normalizedServices = [];

      for (const service of body.services) {
        if (typeof service === "string") {
          const name = service.trim();
          if (name) normalizedServices.push(name);
          continue;
        }

        if (
          service &&
          typeof service === "object" &&
          !Array.isArray(service) &&
          typeof service.name === "string"
        ) {
          const name = service.name.trim();
          if (!name) continue;

          normalizedServices.push({
            ...service,
            name,
          });

          continue;
        }

        return json(
          {
            message:
              "Each service must be a string or an object with a name.",
          },
          400
        );
      }

      if (normalizedServices.length > 100) {
        return json(
          { message: "You can add up to 100 services." },
          400
        );
      }

      const seenStrings = new Set();
      update.services = normalizedServices.filter((service) => {
        if (typeof service !== "string") return true;
        const key = service.toLowerCase();
        if (seenStrings.has(key)) return false;
        seenStrings.add(key);
        return true;
      });
    }

    // Holidays
    if (body.holidayDates !== undefined) {
      const normalizedDates = normalizeHolidayDates(
        body.holidayDates
      );

      if (normalizedDates === null) {
        return json(
          {
            message:
              "Holiday dates must be an array of valid YYYY-MM-DD dates, with at most 365 entries.",
          },
          400
        );
      }

      update.holidayDates = getActiveHolidayDates(normalizedDates);
    }

    if (Object.keys(update).length === 0) {
      return json(
        { message: "No valid profile changes were provided." },
        400
      );
    }

    update.updatedAt = new Date();

    // Key Fix: Persist updates directly into MongoDB
    const mongoUpdateQuery = { $set: update };
    if (Object.keys(unset).length > 0) {
      mongoUpdateQuery.$unset = unset;
    }

    await team.updateOne({ _id: member._id }, mongoUpdateQuery);

    // Fetch the updated member document from MongoDB to verify changes
    const updatedMember = await team.findOne({ _id: member._id });
    const businessName = await getBusinessName(db, updatedMember);

    return json({
      success: true,
      message: "Profile updated successfully.",
      profile: serializeProfile(updatedMember, businessName),
    });
  } catch (error) {
    console.error("PUT team profile error:", error);

    return json(
      { message: "Failed to process your profile update." },
      500
    );
  }
}

// DELETE /api/team/profile
export async function DELETE() {
  try {
    const context = await getContext();
    if (context.error) return context.error;

    const { db, team, member } = context;

    await team.updateOne(
      { _id: member._id },
      {
        $unset: {
          profileImage: "",
          image: "",
          imageUrl: "",
          photo: "",
        },
        $set: {
          updatedAt: new Date(),
        },
      }
    );

    const updatedMember = await team.findOne({ _id: member._id });
    const businessName = updatedMember
      ? await getBusinessName(db, updatedMember)
      : "";

    return json({
      success: true,
      message: "Profile image removed successfully.",
      profile: updatedMember
        ? serializeProfile(updatedMember, businessName)
        : null,
    });
  } catch (error) {
    console.error("DELETE team profile image error:", error);

    return json(
      { message: "Failed to remove the profile image." },
      500
    );
  }
}