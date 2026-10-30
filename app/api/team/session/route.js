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

    const role = String(body.role || "").toLowerCase();
    const date = String(body.date || "");
    const sessionId = String(body.sessionId || "").trim();
    const sessionLabel = String(body.sessionLabel || "").trim();
    const action = String(body.action || "");

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

    if (!["start-session", "close-session"].includes(action)) {
      return json({ error: "Invalid session action." }, 400);
    }

    const db = await getDatabase();
    const collection = db.collection(COLLECTION_NAME);

    const filter = {
      doctorId: context.userId,
      date,
      sessionId,
    };

    const existing = await collection.findOne(filter);

    if (action === "start-session") {
      if (existing?.status === "closed") {
        return json(
          { error: "This session has already been closed." },
          409
        );
      }

      const now = new Date();

      // Expire the session 24 hours after it is first created.
      const expiresAt = new Date(
        now.getTime() + 24 * 60 * 60 * 1000
      );

      await collection.updateOne(
        filter,
        {
          $setOnInsert: {
            ...filter,
            createdAt: now,
            status: "active",
            startedAt: now,
            expiresAt,
          },
          $set: {
            sessionLabel,
            updatedAt: now,
          },
        },
        { upsert: true }
      );
    }

    if (action === "close-session") {
      if (!existing || existing.status !== "active") {
        return json(
          { error: "Only an active session can be closed." },
          409
        );
      }

      const now = new Date();

      await collection.updateOne(filter, {
        $set: {
          status: "closed",
          closedAt: now,
          updatedAt: now,
          sessionLabel,
        },
      });
    }

    const saved = await collection.findOne(filter, {
      projection: {
        _id: 0,
        sessionId: 1,
        sessionLabel: 1,
        status: 1,
        startedAt: 1,
        closedAt: 1,
        expiresAt: 1,
      },
    });

    return json({
      message:
        action === "start-session"
          ? "Session started."
          : "Session closed.",
      session: saved,
    });
  } catch (error) {
    console.error("POST /api/team/session:", error);

    return json(
      { error: "Unable to update session." },
      500
    );
  }
}