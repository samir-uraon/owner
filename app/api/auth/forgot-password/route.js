
import { NextResponse } from "next/server";
import crypto from "node:crypto";
import clientPromise from "@/lib/mongodb";
import transporter from "@/lib/mailer";

const ACCOUNT_COLLECTIONS = {
  owner: "owners",
  staff: "staff",
  doctor: "doctors",
};

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (char) =>
    ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    })[char]
  );
}

function hashOTP(otp, secret) {
  return crypto
    .createHmac("sha256", secret)
    .update(otp)
    .digest("hex");
}

export async function POST(request) {
  try {
    const body = await request.json();
    const identifier = String(body.identifier || "").trim();
    const accountType = String(body.accountType || "")
      .trim()
      .toLowerCase();

    if (!identifier) {
      return NextResponse.json(
        { error: "Email or mobile number is required." },
        { status: 400 }
      );
    }

    const collectionName = ACCOUNT_COLLECTIONS[accountType];

    if (!collectionName) {
      return NextResponse.json(
        { error: "Select a valid account type." },
        { status: 400 }
      );
    }

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB);
    const collection = db.collection(collectionName);

    const account = await collection.findOne({
      $or: [
        { email: identifier.toLowerCase() },
        { phone: identifier },
        { mobile: identifier },
      ],
    });

    if (!account) {
      return NextResponse.json(
        { error: "No matching account was found." },
        { status: 404 }
      );
    }

    if (!account.email) {
      return NextResponse.json(
        { error: "No email address is associated with this account." },
        { status: 400 }
      );
    }

    const secret = process.env.OTP_SECRET;

    if (!secret || secret.length < 32) {
      console.error("OTP_SECRET must be configured with at least 32 characters.");

      return NextResponse.json(
        { error: "OTP service is not configured." },
        { status: 500 }
      );
    }

    const otp = crypto.randomInt(100000, 1000000).toString();
    const otpHash = hashOTP(otp, secret);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 15 * 60 * 1000);

    const otpCollection = db.collection("passwordResetOTPs");

    // Invalidate any previous OTP for this account.
    await otpCollection.deleteMany({
      accountId: account._id,
      collectionName,
    });

    await otpCollection.insertOne({
      accountId: account._id,
      collectionName,
      otpHash,
      accountType,
      attempts: 0,
      expiresAt,
      createdAt: now,
    });

    const displayName =
      account.name ||
      account.fullName ||
      account.doctorName ||
      "User";

    const safeName = escapeHtml(displayName);
    const accountLabel =
      accountType === "owner"
        ? "owner"
        : accountType === "doctor"
          ? "doctor"
          : "staff";

    try {
      await transporter.sendMail({
        from: `"Zeric" <${process.env.EMAIL_USER}>`,
        to: account.email,
        subject: "Your Zeric Password Reset OTP",
        text: `Hello ${displayName},

Your Zeric ${accountLabel} password reset OTP is: ${otp}

This OTP expires in 15 minutes. Do not share it with anyone.

If you did not request this OTP, please ignore this email.`,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:30px;color:#334155;">
            <h2 style="color:#0f172a;">Hello ${safeName} 👋</h2>

            <p>We received a request to reset your Zeric ${accountLabel} account password.</p>

            <p>Use this verification code to continue:</p>

            <div style="margin:28px 0;padding:20px;background:#f5f3ff;border-radius:12px;text-align:center;">
              <div style="font-size:12px;color:#64748b;margin-bottom:8px;">YOUR RESET OTP</div>
              <div style="font-size:34px;font-weight:bold;letter-spacing:10px;color:#4f46e5;">${otp}</div>
            </div>

            <p>This OTP expires in <strong>15 minutes</strong>.</p>
            <p>Never share this code with anyone.</p>
            <p>If you did not request this reset, you can safely ignore this email.</p>

            <hr style="border:none;border-top:1px solid #e2e8f0;margin:30px 0;" />

            <p style="font-size:12px;color:#94a3b8;">
              Zeric — Made Simpler &amp; Much Faster
            </p>
          </div>
        `,
      });
    } catch (emailError) {
      await otpCollection.deleteOne({
        accountId: account._id,
        collectionName,
        otpHash,
      });

      throw emailError;
    }

    return NextResponse.json({
      success: true,
      message: "OTP sent to your registered email address.",
    });
  } catch (error) {
    console.error("Forgot password OTP error:", error);

    return NextResponse.json(
      { error: "Failed to send OTP. Please try again." },
      { status: 500 }
    );
  }
}
