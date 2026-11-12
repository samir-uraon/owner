
"use client";

import { useEffect, useCallback, useState } from "react";
import {
  Search,
  Users,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  ShieldBan,
  CheckCircle,
  UserRound,
  Mail,
  Phone,
  CalendarDays,
  Filter,
} from "lucide-react";
import { toast } from "react-hot-toast";

export default function AdminUsersPage() {
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    totalPages: 1,
  });
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState("");

  const loadUsers = useCallback(async () => {
    setLoading(true);

    try {
      const params = new URLSearchParams({
        search: search.trim(),
        page: String(page),
        limit: "20",
      });

      const res = await fetch(`/api/admin/users?${params}`, {
        cache: "no-store",
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Failed to load users");
      }

      setUsers(data.users || []);
      setPagination({
        total: data.pagination?.total || 0,
        page: data.pagination?.page || page,
        totalPages: data.pagination?.totalPages || 1,
      });
    } catch (error) {
      toast.error(error.message || "Failed to load users");
    } finally {
      setLoading(false);
    }
  }, [search, page]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadUsers();
    }, 350);

    return () => clearTimeout(timer);
  }, [loadUsers]);

  async function changeStatus(user) {
    const suspended = user.status === "suspended";
    const action = suspended ? "activate" : "suspend";

    const confirmed = window.confirm(
      `Are you sure you want to ${action} ${user.name || "this user"}?`
    );

    if (!confirmed) return;

    setUpdating(user._id);

    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: user._id,
          action,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Operation failed");
      }

      toast.success(data.message || "User status updated");

      await loadUsers();
    } catch (error) {
      toast.error(error.message || "Operation failed");
    } finally {
      setUpdating("");
    }
  }

  const totalPages = Math.max(1, pagination.totalPages || 1);

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">

      {/* Page Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-violet-600">
            <Users size={15} />
            Platform Management
          </div>

          <h1 className="mt-2 text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
            Users Management
          </h1>

          <p className="mt-1 text-sm text-gray-500">
            Manage registered Zeriy customers and their account access.
          </p>
        </div>

        <button
          onClick={loadUsers}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:opacity-50"
        >
          <RefreshCw
            size={16}
            className={loading ? "animate-spin" : ""}
          />
          Refresh
        </button>
      </div>

      {/* Statistics */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
              <Users size={21} />
            </div>
            <span className="text-xs font-medium text-gray-400">
              Search results
            </span>
          </div>

          <p className="mt-5 text-sm font-medium text-gray-500">
            Total matching users
          </p>

          <h2 className="mt-1 text-3xl font-bold text-gray-900">
            {pagination.total.toLocaleString("en-IN")}
          </h2>
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <Filter size={21} />
            </div>
            <span className="text-xs font-medium text-gray-400">
              Pagination
            </span>
          </div>

          <p className="mt-5 text-sm font-medium text-gray-500">
            Current page
          </p>

          <h2 className="mt-1 text-3xl font-bold text-gray-900">
            {page} <span className="text-lg font-medium text-gray-400">/ {totalPages}</span>
          </h2>
        </div>
      </div>

      {/* User Table */}
      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">

        {/* Search */}
        <div className="border-b border-gray-100 p-4 sm:p-5">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <h2 className="font-semibold text-gray-900">
                All Users
              </h2>
              <p className="mt-1 text-xs text-gray-400">
                Search and manage customer accounts.
              </p>
            </div>

            <div className="relative w-full sm:max-w-sm">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                size={18}
              />

              <input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Search name, email or phone..."
                className="w-full rounded-xl border border-gray-200 bg-gray-50 py-3 pl-10 pr-4 text-sm outline-none transition focus:border-violet-500 focus:bg-white focus:ring-4 focus:ring-violet-50"
              />
            </div>
          </div>
        </div>

        {/* Loading */}
        {loading ? (
          <div className="flex min-h-[300px] flex-col items-center justify-center gap-3">
            <RefreshCw className="animate-spin text-violet-600" size={26} />
            <p className="text-sm text-gray-500">
              Loading users...
            </p>
          </div>
        ) : users.length === 0 ? (
          <div className="flex min-h-[300px] flex-col items-center justify-center px-4 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100 text-gray-400">
              <UserRound size={26} />
            </div>

            <h3 className="mt-4 font-semibold text-gray-800">
              No users found
            </h3>

            <p className="mt-1 text-sm text-gray-400">
              Try another name, email or phone number.
            </p>
          </div>
        ) : (
          <>
            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="bg-gray-50 text-[11px] uppercase tracking-wider text-gray-500">
                  <tr>
                    <th className="px-5 py-4 font-semibold">User Details</th>
                    <th className="px-5 py-4 font-semibold">Phone</th>
                    <th className="px-5 py-4 font-semibold">Registration</th>
                    <th className="px-5 py-4 font-semibold">Status</th>
                    <th className="px-5 py-4 text-right font-semibold">Action</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-100">
                  {users.map((user) => {
                    const suspended = user.status === "suspended";
                    const busy = updating === user._id;

                    return (
                      <tr
                        key={user._id}
                        className="transition hover:bg-gray-50/70"
                      >
                        {/* User */}
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-violet-50 font-bold text-violet-600">
                              {(user.name || user.email || "U")
                                .charAt(0)
                                .toUpperCase()}
                            </div>

                            <div className="min-w-0">
                              <p className="truncate font-semibold text-gray-900">
                                {user.name || "Unnamed user"}
                              </p>

                              <p className="mt-1 flex items-center gap-1 truncate text-xs text-gray-400">
                                <Mail size={12} />
                                {user.email || "No email"}
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* Phone */}
                        <td className="px-5 py-4">
                          <span className="flex items-center gap-2 text-gray-600">
                            <Phone size={14} className="text-gray-400" />
                            {user.phone || "—"}
                          </span>
                        </td>

                        {/* Registration */}
                        <td className="px-5 py-4">
                          <span className="flex items-center gap-2 text-gray-600">
                            <CalendarDays size={14} className="text-gray-400" />
                            {user.createdAt
                              ? new Date(user.createdAt).toLocaleDateString("en-IN")
                              : "—"}
                          </span>
                        </td>

                        {/* Status */}
                        <td className="px-5 py-4">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${
                              suspended
                                ? "bg-red-50 text-red-600"
                                : "bg-green-50 text-green-700"
                            }`}
                          >
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${
                                suspended ? "bg-red-500" : "bg-green-500"
                              }`}
                            />
                            {suspended ? "Suspended" : "Active"}
                          </span>
                        </td>

                        {/* Action */}
                        <td className="px-5 py-4 text-right">
                          <button
                            type="button"
                            onClick={() => changeStatus(user)}
                            disabled={busy}
                            className={`inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
                              suspended
                                ? "bg-green-50 text-green-700 hover:bg-green-100"
                                : "bg-red-50 text-red-600 hover:bg-red-100"
                            }`}
                          >
                            {busy ? (
                              <RefreshCw size={14} className="animate-spin" />
                            ) : suspended ? (
                              <CheckCircle size={14} />
                            ) : (
                              <ShieldBan size={14} />
                            )}

                            {busy
                              ? "Updating"
                              : suspended
                                ? "Activate"
                                : "Suspend"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex flex-col justify-between gap-3 border-t border-gray-100 px-5 py-4 sm:flex-row sm:items-center">
              <p className="text-xs text-gray-500">
                Showing{" "}
                <span className="font-semibold text-gray-800">
                  {pagination.total === 0 ? 0 : (page - 1) * 20 + 1}
                </span>
                {" "}to{" "}
                <span className="font-semibold text-gray-800">
                  {Math.min(page * 20, pagination.total)}
                </span>
                {" "}of{" "}
                <span className="font-semibold text-gray-800">
                  {pagination.total}
                </span>
                {" "}users
              </p>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={page <= 1 || loading}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="rounded-lg border border-gray-200 p-2 text-gray-600 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-30"
                >
                  <ChevronLeft size={18} />
                </button>

                <span className="px-2 text-xs font-medium text-gray-600">
                  {page} / {totalPages}
                </span>

                <button
                  type="button"
                  disabled={page >= totalPages || loading}
                  onClick={() => setPage((p) => p + 1)}
                  className="rounded-lg border border-gray-200 p-2 text-gray-600 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-30"
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
