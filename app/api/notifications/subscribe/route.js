
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { ObjectId } from "mongodb";

import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import clientPromise from "@/lib/mongodb";

 
const ROLE_COLLECTIONS = {
 
  doctor: "team",
  staff: "team",
};

export async function POST(request) {
  try {
    // 1. Authenticate
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    // 2. Determine collection
    const role = session.user.role;
    const collectionName = ROLE_COLLECTIONS[role];

    if (!collectionName) {
      return NextResponse.json(
        { success: false, message: "Role not authorized" },
        { status: 403 }
      );
    }

    // 3. Validate ID
    const userId = session.user.id || session.user._id;

    if (!userId || !ObjectId.isValid(String(userId))) {
      return NextResponse.json(
        { success: false, message: "Invalid user ID" },
        { status: 400 }
      );
    }

    // 4. Read subscription
    const subscription = await request.json();

    if (
      typeof subscription?.endpoint !== "string" ||
      !subscription.endpoint.startsWith("https://") ||
      typeof subscription?.keys?.p256dh !== "string" ||
      typeof subscription?.keys?.auth !== "string"
    ) {
      return NextResponse.json(
        { success: false, message: "Invalid push subscription" },
        { status: 400 }
      );
    }

    // 5. Database
    const client = await clientPromise;
    const db = client.db("rahul");

    const collection = db.collection(collectionName);

    // 6. Save subscription
    const result = await collection.updateOne(
      { _id: new ObjectId(String(userId)) },
      {
        $set: {
          webPushSubscription: subscription,
          webPushEnabled: true,
          webPushUpdatedAt: new Date(),
        },
      }
    );

    if (!result.matchedCount) {
      return NextResponse.json(
        { success: false, message: "Account not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Push notifications enabled successfully",
      role,
    });

  } catch (error) {
    console.error("Subscribe notification error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Unable to subscribe to notifications",
      },
      { status: 500 }
    );
  }
}
