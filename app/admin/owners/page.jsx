
"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Search,
  UserRound,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  Clock,
  Eye,
} from "lucide-react";
import { toast } from "react-hot-toast";
import Link from "next/link";

export default function AdminOwnersPage() {
  const [owners, setOwners] = useState([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({});
  const [loading, setLoading] = useState(true);

  const loadOwners = useCallback(async () => {
    setLoading(true);

    try {
      const params = new URLSearchParams({
        search,
        page: String(page),
        limit: "20",
      });

      const res = await fetch(`/api/admin/owners?${params}`);
      const data = await res.json();

      if (!res.ok) throw new Error(data.message);

      setOwners(data.owners || []);
      setPagination(data.pagination || {});
    } catch (error) {
      toast.error(error.message || "Failed to load owners");
    } finally {
      setLoading(false);
    }
  }, [search, page]);

  useEffect(() => {
    const timer = setTimeout(loadOwners, 300);
    return () => clearTimeout(timer);
  }, [loadOwners]);

  const verifiedCount = owners.filter(
    (owner) => owner.verified
  ).length;

  const pendingCount = owners.filter(
    (owner) => !owner.verified
  ).length;

  return (
    <div className="space-y-6">

      <div>
        <h1 className="text-2xl font-bold md:text-3xl">
          Owners Management
        </h1>

        <p className="mt-1 text-sm text-gray-500">
          View and monitor all registered Zeriy business owners.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">

        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <UserRound className="text-violet-600" size={22} />
          <p className="mt-3 text-sm text-gray-500">Total Owners</p>
          <h2 className="mt-1 text-3xl font-bold">
            {(pagination.total || 0).toLocaleString("en-IN")}
          </h2>
        </div>

        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <CheckCircle className="text-green-600" size={22} />
          <p className="mt-3 text-sm text-gray-500">
            Verified on current page
          </p>
          <h2 className="mt-1 text-3xl font-bold">
            {verifiedCount}
          </h2>
        </div>

        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <Clock className="text-orange-500" size={22} />
          <p className="mt-3 text-sm text-gray-500">
            Pending on current page
          </p>
          <h2 className="mt-1 text-3xl font-bold">
            {pendingCount}
          </h2>
        </div>

      </div>

      <div className="rounded-2xl border bg-white p-4 shadow-sm">

        <div className="relative mb-5">
          <Search
            className="absolute left-3 top-3 text-gray-400"
            size={19}
          />

          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search owner name, email or mobile..."
            className="w-full rounded-xl border py-3 pl-10 pr-4 text-sm outline-none focus:border-violet-500"
          />
        </div>

        {loading ? (
          <div className="py-16 text-center text-sm text-gray-500">
            Loading owners...
          </div>
        ) : owners.length === 0 ? (
          <div className="py-16 text-center">
            <UserRound
              className="mx-auto mb-3 text-gray-300"
              size={35}
            />
            <p className="text-sm text-gray-500">
              No owners found.
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">

              <table className="w-full min-w-[750px] text-left text-sm">

                <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                  <tr>
                    <th className="p-4">Owner</th>
                    <th className="p-4">Mobile</th>
                    <th className="p-4">Joined</th>
                    <th className="p-4">Verification</th>
                    <th className="p-4">Configuration</th>
                    <th className="p-4 text-right">Details</th>
                  </tr>
                </thead>

                <tbody className="divide-y">

                  {owners.map((owner) => (
                    <tr
                      key={owner._id}
                      className="transition hover:bg-gray-50"
                    >
                      <td className="p-4">
                        <p className="font-semibold text-gray-900">
                          {owner.name}
                        </p>

                        <p className="mt-1 text-xs text-gray-500">
                          {owner.email || "No email"}
                        </p>
                      </td>

                      <td className="p-4">
                        {owner.phone || "—"}
                      </td>

                      <td className="p-4">
                        {owner.createdAt
                          ? new Date(
                              owner.createdAt
                            ).toLocaleDateString("en-IN")
                          : "—"}
                      </td>

                      <td className="p-4">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${
                            owner.verified
                              ? "bg-green-50 text-green-700"
                              : "bg-orange-50 text-orange-700"
                          }`}
                        >
                          {owner.verified
                            ? "Verified"
                            : "Pending"}
                        </span>
                      </td>

                      <td className="p-4">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${
                            owner.configured
                              ? "bg-blue-50 text-blue-700"
                              : "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {owner.configured
                            ? "Completed"
                            : "Incomplete"}
                        </span>
                      </td>

                      <td className="p-4 text-right">
                        <Link
                          href={`/admin/owners/${owner._id}`}
                          className="inline-flex items-center gap-2 rounded-lg bg-violet-50 px-3 py-2 text-xs font-semibold text-violet-700 hover:bg-violet-100"
                        >
                          <Eye size={15} />
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}

                </tbody>
              </table>
            </div>

            <div className="mt-5 flex items-center justify-between">

              <p className="text-xs text-gray-500">
                Page {pagination.page} of{" "}
                {Math.max(1, pagination.totalPages || 1)}
              </p>

              <div className="flex gap-2">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="rounded-lg border p-2 disabled:opacity-30"
                >
                  <ChevronLeft size={18} />
                </button>

                <button
                  disabled={page >= (pagination.totalPages || 1)}
                  onClick={() => setPage((p) => p + 1)}
                  className="rounded-lg border p-2 disabled:opacity-30"
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
