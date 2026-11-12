
import { NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";
import { getAdminSession } from "@/lib/admin-auth";

 
const BUSINESS_COLLECTIONS = [
  "clinics",
  "saloons",
  "parlour",
  "diagnostic",
];

const REFUND_COLLECTIONS = [
  "refunds",
  "refundRecords",
  "paymentRecords",
  "payments",
];

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const MAX_DOCUMENTS = 1000;

const PROCESSED_STATUSES = [
  "processed",
  "completed",
  "success",
  "refunded",
];

const PENDING_STATUSES = [
  "pending",
  "initiated",
  "processing",
];

const FAILED_STATUSES = [
  "failed",
  "rejected",
];

function valueOf(...values) {
  return values.find(
    (value) =>
      value !== undefined &&
      value !== null &&
      value !== ""
  );
}

function asObject(value) {
  return value &&
    typeof value === "object" &&
    !Array.isArray(value)
    ? value
    : {};
}

function toText(value, fallback = "") {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  if (typeof value === "object") {
    if (value.$oid) return String(value.$oid);
    if (value._id) return String(value._id);
    return fallback;
  }

  return String(value);
}

function normalizeStatus(status, refundId) {
  const normalized = String(status || "")
    .trim()
    .toLowerCase();

  if (!normalized) {
    return refundId ? "initiated" : "unknown";
  }

  if (
    ["processed", "completed", "success", "refunded"].includes(
      normalized
    )
  ) {
    return "processed";
  }

  if (
    ["pending", "initiated", "processing", "created"].includes(
      normalized
    )
  ) {
    return normalized === "created" ? "initiated" : normalized;
  }

  if (["failed", "rejected"].includes(normalized)) {
    return normalized;
  }

  return normalized;
}

function hasRefundInformation(...sources) {
  return sources.some((source) => {
    const data = asObject(source);

    return Boolean(
      data.refundId ||
      data.refund_id ||
      data.refundStatus ||
      data.refund_status ||
      data.refundAmount ||
      data.refund_amount ||
      data.refundAt ||
      data.refund_at ||
      data.refund ||
      data.refunds
    );
  });
}

function getRefundEntries(booking) {
  const paymentRecord = asObject(booking.paymentRecord);
  const paymentOrders = booking.paymentOrders;
  const refundObject = asObject(booking.refund);

  const orders = Array.isArray(paymentOrders)
    ? paymentOrders
    : paymentOrders
      ? [paymentOrders]
      : [];

  const candidates = [
    {
      payment: paymentRecord,
      refund: asObject(paymentRecord.refund),
    },
    ...orders.map((payment) => ({
      payment: asObject(payment),
      refund: asObject(payment?.refund),
    })),
    {
      payment: booking,
      refund: refundObject,
    },
  ];

  if (Array.isArray(booking.refunds)) {
    for (const refund of booking.refunds) {
      candidates.push({
        payment: paymentRecord,
        refund: asObject(refund),
      });
    }
  }

  return candidates.filter(({ payment, refund }) =>
    hasRefundInformation(payment, refund)
  );
}

function getBusinessName(business) {
  const data = asObject(business);

  return valueOf(
    data.name,
    data.businessName,
    data.clinicName,
    data.saloonName,
    data.parlourName,
    data.diagnosticName
  );
}

function getCustomer(booking) {
  const user = asObject(
    booking.user || booking.customer || booking.profile
  );

  return {
    name: toText(
      valueOf(
        booking.customerName,
        booking.userName,
        booking.name,
        user.name,
        user.fullName
      ),
      "Unknown"
    ),
    email: toText(
      valueOf(
        booking.customerEmail,
        booking.email,
        user.email
      )
    ),
  };
}

function normalizeRefund({
  refund,
  payment,
  booking,
  business,
  category,
  sourceId,
}) {
  const refundData = asObject(refund);
  const paymentData = asObject(payment);
  const bookingData = asObject(booking);

  const refundId = valueOf(
    refundData.refundId,
    refundData.refund_id,
    refundData.id,
    paymentData.refundId,
    paymentData.refund_id,
    bookingData.refundId,
    bookingData.refund_id
  );

  const paymentId = valueOf(
    refundData.paymentId,
    refundData.payment_id,
    paymentData.paymentId,
    paymentData.razorpayPaymentId,
    paymentData.razorpay_payment_id,
    bookingData.paymentId,
    bookingData.razorpayPaymentId
  );

  const orderId = valueOf(
    refundData.orderId,
    refundData.order_id,
    paymentData.orderId,
    paymentData.razorpayOrderId,
    paymentData.razorpay_order_id,
    bookingData.orderId,
    bookingData.razorpayOrderId
  );

  // Prefer an explicit refund amount. Never silently substitute
  // the original payment amount.
  const amount = valueOf(
    refundData.refundAmount,
    refundData.amount,
    refundData.amountPaid,
    paymentData.refundAmount,
    paymentData.refund_amount,
    bookingData.refundAmount,
    bookingData.refund_amount
  );

  const status = normalizeStatus(
    valueOf(
      refundData.refundStatus,
      refundData.refund_status,
      refundData.status,
      paymentData.refundStatus,
      paymentData.refund_status,
      bookingData.refundStatus,
      bookingData.refund_status
    ),
    refundId
  );

  const createdAt = valueOf(
    refundData.createdAt,
    refundData.refundAt,
    refundData.refund_at,
    refundData.processedAt,
    refundData.updatedAt,
    paymentData.refundAt,
    paymentData.refund_at,
    bookingData.refundAt,
    bookingData.refund_at
  );

  const customer = getCustomer(bookingData);

  const businessName = getBusinessName(business);

  const bookingReference = toText(
    valueOf(
      bookingData.bookingReference,
      bookingData.bookingId,
      bookingData._id
    ),
    "Not available"
  );

  const normalizedRefundId = toText(
    refundId,
    "Not available"
  );

  return {
    id:
      normalizedRefundId !== "Not available"
        ? normalizedRefundId
        : `${sourceId}-${bookingReference}-${toText(paymentId)}`,

    refundId: normalizedRefundId,

    paymentId: toText(paymentId, "Not available"),

    orderId: toText(orderId, "Not available"),

    bookingReference,

    customer: customer.name,

    customerEmail: customer.email,

    business: toText(businessName, "Unknown"),

    category: category || "unknown",

    amount:
      amount !== undefined && amount !== null
        ? Number(amount)
        : null,

    currency: toText(
      valueOf(
        refundData.currency,
        paymentData.currency,
        bookingData.currency
      ),
      "INR"
    ),

    status,

    reason: toText(
      valueOf(
        refundData.refundReason,
        refundData.reason,
        paymentData.refundReason,
        bookingData.refundReason,
        bookingData.cancellationReason
      )
    ),

    createdAt: createdAt || null,

    source: sourceId,
  };
}

function matchesSearch(refund, search) {
  if (!search) return true;

  const searchable = [
    refund.refundId,
    refund.paymentId,
    refund.orderId,
    refund.bookingReference,
    refund.customer,
    refund.customerEmail,
    refund.business,
    refund.reason,
  ]
    .join(" ")
    .toLowerCase();

  return searchable.includes(search);
}

function getDateValue(value) {
  if (!value) return 0;

  const date = new Date(value).getTime();

  return Number.isFinite(date) ? date : 0;
}

function getSummary(refunds) {
  return {
    total: refunds.length,

    processed: refunds.filter((item) =>
      PROCESSED_STATUSES.includes(item.status)
    ).length,

    pending: refunds.filter((item) =>
      PENDING_STATUSES.includes(item.status)
    ).length,

    failed: refunds.filter((item) =>
      FAILED_STATUSES.includes(item.status)
    ).length,
  };
}

export async function GET(request) {
  try {
    const admin = await getAdminSession();

    if (!admin) {
      return NextResponse.json(
        {
          success: false,
          message: "Unauthorized",
        },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);

    const search = (
      searchParams.get("search") || ""
    )
      .trim()
      .toLowerCase();

    const statusFilter = (
      searchParams.get("status") || "all"
    )
      .trim()
      .toLowerCase();

    const page = Math.max(
      1,
      Number.parseInt(searchParams.get("page") || "1", 10) || 1
    );

    const limit = Math.min(
      MAX_LIMIT,
      Math.max(
        1,
        Number.parseInt(
          searchParams.get("limit") || DEFAULT_LIMIT,
          10
        ) || DEFAULT_LIMIT
      )
    );

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB || "rahul");

    const refunds = [];
    const seen = new Set();

    function addRefund(record) {
      const key =
        record.refundId !== "Not available"
          ? `refund:${record.refundId}`
          : [
              record.source,
              record.bookingReference,
              record.paymentId,
              record.status,
            ].join(":");

      if (seen.has(key)) return;

      seen.add(key);
      refunds.push(record);
    }

    // Find existing collections first.
    const existingCollections = await db
      .listCollections({}, { nameOnly: true })
      .toArray();

    const existingNames = new Set(
      existingCollections.map((item) => item.name)
    );

    // 1. Standalone refund/payment collections.
    for (const collectionName of REFUND_COLLECTIONS) {
      if (!existingNames.has(collectionName)) continue;

      const documents = await db
        .collection(collectionName)
        .find({})
        .sort({ createdAt: -1 })
        .limit(MAX_DOCUMENTS)
        .toArray();

      for (const document of documents) {
        const entries = getRefundEntries(document);

        if (entries.length) {
          for (const entry of entries) {
            addRefund(
              normalizeRefund({
                refund: entry.refund,
                payment: entry.payment,
                booking: document,
                business: null,
                category: "standalone",
                sourceId: collectionName,
              })
            );
          }
        } else if (
          hasRefundInformation(document)
        ) {
          addRefund(
            normalizeRefund({
              refund: document.refund || document,
              payment: document,
              booking: document,
              business: null,
              category: "standalone",
              sourceId: collectionName,
            })
          );
        }
      }
    }

    // 2. Refunds embedded in business bookings.
    for (const collectionName of BUSINESS_COLLECTIONS) {
      if (!existingNames.has(collectionName)) continue;

      const documents = await db
        .collection(collectionName)
        .find(
          {
            bookings: {
              $exists: true,
              $ne: [],
            },
          },
          {
            projection: {
              name: 1,
              businessName: 1,
              clinicName: 1,
              saloonName: 1,
              parlourName: 1,
              diagnosticName: 1,
              bookings: 1,
            },
          }
        )
        .limit(MAX_DOCUMENTS)
        .toArray();

      for (const business of documents) {
        const bookings = Array.isArray(business.bookings)
          ? business.bookings
          : [];

        for (const booking of bookings) {
          const entries = getRefundEntries(booking);

          for (const entry of entries) {
            addRefund(
              normalizeRefund({
                refund: entry.refund,
                payment: entry.payment,
                booking,
                business,
                category: collectionName,
                sourceId: collectionName,
              })
            );
          }
        }
      }
    }

    // 3. Sort all discovered refund records.
    refunds.sort(
      (a, b) =>
        getDateValue(b.createdAt) -
        getDateValue(a.createdAt)
    );

    // Summary is calculated across all discovered refunds.
    const summary = getSummary(refunds);

    // 4. Apply search and status filters.
    let filtered = refunds.filter((refund) =>
      matchesSearch(refund, search)
    );

    if (statusFilter !== "all") {
      filtered = filtered.filter(
        (refund) => refund.status === statusFilter
      );
    }

    const total = filtered.length;
    const totalPages = Math.max(
      1,
      Math.ceil(total / limit)
    );

    const safePage = Math.min(page, totalPages);
    const start = (safePage - 1) * limit;

    return NextResponse.json(
      {
        success: true,

        refunds: filtered.slice(start, start + limit),

        summary,

        pagination: {
          page: safePage,
          limit,
          total,
          totalPages,
        },
      },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      }
    );
  } catch (error) {
    console.error("ADMIN_REFUNDS_ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to load refund records",
      },
      { status: 500 }
    );
  }
}
