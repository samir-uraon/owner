
import { NextResponse } from "next/server";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import clientPromise from "@/lib/mongodb";

const ALLOWED_COLLECTIONS = new Set([
  "owners",
  "staff",
  "doctors",
]);

function hashOTP(otp, secret) {
  return crypto
    .createHmac("sha256", secret)
    .update(otp)
    .digest("hex");
}

function safeEqual(a, b) {
  const first = Buffer.from(a, "hex");
  const second = Buffer.from(b, "hex");

  return (
    first.length === second.length &&
    crypto.timingSafeEqual(first, second)
  );
}

export async function POST(request) {
  try {
    const body = await request.json();

    const identifier = String(body.identifier || "").trim();
    const accountType = String(body.accountType || "")
      .trim()
      .toLowerCase();
    const otp = String(body.otp || "").trim();
    const password = String(body.password || "");
    const confirmPassword = String(body.confirmPassword || "");

    if (
      !identifier ||
      !otp ||
      !password ||
      !confirmPassword ||
      !accountType
    ) {
      return NextResponse.json(
        { error: "All fields are required." },
        { status: 400 }
      );
    }

    if (!/^\d{6}$/.test(otp)) {
      return NextResponse.json(
        { error: "Enter a valid 6-digit OTP." },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters long." },
        { status: 400 }
      );
    }

    if (password !== confirmPassword) {
      return NextResponse.json(
        { error: "Passwords do not match." },
        { status: 400 }
      );
    }

    const collectionName = {
      owner: "owners",
      staff: "staff",
      doctor: "doctors",
    }[accountType];

    if (!collectionName || !ALLOWED_COLLECTIONS.has(collectionName)) {
      return NextResponse.json(
        { error: "Invalid account type." },
        { status: 400 }
      );
    }

    const secret = process.env.OTP_SECRET;

    if (!secret || secret.length < 32) {
      return NextResponse.json(
        { error: "OTP service is not configured." },
        { status: 500 }
      );
    }

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB);
    const accounts = db.collection(collectionName);
    const otpCollection = db.collection("passwordResetOTPs");

    const account = await accounts.findOne({
      $or: [
        { email: identifier.toLowerCase() },
        { phone: identifier },
        { mobile: identifier },
      ],
    });

    if (!account) {
      return NextResponse.json(
        { error: "Invalid account or OTP." },
        { status: 400 }
      );
    }

    const resetRecord = await otpCollection.findOne({
      accountId: account._id,
      collectionName,
      expiresAt: { $gt: new Date() },
    });

    if (!resetRecord) {
      return NextResponse.json(
        { error: "OTP is invalid or expired. Request a new OTP." },
        { status: 400 }
      );
    }

    if (resetRecord.attempts >= 5) {
      await otpCollection.deleteOne({ _id: resetRecord._id });

      return NextResponse.json(
        { error: "Too many incorrect attempts. Request a new OTP." },
        { status: 429 }
      );
    }

    const submittedHash = hashOTP(otp, secret);

    if (!safeEqual(submittedHash, resetRecord.otpHash)) {
      const attempts = resetRecord.attempts + 1;

      if (attempts >= 5) {
        await otpCollection.deleteOne({ _id: resetRecord._id });
      } else {
        await otpCollection.updateOne(
          {
            _id: resetRecord._id,
            attempts: resetRecord.attempts,
          },
          { $set: { attempts } }
        );
      }

      return NextResponse.json(
        {
          error:
            attempts >= 5
              ? "Too many incorrect attempts. Request a new OTP."
              : `Incorrect OTP. ${5 - attempts} attempt(s) remaining.`,
        },
        { status: attempts >= 5 ? 429 : 400 }
      );
    }

  const storedPassword =
  accountType === "owner"
    ? await bcrypt.hash(password, 12)
    : password;

const result = await accounts.updateOne(
  { _id: account._id },
  {
    $set: {
      password: storedPassword,
      passwordUpdatedAt: new Date(),
    },
  }
);

    if (result.matchedCount !== 1) {
      return NextResponse.json(
        { error: "Unable to update the password." },
        { status: 500 }
      );
    }

    await otpCollection.deleteMany({
      accountId: account._id,
      collectionName,
    });

    return NextResponse.json({
      success: true,
      message: "Password reset successfully. You can now sign in.",
    });
  } catch (error) {
    console.error("Reset password OTP error:", error);

    return NextResponse.json(
      { error: "Failed to reset password. Please try again." },
      { status: 500 }
    );
  }
}
