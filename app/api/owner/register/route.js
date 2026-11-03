
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import clientPromise from "@/lib/mongodb";
import transporter from "@/lib/mailer";

 

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (character) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };

    return entities[character];
  });
}

export async function POST(req) {
  let owners = null;
  let insertedId = null;

  try {
    const body = await req.json().catch(() => null);

    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { success: false, error: "Invalid request body." },
        { status: 400 }
      );
    }

    const {
      fullName,
      mobile,
      email,
      password,
      confirmPassword,
    } = body;

    if (
      !fullName ||
      !mobile ||
      !email ||
      !password ||
      !confirmPassword
    ) {
      return NextResponse.json(
        { success: false, error: "All fields are required." },
        { status: 400 }
      );
    }

    const name = String(fullName).trim();
    const normalizedEmail = String(email).trim().toLowerCase();
    const normalizedMobile = String(mobile).trim();
    const passwordValue = String(password);

    if (!name || name.length > 100) {
      return NextResponse.json(
        { success: false, error: "Enter a valid full name." },
        { status: 400 }
      );
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return NextResponse.json(
        { success: false, error: "Enter a valid email address." },
        { status: 400 }
      );
    }

    if (!/^[6-9]\d{9}$/.test(normalizedMobile)) {
      return NextResponse.json(
        { success: false, error: "Enter a valid Indian mobile number." },
        { status: 400 }
      );
    }

    if (passwordValue !== String(confirmPassword)) {
      return NextResponse.json(
        { success: false, error: "Passwords do not match." },
        { status: 400 }
      );
    }

    if (passwordValue.length < 6 || passwordValue.length > 72) {
      return NextResponse.json(
        {
          success: false,
          error: "Password must be between 6 and 72 characters.",
        },
        { status: 400 }
      );
    }

    if (
      !process.env.MONGODB ||
      !process.env.EMAIL_USER ||
      !process.env.EMAIL_PASS
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Server configuration error.",
        },
        { status: 500 }
      );
    }

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB);

    owners = db.collection("owners");

    // TTL index: automatically delete expired pending accounts.
    await owners.createIndex(
      { expiresAt: 1 },
      {
        expireAfterSeconds: 0,
        name: "pending_owner_expiry",
      }
    );

    // Check whether email or mobile belongs to a verified account.
    const existingOwner = await owners.findOne({
      isVerified: true,
      $or: [
        { email: normalizedEmail },
        { phone: normalizedMobile },
      ],
    });

    if (existingOwner) {
      const message =
        existingOwner.email === normalizedEmail
          ? "An account with this email already exists."
          : "An account with this mobile number already exists.";

      return NextResponse.json(
        { success: false, error: message },
        { status: 409 }
      );
    }

    const now = new Date();

    // Exactly 15 minutes for pending registration.
    const expiresAt = new Date(
      now.getTime() + 15 * 60 * 1000
    );

    // Generate new OTP every registration attempt.
    const otp = crypto.randomInt(100000, 1000000).toString();

    const otpHash = crypto
      .createHash("sha256")
      .update(otp)
      .digest("hex");

    const hashedPassword = await bcrypt.hash(passwordValue, 12);

    // Delete previous unverified registration using this email OR mobile.
    await owners.deleteMany({
      isVerified: { $ne: true },
      $or: [
        { email: normalizedEmail },
        { phone: normalizedMobile },
      ],
    });

    // Insert completely new pending registration.
    const owner = {
      name,
      phone: normalizedMobile,
      email: normalizedEmail,
      password: hashedPassword,

      isVerified: false,
      isConfigured: false,

      otpHash,
      otpExpiresAt: expiresAt,
      expiresAt,

      createdAt: now,
      updatedAt: now,
    };

    const result = await owners.insertOne(owner);

    insertedId = result.insertedId;

    // Send new OTP.
    try {
      await transporter.sendMail({
        from: `"Zeriy" <${process.env.EMAIL_USER}>`,
        to: normalizedEmail,
        subject: "Verify your Zeriy account",

        text: `Hello ${name},

Welcome to Zeriy!

Your verification code is: ${otp}

This code expires in 15 minutes.

If you did not create this account, ignore this email.

Regards,
Zeriy Team`,

        html: `
          <div style="margin:0;padding:32px 12px;background:#f8fafc;font-family:Arial,Helvetica,sans-serif;color:#0f172a">
            <div style="max-width:480px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:20px;overflow:hidden">

              <div style="padding:28px 24px;background:#4f46e5;text-align:center">
                <h1 style="margin:0;color:#ffffff;font-size:28px">Zeriy</h1>
                <p style="margin:8px 0 0;color:#e0e7ff;font-size:14px">
                  Made Simpler &amp; Much Faster
                </p>
              </div>

              <div style="padding:32px 24px">
                <h2 style="margin:0 0 12px;font-size:22px">
                  Verify your email
                </h2>

                <p style="color:#475569;font-size:15px;line-height:1.7">
                  Hello ${escapeHtml(name)}, welcome to Zeriy!
                  Use this code to complete your registration.
                </p>

                <div style="padding:20px;background:#eef2ff;border:1px solid #c7d2fe;border-radius:14px;text-align:center">

                  <p style="color:#4338ca;font-size:12px;font-weight:bold;letter-spacing:2px">
                    YOUR VERIFICATION CODE
                  </p>

                  <div style="font-size:34px;font-weight:bold;letter-spacing:10px;color:#312e81">
                    ${otp}
                  </div>

                </div>

                <p style="margin-top:20px;color:#64748b;font-size:13px;line-height:1.7">
                  This code expires in 15 minutes.
                  Never share your verification code with anyone.
                </p>

                <hr style="margin:26px 0;border:0;border-top:1px solid #e2e8f0" />

                <p style="color:#94a3b8;font-size:12px">
                  If you did not create a Zeriy account, ignore this email.
                </p>
              </div>
            </div>
          </div>
        `,
      });
    } catch (emailError) {
      console.error("Owner registration email error:", emailError);

      await owners.deleteOne({ _id: insertedId });
      insertedId = null;

      return NextResponse.json(
        {
          success: false,
          error: "Unable to send verification email. Please try again.",
        },
        { status: 502 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: "Verify Your Email",
        email: normalizedEmail,
        expiresIn: 900,
      },
      { status: 201 }
    );

  } catch (error) {
    console.error("Owner registration error:", error);

    if (insertedId && owners) {
      try {
        await owners.deleteOne({ _id: insertedId });
      } catch (cleanupError) {
        console.error("Owner cleanup error:", cleanupError);
      }
    }

    return NextResponse.json(
      {
        success: false,
        error: "Registration failed. Please try again.",
      },
      { status: 500 }
    );
  }
}
