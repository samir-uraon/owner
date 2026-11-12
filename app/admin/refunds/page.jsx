
"use client";

import { useCallback, useEffect, useState } from "react";
import {
  RefreshCw,
  Search,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  CheckCircle2,
  Clock3,
  XCircle,
  IndianRupee,
  AlertCircle,
  ArrowUpRight,
  ReceiptText,
  CalendarDays,
  CreditCard,
  Building2,
  Filter,
  Mail,
} from "lucide-react";

const PAGE_SIZE = 20;

function formatDate(value) {
  if (!value) return "Date unavailable";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "Date unavailable";

  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatAmount(amount, currency = "INR") {
  if (amount === null || amount === undefined || amount === "") {
    return "—";
  }

  const number = Number(amount);

  if (!Number.isFinite(number)) return String(amount);

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: currency || "INR",
    maximumFractionDigits: 2,
  }).format(number);
}

function getStatusStyle(status) {
  const value = String(status || "").toLowerCase();

  if (
    ["processed", "completed", "success", "refunded"].includes(value)
  ) {
    return {
      className: "border-emerald-200 bg-emerald-50 text-emerald-700",
      icon: CheckCircle2,
      label: value === "success" ? "Successful" : value,
      dot: "bg-emerald-500",
    };
  }

  if (
    ["pending", "initiated", "processing"].includes(value)
  ) {
    return {
      className: "border-amber-200 bg-amber-50 text-amber-700",
      icon: Clock3,
      label: value,
      dot: "bg-amber-500",
    };
  }

  if (["failed", "rejected"].includes(value)) {
    return {
      className: "border-red-200 bg-red-50 text-red-700",
      icon: XCircle,
      label: value,
      dot: "bg-red-500",
    };
  }

  return {
    className: "border-gray-200 bg-gray-50 text-gray-600",
    icon: AlertCircle,
    label: value || "Unknown",
    dot: "bg-gray-400",
  };
}

function StatusBadge({ status }) {
  const config = getStatusStyle(status);
  const Icon = config.icon;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold capitalize ${config.className}`}
    >
      <Icon size={12} />
      {config.label}
    </span>
  );
}

function SummaryCard({
  title,
  value,
  description,
  icon: Icon,
  accent,
}) {
  const accents = {
    violet: "bg-violet-50 text-violet-600",
    green: "bg-emerald-50 text-emerald-600",
    amber: "bg-amber-50 text-amber-600",
    red: "bg-red-50 text-red-600",
  };

  return (
    <div className="group rounded-2xl border border-gray-200/80 bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-500">
            {title}
          </p>

          <p className="mt-3 text-2xl font-bold tracking-tight text-gray-900">
            {Number(value || 0).toLocaleString("en-IN")}
          </p>

          <p className="mt-1.5 text-xs text-gray-400">
            {description}
          </p>
        </div>

        <div
          className={`rounded-xl p-3 transition-transform duration-200 group-hover:scale-105 ${accents[accent]}`}
        >
          <Icon size={21} />
        </div>
      </div>
    </div>
  );
}

function EmptyState({ search, status }) {
  return (
    <div className="flex flex-col items-center justify-center px-5 py-16 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-50 text-violet-500">
        <ReceiptText size={30} />
      </div>

      <h3 className="mt-5 text-base font-bold text-gray-800">
        No refund records found
      </h3>

      <p className="mt-2 max-w-sm text-sm leading-6 text-gray-400">
        {search || status !== "all"
          ? "Try changing your search or status filter to find refund records."
          : "Refund records will appear here when they are available in your database."}
      </p>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center px-5 py-16">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-50">
        <RefreshCw
          size={23}
          className="animate-spin text-violet-600"
        />
      </div>

      <p className="mt-4 text-sm font-medium text-gray-600">
        Loading refund records...
      </p>
      <p className="mt-1 text-xs text-gray-400">
        Please wait while we fetch the latest information.
      </p>
    </div>
  );
}

export default function AdminRefundsPage() {
  const [refunds, setRefunds] = useState([]);

  const [summary, setSummary] = useState({
    total: 0,
    processed: 0,
    pending: 0,
    failed: 0,
  });

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);

  const [pagination, setPagination] = useState({
    page: 1,
    limit: PAGE_SIZE,
    total: 0,
    totalPages: 1,
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchRefunds = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const params = new URLSearchParams({
        search,
        status,
        page: String(page),
        limit: String(PAGE_SIZE),
      });

      const response = await fetch(
        `/api/admin/refunds?${params.toString()}`,
        {
          method: "GET",
          cache: "no-store",
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message || "Unable to load refund records."
        );
      }

      setRefunds(Array.isArray(data.refunds) ? data.refunds : []);

      setSummary(
        data.summary || {
          total: 0,
          processed: 0,
          pending: 0,
          failed: 0,
        }
      );

      setPagination(
        data.pagination || {
          page: 1,
          limit: PAGE_SIZE,
          total: 0,
          totalPages: 1,
        }
      );

      if (data.pagination?.page && data.pagination.page !== page) {
        setPage(data.pagination.page);
      }
    } catch (err) {
      setError(err.message || "Something went wrong.");
      setRefunds([]);
    } finally {
      setLoading(false);
    }
  }, [search, status, page]);

  useEffect(() => {
    const timer = setTimeout(fetchRefunds, 300);
    return () => clearTimeout(timer);
  }, [fetchRefunds]);

  function handleSearchChange(value) {
    setSearch(value);
    setPage(1);
  }

  function handleStatusChange(value) {
    setStatus(value);
    setPage(1);
  }

  return (
    <div className="min-h-screen bg-[#f8f9fc] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1600px] space-y-7">

        {/* Page heading */}
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-violet-100 text-violet-700">
              <RotateCcw size={23} />
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
                  Refund Management
                </h1>
                <span className="rounded-full border border-violet-100 bg-violet-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-violet-700">
                  Finance
                </span>
              </div>

              <p className="mt-1.5 text-sm text-gray-500">
                Monitor and review customer refunds across Zeriy.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={fetchRefunds}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 shadow-sm transition hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw
              size={16}
              className={loading ? "animate-spin" : ""}
            />
            Refresh records
          </button>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            title="Total Refunds"
            value={summary.total}
            description="All discovered refund records"
            icon={ReceiptText}
            accent="violet"
          />

          <SummaryCard
            title="Processed"
            value={summary.processed}
            description="Successfully refunded records"
            icon={CheckCircle2}
            accent="green"
          />

          <SummaryCard
            title="Pending"
            value={summary.pending}
            description="Awaiting refund completion"
            icon={Clock3}
            accent="amber"
          />

          <SummaryCard
            title="Failed"
            value={summary.failed}
            description="Failed or rejected records"
            icon={XCircle}
            accent="red"
          />
        </div>

        {/* Refund records */}
        <section className="overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-sm">

          {/* Section heading */}
          <div className="flex flex-col gap-2 border-b border-gray-100 px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-bold text-gray-900">
                Refund records
              </h2>
              <p className="mt-1 text-xs text-gray-400">
                Search and review refund transactions.
              </p>
            </div>

            <span className="w-fit rounded-lg bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-500">
              {pagination.total.toLocaleString("en-IN")} records
            </span>
          </div>

          {/* Search and filters */}
          <div className="flex flex-col gap-3 border-b border-gray-100 bg-gray-50/50 p-4 sm:flex-row sm:items-center">
            <div className="relative w-full sm:max-w-md">
              <Search
                size={17}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
              />

              <input
                type="text"
                value={search}
                onChange={(event) =>
                  handleSearchChange(event.target.value)
                }
                placeholder="Search refund ID, customer, booking..."
                className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-4 text-sm text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-violet-400 focus:ring-4 focus:ring-violet-50"
              />
            </div>

            <div className="relative sm:ml-auto sm:w-52">
              <Filter
                size={15}
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
              />

              <select
                value={status}
                onChange={(event) =>
                  handleStatusChange(event.target.value)
                }
                className="w-full appearance-none rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-9 text-sm font-medium text-gray-700 outline-none transition focus:border-violet-400 focus:ring-4 focus:ring-violet-50"
              >
                <option value="all">All statuses</option>
                <option value="initiated">Initiated</option>
                <option value="pending">Pending</option>
                <option value="processing">Processing</option>
                <option value="processed">Processed</option>
                <option value="completed">Completed</option>
                <option value="refunded">Refunded</option>
                <option value="failed">Failed</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="m-4 flex items-start gap-3 rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">
              <AlertCircle size={19} className="mt-0.5 shrink-0" />
              <div className="flex-1">
                <p className="font-semibold">Unable to load refunds</p>
                <p className="mt-1 text-xs leading-5">{error}</p>
              </div>
              <button
                type="button"
                onClick={fetchRefunds}
                className="shrink-0 text-xs font-bold underline"
              >
                Retry
              </button>
            </div>
          )}

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1050px] text-left text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-white text-[10px] font-bold uppercase tracking-wider text-gray-400">
                  <th className="px-5 py-4">Refund details</th>
                  <th className="px-5 py-4">Customer</th>
                  <th className="px-5 py-4">Booking details</th>
                  <th className="px-5 py-4">Business</th>
                  <th className="px-5 py-4">Refund amount</th>
                  <th className="px-5 py-4">Status</th>
                  <th className="px-5 py-4">Date</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td colSpan={7}>
                      <LoadingState />
                    </td>
                  </tr>
                ) : refunds.length === 0 ? (
                  <tr>
                    <td colSpan={7}>
                      <EmptyState search={search} status={status} />
                    </td>
                  </tr>
                ) : (
                  refunds.map((refund, index) => (
                    <tr
                      key={`${refund.id}-${index}`}
                      className="group transition-colors hover:bg-violet-50/30"
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-start gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-violet-600">
                            <RotateCcw size={17} />
                          </div>

                          <div className="min-w-0">
                            <p className="font-semibold text-gray-900">
                              {refund.refundId}
                            </p>
                            <p className="mt-1 max-w-[180px] truncate text-xs text-gray-400">
                              Payment: {refund.paymentId}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <p className="font-semibold text-gray-800">
                          {refund.customer || "Unknown"}
                        </p>
                        {refund.customerEmail && (
                          <p className="mt-1 flex items-center gap-1.5 text-xs text-gray-400">
                            <Mail size={12} />
                            {refund.customerEmail}
                          </p>
                        )}
                      </td>

                      <td className="px-5 py-4">
                        <p className="font-semibold text-gray-800">
                          {refund.bookingReference || "—"}
                        </p>
                        <p className="mt-1 flex items-center gap-1 text-xs text-gray-400">
                          <CreditCard size={12} />
                          {refund.orderId || "No order ID"}
                        </p>
                      </td>

                      <td className="px-5 py-4">
                        <p className="flex items-center gap-2 font-medium text-gray-800">
                          <Building2
                            size={14}
                            className="shrink-0 text-gray-400"
                          />
                          {refund.business || "Unknown"}
                        </p>
                        <p className="mt-1 pl-5 text-xs capitalize text-gray-400">
                          {refund.category || "Unknown"}
                        </p>
                      </td>

                      <td className="px-5 py-4">
                        <p className="font-bold text-gray-900">
                          {formatAmount(
                            refund.amount,
                            refund.currency
                          )}
                        </p>
                      </td>

                      <td className="px-5 py-4">
                        <StatusBadge status={refund.status} />
                        {refund.reason && (
                          <p
                            title={refund.reason}
                            className="mt-1.5 max-w-[160px] truncate text-xs text-gray-400"
                          >
                            {refund.reason}
                          </p>
                        )}
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex items-start gap-2 text-xs text-gray-500">
                          <CalendarDays
                            size={14}
                            className="mt-0.5 shrink-0 text-gray-400"
                          />
                          <span>{formatDate(refund.createdAt)}</span>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex flex-col gap-3 border-t border-gray-100 bg-gray-50/40 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-gray-500">
              Showing{" "}
              <span className="font-bold text-gray-800">
                {refunds.length}
              </span>{" "}
              of{" "}
              <span className="font-bold text-gray-800">
                {pagination.total}
              </span>{" "}
              refund records
            </p>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={page <= 1 || loading}
                onClick={() =>
                  setPage((current) => Math.max(1, current - 1))
                }
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 transition hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700 disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Previous page"
              >
                <ChevronLeft size={17} />
              </button>

              <span className="min-w-[90px] text-center text-xs font-semibold text-gray-600">
                Page {pagination.page} of {pagination.totalPages}
              </span>

              <button
                type="button"
                disabled={
                  page >= pagination.totalPages || loading
                }
                onClick={() =>
                  setPage((current) =>
                    Math.min(pagination.totalPages, current + 1)
                  )
                }
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 transition hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700 disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Next page"
              >
                <ChevronRight size={17} />
              </button>
            </div>
          </div>
        </section>

        {/* Information */}
        <div className="flex items-start gap-3 rounded-xl border border-blue-100 bg-blue-50/70 p-4">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
            <IndianRupee size={16} />
          </div>

          <div>
            <p className="text-sm font-semibold text-blue-900">
              Refund monitoring information
            </p>
            <p className="mt-1 text-xs leading-5 text-blue-700">
              This page displays refund information saved in your
              database. It does not initiate refunds or confirm
              Razorpay settlement. Verify refund amounts and statuses
              against Razorpay before using them for financial reporting.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
