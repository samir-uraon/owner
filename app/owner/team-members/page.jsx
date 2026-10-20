
"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import {
  ArrowLeft,
  Search,
  Users,
  UserRound,
  Stethoscope,
  Store,
  Phone,
  Mail,
  BriefcaseMedical,
  Clock,
  RefreshCw,
  ChevronRight,
  UserCog,
  Building2,
  AlertCircle,
  X,
  ChevronDown,
  LogIn,
  LogOut,
  Layout,
  LoaderCircle,
} from "lucide-react";

/* -------------------------------------------------------------------------- */
/*                                  CACHE                                     */
/* -------------------------------------------------------------------------- */

const TEAM_CACHE_TTL = 30 * 1000;

const teamMembersCache = new Map();

async function getCachedTeamMembers(cacheKey, url, { force = false } = {}) {
  const existing = teamMembersCache.get(cacheKey);

  if (!force && existing?.data && existing.expiresAt > Date.now()) {
    return existing.data;
  }

  if (!force && existing?.promise) {
    return existing.promise;
  }

  const entry = {
    data: null,
    expiresAt: 0,
    promise: null,
  };

  const request = (async () => {
    const response = await fetch(url, {
      method: "GET",
      cache: "no-store",
      credentials: "same-origin",
    });

    const result = await response.json();

    if (!response.ok || result.success === false) {
      throw new Error(
        result.message || "Unable to load team members."
      );
    }

    const data = {
      team: Array.isArray(result.team) ? result.team : [],
    };

    // Do not let an older request overwrite a newer forced refresh.
    if (teamMembersCache.get(cacheKey) === entry) {
      entry.data = data;
      entry.expiresAt = Date.now() + TEAM_CACHE_TTL;
      entry.promise = null;
    }

    return data;
  })().catch((error) => {
    if (teamMembersCache.get(cacheKey) === entry) {
      teamMembersCache.delete(cacheKey);
    }

    throw error;
  });

  entry.promise = request;
  teamMembersCache.set(cacheKey, entry);

  return request;
}

/**
 * Call this after adding, editing, or deleting a team member if you want
 * to invalidate cached team data immediately.
 *
 * Pass the owner ID/email to clear only that owner's entries.
 */
function invalidateTeamMembersCache(ownerKey) {
  if (!ownerKey) {
    teamMembersCache.clear();
    return;
  }

  const prefix = `${ownerKey}:`;

  for (const key of teamMembersCache.keys()) {
    if (key.startsWith(prefix)) {
      teamMembersCache.delete(key);
    }
  }
}

/* -------------------------------------------------------------------------- */
/*                                  CONSTANTS                                 */
/* -------------------------------------------------------------------------- */

const CATEGORY_INFO = {
  clinic: {
    label: "Clinic",
    members: "Doctors",
    icon: Stethoscope,
  },
  saloon: {
    label: "Salon",
    members: "Staff",
    icon: Store,
  },
  "beauty-parlour": {
    label: "Beauty Parlour",
    members: "Staff",
    icon: Store,
  },
  "diagnostic-centre": {
    label: "Diagnostic Centre",
    members: "Staff",
    icon: Building2,
  },
};

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100";

/* -------------------------------------------------------------------------- */
/*                                  HELPERS                                   */
/* -------------------------------------------------------------------------- */

function getCategory(member) {
  return (
    member.category ||
    member.businessCategory ||
    member.business?.category ||
    "clinic"
  );
}

function getBusinessName(member) {
  return (
    member.shopName ||
    member.businessName ||
    member.business?.name ||
    member.shop?.name ||
    member.clinicName ||
    member.salonName ||
    "Business"
  );
}

function getMemberType(member) {
  const category = getCategory(member);

  if (member.type) {
    return member.type.toLowerCase() === "doctor"
      ? "doctor"
      : "staff";
  }

  return category === "clinic" ? "doctor" : "staff";
}

function getMemberId(member) {
  return String(member.id || member._id || "");
}

function getInitials(name = "") {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] || "")
    .join("")
    .toUpperCase();
}

function normalizeMember(member, business = {}) {
  const category =
    member.category ||
    member.businessCategory ||
    business.category ||
    "clinic";

  return {
    ...member,
    id: getMemberId(member),
    category,
    type: member.type || (category === "clinic" ? "doctor" : "staff"),
    businessId: String(
      member.businessId ||
        business.businessId ||
        business.id ||
        business._id ||
        ""
    ),
    businessName:
      member.businessName ||
      member.shopName ||
      business.name ||
      business.shopName ||
      business.businessName ||
      getBusinessName(member),
    phone: member.phone || member.mobile || "",
    email: member.email || "",
    specialization: member.specialization || "",
    role: member.role || "",
  };
}

/* -------------------------------------------------------------------------- */
/*                              MAIN PAGE CONTENT                             */
/* -------------------------------------------------------------------------- */

function TeamMembersContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();

  const [members, setMembers] = useState([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [businessFilter, setBusinessFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [businesses, setBusinesses] = useState([]);
  const [profileOpen, setProfileOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const selectedBusinessId = searchParams.get("businessId") || "";
  const selectedCategory = searchParams.get("category") || "";

  const userName = session?.user?.name || "Business Owner";
  const initials =
    getInitials(userName).slice(0, 2) || "BO";

  const ownerKey =
    session?.user?.id ||
    session?.user?.email ||
    "";

  /* Redirect unauthenticated users. */
  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/signin");
    }
  }, [status, router]);

  /* ------------------------------------------------------------------------ */
  /*                               FETCH MEMBERS                              */
  /* ------------------------------------------------------------------------ */

  const fetchMembers = useCallback(
    async (isRefresh = false) => {
      if (status !== "authenticated" || !ownerKey) {
        return;
      }

      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");

      const params = new URLSearchParams();

      if (selectedBusinessId) {
        params.set("businessId", selectedBusinessId);
      } else {
        params.set("all", "true");
      }

      if (selectedCategory) {
        params.set("category", selectedCategory);
      }

      const url = `/api/owner/team-members?${params.toString()}`;

      // Cache is isolated by user AND endpoint/filter combination.
      const cacheKey = `${ownerKey}:${url}`;

      try {
        const data = await getCachedTeamMembers(cacheKey, url, {
          force: isRefresh,
        });

        const normalized = data.team.map((member) =>
          normalizeMember(member, member.business || {})
        );

        setMembers(normalized);

        const uniqueBusinesses = new Map();

        normalized.forEach((member) => {
          const id = String(member.businessId || "");

          if (!id) return;

          if (!uniqueBusinesses.has(id)) {
            uniqueBusinesses.set(id, {
              id,
              name: member.businessName || "Business",
              category: member.category,
            });
          }
        });

        setBusinesses([...uniqueBusinesses.values()]);
      } catch (err) {
        setError(
          err.message ||
            "Could not load your team. Please try again."
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [
      status,
      ownerKey,
      selectedBusinessId,
      selectedCategory,
    ]
  );

  /*
   * Run once when the authenticated user or URL filters change.
   * Do not fetch while NextAuth is still loading.
   */
  useEffect(() => {
    if (status === "authenticated" && ownerKey) {
      fetchMembers();
    }
  }, [status, ownerKey, fetchMembers]);

  /* ------------------------------------------------------------------------ */
  /*                              LOGOUT HANDLER                              */
  /* ------------------------------------------------------------------------ */

  const handleLogout = useCallback(async () => {
    if (loggingOut) return;

    setLoggingOut(true);

    try {
      await signOut({ callbackUrl: "/signin" });
    } finally {
      setLoggingOut(false);
    }
  }, [loggingOut]);

  /* ------------------------------------------------------------------------ */
  /*                                   FILTERS                                */
  /* ------------------------------------------------------------------------ */

  const filteredMembers = useMemo(() => {
    const query = search.trim().toLowerCase();

    return members.filter((member) => {
      const type = getMemberType(member);
      const category = getCategory(member);

      const matchesType =
        filter === "all" ||
        (filter === "doctors" && type === "doctor") ||
        (filter === "staff" && type === "staff");

      const matchesBusiness =
        businessFilter === "all" ||
        String(member.businessId) === businessFilter;

      const searchableFields = [
        member.name,
        member.businessName,
        member.shopName,
        member.business?.name,
        member.specialization,
        member.role,
        member.phone,
        member.email,
        CATEGORY_INFO[category]?.label,
        type,
      ];

      const matchesSearch =
        !query ||
        searchableFields.some((value) =>
          String(value || "").toLowerCase().includes(query)
        );

      return matchesType && matchesBusiness && matchesSearch;
    });
  }, [members, search, filter, businessFilter]);

  const doctorCount = members.filter(
    (member) => getMemberType(member) === "doctor"
  ).length;

  const staffCount = members.filter(
    (member) => getMemberType(member) === "staff"
  ).length;

  const businessCount = new Set(
    members.map((member) => member.businessId).filter(Boolean)
  ).size;

  function openMember(member) {
    const params = new URLSearchParams({
      memberId: member.id,
      businessId: String(member.businessId || ""),
      category: getCategory(member),
    });

    router.push(`/owner/team?${params.toString()}`);
  }

  function clearFilters() {
    setSearch("");
    setFilter("all");
    setBusinessFilter("all");
  }

  /* ------------------------------------------------------------------------ */
  /*                                   RENDER                                 */
  /* ------------------------------------------------------------------------ */

  if (status === "loading" || status === "unauthenticated") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f7f8fc]">
        <div className="flex items-center gap-3 text-sm font-medium text-slate-600">
          <RefreshCw
            size={20}
            className="animate-spin text-indigo-600"
          />
          Loading your account...
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f7f8fc] text-slate-900">
      <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8 lg:py-6">
        {/* Top navigation and account menu */}
        <div className="mb-6 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            <ArrowLeft size={17} />
            Back
          </button>

          <div className="relative">
            <button
              type="button"
              onClick={() => setProfileOpen((previous) => !previous)}
              className="flex min-h-10 items-center gap-1 rounded-full border border-slate-200 bg-white p-1 pr-1.5 transition hover:border-indigo-200 hover:bg-slate-50 sm:min-h-11 sm:gap-2 sm:pr-2"
              aria-expanded={profileOpen}
              aria-label="Open account menu"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-xs font-bold text-white sm:h-9 sm:w-9 sm:text-sm">
                {initials}
              </span>

              <ChevronDown
                size={15}
                className={`text-slate-500 transition ${
                  profileOpen ? "rotate-180" : ""
                }`}
              />
            </button>

            {profileOpen && (
              <>
                <button
                  type="button"
                  className="fixed inset-0 z-40 cursor-default"
                  aria-label="Close account menu"
                  onClick={() => setProfileOpen(false)}
                />

                <div className="absolute right-0 z-50 mt-2 w-[min(18rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-lg shadow-slate-200/60 sm:mt-3">
                  <div className="border-b border-slate-100 px-3 py-3">
                    <p className="truncate text-sm font-bold text-slate-900">
                      {userName}
                    </p>

                    <p className="mt-1 truncate text-xs text-slate-500">
                      {session?.user?.email || "No email available"}
                    </p>

                    <p className="mt-1 flex items-center gap-1.5 truncate text-xs text-slate-500">
                      <Phone size={13} className="shrink-0" />
                      {session?.user?.phone ||
                        session?.user?.mobile ||
                        "No mobile number"}
                    </p>

                    <span className="mt-3 inline-flex rounded-full bg-indigo-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-indigo-700">
                      Business Owner
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setProfileOpen(false);
                      router.push("/owner/dashboard");
                    }}
                    className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-3 text-sm text-slate-700 transition hover:bg-indigo-50"
                  >
                    <Layout size={17} />
                    Dashboard
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setProfileOpen(false);
                      router.push("/signin");
                    }}
                    className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-3 text-sm text-slate-700 transition hover:bg-slate-100"
                  >
                    <LogIn size={17} />
                    Sign in
                  </button>

                  <button
                    type="button"
                    onClick={handleLogout}
                    disabled={loggingOut}
                    className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-60"
                  >
                    {loggingOut ? (
                      <LoaderCircle
                        size={17}
                        className="animate-spin"
                      />
                    ) : (
                      <LogOut size={17} />
                    )}

                    {loggingOut ? "Signing out..." : "Sign out"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Page heading */}
        <header className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700">
              <Users size={14} />
              Owner workspace
            </div>

            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Team Members
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500 sm:text-base">
              Manage doctors and staff across your businesses from
              one place.
            </p>
          </div>

          <button
            type="button"
            onClick={() => fetchMembers(true)}
            disabled={loading || refreshing}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-indigo-200 hover:text-indigo-700 disabled:opacity-50"
          >
            <RefreshCw
              size={16}
              className={
                refreshing || loading ? "animate-spin" : ""
              }
            />
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>
        </header>

        {/* Statistics */}
        <section className="mb-7 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard
            icon={Users}
            label="Total members"
            value={members.length}
            description="Across your businesses"
          />

          <StatCard
            icon={Stethoscope}
            label="Doctors"
            value={doctorCount}
            description="Clinic team members"
          />

          <StatCard
            icon={BriefcaseMedical}
            label="Staff"
            value={staffCount}
            description="Business team members"
          />
        </section>

        {/* Team directory */}
        <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-4 sm:p-6">
            <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-lg font-bold">
                  Your team directory
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Search by name, shop name, specialization or role.
                </p>
              </div>

              <span className="inline-flex w-fit items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600">
                <Users size={14} />
                {filteredMembers.length}{" "}
                {filteredMembers.length === 1 ? "member" : "members"}
              </span>
            </div>

            <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_220px]">
              <div className="relative">
                <Search
                  size={18}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                />

                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search name, shop, specialization..."
                  aria-label="Search team members"
                  className={inputClass}
                />

                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    aria-label="Clear search"
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>

              <select
                value={businessFilter}
                onChange={(event) =>
                  setBusinessFilter(event.target.value)
                }
                aria-label="Filter by business"
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
              >
                <option value="all">All businesses</option>

                {businesses.map((business) => (
                  <option key={business.id} value={business.id}>
                    {business.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <FilterButton
                active={filter === "all"}
                onClick={() => setFilter("all")}
              >
                All members ({members.length})
              </FilterButton>

              <FilterButton
                active={filter === "doctors"}
                onClick={() => setFilter("doctors")}
              >
                <Stethoscope size={14} />
                Doctors ({doctorCount})
              </FilterButton>

              <FilterButton
                active={filter === "staff"}
                onClick={() => setFilter("staff")}
              >
                <UserRound size={14} />
                Staff ({staffCount})
              </FilterButton>

              {(search ||
                filter !== "all" ||
                businessFilter !== "all") && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="ml-auto px-2 py-2 text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                >
                  Clear filters
                </button>
              )}
            </div>
          </div>

          <div className="p-4 sm:p-6">
            {loading ? (
              <div className="flex min-h-64 flex-col items-center justify-center text-center">
                <RefreshCw
                  size={28}
                  className="animate-spin text-indigo-600"
                />

                <p className="mt-4 text-sm font-semibold text-slate-700">
                  Loading your team...
                </p>

                <p className="mt-1 text-xs text-slate-400">
                  Fetching your business team members
                </p>
              </div>
            ) : error ? (
              <div className="flex min-h-64 flex-col items-center justify-center text-center">
                <div className="rounded-2xl bg-red-50 p-4 text-red-600">
                  <AlertCircle size={28} />
                </div>

                <p className="mt-4 font-semibold text-slate-800">
                  Could not load team members
                </p>

                <p className="mt-2 max-w-lg text-sm text-slate-500">
                  {error}
                </p>

                <button
                  type="button"
                  onClick={() => fetchMembers(true)}
                  className="mt-5 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
                >
                  Try again
                </button>
              </div>
            ) : filteredMembers.length === 0 ? (
              <div className="flex min-h-72 flex-col items-center justify-center px-4 text-center">
                <div className="rounded-2xl bg-indigo-50 p-5 text-indigo-600">
                  <Users size={32} />
                </div>

                <h3 className="mt-5 text-lg font-bold">
                  {members.length === 0
                    ? "No team members yet"
                    : "No matching members"}
                </h3>

                <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">
                  {members.length === 0
                    ? "Doctors and staff added to your businesses will appear here."
                    : "Try another name, shop name or specialization, or clear your filters."}
                </p>

                {members.length > 0 && (
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="mt-4 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
                  >
                    Clear filters
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {filteredMembers.map((member) => (
                  <MemberCard
                    key={`${member.businessId}-${member.id}`}
                    member={member}
                    onClick={() => openMember(member)}
                  />
                ))}
              </div>
            )}
          </div>

          {!loading && !error && filteredMembers.length > 0 && (
            <div className="border-t border-slate-100 bg-slate-50/70 px-4 py-4 sm:px-6">
              <p className="text-xs text-slate-500">
                Showing{" "}
                <span className="font-semibold text-slate-700">
                  {filteredMembers.length}
                </span>{" "}
                of{" "}
                <span className="font-semibold text-slate-700">
                  {members.length}
                </span>{" "}
                team members across {businessCount}{" "}
                {businessCount === 1 ? "business" : "businesses"}.
              </p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

/* -------------------------------------------------------------------------- */
/*                              REUSABLE COMPONENTS                           */
/* -------------------------------------------------------------------------- */

function StatCard({ icon: Icon, label, value, description }) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-500">
            {label}
          </p>

          <p className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
            {value}
          </p>

          <p className="mt-2 text-xs text-slate-400">
            {description}
          </p>
        </div>

        <div className="rounded-xl bg-indigo-50 p-3 text-indigo-600">
          <Icon size={21} />
        </div>
      </div>
    </div>
  );
}

function FilterButton({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-xs font-semibold transition ${
        active
          ? "border-indigo-600 bg-indigo-600 text-white shadow-sm"
          : "border-slate-200 bg-white text-slate-600 hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700"
      }`}
    >
      {children}
    </button>
  );
}

function MemberCard({ member, onClick }) {
  const type = getMemberType(member);
  const category = getCategory(member);
  const isDoctor = type === "doctor";
  const businessName = member.businessName || getBusinessName(member);

  const CategoryIcon =
    CATEGORY_INFO[category]?.icon || Building2;

  const subtitle = isDoctor
    ? member.specialization || "Doctor"
    : member.role || "Staff member";

  return (
    <article className="group flex min-w-0 flex-col rounded-2xl border border-slate-200 bg-white p-5 transition duration-200 hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-lg hover:shadow-indigo-100/40">
      <div className="flex items-start gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-sm font-bold text-indigo-700">
          {getInitials(member.name || "Team Member")}
        </div>

        <div className="min-w-0 flex-1">
          <h3
            className="truncate font-bold text-slate-900"
            title={member.name}
          >
            {member.name || "Unnamed member"}
          </h3>

          <p className="mt-1 truncate text-sm text-slate-500">
            {subtitle}
          </p>
        </div>

        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${
            isDoctor
              ? "bg-indigo-50 text-indigo-700"
              : "bg-emerald-50 text-emerald-700"
          }`}
        >
          {isDoctor ? "Doctor" : "Staff"}
        </span>
      </div>

      <div className="mt-5 rounded-xl border border-slate-100 bg-slate-50 p-3">
        <div className="flex items-start gap-2.5">
          <CategoryIcon
            size={17}
            className="mt-0.5 shrink-0 text-indigo-600"
          />

          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Business
            </p>

            <p
              className="mt-1 break-words text-sm font-semibold text-slate-800"
              title={businessName}
            >
              {businessName}
            </p>

            <p className="mt-1 text-xs text-slate-500">
              {CATEGORY_INFO[category]?.label || category}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-1 flex-col gap-3">
        {member.phone && (
          <div className="flex items-center gap-2.5 text-sm text-slate-600">
            <Phone size={15} className="shrink-0 text-slate-400" />

            <a
              href={`tel:${member.phone}`}
              onClick={(event) => event.stopPropagation()}
              className="truncate hover:text-indigo-600"
            >
              {member.phone}
            </a>
          </div>
        )}

        {member.email && (
          <div className="flex items-center gap-2.5 text-sm text-slate-600">
            <Mail size={15} className="shrink-0 text-slate-400" />

            <a
              href={`mailto:${member.email}`}
              onClick={(event) => event.stopPropagation()}
              className="truncate hover:text-indigo-600"
            >
              {member.email}
            </a>
          </div>
        )}

        {isDoctor && member.experience != null && (
          <div className="flex items-center gap-2.5 text-sm text-slate-600">
            <Clock size={15} className="shrink-0 text-slate-400" />
            <span>{member.experience} years of experience</span>
          </div>
        )}

        {isDoctor && member.fee != null && (
          <p className="text-sm font-semibold text-slate-700">
            Consultation fee: ₹
            {Number(member.fee).toLocaleString("en-IN")}
          </p>
        )}

        {!member.phone && !member.email && (
          <p className="text-xs text-slate-400">
            No contact information provided
          </p>
        )}
      </div>

      <button
        type="button"
        onClick={onClick}
        className="mt-5 flex w-full items-center justify-between rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition group-hover:border-indigo-200 group-hover:bg-indigo-50 group-hover:text-indigo-700"
      >
        <span className="inline-flex items-center gap-2">
          <UserCog size={16} />
          Work
        </span>

        <ChevronRight size={17} />
      </button>
    </article>
  );
}

/* -------------------------------------------------------------------------- */
/*                                  PAGE EXPORT                               */
/* -------------------------------------------------------------------------- */

export default function TeamMembersPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-[#f7f8fc]">
          <div className="flex items-center gap-3 text-sm font-medium text-slate-600">
            <RefreshCw
              size={20}
              className="animate-spin text-indigo-600"
            />
            Loading team members...
          </div>
        </main>
      }
    >
      <TeamMembersContent />
    </Suspense>
  );
}
