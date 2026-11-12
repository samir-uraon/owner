
"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CreditCard,
  Search,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Receipt,
  UserRound,
  IndianRupee,
  Hash,
} from "lucide-react";
import { toast } from "react-hot-toast";

const STATUSES = [
  "all",
  "created",
  "authorized",
  "captured",
  "paid",
  "success",
  "failed",
  "refunded",
  "pending",
];

export default function AdminPaymentsPage() {
  const [payments, setPayments] = useState([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);

  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
  });

  const [loading, setLoading] = useState(true);

  const fetchPayments = useCallback(async () => {
    try {
      setLoading(true);

      const params = new URLSearchParams({
        search,
        status,
        page: String(page),
        limit: "10",
      });

      const response = await fetch(
        `/api/admin/payments?${params.toString()}`,
        { cache: "no-store" }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Unable to load payments");
      }

      setPayments(data.payments || []);
      setPagination(data.pagination);
    } catch (error) {
      toast.error(error.message || "Failed to load payments");
    } finally {
      setLoading(false);
    }
  }, [search, status, page]);

  useEffect(() => {
    const timer = setTimeout(fetchPayments, 300);
    return () => clearTimeout(timer);
  }, [fetchPayments]);

  const formatAmount = (amount, currency = "INR") => {
    if (amount === null || amount === undefined || amount === "") {
      return "—";
    }

    const numeric = Number(amount);

    if (!Number.isFinite(numeric)) return String(amount);

    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: currency || "INR",
      maximumFractionDigits: 2,
    }).format(numeric);
  };

  const formatDate = (value) => {
    if (!value) return "—";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return "—";

    return date.toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusClass = (value) => {
    const normalized = String(value || "").toLowerCase();

    if (
      ["captured", "paid", "success", "refunded"].includes(normalized)
    ) {
      return "bg-emerald-50 text-emerald-700";
    }

    if (["failed"].includes(normalized)) {
      return "bg-red-50 text-red-700";
    }

    if (
      ["created", "authorized", "pending"].includes(normalized)
    ) {
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
              <CreditCard size={17} />
              Financial Management
            </div>

            <h1 className="mt-2 text-2xl font-bold text-gray-900 sm:text-3xl">
              Payments
            </h1>

            <p className="mt-1 text-sm text-gray-500">
              Monitor payment transactions across Zeriy.
            </p>
          </div>

          <button
            onClick={fetchPayments}
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
            <p className="text-sm text-gray-500">Matching transactions</p>
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
            <p className="text-sm text-gray-500">Displayed transactions</p>
            <p className="mt-2 text-3xl font-bold text-gray-900">
              {payments.length}
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="relative sm:col-span-2">
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
                placeholder="Search customer, payment ID or order ID..."
                className="w-full rounded-xl border border-gray-200 bg-gray-50 py-3 pl-10 pr-4 text-sm outline-none focus:border-violet-400 focus:bg-white focus:ring-2 focus:ring-violet-100"
              />
            </div>

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
                  {item === "all" ? "All Statuses" : item}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
            <h2 className="font-semibold text-gray-900">
              Transaction History
            </h2>

            <span className="text-xs text-gray-400">
              {pagination.total.toLocaleString("en-IN")} records
            </span>
          </div>

          {loading ? (
            <div className="flex min-h-64 items-center justify-center gap-3 text-sm text-gray-500">
              <RefreshCw size={18} className="animate-spin text-violet-600" />
              Loading payments...
            </div>
          ) : payments.length === 0 ? (
            <div className="flex min-h-64 flex-col items-center justify-center px-4 text-center">
              <div className="rounded-2xl bg-violet-50 p-4 text-violet-600">
                <CreditCard size={30} />
              </div>

              <h3 className="mt-4 font-semibold text-gray-800">
                No payment records found
              </h3>

              <p className="mt-1 text-sm text-gray-500">
                Try another search or status filter.
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1050px] text-left">
                  <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                    <tr>
                      <th className="px-5 py-4 font-semibold">Customer</th>
                      <th className="px-5 py-4 font-semibold">Payment ID</th>
                      <th className="px-5 py-4 font-semibold">Order ID</th>
                      <th className="px-5 py-4 font-semibold">Booking</th>
                      <th className="px-5 py-4 font-semibold">Amount</th>
                      <th className="px-5 py-4 font-semibold">Status</th>
                      <th className="px-5 py-4 font-semibold">Date</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-gray-100">
                    {payments.map((payment) => (
                      <tr
                        key={`${payment.source}-${payment.id}`}
                        className="transition hover:bg-gray-50"
                      >
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2">
                            <UserRound
                              size={17}
                              className="text-gray-400"
                            />
                            <div>
                              <p className="text-sm font-semibold text-gray-800">
                                {payment.customerName || "Unknown"}
                              </p>
                              <p className="mt-0.5 text-xs text-gray-400">
                                {payment.customerEmail || "—"}
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <Hash size={14} className="text-gray-400" />
                            {payment.paymentId || "—"}
                          </div>
                        </td>

                        <td className="px-5 py-4 text-sm text-gray-600">
                          {payment.orderId || "—"}
                        </td>

                        <td className="px-5 py-4 text-sm text-gray-600">
                          {payment.bookingReference || "—"}
                        </td>

                        <td className="px-5 py-4">
                          <p className="flex items-center gap-1 text-sm font-bold text-gray-900">
                            <IndianRupee size={14} />
                            {formatAmount(payment.amount, payment.currency)
                              .replace(/^₹/, "")}
                          </p>
                          <p className="mt-0.5 text-xs text-gray-400">
                            {payment.provider || "Payment gateway"}
                          </p>
                        </td>

                        <td className="px-5 py-4">
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${getStatusClass(
                              payment.status
                            )}`}
                          >
                            {payment.status || "Unknown"}
                          </span>
                        </td>

                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2 text-sm text-gray-500">
                            <Receipt size={15} className="text-gray-400" />
                            {formatDate(payment.createdAt)}
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
