import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import clientPromise from "@/lib/mongodb";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

 
const VALID_ROLES = ["doctor"];
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const COLLECTION_NAME = "teamSessions";

function json(data, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store, max-age=0",
    },
  });
}

async function getDoctorContext() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return { error: "Unauthorized.", status: 401 };
  }

  const userId = String(session.user.id || session.user._id || "");

  if (
    !userId ||
    !VALID_ROLES.includes(
      String(session.user.role || "").toLowerCase()
    )
  ) {
    return { error: "Forbidden.", status: 403 };
  }

  return { userId };
}

function validateDate(date) {
  if (!DATE_PATTERN.test(date || "")) return false;

  const parsed = new Date(`${date}T00:00:00.000Z`);

  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === date
  );
}

async function getDatabase() {
  const client = await clientPromise;
  const db = client.db(process.env.MONGODB);

  // MongoDB automatically removes documents when expiresAt is reached.
  await db.collection(COLLECTION_NAME).createIndex(
    { expiresAt: 1 },
    {
      expireAfterSeconds: 0,
      name: "teamSessions_expiry_ttl",
    }
  );

  return db;
}

export async function GET(request) {
  try {
    const context = await getDoctorContext();

    if (context.error) {
      return json({ error: context.error }, context.status);
    }

    const { searchParams } = new URL(request.url);
    const role = String(searchParams.get("role") || "").toLowerCase();
    const date = searchParams.get("date") || "";

    if (role !== "doctor") {
      return json({ error: "Invalid role." }, 400);
    }

    if (!validateDate(date)) {
      return json({ error: "A valid date is required." }, 400);
    }

    const db = await getDatabase();

    const sessions = await db
      .collection(COLLECTION_NAME)
      .find({
        doctorId: context.userId,
        date,
      })
      .project({
        _id: 0,
        sessionId: 1,
        sessionLabel: 1,
        status: 1,
        startedAt: 1,
        closedAt: 1,
      })
      .toArray();

    return json({ sessions });
  } catch (error) {
    console.error("GET /api/team/session:", error);

    return json(
      { error: "Unable to load session states." },
      500
    );
  }
}


export async function POST(request) {
  try {
    const context = await getDoctorContext();

    if (context.error) {
      return json({ error: context.error }, context.status);
    }

    const body = await request.json();
    const now = new Date();

    const role = String(body.role || "").toLowerCase();
    const date = String(body.date || "").trim();
    const sessionId = String(body.sessionId || "").trim();
    const sessionLabel = String(body.sessionLabel || "").trim();

    // Read slot times directly from request body
    const slotOpen = String(body.slotOpen || "").trim();
    const slotClose = String(body.slotClose || "").trim();

    const action = String(body.action || "").trim();

    // Validation
    if (role !== "doctor") {
      return json({ error: "Invalid role." }, 400);
    }

    if (!validateDate(date)) {
      return json({ error: "A valid date is required." }, 400);
    }

    if (!sessionId || !sessionLabel) {
      return json(
        { error: "Session ID and label are required." },
        400
      );
    }

    if (!slotOpen || !slotClose) {
      return json({ error: "Slot times are required." }, 400);
    }

    if (
      !["start-session", "cancel-session", "close-session"].includes(action)
    ) {
      return json({ error: "Invalid session action." }, 400);
    }

    const db = await getDatabase();

    const sessionCollection = db.collection(COLLECTION_NAME);
    const bookingCollection = db.collection("bookings");

    // Match particular doctor's session
    const filter = {
      doctorId: context.userId,
      date,
      sessionId,
    };

    // Match bookings belonging to this exact time slot
    const bookingFilter = {
      doctorId: context.userId,
      date,
      "slot.open": slotOpen,
      "slot.close": slotClose,
      status: "waiting",
    };

    const existing = await sessionCollection.findOne(filter);

    // START SESSION
    if (action === "start-session") {
      if (
        existing?.cancel === true ||
        existing?.status === "closed"
      ) {
        return json(
          { error: "This session has already been cancelled or closed." },
          409
        );
      }

      const startedAt = existing?.startedAt || now;

      const expiresAt =
        existing?.expiresAt ||
        new Date(startedAt.getTime() + 24 * 60 * 60 * 1000);

      await sessionCollection.updateOne(
        filter,
        {
          $setOnInsert: {
            ...filter,
            createdAt: now,
            startedAt,
            expiresAt,
          },
          $set: {
            sessionLabel,
            slotOpen,
            slotClose,
            status: "active",
            cancel: false,
            updatedAt: now,
          },
        },
        { upsert: true }
      );

      const bookingResult = await bookingCollection.updateMany(
        bookingFilter,
        {
          $set: {
            arrivalTime: startedAt,
            updatedAt: now,
          },
        }
      );

      return json({
        success: true,
        message: "Session started successfully.",
        sessionId,
        slotOpen,
        slotClose,
        bookingsUpdated: bookingResult.modifiedCount,
      });
    }

  // CANCEL SESSION OR CLOSE SESSION
if (
  action === "cancel-session" ||
  action === "close-session"
) {
  await sessionCollection.updateOne(
    filter,
    {
      $setOnInsert: {
        ...filter,
        createdAt: now,
      },
      $set: {
        sessionLabel,
        slotOpen,
        slotClose,
        status: "closed",
        cancel: true,
        closedAt: now,
        updatedAt: now,
      },
    },
    { upsert: true }
  );

  // Update only waiting bookings of this exact session
  const bookingResult = await bookingCollection.updateMany(
    {
      doctorId: context.userId,
      date,
      "slot.open": slotOpen,
      "slot.close": slotClose,
      status: "waiting",
    },
    {
      $set: {
        status: "pending",
        bydoctor: true,
        updatedAt: now,
      },
    }
  );

  const saved = await sessionCollection.findOne(
    filter,
    {
      projection: {
        _id: 0,
        sessionId: 1,
        sessionLabel: 1,
        slotOpen: 1,
        slotClose: 1,
        status: 1,
        cancel: 1,
        startedAt: 1,
        closedAt: 1,
      },
    }
  );

  return json({
    success: true,
    message:
      action === "cancel-session"
        ? "Session cancelled successfully. Waiting bookings moved to pending."
        : "Session closed successfully. Waiting bookings moved to pending.",
    session: saved,
    bookingsUpdated: bookingResult.modifiedCount,
  });
}

  } catch (error) {
    console.error("POST /api/team/session:", error);

    return json(
      { error: "Unable to update session." },
      500
    );
  }
}
