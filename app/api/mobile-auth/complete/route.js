import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import crypto from "crypto";
import clientPromise from "@/lib/mongodb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Two slashes: must match Linking.createURL("auth/callback") and the Android intent filter
const APP_CALLBACK = "zeriy-owner://auth/callback";

const SESSION_COOKIE_NAMES = [
  "__Secure-authjs.session-token",
  "authjs.session-token",
  "__Secure-next-auth.session-token",
  "next-auth.session-token",
];

export async function GET(req) {
  try {
    const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;

    const token = await getToken({ req, secret });

    if (!token) {
      return NextResponse.json(
        { error: "Not authenticated. Please sign in again." },
        { status: 401 }
      );
    }

    const userId = token.id || token.sub;

    if (!userId) {
      return NextResponse.json(
        { error: "User ID missing from session." },
        { status: 401 }
      );
    }

    // Which session cookie did Chrome actually receive? (differs between v4 and v5)
    const cookieName = SESSION_COOKIE_NAMES.find(
      (name) => req.cookies.get(name)?.value || req.cookies.get(`${name}.0`)?.value
    );

    if (!cookieName) {
      return NextResponse.json(
        { error: "Session cookie not found." },
        { status: 401 }
      );
    }

    // One-time random code, only its SHA-256 hash is stored
    const code = crypto.randomBytes(32).toString("base64url");
    const codeHash = crypto.createHash("sha256").update(code).digest("hex");
    const expiresAt = new Date(Date.now() + 2 * 60 * 1000); // 2 minutes

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB || "rahul");

    await db.collection("mobile_auth_codes").insertOne({
      codeHash,
      cookieName,
      user: {
        id: String(userId),
       
  name: token.name || "",
  email: token.email || "",
  role: token.role || "",
  phone: token.phone || "",
  isConfigured: token.isConfigured ?? false,
  webPushEnabled: token.webPushEnabled === true,
      },
      expiresAt,
      createdAt: new Date(),
    });

    // base64url is URL-safe, so no extra escaping is needed
    const link = `${APP_CALLBACK}?code=${code}`;

    // Return an HTML page (not a 302): Chrome blocks silent redirects to custom schemes,
    // but allows a script navigation and, as a fallback, a tapped link.
    const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="referrer" content="no-referrer">
  <title>Returning to Zeriy</title>
</head>
<body style="font-family:system-ui,sans-serif;text-align:center;padding:56px 24px;background:#f8fafc;color:#0f172a">
  <h2 style="margin:0 0 8px">Login successful</h2>
  <p style="color:#64748b;margin:0 0 28px">Returning to the Zeriy-Owner app…</p>
  <a href="${link}" style="display:inline-block;padding:14px 32px;background:#6C3CE9;color:#fff;border-radius:12px;font-weight:600;text-decoration:none">Open Zeriy</a>
  <script>setTimeout(function(){ window.location.href = ${JSON.stringify(link)}; }, 300);</script>
</body>
</html>`;

    return new NextResponse(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store, no-cache, must-revalidate",
        Pragma: "no-cache",
        "Referrer-Policy": "no-referrer",
      },
    });
  } catch (error) {
    console.error("Mobile authentication completion error:", error);

    return NextResponse.json(
      { error: "Unable to complete mobile authentication." },
      { status: 500 }
    );
  }
}