
"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import {
  Bell,
  LoaderCircle,
  X,
  ShieldCheck,
} from "lucide-react";

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat(
    (4 - (base64String.length % 4)) % 4
  );

  const base64 = (base64String + padding)
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  const rawData = window.atob(base64);

  return Uint8Array.from(
    rawData,
    (char) => char.charCodeAt(0)
  );
}

function arrayBufferToBase64Url(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";

  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return window
    .btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function isIOSDevice() {
  return (
    /iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    (
      navigator.platform === "MacIntel" &&
      navigator.maxTouchPoints > 1
    )
  );
}

function isInstalledApp() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true
  );
}

function getBrowserSupport() {
  if (!window.isSecureContext) {
    return "Notifications require HTTPS or localhost.";
  }

  if (!("Notification" in window)) {
    return "This browser does not support notifications.";
  }

  if (!("serviceWorker" in navigator)) {
    return "Service workers are not supported.";
  }

  if (!("PushManager" in window)) {
    return "Web Push is not supported in this browser.";
  }

  if (isIOSDevice() && !isInstalledApp()) {
    return "On iPhone or iPad, add Zeriy to your Home Screen and open it from there.";
  }

  return null;
}

// ==========================================
// REQUEST NATIVE EXPO PUSH TOKEN
// ==========================================

function requestNativePushToken() {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      window.removeEventListener(
        "ZERIY_PUSH_TOKEN",
        handleToken
      );

      reject(
        new Error(
          "Mobile notification registration timed out."
        )
      );
    }, 30000);

    function handleToken(event) {
      clearTimeout(timeout);

      window.removeEventListener(
        "ZERIY_PUSH_TOKEN",
        handleToken
      );

      resolve(event.detail);
    }

    window.addEventListener(
      "ZERIY_PUSH_TOKEN",
      handleToken
    );

    window.ReactNativeWebView.postMessage(
      "ZERIY_REGISTER_PUSH"
    );
  });
}

export default function EnableNotifications({
  webPushEnabled = false,
  updateSession,
}) {
  const {
    data: session,
    status,
    update,
  } = useSession();

  const [loading, setLoading] = useState(false);
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState("");
  const [nativeEnabled, setNativeEnabled] = useState(false);

  const syncSession = updateSession || update;

  const isNativeApp =
    typeof window !== "undefined" &&
    Boolean(window.ReactNativeWebView?.postMessage);

  // Use the correct subscription status for each platform.
  const sessionEnabled = isNativeApp
    ? Boolean(
        session?.user?.expoPushEnabled ?? nativeEnabled
      )
    : Boolean(
        session?.user?.webPushEnabled ?? webPushEnabled
      );

  // ==========================================
  // SHOW / HIDE BANNER
  // ==========================================

  useEffect(() => {
    if (status !== "authenticated" || !session?.user) {
      setVisible(false);
      return;
    }

    if (sessionEnabled) {
      setVisible(false);
      return;
    }

    const frame = requestAnimationFrame(() => {
      setVisible(true);
    });

    return () => cancelAnimationFrame(frame);
  }, [
    status,
    session?.user,
    sessionEnabled,
  ]);

  // ==========================================
  // UPDATE NEXTAUTH SESSION
  // ==========================================

  const updateServerSession = useCallback(
    async (value) => {
      try {
        await syncSession({
          webPushEnabled: value,
        });
      } catch (error) {
        console.error(
          "Session update error:",
          error
        );
      }
    },
    [syncSession]
  );

  // ==========================================
  // ENABLE NOTIFICATIONS
  // ==========================================

  async function enableNotifications() {
    try {
      setLoading(true);
      setMessage("");

      if (
        status !== "authenticated" ||
        !session?.user
      ) {
        throw new Error("Please login first.");
      }

      // ======================================
      // NATIVE EXPO MOBILE APP
      // ======================================

      if (isNativeApp) {
        const token = await requestNativePushToken();

        if (!token) {
          throw new Error(
            "Unable to get mobile push token."
          );
        }

        // Save native token to MongoDB.
        const response = await fetch(
          "/api/notifications/native-subscribe",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            credentials: "same-origin",
            cache: "no-store",
            body: JSON.stringify({
              token,
            }),
          }
        );

        const data = await response
          .json()
          .catch(() => ({}));

        if (!response.ok || !data.success) {
          throw new Error(
            data.message ||
            "Unable to save mobile push token."
          );
        }

        setNativeEnabled(true);
        setMessage("");
        setVisible(false);

        return;
      }

      // ======================================
      // EXISTING WEBSITE WEB PUSH
      // ======================================

      const unsupported = getBrowserSupport();

      if (unsupported) {
        throw new Error(unsupported);
      }

      const publicKey =
        process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();

      if (!publicKey) {
        throw new Error(
          "VAPID public key is missing."
        );
      }

      const applicationServerKey =
        urlBase64ToUint8Array(publicKey);

      // Request notification permission.
      let permission = Notification.permission;

      if (permission === "default") {
        permission =
          await Notification.requestPermission();
      }

      if (permission !== "granted") {
        if (permission === "denied") {
          throw new Error(
            "Notifications are blocked. Allow them in browser settings."
          );
        }

        throw new Error(
          "Notification permission was not granted."
        );
      }

      // Register service worker.
      await navigator.serviceWorker.register(
        "/sw.js",
        {
          scope: "/",
        }
      );

      const registration =
        await navigator.serviceWorker.ready;

      // Get existing subscription.
      let subscription =
        await registration.pushManager.getSubscription();

      // Check existing VAPID key.
      if (subscription) {
        const existingKey =
          subscription.options?.applicationServerKey;

        const existingPublicKey = existingKey
          ? arrayBufferToBase64Url(existingKey)
          : "";

        const normalizedPublicKey =
          arrayBufferToBase64Url(applicationServerKey);

        if (
          existingPublicKey &&
          existingPublicKey !== normalizedPublicKey
        ) {
          await subscription.unsubscribe();
          subscription = null;
        }
      }

      // Create subscription if required.
      if (!subscription) {
        subscription =
          await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey,
          });
      }

      // Save Web Push subscription to MongoDB.
      const response = await fetch(
        "/api/notifications/subscribe",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "same-origin",
          cache: "no-store",
          body: JSON.stringify(
            subscription.toJSON()
          ),
        }
      );

      const data = await response
        .json()
        .catch(() => ({}));

      if (!response.ok || !data.success) {
        throw new Error(
          data.message ||
          "Unable to save push subscription."
        );
      }

      // Update session after successful subscription.
      await updateServerSession(true);

      setMessage("");
      setVisible(false);

    } catch (error) {
      console.error(
        "Enable notification error:",
        error
      );

      setMessage(
        error.message || "Something went wrong."
      );
    } finally {
      setLoading(false);
    }
  }

  // ==========================================
  // AUTHENTICATION CHECK
  // ==========================================

  if (
    status !== "authenticated" ||
    !session?.user ||
    sessionEnabled
  ) {
    return null;
  }

  // ==========================================
  // UI
  // ==========================================

  return (
    <div
      className={`fixed left-1/2 top-3 z-[9999] w-[calc(100%-24px)] max-w-md -translate-x-1/2 transition-all duration-500 ease-out ${
        visible
          ? "translate-y-0 opacity-100"
          : "-translate-y-[150%] opacity-0 pointer-events-none"
      }`}
    >
      <div className="relative overflow-hidden rounded-2xl border border-violet-100 bg-white p-3.5 shadow-xl shadow-violet-900/10 sm:p-4">

        {/* Top accent */}

        <div className="flex items-center gap-3">

          {/* Icon */}

          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
            <Bell size={21} />
          </div>

          {/* Content */}

          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-gray-900">
              Stay updated with Zeriy
            </p>

            <p className="mt-0.5 text-xs leading-relaxed text-gray-500">
              Enable notifications to receive booking and queue updates.
            </p>
          </div>

          {/* Close */}

          <button
            type="button"
            onClick={() => setVisible(false)}
            disabled={loading}
            aria-label="Dismiss notification prompt"
            className="absolute right-2 top-2 rounded-lg p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
          >
            <X size={16} />
          </button>
        </div>

        {/* Error message */}

        {message && (
          <p
            role="alert"
            className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600"
          >
            {message}
          </p>
        )}

        {/* Enable button */}

        <button
          type="button"
          onClick={enableNotifications}
          disabled={loading}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? (
            <LoaderCircle
              size={17}
              className="animate-spin"
            />
          ) : (
            <ShieldCheck size={17} />
          )}

          {loading
            ? "Enabling..."
            : "Enable Notifications"}
        </button>

        <p className="mt-2 text-center text-[9px] text-gray-400">
          You can manage notification permissions anytime in your device settings.
        </p>
      </div>
    </div>
  );
}
