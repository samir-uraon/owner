
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import clientPromise from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import webpush from "web-push";

export const runtime = "nodejs";
export const revalidate = 0;

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

// VAPID configuration
const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY?.trim();
const vapidSubject = process.env.VAPID_SUBJECT?.trim();

const vapidConfigured = Boolean(
  vapidPublicKey && vapidPrivateKey && vapidSubject
);

if (vapidConfigured) {
  try {
    webpush.setVapidDetails(
      vapidSubject,
      vapidPublicKey,
      vapidPrivateKey
    );
  } catch (error) {
    console.error("VAPID configuration error:", error);
  }
}

// Send native Expo Push Notifications.
async function sendExpoPush(users, recipient, notification) {
  const tokens = Array.isArray(recipient.expoPushTokens)
    ? recipient.expoPushTokens
        .map((item) => item?.token)
        .filter(
          (token) =>
            typeof token === "string" &&
            /^(Expo(nent)?PushToken)\[[^\]]+\]$/.test(token)
        )
    : [];

  if (tokens.length === 0) {
    return {
      sent: false,
      sentCount: 0,
      reason: "No valid Expo push tokens registered",
    };
  }

  try {
    const payload = tokens.map((token) => ({
      to: token,
      sound: "default",
      title: notification.title,
      body: notification.message,
      priority: "high",
      channelId: "default",
      data: {
        url: notification.url,
        notificationId: notification.notificationId,
      },
    }));

    const response = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Accept-Encoding": "gzip, deflate",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json();

    if (!response.ok) {
      console.error("Expo Push HTTP error:", result);

      return {
        sent: false,
        sentCount: 0,
        reason: "Expo Push service request failed",
      };
    }

    const tickets = Array.isArray(result.data) ? result.data : [];
    let sentCount = 0;
    const invalidTokens = [];

    tickets.forEach((ticket, index) => {
      if (ticket.status === "ok") {
        sentCount++;
      } else {
        console.error("Expo Push ticket error:", ticket);

        if (ticket.details?.error === "DeviceNotRegistered") {
          invalidTokens.push(tokens[index]);
        }
      }
    });

    // Remove expired native device tokens.
    if (invalidTokens.length > 0) {
      await users.updateOne(
        { _id: recipient._id },
        {
          $pull: {
            expoPushTokens: {
              token: { $in: invalidTokens },
            },
          },
          $set: {
            expoPushUpdatedAt: new Date(),
          },
        }
      );
    }

    return {
      sent: sentCount > 0,
      sentCount,
      totalTokens: tokens.length,
      invalidTokensRemoved: invalidTokens.length,
      reason:
        sentCount > 0
          ? "Expo Push notification accepted"
          : "Expo Push delivery was not accepted",
    };
  } catch (error) {
    console.error("Expo Push delivery error:", error);

    return {
      sent: false,
      sentCount: 0,
      reason: "Expo Push delivery failed",
    };
  }
}

export async function POST(request) {
  try {
    // 1. Authenticate sender.
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

    // 2. Read request.
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

    // 3. Database.
    const client = await clientPromise;
    const db = client.db("rahul");
    const users = db.collection("users");

    // 4. Find recipient.
    const recipient = await users.findOne({
      _id: new ObjectId(String(userId)),
    });

    if (!recipient) {
      return NextResponse.json(
        { success: false, message: "Patient not found" },
        { status: 404 }
      );
    }

    // 5. Save notification.
    const notification = {
      userId: recipient._id,
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

    const notificationId = result.insertedId.toString();

    // 6. Send Web Push independently.
    let webPushSent = false;
    let webPushError = null;

    const subscription = recipient.webPushSubscription;

    if (recipient.webPushEnabled === true) {
      if (
        !subscription?.endpoint ||
        !subscription?.keys?.p256dh ||
        !subscription?.keys?.auth ||
        typeof subscription.endpoint !== "string" ||
        typeof subscription.keys.p256dh !== "string" ||
        typeof subscription.keys.auth !== "string"
      ) {
        webPushError = "Invalid or missing Web Push subscription";
      } else if (!vapidConfigured) {
        webPushError = "VAPID configuration is missing";
      } else {
        const payload = JSON.stringify({
          title: notification.title,
          body: notification.message,
          url: notification.url,
          icon: "/logo.png",
          badge: "/logo.png",
          notificationId,
        });

        try {
          console.log("Sending Web Push to:", String(userId));

          await webpush.sendNotification(
            subscription,
            payload,
            {
              TTL: 3600,
              urgency: "high",
            }
          );

          webPushSent = true;
        } catch (pushError) {
          console.error("Web Push delivery error:", pushError);

          webPushError = pushError.message;

          // Remove expired subscription.
          if (
            pushError.statusCode === 404 ||
            pushError.statusCode === 410
          ) {
            await users.updateOne(
              {
                _id: recipient._id,
                "webPushSubscription.endpoint": subscription.endpoint,
              },
              {
                $unset: {
                  webPushSubscription: "",
                },
                $set: {
                  webPushEnabled: false,
                  webPushUpdatedAt: new Date(),
                },
              }
            );
          }
        }
      }
    } else {
      webPushError = "Web Push is disabled";
    }

    // 7. Send Expo Push independently.
    const expoResult = await sendExpoPush(
      users,
      recipient,
      {
        title: notification.title,
        message: notification.message,
        url: notification.url,
        notificationId,
      }
    );

    // 8. Final response.
    const expoPushSent = expoResult.sent === true;
    const pushSent = webPushSent || expoPushSent;

    return NextResponse.json({
      success: true,
      pushSent,
      webPushSent,
      expoPushSent,
      message: pushSent
        ? "Notification saved and push delivery accepted"
        : "Notification saved, but push delivery was unsuccessful",
      notificationId,
      webPushError,
      expoPushReason: expoResult.reason,
      expoDevicesSent: expoResult.sentCount || 0,
    });
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
