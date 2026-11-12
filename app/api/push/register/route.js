
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { ObjectId } from "mongodb";
import clientPromise from "@/lib/mongodb";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

 

function getAccountCollection(role) {
  if (role === "owner") return "owners";

  if (role === "doctor" || role === "staff") {
    return "team";
  }

  return "users";
}

function getAccountFilter(id) {
  const filters = [{ _id: id }];

  if (ObjectId.isValid(String(id))) {
    filters.push({ _id: new ObjectId(String(id)) });
  }

  return { $or: filters };
}

function isValidExpoToken(token) {
  return (
    typeof token === "string" &&
    /^Expo(nent)?PushToken\[[A-Za-z0-9_-]+\]$/.test(token)
  );
}

export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, message: "Please sign in first" },
        { status: 401 }
      );
    }

    const { token } = await request.json();

    if (!isValidExpoToken(token)) {
      return NextResponse.json(
        { success: false, message: "Invalid Expo push token" },
        { status: 400 }
      );
    }

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB || "rahul");

    const collection = db.collection(
      getAccountCollection(session.user.role)
    );

    const result = await collection.updateOne(
      getAccountFilter(session.user.id),
      {
        $addToSet: {
          expoPushTokens: token,
        },
        $set: {
          pushTokenUpdatedAt: new Date(),
        },
      }
    );

    if (!result.matchedCount) {
      return NextResponse.json(
        {
          success: false,
          message: "Account not found. Please sign in again.",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Push token registered successfully",
    });
  } catch (error) {
    console.error("PUSH_TOKEN_REGISTER_ERROR:", error);

    return NextResponse.json(
      { success: false, message: "Failed to register push token" },
      { status: 500 }
    );
  }
}

export async function DELETE(request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, message: "Please sign in first" },
        { status: 401 }
      );
    }

    const { token } = await request.json();

    if (!isValidExpoToken(token)) {
      return NextResponse.json(
        { success: false, message: "Invalid Expo push token" },
        { status: 400 }
      );
    }

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB || "rahul");

    const collection = db.collection(
      getAccountCollection(session.user.role)
    );

    await collection.updateOne(
      getAccountFilter(session.user.id),
      {
        $pull: {
          expoPushTokens: token,
        },
        $set: {
          pushTokenUpdatedAt: new Date(),
        },
      }
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("PUSH_TOKEN_REMOVE_ERROR:", error);

    return NextResponse.json(
      { success: false, message: "Failed to remove push token" },
      { status: 500 }
    );
  }
}
