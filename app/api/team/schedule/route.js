 
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

function json(data, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}

function validId(value) {
  return typeof value === "string" && ObjectId.isValid(value);
}

function normalizeSchedule(schedule = {}) {
  const days = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
  ];

  return Object.fromEntries(
    days.map((day) => {
      const entry = schedule?.[day] || schedule?.[day.toLowerCase()] || {};

      return [
        day,
        {
          active: Boolean(entry.active),
          slots: Array.isArray(entry.slots)
            ? entry.slots.map((slot) => ({
                open: slot.open || "",
                close: slot.close || "",
                capacity: Number(slot.capacity || 0),
                checkupStartTime: slot.checkupStartTime || "",
                active: slot.active !== false,
              }))
            : [],
        },
      ];
    }),
  );
}

function buildMemberQuery(userId, email, role) {
  const identityConditions = [];

  if (validId(userId)) {
    identityConditions.push({ _id: new ObjectId(userId) });
    identityConditions.push({ ownerId: new ObjectId(userId) });
  }

  if (userId) {
    identityConditions.push({ ownerId: userId });
    identityConditions.push({ userId });
    identityConditions.push({ teamMemberId: userId });
  }

  if (email) {
    identityConditions.push({
      email: { $regex: `^${email.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" },
    });
  }

  return {
    role: { $regex: `^${role}$`, $options: "i" },
    $or: identityConditions,
  };
}

async function findBusiness(db, member) {
  const category = String(member.category || "")
    .trim()
    .toLowerCase();

  const config = CATEGORY_CONFIG[category];

  if (!config) {
    console.warn("Unknown team member category:", category);
    return null;
  }

  const collection = db.collection(config.collection);

  // First try the category-specific reference field on the team document.
  let businessId = null;

  for (const field of config.idFields) {
    if (member[field]) {
      businessId = member[field];
      break;
    }
  }

  // Support existing records that use clinicId or another category ID
  // even if the reference field differs from the preferred field.
  if (!businessId) {
    const possibleFields = [
      "clinicId",
      "saloonId",
      "salonId",
      "parlourId",
      "beautyParlourId",
      "diagnosticId",
      "businessId",
    ];

    for (const field of possibleFields) {
      if (member[field]) {
        businessId = member[field];
        break;
      }
    }
  }

  if (!businessId) return null;

  const idString = String(businessId);
  const idQuery = validId(idString)
    ? {
        $or: [
          { _id: new ObjectId(idString) },
          { _id: idString },
        ],
      }
    : { _id: idString };

  return collection.findOne(idQuery, {
    projection: {
      name: 1,
      clinicName: 1,
      businessName: 1,
      saloonName: 1,
      salonName: 1,
      parlourName: 1,
    },
  });
}

export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return json({ error: "Unauthorized" }, 401);
    }

    const { searchParams } = new URL(request.url);
    const role = String(searchParams.get("role") || "")
      .trim()
      .toLowerCase();

    // Ensure the requested role matches the logged-in user's role.
    const sessionRole = String(session.user.role || "")
      .trim()
      .toLowerCase();

    if (!TEAM_ROLES.includes(role)) {
      return json({ error: "Invalid team role" }, 400);
    }

    if (sessionRole !== role) {
      return json({ error: "Forbidden: role mismatch" }, 403);
    }

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB);

    const userId = String(session.user.id);
    const email = String(session.user.email || "")
      .trim()
      .toLowerCase();

    const memberQuery = buildMemberQuery(userId, email, role);

    if (!memberQuery.$or.length) {
      return json({ error: "Team identity not found" }, 404);
    }

    const member = await db.collection("team").findOne(memberQuery);

    if (!member) {
      return json({ error: "Team member not found" }, 404);
    }

    const business = await findBusiness(db, member);

    const businessName =
      business?.name ||
      business?.clinicName ||
      business?.businessName ||
      business?.saloonName ||
      business?.salonName ||
      business?.parlourName ||
      "";

    return json({
      schedule: normalizeSchedule(member.schedule),
      businessName,
      category: member.category || "",
      profile: {
        id: String(member._id),
        name: member.name || member.fullName || "",
        email: member.email || session.user.email || "",
        phone: member.phone || member.mobile || "",
        image: member.image || member.imageUrl || member.profileImage || "",
        role: String(member.role || role).toLowerCase(),
        specialization: member.specialization || "",
        experience: member.experience ?? "",
        fee: member.fee ?? member.charge ?? "",
        services: Array.isArray(member.services) ? member.services : [],
      },
    });
  } catch (error) {
    console.error("GET /api/team/schedule:", error);
    return json({ error: "Failed to load team schedule" }, 500);
  }
}
