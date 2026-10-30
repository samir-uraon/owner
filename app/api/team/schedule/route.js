
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
    headers: {
      "Cache-Control": "no-store, max-age=0",
    },
  });
}

function validId(value) {
  return typeof value === "string" && ObjectId.isValid(value);
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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
      const entry =
        schedule?.[day] ||
        schedule?.[day.toLowerCase()] ||
        {};

      const slots = Array.isArray(entry.slots)
        ? entry.slots.map((slot) => ({
            open: slot.open || slot.start || "",
            close: slot.close || slot.end || "",
            capacity: Number(slot.capacity ?? 0),
            checkupStartTime:
              slot.checkupStartTime || slot.open || slot.start || "",
            active: slot.active ?? true,
          }))
        : [];

      return [
        day,
        {
          // Preserve both true and false.
          // Missing day status defaults to false.
          active: entry.active ?? false,
          slots,
        },
      ];
    })
  );
}

function buildMemberQuery(userId, email, role) {
  const identityConditions = [];

  // Match the logged-in team member by their own ID.
  if (validId(userId)) {
    identityConditions.push({
      _id: new ObjectId(userId),
    });
  }

  // Support installations that use a string-based team ID.
  if (userId) {
    identityConditions.push(
      { _id: userId },
      { userId },
      { teamMemberId: userId }
    );
  }

  if (email) {
    identityConditions.push({
      email: {
        $regex: `^${escapeRegex(email)}$`,
        $options: "i",
      },
    });
  }

  return {
    role: {
      $regex: `^${escapeRegex(role)}$`,
      $options: "i",
    },
    $or: identityConditions,
  };
}

async function findBusiness(db, member) {
  const category = String(member.category || "")
    .trim()
    .toLowerCase();

  const config = CATEGORY_CONFIG[category];

  if (!config) {
    return null;
  }

  const collection = db.collection(config.collection);

  let businessId = null;

  for (const field of config.idFields) {
    if (member[field]) {
      businessId = member[field];
      break;
    }
  }

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

  if (!businessId) {
    return null;
  }

  const idString = String(businessId);

  const idConditions = validId(idString)
    ? [
        { _id: new ObjectId(idString) },
        { _id: idString },
      ]
    : [{ _id: idString }];

  return collection.findOne(
    { $or: idConditions },
    {
      projection: {
        name: 1,
        clinicName: 1,
        businessName: 1,
        saloonName: 1,
        salonName: 1,
        parlourName: 1,
      },
    }
  );
}

function getBusinessName(business) {
  return (
    business?.name ||
    business?.clinicName ||
    business?.businessName ||
    business?.saloonName ||
    business?.salonName ||
    business?.parlourName ||
    ""
  );
}

async function getTeamMember(db, session, role) {
  const userId = String(session.user.id || "");
  const email = String(session.user.email || "")
    .trim()
    .toLowerCase();

  const query = buildMemberQuery(userId, email, role);

  if (!query.$or.length) {
    return null;
  }

  return db.collection("team").findOne(query);
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

    const member = await getTeamMember(db, session, role);

    if (!member) {
      return json({ error: "Team member not found" }, 404);
    }

    const business = await findBusiness(db, member);
    const businessName = getBusinessName(business);

    return json({
      schedule: normalizeSchedule(member.schedule),
      businessName,
      category: member.category || "",
      profile: {
        id: String(member._id),
        name: member.name || member.fullName || "",
        email: member.email || session.user.email || "",
        phone: member.phone || member.mobile || "",
        image:
          member.image ||
          member.imageUrl ||
          member.profileImage ||
          "",
        role: String(member.role || role).toLowerCase(),
        specialization: member.specialization || "",
        experience: member.experience ?? "",
        duration: member.duration ?? "",
        fee: member.fee ?? member.charge ?? "",
        bookingCharge: member.bookingCharge ?? "",
        businessName,
        services: Array.isArray(member.services)
          ? member.services
          : [],
          holidays:Array.isArray(member.holidayDates)
          ? member.holidayDates
          : [],
      },
    });
  } catch (error) {
    console.error("GET /api/team/schedule:", error);

    return json(
      { error: "Failed to load team schedule" },
      500
    );
  }
}

export async function PUT(request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return json({ error: "Unauthorized" }, 401);
    }

    const body = await request.json().catch(() => null);

    if (!body || typeof body !== "object") {
      return json({ error: "Invalid request body" }, 400);
    }

    const { searchParams } = new URL(request.url);

    const role = String(
      body.role || searchParams.get("role") || ""
    )
      .trim()
      .toLowerCase();

    const sessionRole = String(session.user.role || "")
      .trim()
      .toLowerCase();

    if (!TEAM_ROLES.includes(role)) {
      return json({ error: "Invalid team role" }, 400);
    }

    if (sessionRole !== role) {
      return json(
        { error: "Forbidden: role mismatch" },
        403
      );
    }

    if (
      !body.schedule ||
      typeof body.schedule !== "object" ||
      Array.isArray(body.schedule)
    ) {
      return json(
        { error: "Schedule payload is required" },
        400
      );
    }

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB);

    // Only update the authenticated team member.
    const member = await getTeamMember(db, session, role);

    if (!member) {
      return json({ error: "Team member not found" }, 404);
    }

    // Normalize all seven days, including day and slot active flags.
    const cleanedSchedule = normalizeSchedule(body.schedule);

    const updateResult = await db.collection("team").updateOne(
      {
        _id: member._id,
        role: member.role,
      },
      {
        $set: {
          schedule: cleanedSchedule,
          updatedAt: new Date(),
        },
      }
    );

    if (updateResult.matchedCount === 0) {
      return json({ error: "Team member not found" }, 404);
    }

    return json({
      message: "Schedule and active statuses updated successfully",
      schedule: cleanedSchedule,
    });
  } catch (error) {
    console.error("PUT /api/team/schedule:", error);

    return json(
      { error: "Failed to update team schedule" },
      500
    );
  }
}
