
import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import clientPromise from "@/lib/mongodb";
import { getAdminSession } from "@/lib/admin-auth";

 
export async function GET(req) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search")?.trim() || "";
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const limit = Math.min(50, Math.max(1, Number(searchParams.get("limit")) || 20));

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB || "rahul");
    const users = db.collection("users");

    const filter = search
      ? {
          $or: [
            { name: { $regex: search, $options: "i" } },
            { fullName: { $regex: search, $options: "i" } },
            { email: { $regex: search, $options: "i" } },
            { phone: { $regex: search, $options: "i" } },
            { mobile: { $regex: search, $options: "i" } },
          ],
        }
      : {};

    const [data, total] = await Promise.all([
      users.find(filter)
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
      users.countDocuments(filter),
    ]);

    return NextResponse.json({
      success: true,
      users: data.map((user) => ({
        ...user,
        _id: user._id.toString(),
        name: user.name || user.fullName || "Unknown",
        email: user.email || "",
        phone: user.phone || user.mobile || "",
        status: user.status || (user.isActive === false ? "suspended" : "active"),
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Admin users GET:", error);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}

export async function PATCH(req) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
    }

    const { id, action } = await req.json();

    if (!ObjectId.isValid(id) || !["suspend", "activate"].includes(action)) {
      return NextResponse.json({ message: "Invalid request" }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB || "rahul");

    const result = await db.collection("users").updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          isActive: action === "activate",
          status: action === "activate" ? "active" : "suspended",
          updatedAt: new Date(),
        },
      }
    );

    if (!result.matchedCount) {
      return NextResponse.json({ message: "User not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: `User ${action === "activate" ? "activated" : "suspended"}`,
    });
  } catch (error) {
    console.error("Admin users PATCH:", error);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}
