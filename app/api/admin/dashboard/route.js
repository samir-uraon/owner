
import { NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";
import { getAdminSession } from "@/lib/admin-auth";

 export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const session = await getAdminSession();

    if (!session) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 403 }
      );
    }

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB || "rahul");

    const businessCollections = [
      "clinics",
      "saloons",
      "parlour",
      "diagnostic",
    ];

    const [
      totalUsers,
      totalOwners,
      businessCounts,
    ] = await Promise.all([
      db.collection("users").countDocuments(),
      db.collection("owners").countDocuments(),

      Promise.all(
        businessCollections.map((name) =>
          db.collection(name).countDocuments()
        )
      ),
    ]);

    const totalBusinesses = businessCounts.reduce(
      (total, count) => total + count,
      0
    );

    return NextResponse.json({
      success: true,
      statistics: {
        totalUsers,
        totalOwners,
        totalBusinesses,
        businesses: {
          clinics: businessCounts[0],
          saloons: businessCounts[1],
          parlour: businessCounts[2],
          diagnostic: businessCounts[3],
        },
      },
    });
  } catch (error) {
    console.error("Admin dashboard error:", error);

    return NextResponse.json(
      { success: false, message: "Unable to load dashboard" },
      { status: 500 }
    );
  }
}
