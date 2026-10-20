
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
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}

function validId(value) {
  return typeof value === "string" && ObjectId.isValid(value);
}

async function findMember(db, session, role) {
  const userId = String(session.user.id || "");
  const email = String(session.user.email || "").trim().toLowerCase();

  const conditions = [];

  if (validId(userId)) {
    conditions.push({ _id: new ObjectId(userId) });
    conditions.push({ ownerId: new ObjectId(userId) });
  }

  if (email) {
    conditions.push({ email });
  }

  if (!conditions.length) return null;

  return db.collection("team").findOne({
    role,
    $or: conditions,
  });
}

export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return json({ error: "Unauthorized" }, 401);
    }

    const { searchParams } = new URL(request.url);
    const role = String(searchParams.get("role") || "")
      .trim()
      .toLowerCase();

    if (!TEAM_ROLES.includes(role)) {
      return json({ error: "Invalid team role" }, 400);
    }

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB);
    const member = await findMember(db, session, role);

    if (!member) {
      return json({ error: "Team member not found" }, 404);
    }

    return json({
      profile: {
        id: String(member._id),
        name: member.name || "",
        email: member.email || session.user.email || "",
        phone: member.phone || "",
        image: member.image || member.imageUrl || "",
        role: member.role || role,
        specialization: member.specialization || "",
        experience: member.experience ?? "",
        fee: member.fee ?? "",
        services: Array.isArray(member.services) ? member.services : [],
      },
    });
  } catch (error) {
    console.error("GET /api/team/profile:", error);
    return json({ error: "Failed to load profile" }, 500);
  }
}

export async function PUT(request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return json({ error: "Unauthorized" }, 401);
    }

    const body = await request.json();
    const role = String(body.role || "")
      .trim()
      .toLowerCase();

    if (!TEAM_ROLES.includes(role)) {
      return json({ error: "Invalid team role" }, 400);
    }

    const name = String(body.name || "").trim();
    const phone = String(body.phone || "").trim();
    const image = String(body.image || body.imageUrl || "").trim();

    if (!name) {
      return json({ error: "Name is required" }, 400);
    }

    if (phone && !/^[6-9]\d{9}$/.test(phone)) {
      return json({ error: "Enter a valid 10-digit Indian mobile number" }, 400);
    }

    const update = {
      name,
      phone,
      image,
      updatedAt: new Date(),
    };

    if (role === "doctor") {
      update.specialization = String(body.specialization || "").trim();

      const experience = Number(body.experience);
      const fee = Number(body.fee);

      if (
        body.experience !== "" &&
        body.experience != null &&
        (!Number.isFinite(experience) || experience < 0)
      ) {
        return json({ error: "Invalid experience" }, 400);
      }

      if (
        body.fee !== "" &&
        body.fee != null &&
        (!Number.isFinite(fee) || fee < 0)
      ) {
        return json({ error: "Invalid consultation fee" }, 400);
      }

      update.experience =
        body.experience === "" || body.experience == null
          ? ""
          : experience;

      update.fee =
        body.fee === "" || body.fee == null
          ? ""
          : fee;
    } else {
      update.services = Array.isArray(body.services)
        ? body.services
            .map((service) => String(service).trim())
            .filter(Boolean)
        : typeof body.services === "string"
          ? body.services
              .split(",")
              .map((service) => service.trim())
              .filter(Boolean)
          : [];
    }

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB);
    const member = await findMember(db, session, role);

    if (!member) {
      return json({ error: "Team member not found" }, 404);
    }

    await db.collection("team").updateOne(
      { _id: member._id, role },
      { $set: update },
    );

    return json({
      success: true,
      profile: {
        ...update,
        id: String(member._id),
        email: member.email || session.user.email || "",
        role,
      },
    });
  } catch (error) {
    console.error("PUT /api/team/profile:", error);
    return json({ error: "Failed to update profile" }, 500);
  }
}
