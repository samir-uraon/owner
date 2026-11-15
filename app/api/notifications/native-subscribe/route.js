
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { ObjectId } from "mongodb";

import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import clientPromise from "@/lib/mongodb";

export const runtime = "nodejs";
export const revalidate = 0;

const ROLE_COLLECTIONS = {
  user: "users",
  doctor: "team",
  staff: "team",
};

export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const role = session.user.role;
    const collectionName = ROLE_COLLECTIONS[role];

    if (!collectionName) {
      return NextResponse.json(
        { success: false, message: "Role not authorized" },
        { status: 403 }
      );
    }

    const userId = session.user.id || session.user._id;

    if (!userId || !ObjectId.isValid(String(userId))) {
      return NextResponse.json(
        { success: false, message: "Invalid account ID" },
        { status: 400 }
      );
    }

    const { token } = await request.json();

    if (
      typeof token !== "string" ||
      token.length > 512 ||
      !/^(Expo(nent)?PushToken)\[[^\]]+\]$/.test(token)
    ) {
      return NextResponse.json(
        { success: false, message: "Invalid Expo push token" },
        { status: 400 }
      );
    }

    const client = await clientPromise;
    const db = client.db("rahul");
    const collection = db.collection(collectionName);

    const accountFilter = {
      _id: new ObjectId(String(userId)),
    };

    // Avoid storing duplicate tokens for the same account.
    await collection.updateOne(accountFilter, {
      $pull: {
        expoPushTokens: { token },
      },
    });

    const result = await collection.updateOne(accountFilter, {
      $push: {
        expoPushTokens: {
          token,
          platform: "expo",
          updatedAt: new Date(),
        },
      },
      $set: {
        expoPushEnabled: true,
        expoPushUpdatedAt: new Date(),
      },
    });

    if (!result.matchedCount) {
      return NextResponse.json(
        { success: false, message: "Account not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Native push token saved successfully",
      role,
    });
  } catch (error) {
    console.error("Native push subscription error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Unable to save native push token",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const collectionName = ROLE_COLLECTIONS[session.user.role];
    const userId = session.user.id || session.user._id;

    if (!collectionName || !userId || !ObjectId.isValid(String(userId))) {
      return NextResponse.json(
        { success: false, message: "Invalid account" },
        { status: 400 }
      );
    }

    const { token } = await request.json();

    if (typeof token !== "string" || !token) {
      return NextResponse.json(
        { success: false, message: "Token is required" },
        { status: 400 }
      );
    }

    const client = await clientPromise;
    const db = client.db("rahul");

    const result = await db.collection(collectionName).updateOne(
      { _id: new ObjectId(String(userId)) },
      {
        $pull: {
          expoPushTokens: { token },
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
      message: "Native push token removed successfully",
    });
  } catch (error) {
    console.error("Native push unsubscribe error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Unable to remove native push token",
      },
      { status: 500 }
    );
  }
}
