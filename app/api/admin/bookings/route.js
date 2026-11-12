
import { NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";
import { getAdminSession } from "@/lib/admin-auth";

 

const SOURCES = [
  { category: "clinic", collection: "clinics", label: "Clinic" },
  { category: "saloon", collection: "saloons", label: "Salon" },
  { category: "beauty-parlour", collection: "parlour", label: "Beauty Parlour" },
  { category: "diagnostic-centre", collection: "diagnostic", label: "Diagnostic Centre" },
];

const PRIVATE_FIELDS = {
  password: 0,
  passwordHash: 0,
  otp: 0,
  otpHash: 0,
  verificationToken: 0,
};

function firstValue(...values) {
  return values.find(
    (value) => value !== undefined && value !== null && value !== ""
  ) ?? null;
}

function textValue(value) {
  if (value === undefined || value === null) return "";
  if (typeof value === "object") {
    return String(value.name || value.fullName || value.email || "");
  }
  return String(value);
}

function getAppointment(booking) {
  return booking.appointment || booking;
}

function normalizeBooking(doc, source) {
  const appointment = getAppointment(doc);
  const customer =
    doc.customer ||
    doc.user ||
    doc.patient ||
    appointment.customer ||
    appointment.patient ||
    {};

  const doctor =
    doc.doctor ||
    appointment.doctor ||
    {};

  const business =
    doc.business ||
    doc.clinic ||
    doc.saloon ||
    doc.parlour ||
    doc.diagnosticCentre ||
    {};

  const payment =
    doc.paymentRecord ||
    doc.payment ||
    doc.paymentDetails ||
    {};

  const bookingId = firstValue(
    doc.bookingReference,
    doc.bookingId,
    doc.reference,
    doc.tokenNumber,
    doc.token,
    doc._id
  );

  return {
    id: doc._id.toString(),
    bookingId: textValue(bookingId),
    category: source.category,
    categoryLabel: source.label,

    customerName: textValue(
      firstValue(
        customer.fullName,
        customer.name,
        doc.customerName,
        doc.patientName,
        doc.userName,
        appointment.customerName,
        appointment.patientName
      )
    ),

    customerEmail: textValue(
      firstValue(
        customer.email,
        doc.customerEmail,
        doc.email,
        appointment.email
      )
    ),

    customerPhone: textValue(
      firstValue(
        customer.mobile,
        customer.phone,
        doc.customerPhone,
        doc.phone,
        appointment.phone
      )
    ),

    doctorName: textValue(
      firstValue(
        doctor.fullName,
        doctor.name,
        doc.doctorName,
        appointment.doctorName
      )
    ),

    businessName: textValue(
      firstValue(
        business.businessName,
        business.clinicName,
        business.name,
        doc.businessName,
        doc.clinicName,
        doc.saloonName,
        doc.parlourName,
        doc.diagnosticName,
        appointment.businessName
      )
    ),

    appointmentDate: firstValue(
      appointment.date,
      appointment.appointmentDate,
      doc.appointmentDate,
      doc.date
    ),

    appointmentTime: firstValue(
      appointment.time,
      appointment.appointmentTime,
      doc.appointmentTime,
      doc.time
    ),

    token: textValue(
      firstValue(
        appointment.tokenNumber,
        appointment.token,
        doc.tokenNumber,
        doc.token
      )
    ),

    status: textValue(
      firstValue(doc.status, appointment.status, "unknown")
    ),

    paymentStatus: textValue(
      firstValue(
        payment.status,
        doc.paymentStatus,
        doc.paymentOrders?.status,
        "unknown"
      )
    ),

    amount: firstValue(
      payment.amount,
      doc.amount,
      doc.paymentAmount,
      doc.totalAmount,
      doc.fee,
      null
    ),

    createdAt: firstValue(doc.createdAt, doc.bookingDate, null),
  };
}

export async function GET(req) {
  try {
    const admin = await getAdminSession();

    if (!admin) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);

    const search = searchParams.get("search")?.trim() || "";
    const category = searchParams.get("category") || "all";
    const status = searchParams.get("status") || "all";

    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const limit = Math.min(
      50,
      Math.max(1, Number(searchParams.get("limit")) || 10)
    );

    const selectedSources =
      category === "all"
        ? SOURCES
        : SOURCES.filter((item) => item.category === category);

    if (!selectedSources.length) {
      return NextResponse.json(
        { success: false, message: "Invalid category" },
        { status: 400 }
      );
    }

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB || "rahul");

    // Fetch a bounded recent set from each business collection.
    const fetchLimit = Math.min(page * limit * 5, 5000);

    const results = await Promise.all(
      selectedSources.map(async (source) => {
        const docs = await db
          .collection(source.collection)
          .find(
            { bookings: { $exists: true, $ne: [] } },
            { projection: PRIVATE_FIELDS }
          )
          .sort({ createdAt: -1, _id: -1 })
          .limit(fetchLimit)
          .toArray();

        const bookings = [];

        for (const businessDoc of docs) {
          const businessBookings = Array.isArray(businessDoc.bookings)
            ? businessDoc.bookings
            : [];

          for (const booking of businessBookings) {
            const normalized = normalizeBooking(
              {
                ...booking,
                business: {
                  businessName:
                    businessDoc.businessName ||
                    businessDoc.clinicName ||
                    businessDoc.saloonName ||
                    businessDoc.parlourName ||
                    businessDoc.diagnosticName ||
                    businessDoc.name,
                },
                businessId: businessDoc._id,
              },
              source
            );

            bookings.push(normalized);
          }
        }

        return bookings;
      })
    );

    let bookings = results.flat();

    if (status !== "all") {
      bookings = bookings.filter(
        (booking) =>
          booking.status.toLowerCase() === status.toLowerCase()
      );
    }

    if (search) {
      const query = search.toLowerCase();

      bookings = bookings.filter((booking) =>
        [
          booking.bookingId,
          booking.customerName,
          booking.customerEmail,
          booking.customerPhone,
          booking.doctorName,
          booking.businessName,
          booking.token,
        ].some((value) => value?.toLowerCase().includes(query))
      );
    }

    bookings.sort((a, b) => {
      const dateA = new Date(a.createdAt || 0).getTime();
      const dateB = new Date(b.createdAt || 0).getTime();
      return dateB - dateA;
    });

    const total = bookings.length;
    const start = (page - 1) * limit;

    return NextResponse.json({
      success: true,
      bookings: bookings.slice(start, start + limit),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Admin bookings API error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to load bookings",
      },
      { status: 500 }
    );
  }
}
