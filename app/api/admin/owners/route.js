
import { NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";
import { getAdminSession } from "@/lib/admin-auth";

 
export async function GET(req) {
  try {
    const session = await getAdminSession();

    if (!session) {
      return NextResponse.json(
        { message: "Unauthorized" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);

    const search = searchParams.get("search")?.trim() || "";
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const limit = Math.min(
      50,
      Math.max(1, Number(searchParams.get("limit")) || 20)
    );

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB || "rahul");

    const filter = search
      ? {
          $or: [
            { name: { $regex: search, $options: "i" } },
            { fullName: { $regex: search, $options: "i" } },
            { email: { $regex: search, $options: "i" } },
            { mobile: { $regex: search, $options: "i" } },
            { phone: { $regex: search, $options: "i" } },
          ],
        }
      : {};

    const [owners, total] = await Promise.all([
      db.collection("owners")
        .find(filter)
        .project({
          password: 0,
          passwordHash: 0,
          otp: 0,
          otpHash: 0,
          verificationToken: 0,
        })
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .toArray(),

      db.collection("owners").countDocuments(filter),
    ]);

    return NextResponse.json({
      success: true,

      owners: owners.map((owner) => ({
        _id: owner._id.toString(),
        name: owner.fullName || owner.name || "Unknown",
        email: owner.email || "",
        phone: owner.mobile || owner.phone || "",
        verified: owner.isVerified === true,
        configured: owner.isConfigured ?? false,
        createdAt: owner.createdAt || null,
        status: owner.adminSuspended
          ? "suspended"
          : owner.isVerified === true
            ? "active"
            : "pending",
      })),

      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Admin owners error:", error);

    return NextResponse.json(
      { message: "Unable to load owners" },
      { status: 500 }
    );
  }
}
