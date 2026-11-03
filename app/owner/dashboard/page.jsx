
"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  Plus,
  Store,
  MapPin,
  ArrowUpRight,
  LogOut,
  Menu,
  X,
  RefreshCw,
  ChevronDown,
  LayoutDashboard,
  Phone,
  LoaderCircle,
  Search,
  Building2,
  Stethoscope,
  Scissors,
  Sparkles,
  FlaskConical,
  CheckCircle2,
  AlertCircle,
  LogIn,
  Users,
  Network,
  User,
} from "lucide-react";

const CATEGORY_INFO = {
  clinic: {
    label: "Clinic",
    icon: Stethoscope,
    color: "bg-blue-50 text-blue-600",
  },
  saloon: {
    label: "Salon",
    icon: Scissors,
    color: "bg-pink-50 text-pink-600",
  },
  "beauty-parlour": {
    label: "Beauty Parlour",
    icon: Sparkles,
    color: "bg-purple-50 text-purple-600",
  },
  "diagnostic-centre": {
    label: "Diagnostic Centre",
    icon: FlaskConical,
    color: "bg-emerald-50 text-emerald-600",
  },
};


const BUSINESS_CACHE_TTL = 30 * 1000;

const businessCache = new Map();

async function fetchOwnerBusinesses(cacheKey, { force = false } = {}) {
  const existing = businessCache.get(cacheKey);

  // Reuse fresh cached data.
  if (
    !force &&
    existing?.data &&
    existing.expiresAt > Date.now()
  ) {
    return existing.data;
  }

  // Reuse an ongoing request.
  if (!force && existing?.promise) {
    return existing.promise;
  }

  const entry = {
    data: null,
    expiresAt: 0,
    promise: null,
  };

  const request = (async () => {
    const response = await fetch("/api/owner/business", {
      method: "GET",
      cache: "no-store",
    });

    const result = await response.json();
     
    

    if (!response.ok) {
      throw new Error(
        result.error || "Could not load businesses."
      );
    }

    const businesses = Array.isArray(result.businesses)
      ? result.businesses
      : [];

    entry.data = businesses;
    entry.expiresAt = Date.now() + BUSINESS_CACHE_TTL;
    entry.promise = null;

    return businesses;
  })().catch((error) => {
    // Remove only this failed request's entry.
    if (businessCache.get(cacheKey) === entry) {
      businessCache.delete(cacheKey);
    }

    throw error;
  });

  entry.promise = request;
  businessCache.set(cacheKey, entry);

  return request;
}


export default function OwnerDashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [businesses, setBusinesses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [profileOpen, setProfileOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [search, setSearch] = useState("");

  const userName = session?.user?.name || "Business Owner";
  const firstName = userName.trim().split(/\s+/)[0] || "there";

  const initials =
    userName
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 1)
      .map((part) => part[0].toUpperCase())
      .join("") || "BO";

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/signin");
    }
  }, [status, router]);


const cacheKey = `owner-businesses:${
  session?.user?.id || session?.user?.email || "unknown"
}`;

const loadBusinesses = useCallback(
  async ({ force = false } = {}) => {
    const cached = businessCache.get(cacheKey);

    // Immediately restore fresh cached businesses.
    if (
      !force &&
      cached?.data &&
      cached.expiresAt > Date.now()
    ) {
      setBusinesses(cached.data);
      setError("");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const data = await fetchOwnerBusinesses(cacheKey, {
        force,
      });

      setBusinesses(data);
    } catch (err) {
      setError(
        err.message || "Could not load businesses."
      );
    } finally {
      setLoading(false);
    }
  },
  [cacheKey]
);

useEffect(() => {
  if (status === "authenticated") {
    loadBusinesses();
  }
}, [status, loadBusinesses]);

  const openBusiness = (business) => {
    if (!business?._id || !business?.category) return;

    router.push(
      `/owner/profile?businessId=${encodeURIComponent(business._id)}&category=${encodeURIComponent(business.category)}`
    );
  };

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);

    try {
      await signOut({ callbackUrl: "/signin" });
    } finally {
      setLoggingOut(false);
    }
  };

  const filteredBusinesses = businesses.filter((business) => {
    const query = search.trim().toLowerCase();

    if (!query) return true;

    return [
      business.businessName,
      business.name,
      business.categoryName,
      business.category,
      business.city,
      business.address,
    ].some((value) =>
      String(value || "").toLowerCase().includes(query)
    );
  });

  if (status === "loading" || status === "unauthenticated") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <LoaderCircle className="animate-spin text-indigo-600" size={26} />
        <span className="ml-3 text-sm font-medium text-slate-500">
          Preparing your dashboard...
        </span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f7f8fc] text-slate-900">
   
<header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl">
  <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-2 px-5 sm:h-[70px] sm:gap-4 sm:px-6 lg:px-8">
    {/* Logo */}
    <button
      type="button"
      onClick={() => router.push("/owner/dashboard")}
      className="flex min-w-0 shrink items-center gap-2 sm:gap-2.5"
      aria-label="Zeriy dashboard"
    >
      <Image
        src="/logo.png"
        alt="Zeriy"
        width={35}
        height={35}
        priority
        className="h-9 w-9 shrink-0 rounded-lg object-contain sm:h-10 sm:w-10 sm:rounded-xl"
      />

      <span className="truncate text-lg font-extrabold tracking-tight text-slate-900 sm:text-xl">
        Zeriy<span className="text-indigo-600">.</span>
      </span>
    </button>

    {/* Actions */}
<div className="flex shrink-0 items-center gap-3 sm:gap-7">
<button
  type="button"
  onClick={() => router.push("/owner/team-members")}
  title="Team Members"
  aria-label="Team Members"
  className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 active:scale-[0.98] sm:px-4"
>
  <Network size={17} />
  <span className="hidden sm:inline">Team Members</span>
</button>

  {/* Account menu */}
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
        className={` text-slate-500 transition ${
          profileOpen ? "rotate-180" : ""
        }`}
      />
    </button>

    {/* Keep your existing account dropdown here */}


        {profileOpen && (
          <>
            <button
              type="button"
              className="fixed inset-0 z-40 cursor-default"
              aria-label="Close account menu"
              onClick={() => setProfileOpen(false)}
            />

            <div className="absolute right-0 z-50 mt-2 w-[min(18rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-slate-200 bg-white p-2  shadow-slate-200/60 sm:mt-3">
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
                  router.push("/owner/edit");
                }}
                className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-3 text-sm text-slate-700 transition hover:bg-amber-100"
              >
                <User size={17} />
              Profile
              </button>


              <button
                type="button"
                onClick={() => {
                  setProfileOpen(false);
                  router.push("/signin");
                }}
                className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-3 text-sm text-slate-700 transition hover:bg-slate-200"
              >
                <LogIn size={17} />
                Sign in
              </button>

              <button
                type="button"
                onClick={handleLogout}
                disabled={loggingOut}
                className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-red-600 transition hover:bg-red-100 disabled:opacity-60"
              >
                {loggingOut ? (
                  <LoaderCircle size={17} className="animate-spin" />
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
  </div>
</header>


      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
        <section className="relative mb-8 overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-700 via-indigo-600 to-violet-600 p-6 text-white shadow-xl shadow-indigo-200/50 sm:p-8 lg:p-10">
          <div className="pointer-events-none absolute -right-10 -top-20 h-64 w-64 rounded-full border-[35px] border-white/10" />
          <div className="pointer-events-none absolute -bottom-24 right-36 h-48 w-48 rounded-full bg-violet-400/20 blur-3xl" />

          <div className="relative z-10 max-w-2xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold text-indigo-50">
              <Sparkles size={14} />
              Your business workspace
            </span>
            <h1 className="mt-5 text-3xl font-extrabold tracking-tight sm:text-4xl">
              Welcome back, {firstName}!
            </h1>
            <p className="mt-3 max-w-lg text-sm leading-6 text-indigo-100 sm:text-base">
              Everything you manage, all in one place. Open a business to
              view its details and continue setting it up.
            </p>
            <button
              onClick={() => router.push("/owner/select-category")}
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-bold text-indigo-700 transition hover:-translate-y-0.5 hover:bg-indigo-50"
            >
              <Plus size={17} />
              Create a business
              <ArrowUpRight size={16} />
            </button>
          </div>
        </section>

        <section className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-indigo-600">
              WORKSPACE
            </p>
            <h2 className="mt-1 text-2xl font-extrabold tracking-tight">
              My businesses
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Manage and access all your business profiles.
            </p>
          </div>
<button
  onClick={() => loadBusinesses({ force: true })}
  disabled={loading}
  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-600 shadow-sm transition hover:border-indigo-200 hover:text-indigo-700 disabled:opacity-50"
>
  <RefreshCw
    size={15}
    className={loading ? "animate-spin" : ""}
  />
  Refresh
</button>
        </section>

        <section className="mb-6 grid gap-4 sm:grid-cols-2">
          <div className="flex items-center gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm shadow-slate-100">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
              <Building2 size={23} />
            </div>
            <div>
              <p className="text-sm text-slate-500">Total businesses</p>
              <p className="mt-0.5 text-2xl font-extrabold">
                {loading ? "—" : businesses.length}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm shadow-slate-100">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
              <CheckCircle2 size={23} />
            </div>
            <div>
              <p className="text-sm text-slate-500">Setup completed</p>
              <p className="mt-0.5 text-2xl font-extrabold">
                {loading
                  ? "—"
                  : businesses.filter((business) => business.setupCompleted)
                      .length}
              </p>
            </div>
          </div>
        </section>

        {error && (
          <div className="mb-6 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <AlertCircle size={19} className="mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="font-semibold">Unable to load businesses</p>
              <p className="mt-1">{error}</p>
              <button
                onClick={loadBusinesses}
                className="mt-2 font-bold underline underline-offset-2"
              >
                Try again
              </button>
            </div>
          </div>
        )}

        {!loading && businesses.length > 0 && (
          <div className="relative mb-5">
            <Search
              size={18}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by business name, category, or city..."
              className="w-full rounded-2xl border border-slate-200 bg-white py-3.5 pl-11 pr-4 text-sm outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50"
            />
          </div>
        )}

        {loading ? (
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {[1, 2, 3].map((item) => (
              <div
                key={item}
                className="h-56 animate-pulse rounded-3xl border border-slate-200 bg-white"
              />
            ))}
          </div>
        ) : businesses.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white px-5 py-16 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
              <Store size={29} />
            </div>
            <h3 className="mt-5 text-lg font-bold">Your workspace is empty</h3>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-500">
              Add your first business to manage its details and get started
              with Zeriy.
            </p>
            <button
              onClick={() => router.push("/owner/select-category")}
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-indigo-700"
            >
              <Plus size={17} />
              Add your first business
            </button>
          </div>
        ) : filteredBusinesses.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white px-5 py-12 text-center">
            <Search className="mx-auto text-slate-400" size={25} />
            <p className="mt-3 font-semibold">No matching businesses</p>
            <p className="mt-1 text-sm text-slate-500">
              Try another name, category, or city.
            </p>
          </div>
        ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
  {filteredBusinesses.map((business) => {
    const category = CATEGORY_INFO[business.category] || {
      label: business.categoryName || "Business",
      icon: Store,
      color: "bg-slate-100 text-slate-600",
    };

    const CategoryIcon = category.icon;

    return (
      <button
        key={`${business.category}-${business._id}`}
        type="button"
        onClick={() => openBusiness(business)}
        className="group flex min-w-0 items-stretch gap-4 rounded-2xl border border-slate-200/80 bg-white p-4 text-left shadow-sm transition duration-200 hover:-translate-y-1 hover:border-indigo-200 hover:shadow-lg hover:shadow-indigo-100/50 focus:outline-none focus:ring-4 focus:ring-indigo-100"
      >
        {/* Business image */}
        <div className="h-40 w-36 shrink-0 self-start overflow-hidden rounded-xl bg-slate-50 sm:w-40">
          {business.imageUrl ? (
            <img
              src={business.imageUrl}
              alt={business.businessName || business.name || "Business"}
              className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <CategoryIcon size={30} className="text-indigo-600" />
            </div>
          )}
        </div>

        {/* Business details */}
      {/* Business details */}
<div className="relative flex min-h-40 min-w-0 flex-1 flex-col">
  {/* Category label */}
  <span
    className={`absolute right-0 top-0 inline-flex max-w-[55%] items-center gap-1 rounded-full px-2 py-1.5 text-[10px] font-bold ${
      category.color || "bg-slate-100 text-slate-700"
    }`}
  >
    <CategoryIcon size={11} className="shrink-0" />
    <span className="truncate">{category.label || "Business"}</span>
  </span>

  {/* Business name */}
  <h3
    className="mt-8 line-clamp-2 break-words text-sm font-bold leading-5 tracking-tight text-slate-900 transition group-hover:text-indigo-700 sm:text-base"
    title={business.businessName || business.name || "Unnamed business"}
  >
    {business.businessName || business.name || "Unnamed business"}
  </h3>

  {/* Address */}
  <p className="mt-2 flex items-start gap-1.5 text-xs leading-5 text-slate-500">
    <MapPin size={14} className="mt-0.5 shrink-0" />
    <span className="line-clamp-2 break-words">
      {business.city || business.address || "Location not provided"}
    </span>
  </p>

  {/* Doctor / staff count */}
  <div className="mt-2 flex items-center gap-1.5 text-xs font-medium text-slate-600">
    <Users size={14} className="shrink-0 text-indigo-500" />
    <span>
      {String(business.category).toLowerCase().includes("clinic")
        ? `${business.doctors?.length ?? 0} ${
            business.doctors?.length === 1 ? "Doctor" : "Doctors"
          }`
        : `${business.teamMembers?.length ?? business.staff?.length ?? 0} ${
            (business.teamMembers?.length ?? business.staff?.length ?? 0) === 1
              ? "Staff member"
              : "Staff members"
          }`}
    </span>
  </div>

  {/* Setup status */}
  <div className="mt-auto flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
    <span
      className={`text-xs font-semibold ${
        business.setupCompleted
          ? "text-emerald-600"
          : "text-amber-600"
      }`}
    >
      {business.setupCompleted ? "Setup completed" : "Continue setup"}
    </span>

    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-50 text-slate-500 transition group-hover:bg-indigo-600 group-hover:text-white">
      <ArrowUpRight size={16} />
    </span>
  </div>
</div>
      </button>
    );
  })}
</div>
          
        )}

        <footer className="mt-12 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-5 text-xs text-slate-400">
          <span>© {new Date().getFullYear()} Zeriy</span>
          <span>Made Simpler &amp; Much Faster</span>
        </footer>
      </main>
    </div>
  );
}
