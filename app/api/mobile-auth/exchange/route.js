import { NextResponse } from "next/server";
import { encode } from "next-auth/jwt";
import crypto from "crypto";
import clientPromise from "@/lib/mongodb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SESSION_MAX_AGE = 30 * 24 * 60 * 60; // 30 days

const ALLOWED_COOKIE_NAMES = new Set([
  "__Secure-authjs.session-token",
  "authjs.session-token",
  "__Secure-next-auth.session-token",
  "next-auth.session-token",
]);

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get("code");

    if (!code || code.length > 200) {
      return NextResponse.json(
        { error: "Invalid login code." },
        { status: 400 }
      );
    }

    const codeHash = crypto.createHash("sha256").update(code).digest("hex");

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB || "rahul");

    // Atomically consume the code so it cannot be reused
    const result = await db
      .collection("mobile_auth_codes")
      .findOneAndDelete({
        codeHash,
        expiresAt: { $gt: new Date() },
      });

    const record = result && "value" in result ? result.value : result;

    if (!record || !record.user?.id) {
      return NextResponse.json(
        { error: "Login code expired or already used." },
        { status: 401 }
      );
    }

    const cookieName = record.cookieName;

    if (!ALLOWED_COOKIE_NAMES.has(cookieName)) {
      return NextResponse.json(
        { error: "Invalid session cookie configuration." },
        { status: 500 }
      );
    }

    const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;

    if (!secret) {
      console.error("Missing AUTH_SECRET or NEXTAUTH_SECRET.");
      return NextResponse.json(
        { error: "Server authentication secret is not configured." },
        { status: 500 }
      );
    }

    const user = record.user;

    const tokenPayload = {
      sub: String(user.id),
      id: String(user.id),
  name: user.name || "",
  email: user.email || "",
  role: user.role || "",
  phone: user.phone || "",
  isConfigured: user.isConfigured ?? false,
  webPushEnabled: user.webPushEnabled === true,
    };

    // Auth.js v5 (authjs.* cookies) uses the cookie name as salt.
    // NextAuth v4 (next-auth.* cookies) uses an empty salt.
    const salt = cookieName.includes("authjs") ? cookieName : "";

    const sessionToken = await encode({
      secret,
      salt,
      maxAge: SESSION_MAX_AGE,
      token: tokenPayload,
    });

    const redirectUrl = new URL("/", req.url);
    if (
      redirectUrl.protocol === "http:" &&
      !redirectUrl.hostname.includes("localhost")
    ) {
      redirectUrl.protocol = "https:";
    }

    const response = NextResponse.redirect(redirectUrl);

    response.cookies.set(cookieName, sessionToken, {
      httpOnly: true,
      // "__Secure-" cookies must be secure
      secure: cookieName.startsWith("__Secure-") || redirectUrl.protocol === "https:",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_MAX_AGE,
    });

    response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
    response.headers.set("Pragma", "no-cache");
    response.headers.set("Referrer-Policy", "no-referrer");

    return response;
  } catch (error) {
    console.error("Mobile session exchange error:", error);

    return NextResponse.json(
      { error: "Unable to establish mobile session." },
      { status: 500 }
    );
  }
}