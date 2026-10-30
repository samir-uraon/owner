
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { ObjectId } from "mongodb";

import clientPromise from "@/lib/mongodb";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export const dynamic = "force-dynamic";

const TEAM_ROLES = ["doctor", "staff"];

function json(data, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store, max-age=0",
    },
  });
}

function validId(value) {
  return (
    typeof value === "string" &&
    ObjectId.isValid(value)
  );
}

function cleanString(value, maxLength = 200) {
  return typeof value === "string"
    ? value.trim().slice(0, maxLength)
    : "";
}

function normalizeEmail(value) {
  return typeof value === "string"
    ? value.trim().toLowerCase()
    : "";
}

/**
 * Normalize services to:
 * [{ name: "General Consultation", charge: 500 }]
 *
 * Supports older string-based services as well.
 */
function cleanServices(value) {
  let services = value;

  if (typeof services === "string") {
    services = services.split(",");
  }

  if (!Array.isArray(services)) {
    return [];
  }

  const result = [];
  const seen = new Set();

  for (const item of services.slice(0, 100)) {
    let name = "";
    let charge = 0;

    if (typeof item === "string") {
      name = cleanString(item, 100);
    } else if (
      item &&
      typeof item === "object" &&
      !Array.isArray(item)
    ) {
      name = cleanString(item.name, 100);

      if (
        item.charge === "" ||
        item.charge === null ||
        item.charge === undefined
      ) {
        continue;
      }

      charge = Number(item.charge);

      if (
        !Number.isFinite(charge) ||
        charge < 0 ||
        charge > 100000000
      ) {
        continue;
      }
    } else {
      continue;
    }

    if (!name) continue;

    const key = name.toLowerCase();

    if (seen.has(key)) continue;

    seen.add(key);
    result.push({ name, charge });
  }

  return result;
}

/**
 * Find the logged-in team member.
 *
 * First checks the team member's own ID.
 * Email lookup is case-insensitive.
 *
 * Do not use ownerId as a member ID fallback:
 * ownerId identifies the owner, not the team member.
 */
async function findMember(db, session, role) {
  const userId = String(session?.user?.id || "");
  const email = normalizeEmail(session?.user?.email);

  const conditions = [];

  if (validId(userId)) {
    conditions.push({
      _id: new ObjectId(userId),
    });
  }

  if (email) {
    conditions.push({
      email: {
        $regex: `^${email.replace(
          /[.*+?^${}()|[\]\\]/g,
          "\\$&"
        )}$`,
        $options: "i",
      },
    });
  }

  if (!conditions.length) {
    return null;
  }

  return db.collection("team").findOne({
    role: {
      $regex: `^${role}$`,
      $options: "i",
    },
    $or: conditions,
  });
}

/**
 * GET /api/team/profile?role=doctor
 * GET /api/team/profile?role=staff
 */
export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return json(
        { error: "Unauthorized" },
        401
      );
    }

    const { searchParams } = new URL(request.url);

    const role = cleanString(
      searchParams.get("role"),
      30
    ).toLowerCase();

    if (!TEAM_ROLES.includes(role)) {
      return json(
        { error: "Invalid team role" },
        400
      );
    }

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB);

    const member = await findMember(
      db,
      session,
      role
    );

    if (!member) {
      return json(
        { error: "Team member not found" },
        404
      );
    }

    return json({
      success: true,
      profile: {
        id: String(member._id),
        name: member.name || "",
        email:
          member.email ||
          session.user.email ||
          "",
        phone: member.phone || "",
        image:
          member.image ||
          member.imageUrl ||
          "",
        role: member.role || role,
        specialization:
          member.specialization || "",
        experience: member.experience ?? "",
        fee: member.fee ?? "",
        bookingCharge:
          member.bookingCharge ?? "",
        duration: member.duration ?? "",
        services: cleanServices(member.services),
      },
    });
  } catch (error) {
    console.error(
      "GET /api/team/profile:",
      error
    );

    return json(
      { error: "Failed to load profile" },
      500
    );
  }
}

/**
 * PUT /api/team/profile
 *
 * Saves profile changes directly to the team collection.
 * Services are saved for both doctors and staff.
 */
export async function PUT(request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return json(
        { error: "Unauthorized" },
        401
      );
    }

    const body = await request.json();

    const role = cleanString(
      body.role,
      30
    ).toLowerCase();

    if (!TEAM_ROLES.includes(role)) {
      return json(
        { error: "Invalid team role" },
        400
      );
    }

    const name = cleanString(body.name, 120);
    const phone = cleanString(body.phone, 30);

    const image = cleanString(
      body.image ?? body.imageUrl,
      2000
    );

    if (!name) {
      return json(
        { error: "Name is required" },
        400
      );
    }

    if (
      phone &&
      !/^[6-9]\d{9}$/.test(phone)
    ) {
      return json(
        {
          error:
            "Enter a valid 10-digit Indian mobile number",
        },
        400
      );
    }

    const update = {
      name,
      phone: phone || null,
      image,
      imageUrl: image,
      updatedAt: new Date(),
    };

    if (role === "doctor") {
      const specialization = cleanString(
        body.specialization,
        120
      );

      const experience =
        body.experience === "" ||
        body.experience == null
          ? ""
          : Number(body.experience);

      const fee =
        body.fee === "" || body.fee == null
          ? ""
          : Number(body.fee);

      if (
        experience !== "" &&
        (
          !Number.isFinite(experience) ||
          experience < 0 ||
          experience > 100
        )
      ) {
        return json(
          { error: "Invalid experience" },
          400
        );
      }

      if (
        fee !== "" &&
        (
          !Number.isFinite(fee) ||
          fee < 0 ||
          fee > 100000000
        )
      ) {
        return json(
          {
            error: "Invalid consultation fee",
          },
          400
        );
      }

      update.specialization = specialization;
      update.experience = experience;
      update.fee = fee;

      // Doctors can also have multiple services with charges.
      update.services = cleanServices(
        body.services
      );

      if (body.bookingCharge !== undefined) {
        const bookingCharge =
          body.bookingCharge === "" ||
          body.bookingCharge == null
            ? ""
            : Number(body.bookingCharge);

        if (
          bookingCharge !== "" &&
          (
            !Number.isFinite(bookingCharge) ||
            bookingCharge < 0 ||
            bookingCharge > 100000000
          )
        ) {
          return json(
            {
              error: "Invalid booking charge",
            },
            400
          );
        }

        update.bookingCharge = bookingCharge;
      }
    } else {
      // Staff services are also stored as objects with charges.
      update.services = cleanServices(
        body.services
      );
    }

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB);

    const member = await findMember(
      db,
      session,
      role
    );

    if (!member) {
      return json(
        { error: "Team member not found" },
        404
      );
    }

    // Update only the matched team member.
    const updateResult = await db
      .collection("team")
      .updateOne(
        {
          _id: member._id,
          role: {
            $regex: `^${role}$`,
            $options: "i",
          },
        },
        {
          $set: update,
        }
      );

    if (!updateResult.matchedCount) {
      return json(
        { error: "Team member not found" },
        404
      );
    }

    const updatedMember = await db
      .collection("team")
      .findOne({
        _id: member._id,
      });

    return json({
      success: true,
      message: "Profile updated successfully",
      profile: {
        id: String(updatedMember._id),
        name: updatedMember.name || "",
        email:
          updatedMember.email ||
          session.user.email ||
          "",
        phone: updatedMember.phone || "",
        image:
          updatedMember.image ||
          updatedMember.imageUrl ||
          "",
        role: updatedMember.role || role,
        specialization:
          updatedMember.specialization || "",
        experience: updatedMember.experience ?? "",
        fee: updatedMember.fee ?? "",
        bookingCharge:
          updatedMember.bookingCharge ?? "",
        duration: updatedMember.duration ?? "",
        services: cleanServices(
          updatedMember.services
        ),
      },
    });
  } catch (error) {
    console.error(
      "PUT /api/team/profile:",
      error
    );

    return json(
      { error: "Failed to update profile" },
      500
    );
  }
}
