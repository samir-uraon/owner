
"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CalendarDays,
  Search,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Ticket,
  UserRound,
  Stethoscope,
  Building2,
  CreditCard,
} from "lucide-react";
import { toast } from "react-hot-toast";

const CATEGORIES = [
  { value: "all", label: "All Categories" },
  { value: "clinic", label: "Clinics" },
  { value: "saloon", label: "Salons" },
  { value: "beauty-parlour", label: "Beauty Parlours" },
  { value: "diagnostic-centre", label: "Diagnostic Centres" },
];

const STATUSES = [
  "all",
  "waiting",
  "confirmed",
  "in-progress",
  "serving",
  "completed",
  "cancelled",
  "skipped",
  "refunded",
  "failed",
  "rejected",
];

export default function AdminBookingsPage() {
  const [bookings, setBookings] = useState([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);

  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
  });

  const [loading, setLoading] = useState(true);

  const fetchBookings = useCallback(async () => {
    try {
      setLoading(true);

      const params = new URLSearchParams({
        search,
        category,
        status,
        page: String(page),
        limit: "10",
      });

      const response = await fetch(
        `/api/admin/bookings?${params.toString()}`,
        { cache: "no-store" }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Unable to load bookings");
      }

      setBookings(data.bookings || []);
      setPagination(data.pagination);
    } catch (error) {
      toast.error(error.message || "Failed to load bookings");
    } finally {
      setLoading(false);
    }
  }, [search, category, status, page]);

  useEffect(() => {
    const timer = setTimeout(fetchBookings, 300);
    return () => clearTimeout(timer);
  }, [fetchBookings]);

  const formatDate = (value) => {
    if (!value) return "—";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return String(value);

    return date.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const formatAmount = (value) => {
    if (value === null || value === undefined || value === "") {
      return "—";
    }

    const amount = Number(value);

    if (!Number.isFinite(amount)) return String(value);

    return amount.toLocaleString("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
    });
  };

  const statusClass = (value) => {
    const normalized = String(value || "").toLowerCase();

    if (["completed", "confirmed", "serving"].includes(normalized)) {
      return "bg-emerald-50 text-emerald-700";
    }

    if (["cancelled", "failed", "rejected", "skipped"].includes(normalized)) {
      return "bg-red-50 text-red-700";
    }

    if (["waiting", "pending", "in-progress"].includes(normalized)) {
      return "bg-amber-50 text-amber-700";
    }

    return "bg-gray-100 text-gray-600";
  };

  return (
    <div className="min-h-screen bg-[#f7f8fc] p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">

        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <div className="flex items-center gap-2 text-sm font-medium text-violet-600">
              <CalendarDays size={17} />
              Platform Management
            </div>

            <h1 className="mt-2 text-2xl font-bold text-gray-900 sm:text-3xl">
              Bookings
            </h1>

            <p className="mt-1 text-sm text-gray-500">
              Monitor appointments across all Zeriy businesses.
            </p>
          </div>

          <button
            onClick={fetchBookings}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw
              size={16}
              className={loading ? "animate-spin" : ""}
            />
            Refresh
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">Matching bookings</p>
            <p className="mt-2 text-3xl font-bold text-gray-900">
              {pagination.total.toLocaleString("en-IN")}
            </p>
          </div>

          <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">Current page</p>
            <p className="mt-2 text-3xl font-bold text-gray-900">
              {pagination.totalPages ? pagination.page : 0}
              <span className="ml-2 text-base font-medium text-gray-400">
                / {pagination.totalPages}
              </span>
            </p>
          </div>

          <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">Displayed bookings</p>
            <p className="mt-2 text-3xl font-bold text-gray-900">
              {bookings.length}
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
            <div className="relative lg:col-span-1">
              <Search
                size={18}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
              />

              <input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
                placeholder="Search booking, customer, doctor..."
                className="w-full rounded-xl border border-gray-200 bg-gray-50 py-3 pl-10 pr-4 text-sm outline-none focus:border-violet-400 focus:bg-white focus:ring-2 focus:ring-violet-100"
              />
            </div>

            <select
              value={category}
              onChange={(event) => {
                setCategory(event.target.value);
                setPage(1);
              }}
              className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
            >
              {CATEGORIES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>

            <select
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
                setPage(1);
              }}
              className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
            >
              {STATUSES.map((item) => (
                <option key={item} value={item}>
                  {item === "all"
                    ? "All Statuses"
                    : item.replaceAll("-", " ")}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
            <h2 className="font-semibold text-gray-900">
              Booking Directory
            </h2>

            <span className="text-xs text-gray-400">
              {pagination.total.toLocaleString("en-IN")} records
            </span>
          </div>

          {loading ? (
            <div className="flex min-h-64 items-center justify-center gap-3 text-sm text-gray-500">
              <RefreshCw size={18} className="animate-spin text-violet-600" />
              Loading bookings...
            </div>
          ) : bookings.length === 0 ? (
            <div className="flex min-h-64 flex-col items-center justify-center px-4 text-center">
              <div className="rounded-2xl bg-violet-50 p-4 text-violet-600">
                <CalendarDays size={30} />
              </div>

              <h3 className="mt-4 font-semibold text-gray-800">
                No bookings found
              </h3>

              <p className="mt-1 text-sm text-gray-500">
                Try changing your search or filters.
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1150px] text-left">
                  <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                    <tr>
                      <th className="px-5 py-4 font-semibold">Booking</th>
                      <th className="px-5 py-4 font-semibold">Customer</th>
                      <th className="px-5 py-4 font-semibold">Doctor / Business</th>
                      <th className="px-5 py-4 font-semibold">Appointment</th>
                      <th className="px-5 py-4 font-semibold">Amount</th>
                      <th className="px-5 py-4 font-semibold">Status</th>
                      <th className="px-5 py-4 font-semibold">Payment</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-gray-100">
                    {bookings.map((booking) => (
                      <tr
                        key={`${booking.category}-${booking.id}`}
                        className="transition hover:bg-gray-50"
                      >
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2">
                            <Ticket size={17} className="text-violet-600" />
                            <div>
                              <p className="font-semibold text-gray-900">
                                {booking.bookingId || booking.id}
                              </p>
                              <p className="mt-0.5 text-xs text-gray-400">
                                {booking.categoryLabel}
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="px-5 py-4">
                          <div className="flex items-start gap-2">
                            <UserRound
                              size={16}
                              className="mt-0.5 text-gray-400"
                            />
                            <div>
                              <p className="text-sm font-semibold text-gray-800">
                                {booking.customerName || "Unknown"}
                              </p>
                              <p className="mt-1 text-xs text-gray-500">
                                {booking.customerPhone ||
                                  booking.customerEmail ||
                                  "—"}
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="px-5 py-4">
                          <div className="space-y-1">
                            <p className="flex items-center gap-2 text-sm text-gray-700">
                              <Stethoscope size={14} className="text-gray-400" />
                              {booking.doctorName || "—"}
                            </p>
                            <p className="flex items-center gap-2 text-xs text-gray-500">
                              <Building2 size={13} className="text-gray-400" />
                              {booking.businessName || "—"}
                            </p>
                          </div>
                        </td>

                        <td className="px-5 py-4">
                          <p className="text-sm font-medium text-gray-800">
                            {formatDate(booking.appointmentDate)}
                          </p>
                          <p className="mt-1 text-xs text-gray-500">
                            {booking.appointmentTime || "—"}
                            {booking.token ? ` · Token ${booking.token}` : ""}
                          </p>
                        </td>

                        <td className="px-5 py-4 text-sm font-semibold text-gray-800">
                          {formatAmount(booking.amount)}
                        </td>

                        <td className="px-5 py-4">
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${statusClass(
                              booking.status
                            )}`}
                          >
                            {booking.status || "Unknown"}
                          </span>
                        </td>

                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <CreditCard size={15} className="text-gray-400" />
                            <span className="capitalize">
                              {booking.paymentStatus || "Unknown"}
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-col gap-3 border-t border-gray-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-gray-500">
                  Page {pagination.page} of {pagination.totalPages}
                </p>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() =>
                      setPage((current) => Math.max(1, current - 1))
                    }
                    disabled={page <= 1 || loading}
                    className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ChevronLeft size={16} />
                    Previous
                  </button>

                  <button
                    onClick={() =>
                      setPage((current) =>
                        Math.min(pagination.totalPages, current + 1)
                      )
                    }
                    disabled={
                      page >= pagination.totalPages || loading
                    }
                    className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Next
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
