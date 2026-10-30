import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { ObjectId } from "mongodb";
import clientPromise from "@/lib/mongodb";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

const TIME_ZONE = "Asia/Kolkata";
const VALID_ROLES = ["doctor", "staff"];

function json(data, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store, no-cache, max-age=0, must-revalidate",
      Pragma: "no-cache",
    },
  });
}

function validId(value) {
  return (
    typeof value === "string" &&
    ObjectId.isValid(value) &&
    String(new ObjectId(value)) === value.toLowerCase()
  );
}

function idVariants(value) {
  if (value == null || value === "") return [];

  const stringId = String(value).trim();
  if (!stringId) return [];

  const variants = [stringId];

  if (validId(stringId)) {
    variants.push(new ObjectId(stringId));
  }

  return variants;
}

function dateKey(value) {
  if (!value) return "";

  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  const parsed = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(parsed.getTime())) return "";

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(parsed);

  const values = Object.fromEntries(
    parts.map(({ type, value }) => [type, value])
  );

  return `${values.year}-${values.month}-${values.day}`;
}

function normalizeSlot(slot) {
  if (!slot) return "";

  if (typeof slot === "string") return slot.trim();

  if (typeof slot === "object") {
    const open = String(slot.open || slot.start || slot.from || "").trim();
    const close = String(slot.close || slot.end || slot.to || "").trim();

    if (slot.value) return String(slot.value).trim();
    if (open && close) return `${open}-${close}`;

    return open || close || slot.label || "";
  }

  return String(slot).trim();
}

function normalizeBooking(booking) {
  const patient = booking.patient || booking.customer || {};
  const slotObject =
    booking.slot && typeof booking.slot === "object" ? booking.slot : {};

  const slotLabel = normalizeSlot(booking.slotTime || booking.slot);

  return {
    id: String(booking._id),
    _id: String(booking._id),
    bookingReference: booking.bookingReference || "",

    token:
      booking.token ||
      booking.tokenNumber ||
      (booking.sequence != null
        ? `A${String(booking.sequence).padStart(3, "0")}`
        : "—"),

    sequence: booking.sequence ?? null,

    name:
      patient.name ||
      booking.patientName ||
      booking.customerName ||
      booking.name ||
      "Customer",

    phone:
      patient.phone ||
      booking.patientPhone ||
      booking.phone ||
      booking.customerPhone ||
      "",

    email: patient.email || booking.userEmail || "",
    age: patient.age ?? booking.age ?? "",
    gender: patient.gender || booking.gender || "",
    type: patient.type || booking.patientType || "",

    status: String(booking.status || "waiting").toLowerCase(),
    paymentStatus: String(booking.paymentStatus || "unpaid").toLowerCase(),

    paymentId: booking.paymentId || null,
    amount: booking.amount ?? null,
    currency: booking.currency || "INR",

    expectedTurnAt:
      booking.expectedTurnAt ||
      booking.expectedTurn ||
      booking.checkupTime ||
      null,

    createdAt: booking.createdAt || booking.bookingDate || null,
    updatedAt: booking.updatedAt || null,

    date: dateKey(
      booking.date ||
        booking.bookingDate ||
        booking.createdAt ||
        booking.expectedTurnAt
    ),

    slot: slotLabel,
    slotValue: slotLabel,
    slotOpen: slotObject.open || "",
    slotClose: slotObject.close || "",
    checkupStartTime: slotObject.checkupStartTime || "",

    duration: booking.duration ?? null,
    serviceName: booking.serviceName || "Consultation",
    priority: String(
      booking.priority ||
        booking.bookingPriority ||
        booking.urgency ||
        "normal"
    ).toLowerCase(),

    isEmergency:
      booking.isEmergency === true ||
      String(booking.priority || "").toLowerCase().includes("emergency"),
    isElderly:
      booking.isElderly === true ||
      String(booking.priority || "").toLowerCase().includes("elderly"),

    clinicId: booking.clinicId ? String(booking.clinicId) : "",
    clinicName: booking.clinicName || "",
    address: booking.address || "",

    doctorId: booking.doctorId ? String(booking.doctorId) : "",
    doctorName: booking.doctorName || "",
    staffId: booking.staffId ? String(booking.staffId) : "",
    staffName: booking.staffName || "",
  };
}

function buildBookingQuery(userId, role) {
  const variants = idVariants(userId);
  if (!variants.length) return null;

  const assignmentField = role === "doctor" ? "doctorId" : "staffId";

  return {
    $or: variants.map((id) => ({
      [assignmentField]: id,
    })),
  };
}

function isValidDate(date) {
  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return false;
  }

  const [year, month, day] = date.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));

  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}

function bookingDateQuery(date) {
  const start = new Date(`${date}T00:00:00.000+05:30`);
  const end = new Date(`${date}T00:00:00.000+05:30`);
  end.setUTCDate(end.getUTCDate() + 1);

  return {
    $or: [
      { date },
      { bookingDate: date },
      { createdAt: { $gte: start, $lt: end } },
      { bookingDate: { $gte: start, $lt: end } },
    ],
  };
}

async function getAuthorizedContext(request, method) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return { response: json({ error: "Unauthorized" }, 401) };
  }

  const role = String(session.user.role || "").trim().toLowerCase();

  if (!VALID_ROLES.includes(role)) {
    return { response: json({ error: "Forbidden" }, 403) };
  }

  const client = await clientPromise;
  const db = client.db(process.env.MONGODB);

  return {
    session,
    role,
    userId: String(session.user.id).trim(),
    client,
    db,
  };
}

export async function GET(request) {
  try {
    const context = await getAuthorizedContext(request, "GET");
    if (context.response) return context.response;

    const { session, role, userId, db } = context;
    const { searchParams } = new URL(request.url);

    const requestedRole = String(searchParams.get("role") || "")
      .trim()
      .toLowerCase();

    const date = String(searchParams.get("date") || "").trim();
    const requestedSlot = String(searchParams.get("slot") || "").trim();

    if (!VALID_ROLES.includes(requestedRole)) {
      return json({ error: "Invalid team role" }, 400);
    }

    if (!isValidDate(date)) {
      return json({ error: "A valid date is required (YYYY-MM-DD)" }, 400);
    }

    if (String(session.user.role || "").trim().toLowerCase() !== requestedRole) {
      return json({ error: "Forbidden" }, 403);
    }

    const bookingQuery = buildBookingQuery(userId, requestedRole);

    if (!bookingQuery) {
      return json({ error: "Invalid team member ID" }, 400);
    }

    const rawBookings = await db
      .collection("bookings")
      .find(bookingQuery)
      .sort({ sequence: 1, createdAt: 1 })
      .toArray();

    const customers = rawBookings
      .map(normalizeBooking)
      .filter((booking) => {
        if (booking.date !== date) return false;
        if (requestedSlot && booking.slot !== requestedSlot) return false;
        return true;
      });

    return json({
      customers,
      total: customers.length,
      date,
      slot: requestedSlot,
    });
  } catch (error) {
    console.error("GET /api/team/customer:", error);
    return json({ error: "Failed to load slot customers" }, 500);
  }
}

/**
 * POST /api/team/customer
 * Accepts manual patient bookings from Doctor / Staff dashboard.
 */

export async function POST(request) {
  try {
    const context = await getAuthorizedContext(request, "POST");
    if (context.response) return context.response;

    const { session, role, userId, db } = context;

    let body;

    try {
      body = await request.json();
    } catch {
      return json({ error: "Invalid JSON body" }, 400);
    }

    // 1. Normalize patient details
    const patient =
      body.patient && typeof body.patient === "object"
        ? body.patient
        : {};

    const patientName = String(
      patient.name || body.patientName || body.name || ""
    ).trim();

    const phone = String(
      body.phone || body.patientPhone || patient.phone || ""
    ).trim();

    const gender = String(
      patient.gender || body.gender || ""
    ).trim();

    const age =
      patient.age !== undefined &&
      patient.age !== null &&
      patient.age !== ""
        ? Number(patient.age)
        : null;

    const patientType = String(
      patient.type || "walk-in"
    ).trim();

    const date = String(body.date || "").trim();

    const priority = String(
      body.priority || "normal"
    ).toLowerCase();

    const serviceName = String(
      body.serviceName || body.service || "Consultation"
    ).trim();

    if (!patientName) {
      return json({ error: "Patient name is required" }, 400);
    }

    if (!isValidDate(date)) {
      return json(
        { error: "A valid date is required (YYYY-MM-DD)" },
        400
      );
    }

    if (
      age !== null &&
      (!Number.isInteger(age) || age < 0 || age > 130)
    ) {
      return json({ error: "Invalid patient age" }, 400);
    }

    if (!["normal", "elderly", "emergency"].includes(priority)) {
      return json({ error: "Invalid booking priority" }, 400);
    }

    // 2. Normalize session information.
    // Keep the original object for the MongoDB slot field.
    const rawSlot =
      body.slot && typeof body.slot === "object"
        ? body.slot
        : {};

    const normalizedSlot = normalizeSlot(body.slot);

    if (!normalizedSlot) {
      return json(
        { error: "A valid session slot is required" },
        400
      );
    }

    const slotDetails = {
      open: String(rawSlot.open || ""),
      close: String(rawSlot.close || ""),
      checkupStartTime: String(
        rawSlot.checkupStartTime ||
          rawSlot.checkupStart ||
          ""
      ),
    };

    const time = String(
      body.time ||
        slotDetails.checkupStartTime ||
        slotDetails.open ||
        (typeof body.slot === "string" ? body.slot : "") ||
        ""
    ).trim();

    if (!time) {
      return json(
        { error: "Appointment time is required" },
        400
      );
    }

    // 3. Get the authenticated user's profile.
    const userFilter = validId(userId)
      ? { _id: new ObjectId(userId) }
      : { id: userId };

    const userProfile = await db
      .collection("users")
      .findOne(userFilter);

    if (!userProfile) {
      return json(
        { error: "User profile not found" },
        404
      );
    }

    const doctorId =
      role === "doctor"
        ? String(userId)
        : String(
            userProfile.doctorId ||
              userProfile.assignedDoctorId ||
              ""
          );

    const doctorName = String(
      userProfile.name ||
        userProfile.fullName ||
        ""
    );

    const clinicId = String(
      userProfile.clinicId || ""
    );

    const clinicName = String(
      userProfile.businessName ||
        userProfile.clinicName ||
        ""
    );

    if (!doctorId || !clinicId) {
      return json(
        {
          error:
            "Doctor or clinic information is missing from the profile.",
        },
        400
      );
    }

    const doctorVariants = idVariants(doctorId);

    // 4. Count bookings for this doctor, date, and session.
    const countFilter = {
      doctorId: { $in: doctorVariants },
      ...bookingDateQuery(date),
    };

    const existingBookings = await db
      .collection("bookings")
      .find(countFilter)
      .toArray();

    const slotBookings = existingBookings.filter((booking) => {
      const existingSlot = normalizeSlot(
        booking.slotTime || booking.slot
      );

      return existingSlot === normalizedSlot;
    });

    const sequence = slotBookings.length + 1;
    const token = `A${String(sequence).padStart(3, "0")}`;

    // 5. Resolve the doctor's configured duration.
    const duration = Math.max(
      1,
      Number(userProfile.duration) || 20
    );

    // 6. Calculate an estimated turn time in Asia/Kolkata.
    // Existing bookings are used to determine this session's sequence.
    function getExpectedTurnAt(dateValue, timeValue, offsetMinutes) {
      const match = String(timeValue).match(
        /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i
      );

      if (!match) return null;

      let hours = Number(match[1]);
      const minutes = Number(match[2]);
      const meridiem = match[3].toUpperCase();

      if (
        hours < 1 ||
        hours > 12 ||
        minutes < 0 ||
        minutes > 59
      ) {
        return null;
      }

      if (meridiem === "AM") {
        hours = hours === 12 ? 0 : hours;
      } else {
        hours = hours === 12 ? 12 : hours + 12;
      }

      const localStart = new Date(
        `${dateValue}T${String(hours).padStart(2, "0")}:${String(
          minutes
        ).padStart(2, "0")}:00+05:30`
      );

      if (Number.isNaN(localStart.getTime())) {
        return null;
      }

      localStart.setMinutes(
        localStart.getMinutes() + offsetMinutes
      );

      return localStart;
    }

    const expectedTurnAt = getExpectedTurnAt(
      date,
      time,
      (sequence - 1) * duration
    );

    const now = new Date();

    // 7. Create the new booking in the target MongoDB format.
    const newBooking = {
      bookingReference: crypto.randomUUID(),

      token,
      sequence,

      // Keep ID representation consistent with the existing
      // customer API and database schema.
      userId: String(userId),
      userEmail: String(
        session?.user?.email || userProfile.email || ""
      ),

      clinicId,
      clinicName,
      address: String(userProfile.address || ""),

      doctorId,
      doctorName,
      duration,

      serviceName,
      date,
      time,

      slot: slotDetails,

      patient: {
        name: patientName,
        type: patientType,
        ...(age !== null ? { age } : {}),
        gender,
        ...(phone ? { phone } : {}),
      },

      priority,
      status: "waiting",

      // Staff-created bookings are unpaid unless your actual
      // payment workflow confirms payment.
      paymentStatus: "unpaid",

      ...(expectedTurnAt
        ? { expectedTurnAt }
        : {}),

      ...(role === "staff"
        ? {
            staffId: validId(userId)
              ? new ObjectId(userId)
              : userId,
          }
        : {}),

      createdAt: now,
      updatedAt: now,
    };

    const insertResult = await db
      .collection("bookings")
      .insertOne(newBooking);

    const createdBooking = {
      ...newBooking,
      _id: insertResult.insertedId,
    };

    return json(
      {
        success: true,
        message: "Patient booked successfully",
        customer: normalizeBooking(createdBooking),
      },
      201
    );
  } catch (error) {
    console.error("POST /api/team/customer:", error);

    return json(
      { error: "Failed to book patient" },
      500
    );
  }
}


/**
 * PATCH body parameters accepts both formats:
 * Format 1 (Explicit Action):
 * {
 *   "role": "doctor",
 *   "bookingId": "<MongoDB booking _id>",
 *   "action": "start" | "complete" | "cancel",
 *   "date": "YYYY-MM-DD",
 *   "slot": "09:00 AM-01:00 PM"
 * }
 * 
 * Format 2 (Status Target):
 * {
 *   "bookingId": "<MongoDB booking _id>",
 *   "status": "serving" | "completed" | "cancelled",
 *   "role": "doctor",
 *   "date": "YYYY-MM-DD"
 * }
 */
export async function PATCH(request) {
  let mongoSession;

  try {
    const context = await getAuthorizedContext(request, "PATCH");
    if (context.response) return context.response;

    const { session, role, userId, client, db } = context;

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: "Invalid JSON body" }, 400);
    }

    const requestedRole = String(body.role || role).trim().toLowerCase();
    const bookingId = String(body.bookingId || body.customerId || "").trim();
    
    // Support mapping from `status` field directly to internal `action`
    let action = String(body.action || "").trim().toLowerCase();
    if (!action && body.status) {
      const statusMap = {
        serving: "start",
        "in-progress": "start",
        completed: "complete",
        cancelled: "cancel",
        canceled: "cancel",
      };
      action = statusMap[String(body.status).toLowerCase()] || "";
    }

    const date = String(body.date || "").trim();
    let requestedSlot = String(body.slot || "").trim();

    if (!VALID_ROLES.includes(requestedRole) || requestedRole !== role) {
      return json({ error: "Forbidden: role mismatch" }, 403);
    }

    if (!validId(bookingId)) {
      return json({ error: "A valid bookingId is required" }, 400);
    }

    if (!["start", "complete", "cancel"].includes(action)) {
      return json(
        { error: 'Action must be "start", "complete", or "cancel"' },
        400
      );
    }

    if (!isValidDate(date)) {
      return json({ error: "A valid date is required (YYYY-MM-DD)" }, 400);
    }

    const assignmentField = role === "doctor" ? "doctorId" : "staffId";
    const assigneeVariants = idVariants(userId);

    if (!assigneeVariants.length) {
      return json({ error: "Invalid team member ID" }, 400);
    }

    const assignmentFilter = {
      _id: new ObjectId(bookingId),
      [assignmentField]: { $in: assigneeVariants },
    };

    const bookings = db.collection("bookings");
    const target = await bookings.findOne(assignmentFilter);

    if (!target) {
      return json({ error: "Booking not found or not assigned to you" }, 404);
    }

    const normalizedTarget = normalizeBooking(target);

    if (normalizedTarget.date !== date) {
      return json({ error: "Booking does not belong to this date" }, 409);
    }

    // Auto-populate slot if not provided in request body
    if (!requestedSlot) {
      requestedSlot = normalizedTarget.slot;
    }

    const currentStatus = String(target.status || "waiting").toLowerCase();

    if (action === "start" && currentStatus !== "waiting") {
      return json(
        { error: `Cannot start a booking with status "${currentStatus}"` },
        409
      );
    }

    if (action === "complete" && currentStatus !== "serving") {
      return json(
        { error: 'Only a patient with status "serving" can be completed' },
        409
      );
    }

    if (action === "cancel" && currentStatus === "completed") {
      return json(
        { error: "Completed bookings cannot be cancelled" },
        409
      );
    }

    const nextStatus =
      action === "start"
        ? "serving"
        : action === "complete"
        ? "completed"
        : "cancelled";

    const now = new Date();

    // Strategy 1: Attempt update inside a Session Transaction
    let updatedBooking = null;
    let conflict = null;
    let useTransaction = true;

    try {
      mongoSession = client.startSession();
      await mongoSession.withTransaction(async () => {
        conflict = null;
        updatedBooking = null;

        const freshTarget = await bookings.findOne(assignmentFilter, {
          session: mongoSession,
        });

        if (!freshTarget) {
          conflict = {
            status: 404,
            error: "Booking not found or not assigned to you",
          };
          return;
        }

        const freshStatus = String(
          freshTarget.status || "waiting"
        ).toLowerCase();

        if (action === "start") {
          if (freshStatus !== "waiting") {
            conflict = {
              status: 409,
              error: `Booking is no longer waiting (current status: ${freshStatus})`,
            };
            return;
          }

          const activeQuery = {
            [assignmentField]: { $in: assigneeVariants },
            status: { $in: ["serving", "in-progress"] },
            ...bookingDateQuery(date),
          };

          const activeBookings = await bookings
            .find(activeQuery, { session: mongoSession })
            .toArray();

          const otherActive = activeBookings.find((booking) => {
            if (String(booking._id) === bookingId) return false;

            const normalized = normalizeBooking(booking);
            return (
              normalized.date === date &&
              (!requestedSlot || normalized.slot === requestedSlot)
            );
          });

          if (otherActive) {
            conflict = {
              status: 409,
              error:
                "Another patient is already being checked. Mark that patient Done first.",
              activeBookingId: String(otherActive._id),
            };
            return;
          }
        } else if (action === "complete" && freshStatus !== "serving") {
          conflict = {
            status: 409,
            error: `Only a serving patient can be completed (current status: ${freshStatus})`,
          };
          return;
        }

        const updateFields = {
          status: nextStatus,
          updatedAt: now,
          ...(action === "start"
            ? { checkupStartedAt: now }
            : action === "complete"
            ? { checkupCompletedAt: now }
            : { cancelledAt: now }),
        };

        const result = await bookings.updateOne(
          {
            _id: freshTarget._id,
            [assignmentField]: { $in: assigneeVariants },
            status: freshTarget.status ?? "waiting",
          },
          { $set: updateFields },
          { session: mongoSession }
        );

        if (result.modifiedCount !== 1) {
          conflict = {
            status: 409,
            error: "Booking changed concurrently. Refresh and try again.",
          };
          return;
        }

        updatedBooking = await bookings.findOne(
          { _id: freshTarget._id },
          { session: mongoSession }
        );
      });
    } catch (txError) {
      useTransaction = false;
      // Fallback for standalone MongoDB deployments without replica set transactions
      if (
        txError?.code === 20 ||
        /transaction numbers are only allowed|replica set|does not support transactions/i.test(
          String(txError?.message || "")
        )
      ) {
        if (action === "start") {
          const activeQuery = {
            [assignmentField]: { $in: assigneeVariants },
            status: { $in: ["serving", "in-progress"] },
            ...bookingDateQuery(date),
          };

          const activeBookings = await bookings.find(activeQuery).toArray();
          const otherActive = activeBookings.find((booking) => {
            if (String(booking._id) === bookingId) return false;
            const normalized = normalizeBooking(booking);
            return (
              normalized.date === date &&
              (!requestedSlot || normalized.slot === requestedSlot)
            );
          });

          if (otherActive) {
            return json(
              {
                error:
                  "Another patient is already being checked. Mark that patient Done first.",
                activeBookingId: String(otherActive._id),
              },
              409
            );
          }
        }

        const updateFields = {
          status: nextStatus,
          updatedAt: now,
          ...(action === "start"
            ? { checkupStartedAt: now }
            : action === "complete"
            ? { checkupCompletedAt: now }
            : { cancelledAt: now }),
        };

        const result = await bookings.updateOne(
          {
            _id: new ObjectId(bookingId),
            [assignmentField]: { $in: assigneeVariants },
          },
          { $set: updateFields }
        );

        if (result.modifiedCount === 1) {
          updatedBooking = await bookings.findOne({
            _id: new ObjectId(bookingId),
          });
        }
      } else {
        throw txError;
      }
    }

    if (useTransaction && conflict) {
      return json(
        {
          error: conflict.error,
          ...(conflict.activeBookingId
            ? { activeBookingId: conflict.activeBookingId }
            : {}),
        },
        conflict.status
      );
    }

    if (!updatedBooking) {
      return json({ error: "Could not update booking status" }, 409);
    }

    return json({
      success: true,
      action,
      status: nextStatus,
      customer: normalizeBooking(updatedBooking),
      message:
        action === "start"
          ? "Checkup started"
          : action === "complete"
          ? "Patient marked as completed"
          : "Booking cancelled",
    });
  } catch (error) {
    console.error("PATCH /api/team/customer:", error);

    return json({ error: "Failed to update patient checkup" }, 500);
  } finally {
    if (mongoSession) {
      await mongoSession.endSession();
    }
  }
}