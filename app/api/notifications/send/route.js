
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { ObjectId } from "mongodb";
import webpush from "web-push";

import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import clientPromise from "@/lib/mongodb";

export const runtime = "nodejs";
export const revalidate = 0;

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

// ==========================================
// WEB PUSH CONFIGURATION
// ==========================================

const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY?.trim();
const vapidSubject = process.env.VAPID_SUBJECT?.trim();

let vapidConfigured = false;

if (vapidPublicKey && vapidPrivateKey && vapidSubject) {
  try {
    webpush.setVapidDetails(
      vapidSubject,
      vapidPublicKey,
      vapidPrivateKey
    );

    vapidConfigured = true;
  } catch (error) {
    console.error("VAPID configuration error:", error);
  }
}

// ==========================================
// EXPO TOKEN VALIDATION
// ==========================================

function isValidExpoToken(token) {
  return (
    typeof token === "string" &&
    /^(ExpoPushToken|ExponentPushToken)\[[^\]]+\]$/.test(token)
  );
}

// ==========================================
// REMOVE INVALID EXPO TOKENS
// ==========================================

async function removeInvalidExpoTokens(users, recipient, invalidTokens) {
  if (!invalidTokens.length) return;

  await users.updateOne(
    { _id: recipient._id },
    {
      $pull: {
        expoPushTokens: { $in: invalidTokens },
      },
    }
  );

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

// ==========================================
// EXPO PUSH NOTIFICATION
// ==========================================

async function sendExpoPush(users, recipient, notification) {
  if (recipient.expoPushEnabled !== true) {
    return {
      sent: false,
      sentCount: 0,
      reason: "Expo Push is disabled",
    };
  }

  const tokenEntries = Array.isArray(recipient.expoPushTokens)
    ? recipient.expoPushTokens
    : [];

  const tokens = [
    ...new Set(
      tokenEntries
        .map((item) =>
          typeof item === "string" ? item : item?.token
        )
        .filter(isValidExpoToken)
    ),
  ];

  if (tokens.length === 0) {
    return {
      sent: false,
      sentCount: 0,
      totalTokens: 0,
      reason: "No valid Expo push tokens registered",
    };
  }

  let sentCount = 0;
  let invalidTokens = [];
  let failedCount = 0;

  try {
    for (let i = 0; i < tokens.length; i += 100) {
      const batch = tokens.slice(i, i + 100);

      const payload = batch.map((token) => ({
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
        signal: AbortSignal.timeout(15000),
      });

      let result;

      try {
        result = await response.json();
      } catch {
        result = null;
      }

      console.log("Expo Push HTTP status:", response.status);
      console.log("Expo Push response:", JSON.stringify(result));

      if (!response.ok) {
        failedCount += batch.length;
        console.error("Expo Push HTTP error:", result);
        continue;
      }

      const tickets = Array.isArray(result?.data)
        ? result.data
        : [];

      tickets.forEach((ticket, index) => {
        if (ticket?.status === "ok") {
          sentCount++;
        } else {
          failedCount++;
          console.error("Expo Push ticket error:", ticket);

          if (ticket?.details?.error === "DeviceNotRegistered") {
            invalidTokens.push(batch[index]);
          }
        }
      });

      if (tickets.length < batch.length) {
        failedCount += batch.length - tickets.length;
      }
    }

    if (invalidTokens.length > 0) {
      await removeInvalidExpoTokens(
        users,
        recipient,
        [...new Set(invalidTokens)]
      );
    }

    return {
      sent: sentCount > 0,
      sentCount,
      failedCount,
      totalTokens: tokens.length,
      invalidTokensRemoved: [...new Set(invalidTokens)].length,
      reason:
        sentCount > 0
          ? "Expo accepted the notification"
          : "Expo did not accept the notification",
    };
  } catch (error) {
    console.error("Expo Push delivery error:", error);

    return {
      sent: sentCount > 0,
      sentCount,
      failedCount,
      totalTokens: tokens.length,
      reason: error.message || "Expo Push delivery failed",
    };
  }
}

// ==========================================
// WEB PUSH NOTIFICATION
// ==========================================

async function sendWebPush(users, recipient, notification) {
  if (recipient.webPushEnabled !== true) {
    return {
      sent: false,
      reason: "Web Push is disabled",
    };
  }

  const subscription = recipient.webPushSubscription;

  if (
    !subscription?.endpoint ||
    !subscription?.keys?.p256dh ||
    !subscription?.keys?.auth
  ) {
    return {
      sent: false,
      reason: "Web Push subscription is missing or invalid",
    };
  }

  if (!vapidConfigured) {
    return {
      sent: false,
      reason: "VAPID configuration is missing",
    };
  }

  const payload = JSON.stringify({
    title: notification.title,
    body: notification.message,
    url: notification.url,
    icon: "/logo.png",
    badge: "/logo.png",
    notificationId: notification.notificationId,
  });

  try {
    await webpush.sendNotification(
      subscription,
      payload,
      {
        TTL: 3600,
        urgency: "high",
      }
    );

    return {
      sent: true,
      reason: "Web Push accepted the notification",
    };
  } catch (error) {
    console.error("Web Push delivery error:", error);

    if (error.statusCode === 404 || error.statusCode === 410) {
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

    return {
      sent: false,
      reason: error.message || "Web Push delivery failed",
    };
  }
}

// ==========================================
// GET MOST RECENT NOTIFICATION PREFERENCE
// ==========================================

function getLatestNotificationType(recipient) {
  const webTime = recipient.webPushUpdatedAt
    ? new Date(recipient.webPushUpdatedAt).getTime()
    : 0;

  const expoTime = recipient.expoPushUpdatedAt
    ? new Date(recipient.expoPushUpdatedAt).getTime()
    : 0;

  // Invalid or missing timestamps are treated as oldest.
  const validWebTime = Number.isFinite(webTime) ? webTime : 0;
  const validExpoTime = Number.isFinite(expoTime) ? expoTime : 0;

  // If both timestamps are equal, do not send.
  if (validWebTime === validExpoTime) {
    return null;
  }

  if (validWebTime > validExpoTime) {
    return {
      type: "web",
      enabled: recipient.webPushEnabled === true,
    };
  }

  return {
    type: "expo",
    enabled: recipient.expoPushEnabled === true,
  };
}

// ==========================================
// POST API
// ==========================================

export async function POST(request) {
  try {
    // 1. Authenticate sender.
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json(
        {
          success: false,
          message: "Unauthorized",
        },
        { status: 401 }
      );
    }

    const allowedRoles = [ "staff", "doctor"];

    if (!allowedRoles.includes(session.user.role)) {
      return NextResponse.json(
        {
          success: false,
          message: "You are not authorized to send notifications",
        },
        { status: 403 }
      );
    }

    // 2. Validate request.
    const body = await request.json();

    const { userId, title, message, url } = body;

    if (!userId || !title || !message) {
      return NextResponse.json(
        {
          success: false,
          message: "Missing required fields",
        },
        { status: 400 }
      );
    }

    if (!ObjectId.isValid(String(userId))) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid user ID",
        },
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
        {
          success: false,
          message: "Invalid notification content",
        },
        { status: 400 }
      );
    }

    const notificationUrl =
      typeof url === "string" &&
      url.startsWith("/") &&
      !url.startsWith("//")
        ? url
        : "/my-bookings";

    // 3. Connect database.
    const client = await clientPromise;
    const db = client.db("rahul");

    const users = db.collection("users");
    const notifications = db.collection("notifications");

    // 4. Find patient.
    const recipient = await users.findOne({
      _id: new ObjectId(String(userId)),
    });

    if (!recipient) {
      return NextResponse.json(
        {
          success: false,
          message: "Patient not found",
        },
        { status: 404 }
      );
    }

    // 5. Save notification in MongoDB.
    const notification = {
      userId: recipient._id,
      title: title.trim(),
      message: message.trim(),
      url: notificationUrl,
      read: false,
      createdAt: new Date(),
      sentBy: String(session.user.id || ""),
    };

    const insertResult = await notifications.insertOne(notification);

    const notificationId = insertResult.insertedId.toString();

    const pushNotification = {
      title: notification.title,
      message: notification.message,
      url: notification.url,
      notificationId,
    };

    // ==========================================
    // 6. SELECT ONLY THE MOST RECENT SETTING
    // ==========================================

    const latestPreference = getLatestNotificationType(recipient);

    let webResult = {
      sent: false,
      reason: "Web Push not selected",
    };

    let expoResult = {
      sent: false,
      sentCount: 0,
      failedCount: 0,
      totalTokens: 0,
      reason: "Expo Push not selected",
    };

    let selectedPushType = latestPreference?.type || null;

    if (latestPreference?.enabled === true) {
      if (latestPreference.type === "web") {
        webResult = await sendWebPush(
          users,
          recipient,
          pushNotification
        );
      } else if (latestPreference.type === "expo") {
        expoResult = await sendExpoPush(
          users,
          recipient,
          pushNotification
        );
      }
    } else {
      const reason = latestPreference
        ? `Latest ${latestPreference.type} notification preference is disabled`
        : "Notification timestamps are missing or equal";

      webResult.reason = reason;
      expoResult.reason = reason;
    }

    const webPushSent = webResult.sent === true;
    const expoPushSent = expoResult.sent === true;

    const pushSent = webPushSent || expoPushSent;

    // 7. Return result.
    return NextResponse.json({
      success: true,
      notificationSaved: true,

      pushSent,
      webPushSent,
      expoPushSent,

      selectedPushType,

      message: pushSent
        ? `${selectedPushType} notification accepted`
        : "Notification saved, but no push notification was sent",

      notificationId,

      webPushError: webResult.reason,
      expoPushReason: expoResult.reason,

      expoDevicesSent: expoResult.sentCount || 0,
      expoDevicesFailed: expoResult.failedCount || 0,
      expoTotalDevices: expoResult.totalTokens || 0,
      expoInvalidTokensRemoved: expoResult.invalidTokensRemoved || 0,
    });
  } catch (error) {
    console.error("Send notification API error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Internal server error",
        error:
          process.env.NODE_ENV === "development"
            ? error.message
            : undefined,
      },
      { status: 500 }
    );
  }
}
