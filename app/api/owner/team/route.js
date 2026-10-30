
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

/**
 * Normalize service records.
 *
 * Supports:
 * ["General Consultation"]
 *
 * And:
 * [
 *   { name: "General Consultation", charge: 500 }
 * ]
 *
 * New service records are saved as objects.
 */
function cleanServices(value) {
  if (!Array.isArray(value)) return [];

  const result = [];
  const seen = new Set();

  for (const item of value.slice(0, 100)) {
    let name;
    let charge;

    if (typeof item === "string") {
      name = cleanString(item, 100);
      charge = 0;
    } else if (
      item &&
      typeof item === "object" &&
      !Array.isArray(item)
    ) {
      name = cleanString(item.name, 100);

      if (
        item.charge === "" ||
        item.charge === null ||
        item.charge === undefined
      ) {
        continue;
      }

      charge = Number(item.charge);

      if (
        !Number.isFinite(charge) ||
        charge < 0 ||
        charge > 100000000
      ) {
        continue;
      }
    } else {
      continue;
    }

    if (!name) continue;

    const key = name.toLowerCase();

    if (seen.has(key)) continue;

    seen.add(key);
    result.push({ name, charge });
  }

  return result;
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
                typeof slot === "object" &&
                !Array.isArray(slot)
            )
            .slice(0, 50)
            .map((slot) => ({
              open: cleanString(slot.open, 30),
              close: cleanString(slot.close, 30),
              checkupStartTime: cleanString(
                slot.checkupStartTime,
                30
              ),
              capacity: Math.max(
                1,
                Math.min(
                  100000,
                  Math.floor(Number(slot.capacity) || 1)
                )
              ),
            })),
        },
      ];
    })
  );
}

/**
 * Profile information, services and schedule live in team.
 * The business document stores only member IDs.
 *
 * Services can be sent as either:
 * body.services
 * body.member.services
 */
function cleanMember(body, category) {
  const clinic = isClinic(category);

  const memberData =
    body.member &&
    typeof body.member === "object" &&
    !Array.isArray(body.member)
      ? body.member
      : {};

  const servicesInput =
    body.services ?? memberData.services;

  const member = {
    name: cleanString(
      body.name ?? memberData.name,
      120
    ),

    phone: cleanString(
      body.phone ?? memberData.phone,
      30
    ),

    email: normalizeEmail(
      body.email ?? memberData.email
    ),

    experience: Math.max(
      0,
      Math.min(
        100,
        Math.floor(
          Number(
            body.experience ?? memberData.experience
          ) || 0
        )
      )
    ),

    // Saved for both doctors and staff.
    services: cleanServices(servicesInput),
  };

  if (clinic) {
    member.specialization = cleanString(
      body.specialization ?? memberData.specialization,
      120
    );

    member.duration = Math.max(
      1,
      Math.min(
        1440,
        Math.floor(
          Number(
            body.duration ?? memberData.duration
          ) || 20
        )
      )
    );

    member.fee = Math.max(
      0,
      Math.min(
        100000000,
        Number(body.fee ?? memberData.fee) || 0
      )
    );

    member.bookingCharge = Math.max(
      0,
      Math.min(
        100000000,
        Number(
          body.bookingCharge ??
            memberData.bookingCharge
        ) || 20
      )
    );

    member.schedule = cleanSchedule(
      body.schedule ??
        memberData.schedule ??
        {}
    );
  } else {
    member.role = cleanString(
      body.role ?? memberData.role,
      120
    );
  }

  return member;
}

function validateMember(member, category) {
  if (!member.name) {
    return "Name is required";
  }

  if (isClinic(category) && !member.specialization) {
    return "Doctor specialization is required";
  }

  if (!isClinic(category) && !member.role) {
    return "Staff role is required";
  }

  return null;
}

/**
 * Supports ID-only arrays and legacy object arrays.
 * New writes always store strings.
 */
function getMemberId(value) {
  if (typeof value === "string") {
    return value;
  }

  if (value && typeof value === "object") {
    return String(value.id || value._id || "");
  }

  return "";
}

function serializeMember(member) {
  return {
    ...member,
    _id: String(member._id),
    id: String(member._id),
  };
}

/**
 * Verify that the logged-in owner owns the business.
 */
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

  const isLinked = references.some((reference) => {
    if (
      !reference ||
      typeof reference !== "object" ||
      reference.businessId == null
    ) {
      return false;
    }

    return (
      String(reference.businessId) ===
      String(businessId)
    );
  });

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

/**
 * GET
 *
 * Returns team records, including services from team.services.
 *
 * Business document:
 * doctors: ["teamObjectId1", "teamObjectId2"]
 */
export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email || !session?.user?.id) {
      return response("Unauthorized", 401);
    }

    const { searchParams } = new URL(request.url);

    const businessId = searchParams.get("businessId");
    const category = searchParams.get("category");

    if (!businessId || !category) {
      return response("Business ID and category are required", 400);
    }

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB);

    const result = await getOwnedBusiness(
      db,
      session,
      businessId,
      category
    );

    if (result.error) {
      return result.error;
    }

    const business = result.business;
    const ownerId = result.ownerId;

    // Get the correct member array from the business document.
    const field = teamField(category);

    const storedIds = Array.isArray(business[field])
      ? business[field]
      : [];

    // Normalize member IDs to strings and remove duplicates.
    const memberIds = [
      ...new Set(
        storedIds
          .map(getMemberId)
          .filter((id) => ObjectId.isValid(id))
      ),
    ];

    if (!memberIds.length) {
      return NextResponse.json({
        success: true,
        team: [],
        total: 0,
      });
    }

    // Match ObjectId and string representations of ownerId
    // and clinicId to support existing MongoDB records.
    const ownerIdString = String(ownerId);
    const businessObjectId = business._id;
    const businessObjectIdString = String(business._id);

    const ownerIdValues = [ownerIdString];

    if (ObjectId.isValid(ownerIdString)) {
      ownerIdValues.push(new ObjectId(ownerIdString));
    }

    const businessIdValues = [businessObjectIdString];

    if (ObjectId.isValid(businessObjectIdString)) {
      businessIdValues.push(
        new ObjectId(businessObjectIdString)
      );
    }

    const accounts = await db
      .collection("team")
      .find({
        _id: {
          $in: memberIds.map((id) => new ObjectId(id)),
        },
        ownerId: {
          $in: ownerIdValues,
        },
        clinicId: {
          $in: businessIdValues,
        },
        category,
      })
      .toArray();

    // Preserve the member order from the business document.
    const accountsById = new Map(
      accounts.map((account) => [
        String(account._id),
        account,
      ])
    );

    const team = memberIds
      .map((id) => accountsById.get(id))
      .filter(Boolean)
      .map((account) => ({
        ...serializeMember(account),
        email: account.email ?? "",
        phone: account.phone ?? "",
        services: cleanServices(account.services),
        role: account.role ?? "",
        category,
        isActive: account.isActive ?? true,
        mustChangePassword:
          account.mustChangePassword ?? false,

        // Retained for compatibility with the existing UI.
        temporaryPassword: account.password ?? null,
      }));

    return NextResponse.json({
      success: true,
      team,
      total: team.length,
    });
  } catch (error) {
    console.error("GET owner team error:", error);

    return response("Failed to load team members", 500);
  }
}

/**
 * POST
 *
 * 1. Insert the complete member into team.
 * 2. Get the inserted ID.
 * 3. Store only that ID string in doctors[] or staff[].
 */

function normalizeMemberServices(member, category) {
  const isDoctor = category === "clinic";

  if (isDoctor) {
    const fee = Number(member.fee);

    if (!Number.isFinite(fee) || fee < 0) {
      return {
        error: "Invalid consultation charge.",
      };
    }

    return {
      member: {
        ...member,
        fee,
        services: [
          {
            name: "General Consultation",
            charge: fee,
          },
        ],
      },
    };
  }

  const services = Array.isArray(member.services)
    ? member.services.map((service) => ({
        name: cleanString(service?.name, 100),
        charge: Number(service?.charge),
      }))
    : [];

  if (
    services.some(
      (service) =>
        !service.name ||
        !Number.isFinite(service.charge) ||
        service.charge < 0
    )
  ) {
    return {
      error: "Each staff service needs a valid name and charge.",
    };
  }

  return {
    member: {
      ...member,
      services,
    },
  };
}

export async function POST(request) {
  let db;
  let insertedTeamId = null;
  let businessUpdated = false;
  let ownerId = null;
  let category = null;
  let businessObjectId = null;
  let field = null;

  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email || !session?.user?.id) {
      return response("Unauthorized", 401);
    }

    const body = await request.json();

    const businessId = cleanString(
      body.businessId,
      100
    );

    category = cleanString(body.category, 50);

    if (
      !businessId ||
      !ObjectId.isValid(businessId) ||
      !Object.hasOwn(CATEGORIES, category)
    ) {
      return response(
        "Invalid business ID or category",
        400
      );
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

  let member = cleanMember(body, category);

const normalized = normalizeMemberServices(
  member,
  category
);

if (normalized.error) {
  return response(normalized.error, 400);
}

member = normalized.member;

const validationError = validateMember(
  member,
  category
);

if (validationError) {
  return response(validationError, 400);
}

    const now = new Date();
    const temporaryPassword =
      generateTemporaryPassword();

    // Profile, services and schedule are saved in team.
    const teamRecord = {
      ...member,
      ownerId,
      clinicId: businessObjectId,
      name: member.name,
      email: member.email || null,
      phone: member.phone || null,
      role: getTeamRole(member, category),
      category,
        businessName:result.business.name,
      password: temporaryPassword,
      isActive: true,
      mustChangePassword: true,
      createdAt: now,
      updatedAt: now,
    };

    const teamInsert = await db
      .collection("team")
      .insertOne(teamRecord);

    insertedTeamId = teamInsert.insertedId;

    const memberId = insertedTeamId.toString();

    // Store only the ID string in the business document.
    const updateResult = await db
      .collection(CATEGORIES[category])
      .updateOne(
        {
          _id: businessObjectId,
          ownerId,
        },
        {
          $addToSet: {
            [field]: memberId,
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
        member: serializeMember({
          ...teamRecord,
          _id: insertedTeamId,
        }),
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
          category &&
          CATEGORIES[category]
        ) {
          await db
            .collection(CATEGORIES[category])
            .updateOne(
              {
                _id: businessObjectId,
                ownerId,
              },
              {
                $pull: {
                  [field]: insertedTeamId.toString(),
                },
              }
            );
        }

        await db.collection("team").deleteOne({
          _id: insertedTeamId,
          ownerId,
        });
      } catch (cleanupError) {
        console.error(
          "Team account cleanup failed:",
          cleanupError
        );
      }
    }

    console.error("POST owner team error:", error);

    return response(
      "Failed to add team member",
      500
    );
  }
}

/**
 * PUT
 *
 * Updates member profile, services and schedule in team.
 * The business array continues to store only the ID.
 */
export async function PUT(request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email || !session?.user?.id) {
      return response("Unauthorized", 401);
    }

    const body = await request.json();
     
    

    const businessId = cleanString(
      body.businessId,
      100
    );

    const category = cleanString(body.category, 50);

    const memberId = cleanString(
      body._id || body.id,
      150
    );

    if (
      !businessId ||
      !ObjectId.isValid(businessId) ||
      !Object.hasOwn(CATEGORIES, category)
    ) {
      return response(
        "Invalid business ID or category",
        400
      );
    }

    if (!ObjectId.isValid(memberId)) {
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

    const storedIds = Array.isArray(
      result.business[field]
    )
      ? result.business[field]
      : [];

    const isLinked = storedIds.some(
      (item) => getMemberId(item) === memberId
    );

    if (!isLinked) {
      return response(
        "Team member not found in this business",
        404
      );
    }

    const existingAccount = await getTeamAccount(
      db,
      memberId,
      ownerId,
      businessObjectId,
      category
    );

    if (!existingAccount) {
      return response("Team account not found", 404);
    }

  let member = cleanMember(body, category);

const normalized = normalizeMemberServices(
  member,
  category
);

if (normalized.error) {
  return response(normalized.error, 400);
}

member = normalized.member;

const validationError = validateMember(
  member,
  category
);

if (validationError) {
  return response(validationError, 400);
}

    const now = new Date();

    const updatedMember = {
      ...member,
      ownerId,
      clinicId: businessObjectId,
      category,
      role: getTeamRole(member, category),
      updatedAt: now,
    };

    const updateResult = await db
      .collection("team")
      .updateOne(
        {
          _id: new ObjectId(memberId),
          ownerId,
          clinicId: businessObjectId,
          category,
        },
        {
          $set: updatedMember,
        }
      );

    if (!updateResult.matchedCount) {
      return response("Team account not found", 404);
    }

    return NextResponse.json({
      success: true,
      message: "Team member updated successfully",
      member: serializeMember({
        ...existingAccount,
        ...updatedMember,
        _id: new ObjectId(memberId),
      }),
    });
  } catch (error) {
    console.error("PUT owner team error:", error);

    return response(
      "Failed to update team member",
      500
    );
  }
}

/**
 * DELETE
 *
 * Remove the ID from the business array and delete
 * the corresponding team account.
 */
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

    if (
      !businessId ||
      !ObjectId.isValid(businessId) ||
      !Object.hasOwn(CATEGORIES, category)
    ) {
      return response(
        "Invalid business ID or category",
        400
      );
    }

    if (!ObjectId.isValid(memberId)) {
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

    const storedIds = Array.isArray(
      result.business[field]
    )
      ? result.business[field]
      : [];

    const isLinked = storedIds.some(
      (item) => getMemberId(item) === memberId
    );

    if (!isLinked) {
      return response("Team member not found", 404);
    }

    const now = new Date();

    // Remove both string IDs and legacy object entries.
    const pullResult = await db
      .collection(CATEGORIES[category])
      .updateOne(
        {
          _id: businessObjectId,
          ownerId,
        },
        {
          $pull: {
            [field]: {
              $in: [
                memberId,
                { id: memberId },
                { _id: memberId },
              ],
            },
          },
          $set: {
            updatedAt: now,
          },
        }
      );

    if (!pullResult.matchedCount) {
      return response("Business not found", 404);
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

    await db
      .collection(CATEGORIES[category])
      .updateOne(
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
      accountDeleted:
        accountDeleteResult.deletedCount > 0,
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
