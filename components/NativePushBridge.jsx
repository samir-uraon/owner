
"use client";

import { useEffect } from "react";

export default function NativePushBridge() {
  useEffect(() => {
    let registering = false;

    async function registerToken() {
      const token = window.__ZERIY_NATIVE_PUSH_TOKEN__;

      if (!token || registering) return;

      registering = true;

      try {
        const response = await fetch("/api/push/register", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "same-origin",
          body: JSON.stringify({ token }),
        });

        const data = await response.json();

        if (!response.ok) {
          console.log("Native push registration:", data.message);
          return;
        }

        console.log("Zeriy native push token registered");
      } catch (error) {
        console.error("Native push bridge error:", error);
      } finally {
        registering = false;
      }
    }

    function handleNativeToken() {
      registerToken();
    }

    window.addEventListener(
      "zeriy-native-push-token",
      handleNativeToken
    );

    window.addEventListener("focus", handleNativeToken);

    // Also handles a token received before this component mounted.
    registerToken();

    return () => {
      window.removeEventListener(
        "zeriy-native-push-token",
        handleNativeToken
      );

      window.removeEventListener("focus", handleNativeToken);
    };
  }, []);

  return null;
}
