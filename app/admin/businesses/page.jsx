
"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Building2,
  Search,
  RefreshCw,
  MapPin,
  ChevronLeft,
  ChevronRight,
  Stethoscope,
  Scissors,
  Sparkles,
  FlaskConical,
} from "lucide-react";
import { toast } from "react-hot-toast";

const CATEGORIES = [
  { value: "all", label: "All Businesses" },
  { value: "clinic", label: "Clinics" },
  { value: "saloon", label: "Salons" },
  { value: "beauty-parlour", label: "Beauty Parlours" },
  { value: "diagnostic-centre", label: "Diagnostic Centres" },
];

const CATEGORY_ICONS = {
  clinic: Stethoscope,
  saloon: Scissors,
  "beauty-parlour": Sparkles,
  "diagnostic-centre": FlaskConical,
};

export default function AdminBusinessesPage() {
  const [businesses, setBusinesses] = useState([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
  });
  const [loading, setLoading] = useState(true);

  const fetchBusinesses = useCallback(
    async (currentPage = page) => {
      try {
        setLoading(true);

        const params = new URLSearchParams({
          search,
          category,
          page: String(currentPage),
          limit: "10",
        });

        const response = await fetch(
          `/api/admin/businesses?${params.toString()}`,
          { cache: "no-store" }
        );

        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.message || "Unable to load businesses");
        }

        setBusinesses(data.businesses || []);
        setPagination(
          data.pagination || {
            page: currentPage,
            limit: 10,
            total: 0,
            totalPages: 0,
          }
        );
      } catch (error) {
        toast.error(error.message || "Failed to load businesses");
      } finally {
        setLoading(false);
      }
    },
    [search, category, page]
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchBusinesses(page);
    }, 300);

    return () => clearTimeout(timer);
  }, [fetchBusinesses, page]);

  const changeCategory = (value) => {
    setCategory(value);
    setPage(1);
  };

  const changeSearch = (value) => {
    setSearch(value);
    setPage(1);
  };

  const formatDate = (value) => {
    if (!value) return "—";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return "—";

    return date.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const getStatusStyle = (status) => {
    const value = String(status || "").toLowerCase();

    if (value.includes("active") || value.includes("verified")) {
      return "bg-emerald-50 text-emerald-700";
    }

    if (value.includes("pending")) {
      return "bg-amber-50 text-amber-700";
    }

    if (value.includes("inactive") || value.includes("suspend")) {
      return "bg-red-50 text-red-700";
    }

    return "bg-gray-100 text-gray-600";
  };

  return (
    <div className="min-h-screen bg-[#f7f8fc] p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <div className="flex items-center gap-2 text-sm font-medium text-violet-600">
              <Building2 size={17} />
              Platform Management
            </div>

            <h1 className="mt-2 text-2xl font-bold text-gray-900 sm:text-3xl">
              Businesses
            </h1>

            <p className="mt-1 text-sm text-gray-500">
              Manage and monitor all businesses registered on Zeriy.
            </p>
          </div>

          <button
            onClick={() => fetchBusinesses(page)}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">Total matching businesses</p>
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
            <p className="text-sm text-gray-500">Showing on this page</p>
            <p className="mt-2 text-3xl font-bold text-gray-900">
              {businesses.length}
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row">
            <div className="relative flex-1">
              <Search
                size={18}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                value={search}
                onChange={(e) => changeSearch(e.target.value)}
                placeholder="Search business name, address or city..."
                className="w-full rounded-xl border border-gray-200 bg-gray-50 py-3 pl-10 pr-4 text-sm outline-none transition focus:border-violet-400 focus:bg-white focus:ring-2 focus:ring-violet-100"
              />
            </div>

            <select
              value={category}
              onChange={(e) => changeCategory(e.target.value)}
              className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
            >
              {CATEGORIES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
            <h2 className="font-semibold text-gray-900">Business Directory</h2>
            <span className="text-xs text-gray-400">
              {pagination.total.toLocaleString("en-IN")} records
            </span>
          </div>

          {loading ? (
            <div className="flex min-h-64 items-center justify-center">
              <div className="flex items-center gap-3 text-sm text-gray-500">
                <RefreshCw size={18} className="animate-spin text-violet-600" />
                Loading businesses...
              </div>
            </div>
          ) : businesses.length === 0 ? (
            <div className="flex min-h-64 flex-col items-center justify-center px-4 text-center">
              <div className="rounded-2xl bg-violet-50 p-4 text-violet-600">
                <Building2 size={30} />
              </div>
              <h3 className="mt-4 font-semibold text-gray-800">
                No businesses found
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                Try changing your search or category filter.
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[850px] text-left">
                  <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                    <tr>
                      <th className="px-5 py-4 font-semibold">Business</th>
                      <th className="px-5 py-4 font-semibold">Category</th>
                      <th className="px-5 py-4 font-semibold">Location</th>
                      <th className="px-5 py-4 font-semibold">Status</th>
                      <th className="px-5 py-4 font-semibold">Created</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-gray-100">
                    {businesses.map((business) => {
                      const CategoryIcon =
                        CATEGORY_ICONS[business.category] || Building2;

                      return (
                        <tr
                          key={`${business.category}-${business.id}`}
                          className="transition hover:bg-gray-50"
                        >
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
                                <CategoryIcon size={19} />
                              </div>
                              <div>
                                <p className="font-semibold text-gray-900">
                                  {business.name}
                                </p>
                                <p className="mt-0.5 text-xs text-gray-400">
                                  ID: {business.id}
                                </p>
                              </div>
                            </div>
                          </td>

                          <td className="px-5 py-4 text-sm text-gray-600">
                            {business.categoryLabel}
                          </td>

                          <td className="max-w-xs px-5 py-4">
                            <div className="flex items-start gap-2 text-sm text-gray-600">
                              <MapPin
                                size={15}
                                className="mt-0.5 shrink-0 text-gray-400"
                              />
                              <span className="line-clamp-2">
                                {business.address || business.city || "—"}
                              </span>
                            </div>
                          </td>

                          <td className="px-5 py-4">
                            <span
                              className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getStatusStyle(
                                business.status
                              )}`}
                            >
                              {business.status || "Unknown"}
                            </span>
                          </td>

                          <td className="px-5 py-4 text-sm text-gray-500">
                            {formatDate(business.createdAt)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-col gap-3 border-t border-gray-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-gray-500">
                  Page {pagination.page} of {pagination.totalPages}
                </p>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage((current) => Math.max(1, current - 1))}
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
