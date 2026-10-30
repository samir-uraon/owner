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

const COLLECTION_CATEGORIES = {
  clinics: "clinic",
  saloons: "saloon",
  parlour: "beauty-parlour",
  diagnostic: "diagnostic-centre",
};

function json(data, status = 200) {
  return NextResponse.json(data, { status });
}

function normalizeId(value) {
  return value == null ? "" : String(value);
}

function getMemberType(member, category) {
  const role = String(
    member.type ||
      member.memberType ||
      member.designation ||
      member.role ||
      ""
  ).toLowerCase();

  if (role.includes("doctor")) return "doctor";

  if (
    role.includes("staff") ||
    role.includes("receptionist") ||
    role.includes("assistant") ||
    role.includes("nurse")
  ) {
    return "staff";
  }

  return category === "clinic" ? "doctor" : "staff";
}

function normalizeMember(member, business, category, businessId) {
  return {
    ...member,
    id: normalizeId(member._id || member.id),
    _id: normalizeId(member._id || member.id),
    name:
      member.fullName ||
      member.name ||
      member.doctorName ||
      member.staffName ||
      "",
    type: getMemberType(member, category),
    category,
    businessId,
    businessName:
      business?.name ||
      business?.shopName ||
      business?.businessName ||
      business?.clinicName ||
      member.businessName ||
      member.clinicName ||
      "Business",
    shopName:
      business?.shopName ||
      business?.name ||
      business?.businessName ||
      "",
    phone:
      member.phone ||
      member.mobile ||
      member.phoneNumber ||
      "",
    email: member.email || member.emailAddress || "",
    specialization:
      member.specialization ||
      member.speciality ||
      member.department ||
      "",
    role: member.role || member.designation || "",
    experience: member.experience || member.yearsOfExperience || null,
    fee: member.fee || member.consultationFee || member.price || null,
  };
}

function normalizeCustomer(record) {
  return {
    id: normalizeId(record._id || record.id),
    customerName:
      record.patientName ||
      record.customerName ||
      record.userName ||
      record.name ||
      "Guest Customer",
    phone:
      record.patientPhone ||
      record.customerPhone ||
      record.phone ||
      record.mobile ||
      "",
    email:
      record.patientEmail ||
      record.customerEmail ||
      record.email ||
      "",
    date: record.appointmentDate || record.bookingDate || record.date || null,
    time: record.appointmentTime || record.bookingTime || record.time || "",
    status: record.status || "confirmed",
    serviceName: record.serviceName || record.service || record.treatment || "",
    amount: record.amount || record.fee || record.price || null,
  };
}

export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return json(
        {
          success: false,
          message: "Please log in to view team details.",
        },
        401
      );
    }

    if (session.user.role && session.user.role !== "owner") {
      return json(
        {
          success: false,
          message: "Only owners can view team members.",
        },
        403
      );
    }

    const { searchParams } = new URL(request.url);
    const requestedMemberId = searchParams.get("memberId");
    const requestedBusinessId = searchParams.get("businessId");
    const requestedCategory = searchParams.get("category");

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

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB);

    const owners = db.collection("owners");
    const teamCollection = db.collection("team");

    // 1. Authenticate owner
    const ownerConditions = [{ _id: session.user.id }];
    if (ObjectId.isValid(session.user.id)) {
      ownerConditions.push({ _id: new ObjectId(session.user.id) });
    }

    const owner = await owners.findOne({ $or: ownerConditions });

    if (!owner) {
      return json(
        {
          success: false,
          message: "Owner account not found.",
        },
        404
      );
    }

    // 2. Read business references from the owner document
    const ownerBusinesses = Array.isArray(owner.business)
      ? owner.business
      : [];

    const linkedBusinesses = ownerBusinesses
      .filter((item) => item && typeof item === "object")
      .map((item) => {
        const businessId = normalizeId(item.businessId);
        const collection = String(item.collection || "").toLowerCase();
        const category = COLLECTION_CATEGORIES[collection];

        return {
          businessId,
          collection,
          category,
        };
      })
      .filter((item) => {
        if (!item.businessId || !item.category) return false;

        if (
          requestedBusinessId &&
          item.businessId !== requestedBusinessId
        ) {
          return false;
        }

        if (
          requestedCategory &&
          item.category !== requestedCategory
        ) {
          return false;
        }

        return true;
      });

    if (linkedBusinesses.length === 0) {
      return json({
        success: true,
        team: [],
        total: 0,
      });
    }

    // 3. FETCH SINGLE MEMBER PROFILE & ASSIGNED CUSTOMERS
    if (requestedMemberId) {
      const memberIdValues = [requestedMemberId];
      if (ObjectId.isValid(requestedMemberId)) {
        memberIdValues.push(new ObjectId(requestedMemberId));
      }

      const rawMember = await teamCollection.findOne({
        _id: { $in: memberIdValues },
      });

      if (!rawMember) {
        return json(
          { success: false, message: "Team member not found." },
          404
        );
      }

      const memberBusinessId = normalizeId(
        rawMember.clinicId || rawMember.businessId
      );

      // Validate owner access
      const authorizedBusiness = linkedBusinesses.find(
        (b) => b.businessId === memberBusinessId
      );

      if (!authorizedBusiness) {
        return json(
          {
            success: false,
            message: "You are not authorized to view this team member.",
          },
          403
        );
      }

      const { collection, category } = authorizedBusiness;
      let business = {};

      if (ObjectId.isValid(memberBusinessId)) {
        business =
          (await db
            .collection(collection)
            .findOne({ _id: new ObjectId(memberBusinessId) })) || {};
      }

      const normalizedMemberProfile = normalizeMember(
        rawMember,
        business,
        category,
        memberBusinessId
      );

      // Search appointments & bookings for customers handled by this member
      const appointmentQuery = {
        $or: [
          { doctorId: { $in: memberIdValues } },
          { staffId: { $in: memberIdValues } },
          { memberId: { $in: memberIdValues } },
        ],
      };

      const [appointments, bookings] = await Promise.all([
        db.collection("appointments").find(appointmentQuery).toArray(),
        db.collection("bookings").find(appointmentQuery).toArray(),
      ]);

      const customers = [...appointments, ...bookings].map(normalizeCustomer);

      return json({
        success: true,
        member: normalizedMemberProfile,
        customers,
        totalCustomers: customers.length,
      });
    }

    // 4. FETCH ALL TEAM MEMBERS
    const team = [];
    const businessCache = new Map();

    for (const linkedBusiness of linkedBusinesses) {
      const { businessId, collection, category } = linkedBusiness;

      const businessIdValues = [businessId];
      if (ObjectId.isValid(businessId)) {
        businessIdValues.push(new ObjectId(businessId));
      }

      const memberQuery = {
        $or: [
          { clinicId: { $in: businessIdValues } },
          { businessId: { $in: businessIdValues } },
        ],
      };

      const members = await teamCollection.find(memberQuery).toArray();

      let business = {};

      if (ObjectId.isValid(businessId)) {
        const cacheKey = `${collection}:${businessId}`;

        if (!businessCache.has(cacheKey)) {
          const businessDocument = await db
            .collection(collection)
            .findOne({
              _id: new ObjectId(businessId),
            });

          businessCache.set(
            cacheKey,
            businessDocument || {}
          );
        }

        business = businessCache.get(cacheKey);
      }

      for (const member of members) {
        const memberBusinessId = normalizeId(
          member.clinicId || member.businessId
        );

        if (memberBusinessId !== businessId) {
          continue;
        }

        team.push(
          normalizeMember(
            member,
            business,
            category,
            businessId
          )
        );
      }
    }

    // Remove duplicates
    const uniqueTeam = Array.from(
      new Map(
        team.map((member) => [
          `${member.businessId}:${member.id}`,
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