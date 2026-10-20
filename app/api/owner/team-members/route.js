 
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { ObjectId } from "mongodb";
import clientPromise from "@/lib/mongodb";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

const CATEGORIES = {
  clinic: "clinics",
  saloon: "saloons",
  "beauty-parlour": "parlour",
  "diagnostic-centre": "diagnostic",
};

function json(data, status = 200) {
  return NextResponse.json(data, { status });
}

function normalizeId(value) {
  if (value == null) return "";
  return String(value);
}

function getOwnerQuery(session) {
  const conditions = [];

  if (session.user.id) {
    conditions.push({ ownerId: session.user.id });
    conditions.push({ userId: session.user.id });
    conditions.push({ createdBy: session.user.id });

    if (ObjectId.isValid(session.user.id)) {
      const objectId = new ObjectId(session.user.id);

      conditions.push({ ownerId: objectId });
      conditions.push({ userId: objectId });
      conditions.push({ createdBy: objectId });
    }
  }

  if (session.user.email) {
    conditions.push({
      ownerEmail: session.user.email.toLowerCase(),
    });
    conditions.push({
      email: session.user.email.toLowerCase(),
    });
  }

  return conditions.length ? { $or: conditions } : null;
}

function getMemberType(member, category) {
  const explicitType = String(
    member.type ||
      member.memberType ||
      member.designation ||
      member.role ||
      ""
  ).toLowerCase();

  if (explicitType.includes("doctor")) return "doctor";

  if (
    explicitType.includes("staff") ||
    explicitType.includes("receptionist") ||
    explicitType.includes("assistant") ||
    explicitType.includes("nurse")
  ) {
    return "staff";
  }

  return category === "clinic" ? "doctor" : "staff";
}

function normalizeMember(member, business, category) {
  const businessId = normalizeId(business._id);

  return {
    ...member,
    id: normalizeId(member.id || member._id),
    _id: normalizeId(member._id || member.id),
    name:
      member.name ||
      member.fullName ||
      member.doctorName ||
      member.staffName ||
      "",
    type: getMemberType(member, category),
    category,
    businessId,
    businessName:
      business.name ||
      business.shopName ||
      business.businessName ||
      business.clinicName ||
      "Business",
    shopName:
      business.shopName ||
      business.name ||
      business.businessName ||
      "",
    phone: member.phone || member.mobile || member.phoneNumber || "",
    email: member.email || "",
    specialization:
      member.specialization ||
      member.speciality ||
      member.department ||
      "",
    role: member.role || member.designation || "",
  };
}

export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id || !session?.user?.email) {
      return json(
        { success: false, message: "Please log in to view your team." },
        401
      );
    }

    const { searchParams } = new URL(request.url);
    const requestedBusinessId = searchParams.get("businessId");
    const requestedCategory = searchParams.get("category");
    const all = searchParams.get("all") === "true";

    if (
      requestedCategory &&
      !Object.prototype.hasOwnProperty.call(CATEGORIES, requestedCategory)
    ) {
      return json(
        { success: false, message: "Invalid business category." },
        400
      );
    }

    if (requestedBusinessId && !ObjectId.isValid(requestedBusinessId)) {
      return json(
        { success: false, message: "Invalid business ID." },
        400
      );
    }

    const ownerQuery = getOwnerQuery(session);

    if (!ownerQuery) {
      return json({ success: true, team: [] });
    }

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB);

    const categories = requestedCategory
      ? [requestedCategory]
      : Object.keys(CATEGORIES);

    const team = [];

    for (const category of categories) {
      const collectionName = CATEGORIES[category];
      const collection = db.collection(collectionName);

      const businessQuery = { ...ownerQuery };

      if (requestedBusinessId) {
        businessQuery._id = new ObjectId(requestedBusinessId);
      }

      const businesses = await collection
        .find(businessQuery)
        .toArray();

      for (const business of businesses) {
        const businessId = normalizeId(business._id);

        // Do not expose members from businesses the owner does not own.
        if (
          requestedBusinessId &&
          businessId !== requestedBusinessId
        ) {
          continue;
        }

        const members = Array.isArray(business.teamMembers)
          ? business.teamMembers
          : [];

        for (const member of members) {
          team.push(normalizeMember(member, business, category));
        }

        // Clinics may store doctors separately from staff.
        if (category === "clinic" && Array.isArray(business.doctors)) {
          for (const doctor of business.doctors) {
            team.push(
              normalizeMember(
                { ...doctor, type: "doctor" },
                business,
                category
              )
            );
          }
        }
      }
    }

    // Remove duplicates when a document appears in both arrays.
    const uniqueTeam = Array.from(
      new Map(
        team.map((member) => [
          `${member.businessId}:${member.id || member.name}`,
          member,
        ])
      ).values()
    );

    return json({
      success: true,
      team: uniqueTeam,
      total: uniqueTeam.length,
    });
  } catch (error) {
    console.error("GET /api/owner/team-members error:", error);

    return json(
      {
        success: false,
        message: "Unable to load team members.",
      },
      500
    );
  }
}
