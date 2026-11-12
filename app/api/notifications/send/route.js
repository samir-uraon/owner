
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import clientPromise from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import webpush from "web-push";

 

// VAPID configuration
const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY?.trim();
const vapidSubject = process.env.VAPID_SUBJECT?.trim();

const vapidConfigured = Boolean(
  vapidPublicKey && vapidPrivateKey && vapidSubject
);

if (vapidConfigured) {
  webpush.setVapidDetails(
    vapidSubject,
    vapidPublicKey,
    vapidPrivateKey
  );
}

export async function POST(request) {
  try {
    // 1. Authenticate sender
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const allowedRoles = ["owner", "staff", "doctor"];

    if (!allowedRoles.includes(session.user.role)) {
      return NextResponse.json(
        {
          success: false,
          message: "You are not authorized to send notifications",
        },
        { status: 403 }
      );
    }

    // 2. Check VAPID configuration
    if (!vapidConfigured) {
      return NextResponse.json(
        {
          success: false,
          message: "VAPID configuration is missing",
        },
        { status: 500 }
      );
    }

    // 3. Read request
    const { userId, title, message, url } = await request.json();

    if (!userId || !title || !message) {
      return NextResponse.json(
        { success: false, message: "Missing required fields" },
        { status: 400 }
      );
    }

    if (!ObjectId.isValid(String(userId))) {
      return NextResponse.json(
        { success: false, message: "Invalid user ID" },
        { status: 400 }
      );
    }

    if (
      typeof title !== "string" ||
      typeof message !== "string" ||
      !title.trim() ||
      !message.trim() ||
      title.length > 120 ||
      message.length > 1000
    ) {
      return NextResponse.json(
        { success: false, message: "Invalid notification content" },
        { status: 400 }
      );
    }

    const notificationUrl =
      typeof url === "string" &&
      url.startsWith("/") &&
      !url.startsWith("//")
        ? url
        : "/my-bookings";

    // 4. Database
    const client = await clientPromise;
    const db = client.db("rahul");

    const users = db.collection("users");

    // 5. Find recipient
    const recipient = await users.findOne({
      _id: new ObjectId(String(userId)),
    });

    if (!recipient) {
      return NextResponse.json(
        { success: false, message: "Patient not found" },
        { status: 404 }
      );
    }

    // 6. Save notification
    const notification = {
      userId: new ObjectId(String(userId)),
      title: title.trim(),
      message: message.trim(),
      url: notificationUrl,
      read: false,
      createdAt: new Date(),
      sentBy: String(
        session.user.id || session.user._id || ""
      ),
    };

    const result = await db
      .collection("notifications")
      .insertOne(notification);

    // 7. Read subscription
    const subscription = recipient.webPushSubscription;

    if (
      !recipient.webPushEnabled ||
      !subscription?.endpoint ||
      !subscription?.keys?.p256dh ||
      !subscription?.keys?.auth
    ) {
      return NextResponse.json({
        success: true,
        pushSent: false,
        message: "Notification saved, but push subscription is missing",
        notificationId: result.insertedId.toString(),
      });
    }

    // 8. Verify subscription structure
    if (
      typeof subscription.endpoint !== "string" ||
      typeof subscription.keys.p256dh !== "string" ||
      typeof subscription.keys.auth !== "string"
    ) {
      return NextResponse.json({
        success: true,
        pushSent: false,
        message: "Notification saved, but subscription format is invalid",
        notificationId: result.insertedId.toString(),
      });
    }

    // 9. Payload
    const payload = JSON.stringify({
      title: notification.title,
      body: notification.message,
      url: notification.url,
      icon: "/logo.png",
      badge: "/logo.png",
      notificationId: result.insertedId.toString(),
    });

    // 10. Send push
    try {
      console.log("========== WEB PUSH DEBUG ==========");
      console.log("Recipient:", String(userId));
      console.log(
        "Subscription origin:",
        new URL(subscription.endpoint).origin
      );
      console.log("VAPID public key configured:", Boolean(vapidPublicKey));
      console.log("VAPID private key configured:", Boolean(vapidPrivateKey));
      console.log("Subscription keys present:", Boolean(
        subscription.keys.p256dh && subscription.keys.auth
      ));

      const pushResponse = await webpush.sendNotification(
        subscription,
        payload,
        {
          TTL: 3600,
          urgency: "high",
        }
      );

      console.log("Push response status:", pushResponse.statusCode);
      console.log("Push notification sent successfully");
      console.log("====================================");

      return NextResponse.json({
        success: true,
        pushSent: true,
        message: "Notification saved and push sent successfully",
        notificationId: result.insertedId.toString(),
      });

    } catch (pushError) {
      console.error("========== WEB PUSH ERROR ==========");
      console.error("Error name:", pushError.name);
      console.error("Error message:", pushError.message);
      console.error("Status code:", pushError.statusCode);
      console.error("Response body:", pushError.body);
      console.error("Response headers:", pushError.headers);
      console.error("====================================");

      // Remove expired subscription
      if (
        pushError.statusCode === 404 ||
        pushError.statusCode === 410
      ) {
        await users.updateOne(
          {
            _id: new ObjectId(String(userId)),
            "webPushSubscription.endpoint": subscription.endpoint,
          },
          {
            $unset: {
              webPushSubscription: "",
            },
            $set: {
              webPushEnabled: false,
            },
          }
        );
      }

      let errorMessage = "Unable to deliver push notification";

      if (pushError.statusCode === 400) {
        errorMessage = "Invalid push subscription or payload";
      } else if (pushError.statusCode === 401) {
        errorMessage = "Push authentication failed. Check VAPID keys";
      } else if (pushError.statusCode === 403) {
        errorMessage = "Push service rejected authentication";
      } else if (pushError.statusCode === 404 ||
                 pushError.statusCode === 410) {
        errorMessage = "Push subscription expired or invalid";
      }

      return NextResponse.json({
        success: true,
        pushSent: false,
        message: "Notification saved, but push delivery failed",
        notificationId: result.insertedId.toString(),
        pushError: errorMessage,
        debug: {
          statusCode: pushError.statusCode || null,
          errorName: pushError.name || null,
          errorDetails: pushError.body || pushError.message || null,
        },
      });
    }

  } catch (error) {
    console.error("Send notification API error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Internal server error",
        error: error.message,
      },
      { status: 500 }
    );
  }
}
