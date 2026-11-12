
"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Bell,
  Send,
  RefreshCw,
  Users,
  Store,
  UserRound,
  CheckCircle2,
  XCircle,
  Clock3,
  AlertCircle,
  Smartphone,
  History,
} from "lucide-react";

const EMPTY_RESULT = {
  totalAccounts: 0,
  sent: 0,
  failed: 0,
  expired: 0,
  withoutSubscription: 0,
};

function formatDate(value) {
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
}

function StatCard({ label, value, icon: Icon, color }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-gray-500">{label}</p>
        <span className={`rounded-lg p-2 ${color}`}>
          <Icon size={18} />
        </span>
      </div>
      <p className="mt-3 text-2xl font-bold text-gray-900">{value}</p>
    </div>
  );
}

export default function AdminNotificationsPage() {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [target, setTarget] = useState("everyone");

  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchHistory = useCallback(async (currentPage = 1) => {
    try {
      setHistoryLoading(true);

      const response = await fetch(
        `/api/admin/notifications?page=${currentPage}&limit=10`,
        { cache: "no-store" }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Could not load notification history");
      }

      setHistory(data.notifications || []);
      setTotalPages(data.pagination?.totalPages || 1);
    } catch (err) {
      setError(err.message || "Could not load notification history");
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHistory(page);
  }, [fetchHistory, page]);

  async function handleSend(event) {
    event.preventDefault();

    setMessage("");
    setError("");
    setResult(null);

    if (!title.trim() || !body.trim()) {
      setError("Please enter both notification title and message.");
      return;
    }

    const confirmed = window.confirm(
      `Send this notification to ${
        target === "everyone" ? "all subscribed accounts" : target
      }?`
    );

    if (!confirmed) return;

    try {
      setSending(true);

      const response = await fetch("/api/admin/notifications", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: title.trim(),
          body: body.trim(),
          target,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Notification could not be sent");
      }

      setResult(data.result || EMPTY_RESULT);
      setMessage(data.message || "Notification sending completed.");

      setTitle("");
      setBody("");

      setPage(1);
      await fetchHistory(1);
    } catch (err) {
      setError(err.message || "Something went wrong");
    } finally {
      setSending(false);
    }
  }

  const audiences = [
    {
      value: "everyone",
      label: "Everyone",
      description: "Users, owners and team members",
      icon: Users,
    },
    {
      value: "users",
      label: "Users",
      description: "Registered customers",
      icon: UserRound,
    },
    {
      value: "owners",
      label: "Owners",
      description: "Business owners",
      icon: Store,
    },
    {
      value: "team",
      label: "Team members",
      description: "Doctors and staff",
      icon: Smartphone,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-violet-100 p-3 text-violet-700">
            <Bell size={23} />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">
              Push Notifications
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Send announcements to Zeriy users and devices.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => fetchHistory(page)}
          disabled={historyLoading}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-50"
        >
          <RefreshCw
            size={16}
            className={historyLoading ? "animate-spin" : ""}
          />
          Refresh history
        </button>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-5">
            <h2 className="text-lg font-bold text-gray-900">
              Create notification
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Keep your announcement short and clear.
            </p>
          </div>

          <form onSubmit={handleSend} className="space-y-5">
            <div>
              <div className="mb-2 flex items-center justify-between">
                <label
                  htmlFor="notification-title"
                  className="text-sm font-semibold text-gray-700"
                >
                  Notification title
                </label>
                <span className="text-xs text-gray-400">
                  {title.length}/80
                </span>
              </div>

              <input
                id="notification-title"
                type="text"
                maxLength={80}
                required
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Example: Zeriy Update"
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none transition focus:border-violet-400 focus:bg-white focus:ring-2 focus:ring-violet-100"
              />
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <label
                  htmlFor="notification-body"
                  className="text-sm font-semibold text-gray-700"
                >
                  Message
                </label>
                <span className="text-xs text-gray-400">
                  {body.length}/240
                </span>
              </div>

              <textarea
                id="notification-body"
                maxLength={240}
                required
                rows={4}
                value={body}
                onChange={(event) => setBody(event.target.value)}
                placeholder="Write your short announcement..."
                className="w-full resize-y rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none transition focus:border-violet-400 focus:bg-white focus:ring-2 focus:ring-violet-100"
              />
            </div>

            <div>
              <p className="mb-3 text-sm font-semibold text-gray-700">
                Send to
              </p>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {audiences.map((audience) => {
                  const Icon = audience.icon;
                  const selected = target === audience.value;

                  return (
                    <button
                      key={audience.value}
                      type="button"
                      onClick={() => setTarget(audience.value)}
                      className={`flex items-start gap-3 rounded-xl border p-3 text-left transition ${
                        selected
                          ? "border-violet-400 bg-violet-50 ring-2 ring-violet-100"
                          : "border-gray-200 bg-white hover:border-gray-300"
                      }`}
                    >
                      <span
                        className={`rounded-lg p-2 ${
                          selected
                            ? "bg-violet-100 text-violet-700"
                            : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        <Icon size={18} />
                      </span>

                      <span>
                        <span className="block text-sm font-semibold text-gray-900">
                          {audience.label}
                        </span>
                        <span className="mt-1 block text-xs text-gray-500">
                          {audience.description}
                        </span>
                      </span>

                      <span className="ml-auto mt-1">
                        <span
                          className={`block h-4 w-4 rounded-full border ${
                            selected
                              ? "border-violet-600 bg-violet-600 shadow-[inset_0_0_0_3px_white]"
                              : "border-gray-300"
                          }`}
                        />
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                <AlertCircle size={17} className="mt-0.5 shrink-0" />
                {error}
              </div>
            )}

            {message && (
              <div className="flex items-start gap-2 rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-700">
                <CheckCircle2 size={17} className="mt-0.5 shrink-0" />
                {message}
              </div>
            )}

            {result && (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <StatCard
                  label="Sent"
                  value={result.sent}
                  icon={CheckCircle2}
                  color="bg-green-50 text-green-600"
                />
                <StatCard
                  label="Failed"
                  value={result.failed}
                  icon={XCircle}
                  color="bg-red-50 text-red-600"
                />
                <StatCard
                  label="Expired"
                  value={result.expired}
                  icon={Clock3}
                  color="bg-amber-50 text-amber-600"
                />
                <StatCard
                  label="No subscription"
                  value={result.withoutSubscription}
                  icon={Users}
                  color="bg-gray-100 text-gray-600"
                />
              </div>
            )}

            <button
              type="submit"
              disabled={sending || !title.trim() || !body.trim()}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-5 py-3 font-semibold text-white shadow-sm transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {sending ? (
                <>
                  <RefreshCw size={17} className="animate-spin" />
                  Sending notification...
                </>
              ) : (
                <>
                  <Send size={17} />
                  Send notification
                </>
              )}
            </button>

            <p className="text-xs leading-5 text-gray-400">
              Notifications are sent only to devices with valid push
              subscriptions. Delivery depends on device permissions,
              browser support and push-service availability.
            </p>
          </form>
        </section>

        <section className="h-fit rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-5 flex items-center gap-2">
            <Smartphone size={19} className="text-violet-600" />
            <h2 className="font-bold text-gray-900">Preview</h2>
          </div>

          <div className="rounded-2xl bg-gray-100 p-4">
            <div className="mx-auto max-w-sm rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-100 text-violet-700">
                  <Bell size={17} />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-gray-800">Zeriy</p>
                  <p className="text-[10px] text-gray-400">Push notification</p>
                </div>

                <span className="text-[10px] text-gray-400">now</span>
              </div>

              <p className="mt-3 break-words text-sm font-bold text-gray-900">
                {title.trim() || "Your notification title"}
              </p>

              <p className="mt-1 break-words text-sm leading-5 text-gray-600">
                {body.trim() || "Your notification message will appear here."}
              </p>
            </div>
          </div>

          <div className="mt-5 rounded-xl border border-blue-100 bg-blue-50 p-4">
            <p className="text-sm font-semibold text-blue-900">
              How it works
            </p>
            <ul className="mt-2 space-y-2 text-xs leading-5 text-blue-800">
              <li>• Admin sends an announcement.</li>
              <li>• Zeriy sends it to subscribed devices.</li>
              <li>• Supported browsers can display it while the website is closed.</li>
              <li>• Mobile apps need native push registration for reliable closed-app notifications.</li>
            </ul>
          </div>
        </section>
      </div>

      <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center gap-2 border-b border-gray-100 p-5">
          <History size={19} className="text-violet-600" />
          <div>
            <h2 className="font-bold text-gray-900">
              Notification history
            </h2>
            <p className="mt-0.5 text-xs text-gray-400">
              Previously sent announcements and delivery results.
            </p>
          </div>
        </div>

        {historyLoading ? (
          <div className="flex justify-center py-12 text-gray-400">
            <RefreshCw size={22} className="animate-spin" />
          </div>
        ) : history.length === 0 ? (
          <div className="py-12 text-center">
            <Bell size={28} className="mx-auto text-gray-300" />
            <p className="mt-3 text-sm font-semibold text-gray-700">
              No notifications sent yet
            </p>
            <p className="mt-1 text-xs text-gray-400">
              Your sent announcements will appear here.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {history.map((item) => (
              <div
                key={item._id}
                className="flex flex-col justify-between gap-3 p-5 sm:flex-row sm:items-center"
              >
                <div className="min-w-0">
                  <p className="break-words font-semibold text-gray-900">
                    {item.title}
                  </p>
                  <p className="mt-1 break-words text-sm text-gray-500">
                    {item.body}
                  </p>
                  <p className="mt-2 text-xs text-gray-400">
                    To: <span className="capitalize">{item.target}</span>
                    {" · "}
                    {formatDate(item.createdAt)}
                  </p>
                </div>

                <div className="flex shrink-0 flex-wrap gap-2 text-xs">
                  <span className="rounded-full bg-green-50 px-2.5 py-1 font-semibold text-green-700">
                    Sent: {item.sent || 0}
                  </span>
                  <span className="rounded-full bg-red-50 px-2.5 py-1 font-semibold text-red-700">
                    Failed: {item.failed || 0}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between border-t border-gray-100 px-5 py-4">
          <span className="text-xs text-gray-500">
            Page {page} of {totalPages}
          </span>

          <div className="flex gap-2">
            <button
              type="button"
              disabled={page <= 1 || historyLoading}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700 disabled:opacity-40"
            >
              Previous
            </button>

            <button
              type="button"
              disabled={page >= totalPages || historyLoading}
              onClick={() =>
                setPage((current) =>
                  Math.min(totalPages, current + 1)
                )
              }
              className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
