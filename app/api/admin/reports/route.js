
import { NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";
import { getAdminSession } from "@/lib/admin-auth";

 

const BUSINESS_COLLECTIONS = [
  "clinics",
  "saloons",
  "parlour",
  "diagnostic",
];

const BUSINESS_LABELS = {
  clinics: "Clinics",
  saloons: "Saloons",
  parlour: "Beauty Parlours",
  diagnostic: "Diagnostic Centres",
};

const MAX_BUSINESS_DOCUMENTS = 5000;

function getObject(value) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : {};
}

function getDate(value) {
  if (!value) return null;

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
}

function getBookingDate(booking) {
  return (
    getDate(booking.createdAt) ||
    getDate(booking.bookingDate) ||
    getDate(booking.appointment?.createdAt) ||
    getDate(booking.appointment?.date) ||
    getDate(booking.date)
  );
}

function getBookingStatus(booking) {
  const status = String(booking.status || "unknown").toLowerCase();

  if (["pending", "booked", "success", "paid"].includes(status)) {
    return "confirmed";
  }

  if (["no-show"].includes(status)) {
    return "skipped";
  }

  return status;
}

function getPaymentStatus(booking) {
  const payment = getObject(booking.paymentRecord);

  return String(
    payment.status ||
      booking.paymentStatus ||
      booking.payment?.status ||
      "unknown"
  ).toLowerCase();
}

function getPaymentAmount(booking) {
  const payment = getObject(booking.paymentRecord);

  const value =
    payment.amount ??
    payment.amountPaid ??
    booking.paymentAmount ??
    booking.amount ??
    booking.payment?.amount;

  const amount = Number(value);

  return Number.isFinite(amount) && amount >= 0 ? amount : 0;
}

function getMonthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
    2,
    "0"
  )}`;
}

function getLastSixMonths() {
  const now = new Date();
  const months = [];

  for (let offset = 5; offset >= 0; offset--) {
    const date = new Date(
      now.getFullYear(),
      now.getMonth() - offset,
      1
    );

    months.push({
      key: getMonthKey(date),
      label: date.toLocaleString("en-IN", {
        month: "short",
        year: "2-digit",
      }),
      bookings: 0,
      completed: 0,
    });
  }

  return months;
}

export async function GET() {
  try {
    const admin = await getAdminSession();

    if (!admin) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB || "rahul");

    const [
      totalUsers,
      totalOwners,
      businessCounts,
    ] = await Promise.all([
      db.collection("users").countDocuments({}),
      db.collection("owners").countDocuments({}),
      Promise.all(
        BUSINESS_COLLECTIONS.map(async (collectionName) => ({
          category: collectionName,
          count: await db.collection(collectionName).countDocuments({}),
        }))
      ),
    ]);

    const businessesByCategory = businessCounts.map((item) => ({
      category: item.category,
      label: BUSINESS_LABELS[item.category],
      count: item.count,
    }));

    const totalBusinesses = businessCounts.reduce(
      (total, item) => total + item.count,
      0
    );

    const businessDocuments = await Promise.all(
      BUSINESS_COLLECTIONS.map(async (collectionName) => {
        const documents = await db
          .collection(collectionName)
          .find(
            { bookings: { $exists: true, $ne: [] } },
            {
              projection: {
                name: 1,
                clinicName: 1,
                saloonName: 1,
                businessName: 1,
                bookings: 1,
              },
            }
          )
          .limit(MAX_BUSINESS_DOCUMENTS)
          .toArray();

        return {
          category: collectionName,
          documents,
        };
      })
    );

    const allBookings = [];

    for (const group of businessDocuments) {
      for (const business of group.documents) {
        const bookings = Array.isArray(business.bookings)
          ? business.bookings
          : [];

        for (const booking of bookings) {
          allBookings.push({
            ...booking,
            __category: group.category,
          });
        }
      }
    }

    const statusCounts = {
      confirmed: 0,
      waiting: 0,
      "in-progress": 0,
      serving: 0,
      completed: 0,
      cancelled: 0,
      skipped: 0,
      refunded: 0,
      failed: 0,
      rejected: 0,
      other: 0,
    };

    const paymentCounts = {
      paid: 0,
      pending: 0,
      failed: 0,
      refunded: 0,
      other: 0,
    };

    const monthly = getLastSixMonths();
    const monthMap = new Map(monthly.map((item) => [item.key, item]));

    const bookingCategoryCounts = BUSINESS_COLLECTIONS.map(
      (category) => ({
        category,
        label: BUSINESS_LABELS[category],
        count: 0,
      })
    );

    const categoryMap = new Map(
      bookingCategoryCounts.map((item) => [item.category, item])
    );

    let completedBookings = 0;
    let cancelledBookings = 0;
    let refundedBookings = 0;
    let totalPaymentAmount = 0;
    let successfulPayments = 0;

    for (const booking of allBookings) {
      const status = getBookingStatus(booking);

      if (Object.prototype.hasOwnProperty.call(statusCounts, status)) {
        statusCounts[status]++;
      } else {
        statusCounts.other++;
      }

      if (status === "completed") completedBookings++;
      if (status === "cancelled") cancelledBookings++;
      if (status === "refunded") refundedBookings++;

      const category = categoryMap.get(booking.__category);

      if (category) category.count++;

      const paymentStatus = getPaymentStatus(booking);

      if (
        ["paid", "captured", "success", "successful", "completed"].includes(
          paymentStatus
        )
      ) {
        paymentCounts.paid++;
        successfulPayments++;
        totalPaymentAmount += getPaymentAmount(booking);
      } else if (
        ["pending", "created", "authorized"].includes(paymentStatus)
      ) {
        paymentCounts.pending++;
      } else if (["failed", "rejected"].includes(paymentStatus)) {
        paymentCounts.failed++;
      } else if (["refunded", "processed"].includes(paymentStatus)) {
        paymentCounts.refunded++;
      } else {
        paymentCounts.other++;
      }

      const bookingDate = getBookingDate(booking);

      if (bookingDate) {
        const month = monthMap.get(getMonthKey(bookingDate));

        if (month) {
          month.bookings++;

          if (status === "completed") {
            month.completed++;
          }
        }
      }
    }

    const totalBookings = allBookings.length;

    const completionRate = totalBookings
      ? Number(((completedBookings / totalBookings) * 100).toFixed(1))
      : 0;

    const cancellationRate = totalBookings
      ? Number(((cancelledBookings / totalBookings) * 100).toFixed(1))
      : 0;

    return NextResponse.json({
      success: true,
      generatedAt: new Date().toISOString(),

      overview: {
        totalUsers,
        totalOwners,
        totalBusinesses,
        totalBookings,
        completedBookings,
        cancelledBookings,
        refundedBookings,
        totalPaymentAmount,
        successfulPayments,
        completionRate,
        cancellationRate,
      },

      businessesByCategory,
      bookingsByCategory: bookingCategoryCounts,
      bookingStatuses: statusCounts,
      paymentStatuses: paymentCounts,
      monthlyBookings: monthly,

      dataNotes: {
        bookingsSource: "Embedded bookings arrays in business documents",
        paymentAmountUnit: "Stored value; verify whether your database uses rupees or paise",
        businessDocumentLimit: MAX_BUSINESS_DOCUMENTS,
      },
    });
  } catch (error) {
    console.error("ADMIN_REPORTS_ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to generate analytics report",
      },
      { status: 500 }
    );
  }
}
