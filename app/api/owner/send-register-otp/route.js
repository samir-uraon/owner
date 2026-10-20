import { NextResponse } from "next/server";
import crypto from "node:crypto";
import clientPromise from "@/lib/mongodb";

 

export async function POST(req) {
  try {
    const body = await req.json().catch(() => null);

    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { success: false, error: "Invalid request body." },
        { status: 400 }
      );
    }

    const email = String(body.email || "").trim().toLowerCase();
    const otp = String(body.otp || "").trim();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { success: false, error: "Enter a valid email address." },
        { status: 400 }
      );
    }

    if (!/^\d{6}$/.test(otp)) {
      return NextResponse.json(
        { success: false, error: "Enter a valid 6-digit OTP." },
        { status: 400 }
      );
    }

    if (!process.env.MONGODB) {
      return NextResponse.json(
        { success: false, error: "Server configuration error." },
        { status: 500 }
      );
    }

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB);
    const owners = db.collection("owners");

    const now = new Date();

    const otpHash = crypto
      .createHash("sha256")
      .update(otp)
      .digest("hex");

    const result = await owners.updateOne(
      {
        email,
        isVerified: false,
        expiresAt: { $gt: now },
        otpExpiresAt: { $gt: now },
        otpHash,
      },
      {
        $set: {
          isVerified: true,
          verifiedAt: now,
          updatedAt: now,
        },
        $unset: {
          expiresAt: "",
          otpExpiresAt: "",
          otpHash: "",
        },
      }
    );

    if (result.modifiedCount !== 1) {
      return NextResponse.json(
        {
          success: false,
          error: "OTP is invalid or expired. Please register again.",
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: "Email verified successfully. Your account has been created.",
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Owner OTP verification error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Verification failed. Please try again.",
      },
      { status: 500 }
    );
  }
}