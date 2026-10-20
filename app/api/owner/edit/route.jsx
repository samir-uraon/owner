 import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import clientPromise from "@/lib/mongodb";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

const MOBILE_REGEX = /^[6-9]\d{9}$/;

function jsonError(message, status = 400) {
  return NextResponse.json({ message }, { status });
}

async function getContext() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return { error: jsonError("Unauthorized.", 401) };
  }

  const client = await clientPromise;
  const db = client.db(process.env.MONGODB);
  const users = db.collection("users");

  const email = session.user.email.trim();

  const user = await users.findOne({
    email: { $regex: `^${escapeRegex(email)}$`, $options: "i" },
  });

  if (!user) {
    return { error: jsonError("User account not found.", 404) };
  }

  return { users, user };
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getSavedPhone(user) {
  return String(user.phone ?? user.mobile ?? "");
}

function publicUser(user) {
  return {
    name: user.name || "",
    email: user.email || "",
    phone: getSavedPhone(user),
  };
}

export async function GET(request) {
  try {
    const context = await getContext();

    if (context.error) return context.error;

    const { users, user } = context;
    const { searchParams } = new URL(request.url);
    const requestedPhone = searchParams.get("phone");

    if (requestedPhone !== null) {
      const phone = requestedPhone.trim();

      if (!MOBILE_REGEX.test(phone)) {
        return jsonError("Enter a valid 10-digit Indian mobile number.");
      }

      // Do not report the current user's own number as a duplicate.
      if (phone === getSavedPhone(user)) {
        return NextResponse.json({ available: true });
      }

      const duplicate = await users.findOne({
        _id: { $ne: user._id },
        $or: [{ phone }, { mobile: phone }],
      });

      return NextResponse.json({
        available: !duplicate,
      });
    }

    return NextResponse.json({
      user: publicUser(user),
    });
  } catch (error) {
    console.error("GET /api/owner/edit:", error);
    return jsonError("Unable to load profile.", 500);
  }
}

export async function PATCH(request) {
  try {
    const context = await getContext();

    if (context.error) return context.error;

    const { users, user } = context;

    let body;

    try {
      body = await request.json();
    } catch {
      return jsonError("Invalid request body.");
    }

    const name =
      typeof body.name === "string" ? body.name.trim() : "";

    if (!name) {
      return jsonError("Name is required.");
    }

    if (name.length > 100) {
      return jsonError("Name cannot exceed 100 characters.");
    }

    const currentPhone = getSavedPhone(user);
    const phoneWasProvided = Object.prototype.hasOwnProperty.call(
      body,
      "phone"
    );

    const phone =
      phoneWasProvided && typeof body.phone === "string"
        ? body.phone.trim()
        : currentPhone;

    const phoneChanged = phone !== currentPhone;

    if (phoneChanged && !MOBILE_REGEX.test(phone)) {
      return jsonError("Enter a valid 10-digit Indian mobile number.");
    }

    if (phoneChanged) {
      const duplicate = await users.findOne({
        _id: { $ne: user._id },
        $or: [{ phone }, { mobile: phone }],
      });

      if (duplicate) {
        return jsonError(
          "This phone number is already registered.",
          409
        );
      }
    }

    const updateFields = {
      name,
      updatedAt: new Date(),
    };

    if (phoneChanged) {
      // Preserve the field convention already used by this user record.
      if (
        Object.prototype.hasOwnProperty.call(user, "mobile") &&
        !Object.prototype.hasOwnProperty.call(user, "phone")
      ) {
        updateFields.mobile = phone;
      } else {
        updateFields.phone = phone;
      }
    }

    await users.updateOne(
      { _id: user._id },
      { $set: updateFields }
    );

    const updatedUser = await users.findOne({ _id: user._id });

    return NextResponse.json({
      message: "Profile updated successfully.",
      user: publicUser(updatedUser || { ...user, ...updateFields }),
    });
  } catch (error) {
    console.error("PATCH /api/owner/edit:", error);
    return jsonError("Unable to update profile.", 500);
  }
}
 