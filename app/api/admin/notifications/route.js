
"use client";

import { useCallback, useEffect, useState } from "react";
import {
  RefreshCw,
  Users,
  Store,
  CalendarCheck,
  IndianRupee,
  CheckCircle2,
  XCircle,
  RotateCcw,
  TrendingUp,
  BarChart3,
  Activity,
  AlertCircle,
} from "lucide-react";

const EMPTY_DATA = {
  overview: {
    totalUsers: 0,
    totalOwners: 0,
    totalBusinesses: 0,
    totalBookings: 0,
    completedBookings: 0,
    cancelledBookings: 0,
    refundedBookings: 0,
    totalPaymentAmount: 0,
    successfulPayments: 0,
    completionRate: 0,
    cancellationRate: 0,
  },
  businessesByCategory: [],
  bookingsByCategory: [],
  bookingStatuses: {},
  paymentStatuses: {},
  monthlyBookings: [],
};

function formatNumber(value) {
  return Number(value || 0).toLocaleString("en-IN");
}

function formatMoney(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function MetricCard({
  title,
  value,
  description,
  icon: Icon,
  iconClass = "bg-violet-50 text-violet-600",
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className="mt-2 break-words text-2xl font-bold tracking-tight text-gray-900">
            {value}
          </p>
          <p className="mt-1 text-xs text-gray-400">{description}</p>
        </div>

        <div className={`rounded-xl p-3 ${iconClass}`}>
          <Icon size={21} />
        </div>
      </div>
    </div>
  );
}

function ProgressRow({ label, value, total, color = "bg-violet-500" }) {
  const percentage = total > 0
    ? Math.min(100, (value / total) * 100)
    : 0;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="font-medium text-gray-700">{label}</span>
        <span className="font-semibold tabular-nums text-gray-900">
          {formatNumber(value)}
        </span>
      </div>

      <div className="h-2.5 overflow-hidden rounded-full bg-gray-100">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

function Panel({ title, description, icon: Icon, children }) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="mb-5 flex items-start gap-3">
        <div className="rounded-xl bg-violet-50 p-2.5 text-violet-600">
          <Icon size={19} />
        </div>

        <div>
          <h2 className="font-bold text-gray-900">{title}</h2>
          <p className="mt-0.5 text-xs text-gray-400">{description}</p>
        </div>
      </div>

      {children}
    </section>
  );
}

export default function AdminReportsPage() {
  const [data, setData] = useState(EMPTY_DATA);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [generatedAt, setGeneratedAt] = useState(null);

  const fetchReports = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const response = await fetch("/api/admin/reports", {
        cache: "no-store",
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Unable to load reports");
      }

      setData({
        ...EMPTY_DATA,
        ...result,
        overview: {
          ...EMPTY_DATA.overview,
          ...(result.overview || {}),
        },
      });

      setGeneratedAt(result.generatedAt || null);
    } catch (err) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const overview = data.overview;
  const monthly = data.monthlyBookings || [];

  const maxMonthlyBookings = Math.max(
    1,
    ...monthly.map((item) => item.bookings || 0)
  );

  const bookingStatusColors = {
    confirmed: "bg-blue-500",
    waiting: "bg-amber-500",
    "in-progress": "bg-violet-500",
    serving: "bg-indigo-500",
    completed: "bg-green-500",
    cancelled: "bg-red-500",
    skipped: "bg-orange-500",
    refunded: "bg-pink-500",
    failed: "bg-red-700",
    rejected: "bg-gray-500",
    other: "bg-gray-400",
  };

  const paymentStatusColors = {
    paid: "bg-green-500",
    pending: "bg-amber-500",
    failed: "bg-red-500",
    refunded: "bg-pink-500",
    other: "bg-gray-400",
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-violet-100 p-3 text-violet-700">
            <BarChart3 size={23} />
          </div>

          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">
              Analytics & Reports
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Monitor Zeriy platform performance.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={fetchReports}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:opacity-60"
        >
          <RefreshCw
            size={16}
            className={loading ? "animate-spin" : ""}
          />
          Refresh reports
        </button>
      </div>

      {generatedAt && (
        <p className="text-xs text-gray-400">
          Last generated: {new Date(generatedAt).toLocaleString("en-IN")}
        </p>
      )}

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle size={18} />
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex min-h-64 flex-col items-center justify-center gap-3 rounded-2xl border border-gray-200 bg-white text-gray-500">
          <RefreshCw size={26} className="animate-spin text-violet-600" />
          <p className="text-sm">Generating analytics...</p>
        </div>
      ) : !error ? (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              title="Total Users"
              value={formatNumber(overview.totalUsers)}
              description="Registered user accounts"
              icon={Users}
            />

            <MetricCard
              title="Total Owners"
              value={formatNumber(overview.totalOwners)}
              description="Registered business owners"
              icon={Store}
              iconClass="bg-blue-50 text-blue-600"
            />

            <MetricCard
              title="Total Businesses"
              value={formatNumber(overview.totalBusinesses)}
              description="Across all business categories"
              icon={Activity}
              iconClass="bg-indigo-50 text-indigo-600"
            />

            <MetricCard
              title="Total Bookings"
              value={formatNumber(overview.totalBookings)}
              description="Bookings found in business records"
              icon={CalendarCheck}
              iconClass="bg-amber-50 text-amber-600"
            />

            <MetricCard
              title="Completed Bookings"
              value={formatNumber(overview.completedBookings)}
              description={`${overview.completionRate}% completion rate`}
              icon={CheckCircle2}
              iconClass="bg-green-50 text-green-600"
            />

            <MetricCard
              title="Cancelled Bookings"
              value={formatNumber(overview.cancelledBookings)}
              description={`${overview.cancellationRate}% cancellation rate`}
              icon={XCircle}
              iconClass="bg-red-50 text-red-600"
            />

            <MetricCard
              title="Refunded Bookings"
              value={formatNumber(overview.refundedBookings)}
              description="Bookings marked refunded"
              icon={RotateCcw}
              iconClass="bg-pink-50 text-pink-600"
            />

            <MetricCard
              title="Successful Payments"
              value={formatNumber(overview.successfulPayments)}
              description="Payments marked successful"
              icon={IndianRupee}
              iconClass="bg-emerald-50 text-emerald-600"
            />
          </div>

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            <Panel
              title="Monthly Booking Trends"
              description="Bookings and completed bookings over the last six months"
              icon={TrendingUp}
            >
              {monthly.length === 0 ? (
                <p className="py-8 text-center text-sm text-gray-400">
                  No monthly booking data available.
                </p>
              ) : (
                <div className="space-y-5">
                  <div className="flex h-48 items-end justify-around gap-3 border-b border-gray-100 pb-2">
                    {monthly.map((item) => {
                      const height = Math.max(
                        item.bookings > 0 ? 5 : 0,
                        (item.bookings / maxMonthlyBookings) * 100
                      );

                      const completedHeight =
                        item.bookings > 0
                          ? (item.completed / maxMonthlyBookings) * 100
                          : 0;

                      return (
                        <div
                          key={item.key}
                          className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-2"
                        >
                          <div className="flex h-full w-full items-end justify-center gap-1">
                            <div
                              className="relative w-5 max-w-[35%] overflow-hidden rounded-t-md bg-violet-100"
                              style={{ height: `${height}%` }}
                              title={`${item.bookings} bookings`}
                            >
                              <div
                                className="absolute bottom-0 w-full rounded-t-md bg-violet-500"
                                style={{
                                  height: `${Math.min(
                                    100,
                                    item.bookings
                                      ? (item.completed / item.bookings) * 100
                                      : 0
                                  )}%`,
                                }}
                              />
                            </div>

                            <div
                              className="w-5 max-w-[35%] rounded-t-md bg-green-500"
                              style={{
                                height: `${completedHeight}%`,
                              }}
                              title={`${item.completed} completed`}
                            />
                          </div>

                          <span className="text-center text-[10px] text-gray-500">
                            {item.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex flex-wrap items-center gap-5 text-xs text-gray-500">
                    <span className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-sm bg-violet-500" />
                      Total bookings
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-sm bg-green-500" />
                      Completed bookings
                    </span>
                  </div>
                </div>
              )}
            </Panel>

            <Panel
              title="Businesses by Category"
              description="Registered businesses across Zeriy"
              icon={Store}
            >
              <div className="space-y-5">
                {(data.businessesByCategory || []).map((item) => (
                  <ProgressRow
                    key={item.category}
                    label={item.label}
                    value={item.count}
                    total={overview.totalBusinesses}
                  />
                ))}

                {data.businessesByCategory?.length === 0 && (
                  <p className="py-8 text-center text-sm text-gray-400">
                    No business data available.
                  </p>
                )}
              </div>
            </Panel>

            <Panel
              title="Booking Status"
              description="Current status distribution of recorded bookings"
              icon={CalendarCheck}
            >
              <div className="space-y-5">
                {Object.entries(data.bookingStatuses || {})
                  .filter(([, value]) => value > 0)
                  .map(([label, value]) => (
                    <ProgressRow
                      key={label}
                      label={label.replaceAll("-", " ")}
                      value={value}
                      total={overview.totalBookings}
                      color={bookingStatusColors[label] || "bg-gray-400"}
                    />
                  ))}

                {overview.totalBookings === 0 && (
                  <p className="py-8 text-center text-sm text-gray-400">
                    No booking records available.
                  </p>
                )}
              </div>
            </Panel>

            <Panel
              title="Payment Status"
              description="Payment status distribution"
              icon={IndianRupee}
            >
              <div className="space-y-5">
                {Object.entries(data.paymentStatuses || {})
                  .filter(([, value]) => value > 0)
                  .map(([label, value]) => (
                    <ProgressRow
                      key={label}
                      label={label}
                      value={value}
                      total={Object.values(data.paymentStatuses || {}).reduce(
                        (sum, count) => sum + count,
                        0
                      )}
                      color={paymentStatusColors[label] || "bg-gray-400"}
                    />
                  ))}

                {Object.values(data.paymentStatuses || {}).every(
                  (value) => value === 0
                ) && (
                  <p className="py-8 text-center text-sm text-gray-400">
                    No payment records available.
                  </p>
                )}
              </div>
            </Panel>
          </div>

          <Panel
            title="Booking Category Breakdown"
            description="Number of bookings for each business type"
            icon={BarChart3}
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {(data.bookingsByCategory || []).map((item) => (
                <div
                  key={item.category}
                  className="rounded-xl border border-gray-100 bg-gray-50 p-4"
                >
                  <p className="text-sm text-gray-500">{item.label}</p>
                  <p className="mt-2 text-2xl font-bold text-gray-900">
                    {formatNumber(item.count)}
                  </p>
                  <p className="mt-1 text-xs text-gray-400">Bookings</p>
                </div>
              ))}
            </div>
          </Panel>

          <Panel
            title="Payment Overview"
            description="Successful payment amounts recorded in booking data"
            icon={IndianRupee}
          >
            <div className="rounded-xl bg-violet-50 p-5">
              <p className="text-sm font-medium text-violet-700">
                Recorded successful payment amount
              </p>
              <p className="mt-2 break-words text-3xl font-bold text-violet-950">
                {formatMoney(overview.totalPaymentAmount)}
              </p>
              <p className="mt-2 text-xs leading-5 text-violet-700">
                This total uses the stored payment amount without assuming
                whether it is in rupees or paise. Verify your database
                convention before using it as a financial report.
              </p>
            </div>
          </Panel>
        </>
      ) : null}
    </div>
  );
}
