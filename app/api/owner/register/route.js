 
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import clientPromise from "@/lib/mongodb";
import transporter from "@/lib/mailer";

 

export async function POST(req) {
  try {
    const body = await req.json();
    const { fullName, mobile, email, password, confirmPassword } = body;

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

    if (!name) {
      return NextResponse.json(
        { success: false, error: "Full name is required." },
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
        {
          success: false,
          error: "Enter a valid Indian mobile number.",
        },
        { status: 400 }
      );
    }

    if (password !== confirmPassword) {
      return NextResponse.json(
        { success: false, error: "Passwords do not match." },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        {
          success: false,
          error: "Password must be at least 6 characters long.",
        },
        { status: 400 }
      );
    }

    if (
      !process.env.MONGODB ||
      !process.env.EMAIL_USER ||
      !process.env.EMAIL_PASS
    ) {
      console.error("Missing required server environment variables.");

      return NextResponse.json(
        {
          success: false,
          error: "Server configuration error. Please try again later.",
        },
        { status: 500 }
      );
    }

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB);
    const owners = db.collection("owners");

    await owners.createIndex(
      { expiresAt: 1 },
      {
        expireAfterSeconds: 0,
        name: "pending_owner_expiry",
      }
    );

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
    const expiresAt = new Date(now.getTime() + 15 * 60 * 1000);

    const otp = crypto.randomInt(100000, 1000000).toString();

    const otpHash = crypto
      .createHash("sha256")
      .update(otp)
      .digest("hex");

    const hashedPassword = await bcrypt.hash(password, 10);

    await owners.deleteMany({
      email: normalizedEmail,
      isVerified: { $ne: true },
    });

    await owners.deleteMany({
      phone: normalizedMobile,
      isVerified: { $ne: true },
    });

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
    };

    const result = await owners.insertOne(owner);

    try {
      await transporter.sendMail({
        from: `"Zeric" <${process.env.EMAIL_USER}>`,
        to: normalizedEmail,
        subject: "Verify your Zeric account",
        text: `Hello ${name},

Welcome to Zeric!

Your email verification code is: ${otp}

Enter this code on the verification page to activate your account.

This code expires in 15 Minutes.

If you did not create this account, you can ignore this email.

Regards,
Zeric Team`,
        html: `
          <div style="margin:0;padding:32px 12px;background:#f8fafc;font-family:Arial,Helvetica,sans-serif;color:#0f172a">
            <div style="max-width:480px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:20px;overflow:hidden">
              <div style="padding:28px 24px;background:#4f46e5;text-align:center">
                <h1 style="margin:0;color:#ffffff;font-size:28px">Zeric</h1>
                <p style="margin:8px 0 0;color:#e0e7ff;font-size:14px">Made Simpler &amp; Much Faster</p>
              </div>

              <div style="padding:32px 24px">
                <h2 style="margin:0 0 12px;font-size:22px">Verify your email</h2>

                <p style="margin:0 0 20px;color:#475569;font-size:15px;line-height:1.7">
                  Hello ${escapeHtml(name)}, welcome to Zeric! Use the verification code below to complete your registration.
                </p>

                <div style="padding:20px;background:#eef2ff;border:1px solid #c7d2fe;border-radius:14px;text-align:center">
                  <p style="margin:0 0 10px;color:#4338ca;font-size:12px;font-weight:bold;letter-spacing:2px">
                    YOUR VERIFICATION CODE
                  </p>
                  <div style="font-size:34px;font-weight:bold;letter-spacing:10px;color:#312e81">
                    ${otp}
                  </div>
                </div>

                <p style="margin:20px 0 0;color:#64748b;font-size:13px;line-height:1.7">
                  This code expires in 2 hours. Never share your verification code with anyone.
                </p>

                <hr style="margin:26px 0;border:0;border-top:1px solid #e2e8f0" />

                <p style="margin:0;color:#94a3b8;font-size:12px;line-height:1.6">
                  If you did not create a Zeric account, you can safely ignore this email.
                </p>
              </div>
            </div>
          </div>
        `,
      });
    } catch (emailError) {
      console.error("Owner registration email error:", emailError);

      await owners.deleteOne({ _id: result.insertedId });

      return NextResponse.json(
        {
          success: false,
          error: "Unable to send the verification email. Please try again.",
        },
        { status: 502 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: "Registration started. Check your email for the verification code.",
        email: normalizedEmail,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Owner registration error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Registration failed. Please try again.",
      },
      { status: 500 }
    );
  }
}

function escapeHtml(value) {
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
