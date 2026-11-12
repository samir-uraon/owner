
import { NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";
import { getAdminSession } from "@/lib/admin-auth";

 

const PRIVATE_FIELDS = {
  password: 0,
  passwordHash: 0,
  otp: 0,
  otpHash: 0,
  verificationToken: 0,
  resetToken: 0,
};

function getName(member) {
  return (
    member.fullName ||
    member.name ||
    member.displayName ||
    member.employeeName ||
    "Unnamed member"
  );
}

function getPhone(member) {
  return member.mobile || member.phone || member.phoneNumber || "";
}

function getEmail(member) {
  return member.email || member.emailAddress || "";
}

function getStatus(member) {
  if (member.isActive === false || member.status === "inactive") {
    return "Inactive";
  }

  if (member.isSuspended === true || member.status === "suspended") {
    return "Suspended";
  }

  return member.status || "Active";
}

export async function GET(req) {
  try {
    const admin = await getAdminSession();

    if (!admin) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);

    const search = searchParams.get("search")?.trim() || "";
    const role = searchParams.get("role") || "all";
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const limit = Math.min(
      50,
      Math.max(1, Number(searchParams.get("limit")) || 10)
    );

    if (!["all", "doctor", "staff"].includes(role)) {
      return NextResponse.json(
        { success: false, message: "Invalid role" },
        { status: 400 }
      );
    }

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB || "rahul");

    const filter = {
      role: role === "all" ? { $in: ["doctor", "staff"] } : role,
    };

    if (search) {
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = { $regex: escaped, $options: "i" };

      filter.$or = [
        { name: regex },
        { fullName: regex },
        { displayName: regex },
        { employeeName: regex },
        { email: regex },
        { emailAddress: regex },
        { mobile: regex },
        { phone: regex },
        { phoneNumber: regex },
        { role: regex },
      ];
    }

    const collection = db.collection("team");

    const total = await collection.countDocuments(filter);

    const members = await collection
      .find(filter, { projection: PRIVATE_FIELDS })
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .toArray();

    const result = members.map((member) => ({
      id: member._id.toString(),
      name: getName(member),
      email: getEmail(member),
      phone: getPhone(member),
      role: member.role || "staff",
      status: getStatus(member),
      businessId:
        member.businessId?.toString?.() ||
        member.clinicId?.toString?.() ||
        "",
      createdAt: member.createdAt || member.joinedAt || null,
    }));

    return NextResponse.json({
      success: true,
      members: result,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Admin team members API error:", error);

    return NextResponse.json(
      { success: false, message: "Failed to load team members" },
      { status: 500 }
    );
  }
}
