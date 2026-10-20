
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { ObjectId } from "mongodb";
import clientPromise from "@/lib/mongodb";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export const dynamic = "force-dynamic";

function json(data, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}

function validId(value) {
  return typeof value === "string" && ObjectId.isValid(value);
}

function dateKey(value) {
  if (!value) return "";

  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return `${values.year}-${values.month}-${values.day}`;
}

function normalizeBooking(booking) {
  const patient = booking.patient || booking.customer || {};

  return {
    id: String(booking._id),
    _id: String(booking._id),
    token:
      booking.token ||
      booking.tokenNumber ||
      (booking.sequence != null ? `A${String(booking.sequence).padStart(3, "0")}` : "—"),
    name:
      patient.name ||
      booking.patientName ||
      booking.customerName ||
      booking.name ||
      "Customer",
    phone:
      patient.phone ||
      booking.phone ||
      booking.customerPhone ||
      "",
    age: patient.age ?? booking.age ?? "",
    gender: patient.gender || booking.gender || "",
    type: patient.type || booking.patientType || "",
    status: String(booking.status || "waiting").toLowerCase(),
    paymentStatus: String(booking.paymentStatus || "unpaid").toLowerCase(),
    expectedTurnAt:
      booking.expectedTurnAt ||
      booking.expectedTurn ||
      booking.checkupTime ||
      null,
    createdAt: booking.createdAt || booking.bookingDate || null,
    date: dateKey(
      booking.date ||
        booking.bookingDate ||
        booking.createdAt ||
        booking.expectedTurnAt,
    ),
    slot: booking.slot || booking.slotTime || "",
    priority: booking.priority || "normal",
  };
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
    const date = String(searchParams.get("date") || "").trim();
    const slot = String(searchParams.get("slot") || "").trim();

    if (!["doctor", "staff"].includes(role)) {
      return json({ error: "Invalid team role" }, 400);
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return json({ error: "A valid date is required (YYYY-MM-DD)" }, 400);
    }

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB);

    const userId = String(session.user.id || "");
    const email = String(session.user.email || "").trim().toLowerCase();

    const memberConditions = [];

    if (validId(userId)) {
      memberConditions.push({ _id: new ObjectId(userId) });
      memberConditions.push({ ownerId: new ObjectId(userId) });
    }

    if (email) {
      memberConditions.push({ email });
    }

    if (!memberConditions.length) {
      return json({ error: "Unable to identify team member" }, 401);
    }

    const member = await db.collection("team").findOne({
      role,
      $or: memberConditions,
    });

    if (!member) {
      return json({ error: "Team member not found" }, 404);
    }

    const query = {
      $or: [
        ...(validId(String(member._id))
          ? [
              { doctorId: String(member._id) },
              { doctorId: member._id },
              { teamId: String(member._id) },
              { teamId: member._id },
            ]
          : []),
        ...(member.clinicId && validId(String(member.clinicId))
          ? [
              {
                clinicId: String(member.clinicId),
                doctorId: { $exists: false },
              },
              {
                clinicId: new ObjectId(String(member.clinicId)),
                doctorId: { $exists: false },
              },
            ]
          : []),
      ],
    };

    if (!query.$or.length) {
      return json({ customers: [] });
    }

    const rawBookings = await db
      .collection("bookings")
      .find(query)
      .sort({ sequence: 1, createdAt: 1 })
      .toArray();

    const customers = rawBookings
      .map(normalizeBooking)
      .filter((booking) => {
        if (booking.date !== date) return false;

        if (slot) {
          return booking.slot === slot;
        }

        return true;
      });

    return json({ customers });
  } catch (error) {
    console.error("GET /api/dashboard/slot-customers:", error);
    return json({ error: "Failed to load slot customers" }, 500);
  }
}
