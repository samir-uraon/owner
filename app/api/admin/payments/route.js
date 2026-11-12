
import { NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";
import { getAdminSession } from "@/lib/admin-auth";

 

const PAYMENT_COLLECTIONS = [
  "payments",
  "paymentRecords",
  "paymentOrders",
];

const BUSINESS_COLLECTIONS = [
  { collection: "clinics", category: "Clinic" },
  { collection: "saloons", category: "Salon" },
  { collection: "parlour", category: "Beauty Parlour" },
  { collection: "diagnostic", category: "Diagnostic Centre" },
];

const PRIVATE_FIELDS = {
  password: 0,
  passwordHash: 0,
  otp: 0,
  otpHash: 0,
  verificationToken: 0,
  secret: 0,
};

function value(...values) {
  return values.find(
    (item) => item !== undefined && item !== null && item !== ""
  ) ?? null;
}

function normalizePayment(doc, source = "payments") {
  const payment = doc.paymentRecord || doc.payment || doc;
  const appointment = doc.appointment || {};
  const customer = doc.customer || doc.user || doc.patient || {};

  return {
    id: doc._id?.toString?.() || doc.id || crypto.randomUUID(),
    source,

    customerName: value(
      customer.name,
      customer.fullName,
      doc.customerName,
      doc.userName,
      appointment.customerName
    ),

    customerEmail: value(
      customer.email,
      doc.customerEmail,
      doc.email
    ),

    bookingReference: value(
      doc.bookingReference,
      doc.bookingId,
      appointment.bookingReference,
      doc.tokenNumber
    ),

    paymentId: value(
      payment.paymentId,
      payment.razorpayPaymentId,
      doc.paymentId,
      doc.razorpayPaymentId
    ),

    orderId: value(
      payment.orderId,
      payment.razorpayOrderId,
      doc.orderId,
      doc.razorpayOrderId
    ),

    amount: value(
      payment.amount,
      doc.amount,
      doc.paymentAmount,
      doc.totalAmount,
      null
    ),

    currency: value(payment.currency, doc.currency, "INR"),

    status: value(
      payment.status,
      doc.paymentStatus,
      doc.status,
      "unknown"
    ),

    provider: value(
      payment.provider,
      doc.provider,
      "Razorpay"
    ),

    createdAt: value(
      payment.createdAt,
      doc.paidAt,
      doc.createdAt,
      doc.updatedAt
    ),
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
    const status = searchParams.get("status") || "all";
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const limit = Math.min(
      50,
      Math.max(1, Number(searchParams.get("limit")) || 10)
    );

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB || "rahul");

    const payments = [];

    // Read standalone payment collections.
    for (const collectionName of PAYMENT_COLLECTIONS) {
      const exists = await db
        .listCollections({ name: collectionName }, { nameOnly: true })
        .hasNext();

      if (!exists) continue;

      const docs = await db
        .collection(collectionName)
        .find({}, { projection: PRIVATE_FIELDS })
        .sort({ createdAt: -1, _id: -1 })
        .limit(5000)
        .toArray();

      payments.push(
        ...docs.map((doc) =>
          normalizePayment(doc, collectionName)
        )
      );
    }

    // Also read payments embedded in business booking records.
    for (const source of BUSINESS_COLLECTIONS) {
      const docs = await db
        .collection(source.collection)
        .find(
          { bookings: { $exists: true, $ne: [] } },
          { projection: PRIVATE_FIELDS }
        )
        .sort({ createdAt: -1, _id: -1 })
        .limit(2000)
        .toArray();

      for (const business of docs) {
        for (const booking of Array.isArray(business.bookings)
          ? business.bookings
          : []) {
          const hasPayment =
            booking.paymentRecord ||
            booking.payment ||
            booking.paymentId ||
            booking.razorpayPaymentId ||
            booking.paymentOrders;

          if (!hasPayment) continue;

          payments.push(
            normalizePayment(
              {
                ...booking,
                businessName:
                  business.businessName ||
                  business.clinicName ||
                  business.name,
              },
              source.collection
            )
          );
        }
      }
    }

    // Remove duplicate payment records by Razorpay payment ID.
    const unique = new Map();

    for (const payment of payments) {
      const key =
        payment.paymentId ||
        payment.orderId ||
        payment.id;

      if (!unique.has(String(key))) {
        unique.set(String(key), payment);
      }
    }

    let filtered = Array.from(unique.values());

    if (status !== "all") {
      filtered = filtered.filter(
        (payment) =>
          String(payment.status).toLowerCase() === status.toLowerCase()
      );
    }

    if (search) {
      const query = search.toLowerCase();

      filtered = filtered.filter((payment) =>
        [
          payment.customerName,
          payment.customerEmail,
          payment.bookingReference,
          payment.paymentId,
          payment.orderId,
          payment.status,
        ].some((item) =>
          String(item || "").toLowerCase().includes(query)
        )
      );
    }

    filtered.sort((a, b) => {
      return (
        new Date(b.createdAt || 0).getTime() -
        new Date(a.createdAt || 0).getTime()
      );
    });

    const total = filtered.length;
    const start = (page - 1) * limit;

    return NextResponse.json({
      success: true,
      payments: filtered.slice(start, start + limit),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Admin payments API error:", error);

    return NextResponse.json(
      { success: false, message: "Failed to load payments" },
      { status: 500 }
    );
  }
}
