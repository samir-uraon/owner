
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { ObjectId } from "mongodb";
import { randomBytes } from "node:crypto";
import clientPromise from "@/lib/mongodb";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

const CATEGORIES = {
  clinic: "clinics",
  saloon: "saloons",
  "beauty-parlour": "parlour",
  "diagnostic-centre": "diagnostic",
};

const DAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

function response(message, status = 400) {
  return NextResponse.json(
    { success: false, message },
    { status }
  );
}

function normalizeEmail(value) {
  return typeof value === "string"
    ? value.trim().toLowerCase()
    : "";
}

function cleanString(value, maxLength = 200) {
  return typeof value === "string"
    ? value.trim().slice(0, maxLength)
    : "";
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function generateTemporaryPassword() {
  return randomBytes(12).toString("base64url");
}

function isClinic(category) {
  return category === "clinic";
}

function teamField(category) {
  return isClinic(category) ? "doctors" : "staff";
}

function getTeamRole(member, category) {
  return isClinic(category)
    ? "doctor"
    : cleanString(member.role, 120).toLowerCase();
}

function cleanServices(value) {
  if (!Array.isArray(value)) return [];

  return [
    ...new Set(
      value
        .map((item) => cleanString(item, 100))
        .filter(Boolean)
    ),
  ].slice(0, 100);
}



function cleanSchedule(schedule = {}) {
  return Object.fromEntries(
    DAYS.map((day) => {
      const dayData = schedule?.[day] || {};

      const slots = Array.isArray(dayData.slots)
        ? dayData.slots
        : [];

      return [
        day,
        {
          active: dayData.active === true,
          slots: slots
            .filter(
              (slot) =>
                slot &&
                typeof slot === "object"
            )
            .map((slot) => ({
              open: cleanString(slot.open, 30),
              close: cleanString(slot.close, 30),
              checkupStartTime: cleanString(
                slot.checkupStartTime,
                30
              ),
              capacity: Math.max(
                1,
                Math.floor(Number(slot.capacity) || 1)
              ),
            })),
        },
      ];
    })
  );
}

function cleanMember(body, category) {
  const clinic = category === "clinic";

  const member = {
    name: cleanString(body.name, 120),
    phone: cleanString(body.phone, 30),
    email: normalizeEmail(body.email),
    experience: Math.max(
      0,
      Math.min(100, Math.floor(Number(body.experience) || 0))
    ),
    updatedAt: new Date(),
  };

  if (clinic) {
    member.specialization = cleanString(body.specialization, 120);
    member.duration = Math.max(
      1,
      Math.min(1440, Math.floor(Number(body.duration) || 20))
    );
    member.fee = Math.max(0, Number(body.fee) || 0);
    member.bookingCharge = Math.max(
      0,
      Number(body.bookingCharge) || 20
    );

    // Normalize the incoming schedule.
    member.schedule = cleanSchedule(body.schedule);
  } else {
    member.role = cleanString(body.role, 120);
    member.services = cleanServices(body.services);
  }

  return member;
}

function serializeMember(member) {
  return {
    ...member,
    _id: String(member._id || member.id),
    id: String(member.id || member._id),
  };
}

async function getOwnedBusiness(
  db,
  session,
  businessId,
  category
) {
  if (!session?.user?.email || !session?.user?.id) {
    return {
      error: response("Unauthorized", 401),
    };
  }

  if (
    !businessId ||
    !ObjectId.isValid(businessId) ||
    !ObjectId.isValid(session.user.id) ||
    !Object.hasOwn(CATEGORIES, category)
  ) {
    return {
      error: response(
        "Invalid business ID or category",
        400
      ),
    };
  }

  const ownerId = new ObjectId(session.user.id);
  const email = normalizeEmail(session.user.email);

  const owner = await db.collection("owners").findOne(
    {
      email: {
        $regex: `^${escapeRegex(email)}$`,
        $options: "i",
      },
    },
    {
      projection: {
        _id: 1,
        business: 1,
      },
    }
  );

  if (!owner) {
    return {
      error: response("Owner account not found", 404),
    };
  }

  const references = Array.isArray(owner.business)
    ? owner.business
    : [];

  const isLinked = references.some(
    (reference) =>
      reference &&
      typeof reference === "object" &&
      reference.businessId != null &&
      String(reference.businessId) === String(businessId)
  );

  if (!isLinked) {
    return {
      error: response(
        "You do not own this business",
        403
      ),
    };
  }

  const business = await db
    .collection(CATEGORIES[category])
    .findOne({
      _id: new ObjectId(businessId),
      ownerId,
    });

  if (!business) {
    return {
      error: response("Business not found", 404),
    };
  }

  return {
    business,
    ownerId,
  };
}

async function getTeamAccount(
  db,
  memberId,
  ownerId,
  businessId,
  category
) {
  if (!ObjectId.isValid(memberId)) {
    return null;
  }

  return db.collection("team").findOne({
    _id: new ObjectId(memberId),
    ownerId,
    clinicId: businessId,
    category,
  });
}

function validateMember(member, category) {
  if (!member.name) {
    return "Name is required";
  }

  if (
    isClinic(category) &&
    !member.specialization
  ) {
    return "Doctor specialization is required";
  }

  if (
    !isClinic(category) &&
    !member.role
  ) {
    return "Staff role is required";
  }

  return null;
}

export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email || !session?.user?.id) {
      return response("Unauthorized", 401);
    }

    const { searchParams } = new URL(request.url);

    const businessId = searchParams.get("businessId");
    const category = searchParams.get("category");

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB);

    const result = await getOwnedBusiness(
      db,
      session,
      businessId,
      category
    );

    if (result.error) return result.error;

    const field = teamField(category);
    const members = Array.isArray(result.business[field])
      ? result.business[field]
      : [];

    const memberIds = members
      .map((member) => String(member.id || member._id || ""))
      .filter((id) => ObjectId.isValid(id))
      .map((id) => new ObjectId(id));

    const accounts = memberIds.length
      ? await db
          .collection("team")
          .find({
            _id: { $in: memberIds },
            ownerId: result.ownerId,
            clinicId: result.business._id,
            category,
          })
          .toArray()
      : [];

    const accountsById = new Map(
      accounts.map((account) => [
        String(account._id),
        account,
      ])
    );

    const team = members.map((member) => {
      const memberId = String(member.id || member._id || "");
      const account = accountsById.get(memberId);

      return {
        ...member,
        _id: memberId,
        id: memberId,
        email: account?.email ?? member.email ?? "",
        phone: account?.phone ?? member.phone ?? "",
        role:
          account?.role ??
          (isClinic(category) ? "doctor" : member.role),
        category,
        isActive: account?.isActive ?? true,
        mustChangePassword:
          account?.mustChangePassword ?? false,

        // Kept for compatibility with your current
        // owner profile's temporary-password display.
        temporaryPassword:
          account?.password ?? null,
      };
    });

    return NextResponse.json({
      success: true,
      team,
    });
  } catch (error) {
    console.error("GET owner team error:", error);

    return response(
      "Failed to load team members",
      500
    );
  }
}
export async function POST(request) {
  let db;
  let insertedTeamId = null;
  let businessUpdated = false;
  let businessId = null;
  let ownerId = null;
  let category = null;
  let field = null;
  let memberId = null;
  let businessObjectId = null;

  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email || !session?.user?.id) {
      return response("Unauthorized", 401);
    }

    const body = await request.json();

    businessId = cleanString(body.businessId, 100);
    category = cleanString(body.category, 50);

    if (
      !businessId ||
      !ObjectId.isValid(businessId) ||
      !CATEGORIES[category]
    ) {
      return response("Invalid business ID or category", 400);
    }

    const client = await clientPromise;
    db = client.db(process.env.MONGODB);

    const result = await getOwnedBusiness(
      db,
      session,
      businessId,
      category
    );

    if (result.error) return result.error;

    ownerId = result.ownerId;
    businessObjectId = result.business._id;
    field = teamField(category);

    const member = cleanMember(body, category);

if (category === "clinic") {
  member.schedule = cleanSchedule(
    body.schedule ?? body.member?.schedule ?? {}
  );
}

const validationError = validateMember(member, category);

if (validationError) {
  return response(validationError);
}

const now = new Date();
const temporaryPassword = generateTemporaryPassword();

const teamRecord = {
  ownerId,
  clinicId: businessObjectId,
  name: member.name,
  email: member.email || null,
  phone: member.phone || null,
  role: getTeamRole(member, category),
  category,
  password: temporaryPassword,
  isActive: true,
  mustChangePassword: true,
  createdAt: now,
  updatedAt: now,
  ...(category === "clinic"
    ? { schedule: member.schedule }
    : {}),
};

const teamInsert = await db.collection("team").insertOne(teamRecord);

insertedTeamId = teamInsert.insertedId;
memberId = insertedTeamId.toString();

member.id = memberId;
member.createdAt = now;
member.updatedAt = now;

const updateResult = await db
  .collection(CATEGORIES[category])
  .updateOne(
    {
      _id: businessObjectId,
      ownerId,
    },
    {
      $push: {
        [field]: member,
      },
      $set: {
        setupCompleted: true,
        updatedAt: now,
      },
    }
  );

if (!updateResult.matchedCount) {
  await db.collection("team").deleteOne({
    _id: insertedTeamId,
    ownerId,
  });

  insertedTeamId = null;
  return response("Business not found", 404);
}

businessUpdated = true;

    return NextResponse.json(
      {
        success: true,
        message: "Team member added successfully",
        member: serializeMember(member),
        credentials: {
          memberId,
          temporaryPassword,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    if (db && insertedTeamId) {
      try {
        if (
          businessUpdated &&
          businessObjectId &&
          ownerId &&
          field &&
          memberId &&
          category &&
          CATEGORIES[category]
        ) {
          await db.collection(CATEGORIES[category]).updateOne(
            {
              _id: businessObjectId,
              ownerId,
            },
            {
              $pull: {
                [field]: { id: memberId },
              },
            }
          );
        }

        await db.collection("team").deleteOne({
          _id: insertedTeamId,
        });
      } catch (cleanupError) {
        console.error(
          "Team account cleanup failed:",
          cleanupError
        );
      }
    }

    console.error("POST owner team error:", error);

    return response("Failed to add team member", 500);
  }
}

export async function PUT(request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email || !session?.user?.id) {
      return response("Unauthorized", 401);
    }

    const body = await request.json();

    const businessId = cleanString(body.businessId, 100);
    const category = cleanString(body.category, 50);
    const memberId = cleanString(
      body._id || body.id,
      150
    );

    if (
      !businessId ||
      !ObjectId.isValid(businessId) ||
      !CATEGORIES[category]
    ) {
      return response("Invalid business ID or category", 400);
    }

    if (!memberId || !ObjectId.isValid(memberId)) {
      return response("Invalid team member ID", 400);
    }

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB);

    const result = await getOwnedBusiness(
      db,
      session,
      businessId,
      category
    );

    if (result.error) return result.error;

    const ownerId = result.ownerId;
    const businessObjectId = result.business._id;
    const field = teamField(category);

    const existingMember = (
      Array.isArray(result.business[field])
        ? result.business[field]
        : []
    ).find(
      (item) =>
        String(item.id || item._id || "") === memberId
    );

    if (!existingMember) {
      return response("Team member not found", 404);
    }

  const member = cleanMember(body, category);

if (category === "clinic") {
  member.schedule = cleanSchedule(
    body.schedule ?? body.member?.schedule ?? {}
  );
}

    const validationError = validateMember(member, category);

    if (validationError) {
      return response(validationError);
    }

    const now = new Date();

    const updatedMember = {
      ...member,
      id: memberId,
      createdAt: existingMember.createdAt || now,
      updatedAt: now,
    };

    // Update the business document.
    const businessUpdate = await db
      .collection(CATEGORIES[category])
      .updateOne(
        {
          _id: businessObjectId,
          ownerId,
          [`${field}.id`]: memberId,
        },
        {
          $set: {
  [`${field}.$`]: updatedMember,
  updatedAt: now,
},
        }
      );

    if (!businessUpdate.matchedCount) {
      return response(
        "Business or team member not found",
        404
      );
    }

    // Synchronize the separate login account.
    const account = await getTeamAccount(
      db,
      memberId,
      ownerId,
      businessObjectId,
      category
    );

    if (account) {
      const teamUpdate = {
        name: updatedMember.name,
        email: updatedMember.email || null,
        phone: updatedMember.phone || null,
        role: getTeamRole(updatedMember, category),
        updatedAt: now,
      };

      // Update schedule in the team collection too.
  if (category === "clinic") {
  teamUpdate.schedule = updatedMember.schedule;
}

      await db.collection("team").updateOne(
        {
          _id: new ObjectId(memberId),
          ownerId,
          clinicId: businessObjectId,
          category,
        },
        {
          $set: teamUpdate,
        }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Team member updated successfully",
      member: serializeMember(updatedMember),
    });
  } catch (error) {
    console.error("PUT owner team error:", error);

    return response(
      "Failed to update team member",
      500
    );
  }
}

export async function DELETE(request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email || !session?.user?.id) {
      return response("Unauthorized", 401);
    }

    const { searchParams } = new URL(request.url);

    const businessId = searchParams.get("businessId");
    const category = searchParams.get("category");
    const memberId = cleanString(
      searchParams.get("memberId"),
      150
    );

    if (!memberId || !ObjectId.isValid(memberId)) {
      return response("Invalid team member ID", 400);
    }

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB);

    const result = await getOwnedBusiness(
      db,
      session,
      businessId,
      category
    );

    if (result.error) return result.error;

    const ownerId = result.ownerId;
    const businessObjectId = result.business._id;
    const field = teamField(category);

    const existingMember = (
      Array.isArray(result.business[field])
        ? result.business[field]
        : []
    ).find(
      (member) =>
        String(member.id || member._id || "") === memberId
    );

    if (!existingMember) {
      return response("Team member not found", 404);
    }

    const now = new Date();

    const updateResult = await db
      .collection(CATEGORIES[category])
      .updateOne(
        {
          _id: businessObjectId,
          ownerId,
          [`${field}.id`]: memberId,
        },
        {
          $pull: {
            [field]: { id: memberId },
          },
          $set: {
            updatedAt: now,
          },
        }
      );

    if (!updateResult.matchedCount) {
      return response("Team member not found", 404);
    }

    const accountDeleteResult = await db
      .collection("team")
      .deleteOne({
        _id: new ObjectId(memberId),
        ownerId,
        clinicId: businessObjectId,
        category,
      });

    const updatedBusiness = await db
      .collection(CATEGORIES[category])
      .findOne(
        {
          _id: businessObjectId,
          ownerId,
        },
        {
          projection: {
            [field]: 1,
          },
        }
      );

    const hasMembers =
      Array.isArray(updatedBusiness?.[field]) &&
      updatedBusiness[field].length > 0;

    await db.collection(CATEGORIES[category]).updateOne(
      {
        _id: businessObjectId,
        ownerId,
      },
      {
        $set: {
          setupCompleted: hasMembers,
          updatedAt: new Date(),
        },
      }
    );

    return NextResponse.json({
      success: true,
      message: "Team member removed successfully",
      memberId,
      accountDeleted: accountDeleteResult.deletedCount > 0,
      setupCompleted: hasMembers,
    });
  } catch (error) {
    console.error("DELETE owner team error:", error);

    return response(
      "Failed to remove team member",
      500
    );
  }
}
