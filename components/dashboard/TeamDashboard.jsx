
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  CalendarDays,
  Clock3,
  Users,
  Search,
  RefreshCw,
  UserRound,
  Stethoscope,
  Save,
  Pencil,
  LoaderCircle,
  AlertCircle,
  CheckCircle2,
  LayoutDashboard,
  ChevronRight,
  Menu,
  X,
  Phone,
  CreditCard,
  BriefcaseMedical,
  CalendarCheck,
  ArrowUpRight,
  LogOut,
} from "lucide-react";

const inputClass =
  "mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100";

function getLocalDate() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const values = Object.fromEntries(
    parts.map(({ type, value }) => [type, value])
  );

  return `${values.year}-${values.month}-${values.day}`;
}

function normalizeSlot(value) {
  return String(value || "")
    .trim()
    .replace(/[–—−]/g, "-")
    .replace(/\s+/g, "")
    .toLowerCase();
}

function getDayName(date) {
  if (!date) return "";

  return new Date(`${date}T12:00:00`)
    .toLocaleDateString("en-US", {
      weekday: "long",
      timeZone: "Asia/Kolkata",
    })
    .toLowerCase();
}

function formatDate(value) {
  if (!value) return "Select a date";

  const date = new Date(`${value}T12:00:00+05:30`);

  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  }).format(date);
}

function formatTime(value) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return String(value);

  return new Intl.DateTimeFormat("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  }).format(date);
}

function statusClass(value) {
  const status = String(value || "").toLowerCase();

  if (["completed", "paid", "captured", "success"].includes(status)) {
    return "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100";
  }

  if (["waiting", "pending"].includes(status)) {
    return "bg-amber-50 text-amber-700 ring-1 ring-amber-100";
  }

  if (["serving", "in-progress"].includes(status)) {
    return "bg-blue-50 text-blue-700 ring-1 ring-blue-100";
  }

  if (
    ["cancelled", "failed", "refunded", "rejected", "skipped", "no-show"].includes(
      status
    )
  ) {
    return "bg-red-50 text-red-700 ring-1 ring-red-100";
  }

  return "bg-slate-100 text-slate-600 ring-1 ring-slate-200";
}

function Status({ value }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${statusClass(
        value
      )}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {String(value || "unknown").replaceAll("-", " ")}
    </span>
  );
}

function StatCard({ label, value, icon: Icon, color, subtitle }) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className="mt-3 text-3xl font-bold tracking-tight text-slate-900">
            {value}
          </p>
        </div>
        <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${color}`}>
          <Icon size={21} />
        </div>
      </div>
      <p className="mt-3 text-xs text-slate-400">{subtitle}</p>
    </div>
  );
}

function ProfileValue({ label, value }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p className="mt-2 break-words text-sm font-semibold text-slate-800">
        {value || "Not provided"}
      </p>
    </div>
  );
}

function ProfileSection({ role, profile, onSaved }) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [form, setForm] = useState({});

  useEffect(() => {
    if (!profile) return;

    setForm({
      name: profile.name || "",
      email: profile.email || "",
      phone: profile.phone || "",
      profileImage: profile.profileImage || "",
      experience: profile.experience ?? "",
      specialization: profile.specialization || "",
      fee: profile.fee ?? "",
      services: Array.isArray(profile.services)
        ? profile.services.join(", ")
        : profile.services || "",
    });
  }, [profile]);

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function save(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch("/api/team/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          role,
          experience:
            form.experience === "" ? "" : Number(form.experience),
          fee: form.fee === "" ? "" : Number(form.fee),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not update profile");
      }

      onSaved(data.profile);
      setEditing(false);
      setSuccess("Your profile has been updated.");
    } catch (err) {
      setError(err.message || "Could not update profile");
    } finally {
      setSaving(false);
    }
  }

  if (!profile) return null;

  const fields = [
    { key: "name", label: "Full name", required: true },
    { key: "phone", label: "Phone number", type: "tel" },
    { key: "profileImage", label: "Profile image URL", type: "url" },
    { key: "experience", label: "Experience (years)", type: "number" },
    ...(role === "doctor"
      ? [
          { key: "specialization", label: "Specialization" },
          { key: "fee", label: "Consultation fee (₹)", type: "number" },
        ]
      : []),
  ];

  return (
    <section
      id="profile"
      className="scroll-mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
    >
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 px-5 py-5 sm:px-7">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-indigo-600">
            Account settings
          </p>
          <h2 className="mt-1 text-lg font-bold text-slate-900">
            My profile
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Manage your personal and professional details.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setError("");
            setSuccess("");
            setEditing((value) => !value);
          }}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          {editing ? <X size={16} /> : <Pencil size={16} />}
          {editing ? "Cancel editing" : "Edit profile"}
        </button>
      </div>

      <div className="p-5 sm:p-7">
        <div className="mb-6 flex items-center gap-4 rounded-2xl bg-indigo-50/70 p-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-indigo-100 text-indigo-700 ring-4 ring-white">
            {profile.profileImage ? (
              <img
                src={profile.profileImage}
                alt={profile.name || "Profile"}
                className="h-full w-full object-cover"
              />
            ) : (
              <UserRound size={30} />
            )}
          </div>
          <div className="min-w-0">
            <h3 className="truncate text-lg font-bold text-slate-900">
              {profile.name || "Team member"}
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              {role === "doctor" ? "Doctor" : "Staff member"}
            </p>
            <p className="mt-1 truncate text-xs text-slate-400">
              {profile.businessName || "Zeric team"}
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-4 flex gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-700">
            <AlertCircle size={18} className="shrink-0" />
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 flex gap-2 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">
            <CheckCircle2 size={18} className="shrink-0" />
            {success}
          </div>
        )}

        {editing ? (
          <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
            {fields.map((field) => (
              <label
                key={field.key}
                className="block text-sm font-medium text-slate-700"
              >
                {field.label}
                <input
                  type={field.type || "text"}
                  className={inputClass}
                  value={form[field.key] ?? ""}
                  onChange={(event) =>
                    update(field.key, event.target.value)
                  }
                  required={field.required}
                  maxLength={field.key === "profileImage" ? 2000 : 100}
                  min={field.type === "number" ? 0 : undefined}
                />
              </label>
            ))}

            <label className="block text-sm font-medium text-slate-700">
              Login email
              <input
                className={`${inputClass} cursor-not-allowed bg-slate-50 text-slate-500`}
                value={form.email || ""}
                disabled
                readOnly
              />
            </label>

            {role === "staff" && (
              <label className="block text-sm font-medium text-slate-700 sm:col-span-2">
                Services (comma-separated)
                <textarea
                  rows={3}
                  className={inputClass}
                  value={form.services || ""}
                  onChange={(event) =>
                    update("services", event.target.value)
                  }
                  placeholder="Appointments, customer support..."
                />
              </label>
            )}

            <div className="flex flex-wrap gap-3 pt-2 sm:col-span-2">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50"
              >
                {saving ? (
                  <LoaderCircle size={17} className="animate-spin" />
                ) : (
                  <Save size={17} />
                )}
                {saving ? "Saving changes..." : "Save changes"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditing(false);
                  setError("");
                  setForm({
                    name: profile.name || "",
                    email: profile.email || "",
                    phone: profile.phone || "",
                    profileImage: profile.profileImage || "",
                    experience: profile.experience ?? "",
                    specialization: profile.specialization || "",
                    fee: profile.fee ?? "",
                    services: Array.isArray(profile.services)
                      ? profile.services.join(", ")
                      : profile.services || "",
                  });
                }}
                className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50"
              >
                Discard
              </button>
            </div>
          </form>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <ProfileValue label="Full name" value={profile.name} />
            <ProfileValue label="Login email" value={profile.email} />
            <ProfileValue label="Phone number" value={profile.phone} />
            <ProfileValue
              label="Experience"
              value={
                profile.experience === "" || profile.experience == null
                  ? "Not provided"
                  : `${profile.experience} years`
              }
            />

            {role === "doctor" ? (
              <>
                <ProfileValue
                  label="Specialization"
                  value={profile.specialization}
                />
                <ProfileValue
                  label="Consultation fee"
                  value={
                    profile.fee === "" || profile.fee == null
                      ? "Not provided"
                      : `₹${profile.fee}`
                  }
                />
              </>
            ) : (
              <ProfileValue label="Services" value={form.services} />
            )}
          </div>
        )}
      </div>
    </section>
  );
}

function EmptyState({ icon: Icon, title, description }) {
  return (
    <div className="flex min-h-64 flex-col items-center justify-center px-5 py-12 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
        <Icon size={26} />
      </div>
      <h3 className="mt-4 font-semibold text-slate-900">{title}</h3>
      <p className="mt-1 max-w-sm text-sm leading-6 text-slate-500">
        {description}
      </p>
    </div>
  );
}

export default function TeamDashboard({ role = "staff" }) {
  const isDoctor = role === "doctor";

  const [date, setDate] = useState("");
  const [slot, setSlot] = useState("");
  const [schedule, setSchedule] = useState({});
  const [profile, setProfile] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState("");
  const [loadingSchedule, setLoadingSchedule] = useState(true);
  const [loadingCustomers, setLoadingCustomers] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [activeView, setActiveView] = useState("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    setDate(getLocalDate());
  }, []);

  const slots = useMemo(() => {
    if (!date) return [];

    const day = getDayName(date);
    const daySchedule = schedule[day] || {};

    if (daySchedule.active === false) return [];

    return (daySchedule.slots || [])
      .filter(
        (item) =>
          item.active !== false && item.open && item.close
      )
      .map((item) => ({
        value: `${item.open}-${item.close}`,
        label: `${item.open} – ${item.close}`,
      }));
  }, [date, schedule]);

  const loadSchedule = useCallback(async () => {
    setLoadingSchedule(true);

    try {
      const response = await fetch(
        `/api/team/schedule?role=${encodeURIComponent(role)}`,
        { cache: "no-store" }
      );
      const data = await response.json();
       
      

      if (!response.ok) {
        throw new Error(data.error || "Could not load schedule");
      }

      setSchedule(data.schedule || {});
    } catch (err) {
      setError(err.message || "Could not load schedule");
    } finally {
      setLoadingSchedule(false);
    }
  }, [role]);

  const loadProfile = useCallback(async () => {
    setLoadingProfile(true);

    try {
      const response = await fetch(
        `/api/team/profile?role=${encodeURIComponent(role)}`,
        { cache: "no-store" }
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not load profile");
      }

      setProfile(data.profile || null);
    } catch (err) {
      setError(err.message || "Could not load profile");
    } finally {
      setLoadingProfile(false);
    }
  }, [role]);

  const loadInitialData = useCallback(async () => {
    setError("");
    await Promise.all([loadSchedule(), loadProfile()]);
  }, [loadSchedule, loadProfile]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  useEffect(() => {
    if (!slots.length) {
      setSlot("");
      return;
    }

    setSlot((current) => {
      const match = slots.find(
        (item) =>
          normalizeSlot(item.value) === normalizeSlot(current)
      );

      return match?.value || slots[0].value;
    });
  }, [slots]);

  const loadCustomers = useCallback(async () => {
    if (!date || !slot || !profile) {
      setCustomers([]);
      setLoadingCustomers(false);
      return;
    }

    setLoadingCustomers(true);
    setError("");

    try {
      const params = new URLSearchParams({ role, date, slot });
      const response = await fetch(
        `/api/dashboard/slot-customers?${params.toString()}`,
        { cache: "no-store" }
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not load customers");
      }

      setCustomers(data.customers || []);
    } catch (err) {
      setCustomers([]);
      setError(err.message || "Could not load customers");
    } finally {
      setLoadingCustomers(false);
    }
  }, [role, date, slot, profile]);

  useEffect(() => {
    loadCustomers();
  }, [loadCustomers, refresh]);

  const filteredCustomers = useMemo(() => {
    const term = search.trim().toLowerCase();

    if (!term) return customers;

    return customers.filter((customer) =>
      [
        customer.patient?.name,
        customer.patient?.phone,
        customer.token,
        customer.bookingReference,
        customer.status,
      ].some((value) =>
        String(value ?? "").toLowerCase().includes(term)
      )
    );
  }, [customers, search]);

  const waitingCount = customers.filter((item) =>
    ["waiting", "pending"].includes(
      String(item.status || "").toLowerCase()
    )
  ).length;

  const servingCount = customers.filter((item) =>
    ["serving", "in-progress"].includes(
      String(item.status || "").toLowerCase()
    )
  ).length;

  const completedCount = customers.filter(
    (item) =>
      String(item.status || "").toLowerCase() === "completed"
  ).length;

  const navItems = [
    {
      id: "dashboard",
      label: "Overview",
      icon: LayoutDashboard,
    },
    {
      id: "bookings",
      label: isDoctor ? "Patient queue" : "Bookings",
      icon: CalendarCheck,
    },
    {
      id: "profile",
      label: "My profile",
      icon: UserRound,
    },
  ];

  function navigate(id) {
    setActiveView(id);
    setSidebarOpen(false);

    if (id === "profile") {
      setTimeout(() => {
        document.getElementById("profile")?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }, 50);
    } else if (id === "bookings") {
      setTimeout(() => {
        document.getElementById("bookings")?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }, 50);
    } else {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  return (
    <main className="min-h-screen bg-[#f6f7fb] text-slate-900">
      {sidebarOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-40 bg-slate-950/40 lg:hidden"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-slate-200 bg-white transition-transform duration-300 lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-[76px] items-center gap-3 border-b border-slate-100 px-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-lg shadow-indigo-200">
            {isDoctor ? (
              <Stethoscope size={21} />
            ) : (
              <Users size={21} />
            )}
          </div>
          <div>
            <h1 className="text-xl font-extrabold tracking-tight text-slate-900">
              Zeric<span className="text-indigo-600">.</span>
            </h1>
            <p className="text-[11px] font-medium text-slate-400">
              TEAM WORKSPACE
            </p>
          </div>
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="ml-auto rounded-lg p-2 text-slate-400 hover:bg-slate-100 lg:hidden"
            aria-label="Close sidebar"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-4 pt-7">
          <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
            Workspace
          </p>

          <nav className="space-y-1.5">
            {navItems.map(({ id, label, icon: Icon }) => {
              const active = activeView === id;

              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => navigate(id)}
                  className={`flex w-full items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-semibold transition ${
                    active
                      ? "bg-indigo-50 text-indigo-700"
                      : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                  }`}
                >
                  <Icon size={19} />
                  {label}
                  {active && (
                    <ChevronRight size={16} className="ml-auto" />
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="mt-auto p-4">
          <div className="rounded-2xl bg-slate-50 p-4">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
              <Activity size={15} className="text-emerald-600" />
              Workspace status
            </div>
            <p className="mt-2 text-xs leading-5 text-slate-500">
              View scheduled slots and manage your bookings from one place.
            </p>
          </div>

          <div className="mt-4 flex items-center gap-3 border-t border-slate-100 px-2 pt-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-indigo-100 text-indigo-700">
              {profile?.profileImage ? (
                <img
                  src={profile.profileImage}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <UserRound size={19} />
              )}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-800">
                {profile?.name || (isDoctor ? "Doctor" : "Staff member")}
              </p>
              <p className="truncate text-xs capitalize text-slate-400">
                {role}
              </p>
            </div>
            <button
              type="button"
              title="Go to profile"
              onClick={() => navigate("profile")}
              className="ml-auto rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-indigo-600"
            >
              <ArrowUpRight size={17} />
            </button>
          </div>
        </div>
      </aside>

      <div className="min-h-screen lg:pl-64">
        <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl">
          <div className="flex h-[76px] items-center gap-4 px-4 sm:px-7 lg:px-9">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="rounded-xl border border-slate-200 p-2.5 text-slate-600 lg:hidden"
              aria-label="Open navigation"
            >
              <Menu size={20} />
            </button>

            <div className="min-w-0">
              <p className="text-xs font-medium text-slate-400">
                Zeric / Workspace
              </p>
              <h2 className="mt-0.5 truncate text-lg font-bold text-slate-900">
                {activeView === "profile"
                  ? "My profile"
                  : activeView === "bookings"
                    ? isDoctor
                      ? "Patient queue"
                      : "Customer bookings"
                    : "Dashboard overview"}
              </h2>
            </div>

            <div className="ml-auto flex items-center gap-2 sm:gap-3">
              <div className="hidden items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 sm:flex">
                <CalendarDays size={15} className="text-indigo-600" />
                <span className="text-xs font-semibold text-slate-600">
                  {date ? formatDate(date) : "Loading date..."}
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setRefresh((value) => value + 1);
                  loadInitialData();
                }}
                disabled={loadingCustomers || loadingSchedule || loadingProfile}
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-3.5 py-2.5 text-sm font-semibold text-white shadow-sm shadow-indigo-200 transition hover:bg-indigo-700 disabled:opacity-50 sm:px-4"
              >
                <RefreshCw
                  size={16}
                  className={
                    loadingCustomers || loadingSchedule || loadingProfile
                      ? "animate-spin"
                      : ""
                  }
                />
                <span className="hidden sm:inline">Refresh</span>
              </button>
            </div>
          </div>
        </header>

        <div className="mx-auto max-w-[1600px] space-y-6 px-4 py-6 sm:px-7 sm:py-8 lg:px-9">
          {activeView !== "profile" && (
            <>
              <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-700 via-indigo-600 to-violet-600 p-6 text-white shadow-xl shadow-indigo-100 sm:p-8 lg:p-9">
                <div className="pointer-events-none absolute -right-12 -top-24 h-72 w-72 rounded-full border-[36px] border-white/5" />
                <div className="pointer-events-none absolute -bottom-32 right-40 h-72 w-72 rounded-full bg-violet-400/20 blur-3xl" />

                <div className="relative z-10 flex flex-col justify-between gap-6 md:flex-row md:items-center">
                  <div className="max-w-2xl">
                    <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-medium text-indigo-50 backdrop-blur">
                      <span className="h-2 w-2 rounded-full bg-emerald-300" />
                      Team workspace
                    </div>

                    <h2 className="mt-5 text-2xl font-bold tracking-tight sm:text-3xl lg:text-4xl">
                      Welcome back{profile?.name ? `, ${profile.name.split(" ")[0]}` : ""}
                    </h2>
                    <p className="mt-3 max-w-xl text-sm leading-6 text-indigo-100 sm:text-base">
                      {isDoctor
                        ? "Keep track of your patient queue, scheduled sessions, and consultation progress."
                        : "Stay on top of customer bookings, scheduled services, and daily activity."}
                    </p>

                    <button
                      type="button"
                      onClick={() => navigate("bookings")}
                      className="mt-6 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-bold text-indigo-700 shadow-sm transition hover:bg-indigo-50"
                    >
                      {isDoctor ? "View patient queue" : "View bookings"}
                      <ArrowUpRight size={17} />
                    </button>
                  </div>

                  <div className="hidden h-36 w-36 shrink-0 items-center justify-center rounded-[2rem] border border-white/20 bg-white/10 backdrop-blur-sm md:flex lg:h-44 lg:w-44">
                    {isDoctor ? (
                      <Stethoscope size={68} strokeWidth={1.3} />
                    ) : (
                      <BriefcaseMedical size={68} strokeWidth={1.3} />
                    )}
                  </div>
                </div>
              </section>

              <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard
                  label="Total bookings"
                  value={customers.length}
                  icon={Users}
                  color="bg-indigo-50 text-indigo-600"
                  subtitle="For the selected date and slot"
                />
                <StatCard
                  label="Waiting"
                  value={waitingCount}
                  icon={Clock3}
                  color="bg-amber-50 text-amber-600"
                  subtitle="Awaiting their turn"
                />
                <StatCard
                  label="In progress"
                  value={servingCount}
                  icon={Activity}
                  color="bg-blue-50 text-blue-600"
                  subtitle="Currently being served"
                />
                <StatCard
                  label="Completed"
                  value={completedCount}
                  icon={CheckCircle2}
                  color="bg-emerald-50 text-emerald-600"
                  subtitle="Completed bookings"
                />
              </section>
            </>
          )}

          {error && (
            <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              <AlertCircle size={19} className="mt-0.5 shrink-0" />
              <div className="flex-1">
                <p className="font-semibold">Unable to load data</p>
                <p className="mt-1 break-words">{error}</p>
                <button
                  type="button"
                  onClick={loadInitialData}
                  className="mt-2 font-semibold underline"
                >
                  Try again
                </button>
              </div>
            </div>
          )}

          {activeView !== "profile" && (
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                      <CalendarDays size={18} />
                    </div>
                    <h2 className="font-bold text-slate-900">
                      Schedule and bookings
                    </h2>
                  </div>
                  <p className="mt-2 text-sm text-slate-500">
                    Choose a date and session to see the matching customers.
                  </p>
                </div>
                {loadingSchedule && (
                  <span className="inline-flex items-center gap-2 text-xs text-slate-400">
                    <LoaderCircle size={14} className="animate-spin" />
                    Updating schedule
                  </span>
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm font-semibold text-slate-700">
                  Select date
                  <input
                    type="date"
                    className={inputClass}
                    value={date}
                    onChange={(event) => setDate(event.target.value)}
                  />
                </label>

                <label className="block text-sm font-semibold text-slate-700">
                  Scheduled session
                  <select
                    className={inputClass}
                    value={slot}
                    disabled={loadingSchedule || slots.length === 0}
                    onChange={(event) => setSlot(event.target.value)}
                  >
                    {!slots.length && (
                      <option value="">
                        {loadingSchedule
                          ? "Loading schedule..."
                          : "No active sessions for this day"}
                      </option>
                    )}
                    {slots.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-2 rounded-xl bg-slate-50 px-4 py-3 text-sm">
                <CalendarDays size={16} className="text-indigo-600" />
                <span className="font-semibold text-slate-700">
                  {formatDate(date)}
                </span>
                <span className="text-slate-300">/</span>
                <Clock3 size={16} className="text-indigo-600" />
                <span className="text-slate-500">
                  {slot ? slot.replace("-", " – ") : "No session selected"}
                </span>
              </div>
            </section>
          )}

          {activeView !== "profile" && (
            <section
              id="bookings"
              className="scroll-mt-24 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
            >
              <div className="flex flex-col gap-4 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
                <div>
                  <div className="flex items-center gap-2">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
                      <CalendarCheck size={18} />
                    </div>
                    <h2 className="font-bold text-slate-900">
                      {isDoctor ? "Patient queue" : "Customer bookings"}
                    </h2>
                  </div>
                  <p className="mt-2 text-sm text-slate-500">
                    {filteredCustomers.length} matching booking(s)
                  </p>
                </div>

                <label className="relative w-full sm:w-80">
                  <Search
                    size={17}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-3 text-sm outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-50"
                    placeholder="Search name, phone or token..."
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                  />
                </label>
              </div>

              {loadingCustomers || loadingProfile ? (
                <div className="flex min-h-64 items-center justify-center gap-3 text-sm text-slate-500">
                  <LoaderCircle
                    size={23}
                    className="animate-spin text-indigo-600"
                  />
                  Loading bookings...
                </div>
              ) : !date ? (
                <EmptyState
                  icon={CalendarDays}
                  title="Select a date"
                  description="Your scheduled sessions and bookings will appear here."
                />
              ) : !slot ? (
                <EmptyState
                  icon={Clock3}
                  title="No active session"
                  description="Choose another date with an active scheduled session."
                />
              ) : filteredCustomers.length === 0 ? (
                <EmptyState
                  icon={UserRound}
                  title="No bookings found"
                  description="There are no matching bookings for this date and session. Try another date or clear your search."
                />
              ) : (
                <>
                  <div className="hidden overflow-x-auto lg:block">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-slate-50/80 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        <tr>
                          <th className="px-6 py-4">Token</th>
                          <th className="px-6 py-4">Customer</th>
                          <th className="px-6 py-4">Contact</th>
                          <th className="px-6 py-4">Age / gender</th>
                          <th className="px-6 py-4">Expected turn</th>
                          <th className="px-6 py-4">Booking status</th>
                          <th className="px-6 py-4">Payment</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredCustomers.map((customer) => (
                          <tr
                            key={customer.id || customer._id}
                            className="transition hover:bg-indigo-50/30"
                          >
                            <td className="px-6 py-4">
                              <span className="inline-flex rounded-lg bg-indigo-50 px-2.5 py-1.5 font-bold text-indigo-700">
                                {customer.token ||
                                  customer.bookingReference ||
                                  "—"}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <p className="font-semibold text-slate-800">
                                {customer.patient?.name || "Unnamed customer"}
                              </p>
                              <p className="mt-1 text-xs text-slate-400">
                                {customer.patient?.type || "Normal"}
                              </p>
                            </td>
                            <td className="px-6 py-4 text-slate-600">
                              {customer.patient?.phone ? (
                                <span className="inline-flex items-center gap-2">
                                  <Phone size={14} className="text-slate-400" />
                                  {customer.patient.phone}
                                </span>
                              ) : (
                                "—"
                              )}
                            </td>
                            <td className="px-6 py-4 text-slate-600">
                              {[
                                customer.patient?.age,
                                customer.patient?.gender,
                              ]
                                .filter(
                                  (value) =>
                                    value !== null &&
                                    value !== undefined &&
                                    value !== ""
                                )
                                .join(" / ") || "—"}
                            </td>
                            <td className="px-6 py-4">
                              <span className="inline-flex items-center gap-2 whitespace-nowrap font-medium text-slate-700">
                                <Clock3
                                  size={15}
                                  className="text-indigo-500"
                                />
                                {formatTime(customer.expectedTurnAt)}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <Status value={customer.status} />
                            </td>
                            <td className="px-6 py-4">
                              <Status value={customer.paymentStatus} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="divide-y divide-slate-100 lg:hidden">
                    {filteredCustomers.map((customer) => (
                      <article
                        key={customer.id || customer._id}
                        className="p-5 transition hover:bg-slate-50/70 sm:p-6"
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50 font-bold text-indigo-700">
                            {customer.token ||
                              customer.bookingReference ||
                              "—"}
                          </div>
                          <div className="min-w-0 flex-1">
                            <h3 className="truncate font-bold text-slate-900">
                              {customer.patient?.name || "Unnamed customer"}
                            </h3>
                            <p className="mt-1 text-xs text-slate-500">
                              {customer.patient?.type || "Normal"} customer
                            </p>
                          </div>
                          <Status value={customer.status} />
                        </div>

                        <div className="mt-5 grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-xs text-slate-400">Phone</p>
                            <p className="mt-1 break-all text-sm font-medium text-slate-700">
                              {customer.patient?.phone || "—"}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-400">Expected turn</p>
                            <p className="mt-1 text-sm font-medium text-slate-700">
                              {formatTime(customer.expectedTurnAt)}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-400">Age / gender</p>
                            <p className="mt-1 text-sm font-medium capitalize text-slate-700">
                              {[
                                customer.patient?.age,
                                customer.patient?.gender,
                              ]
                                .filter(
                                  (value) =>
                                    value !== null &&
                                    value !== undefined &&
                                    value !== ""
                                )
                                .join(" / ") || "—"}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-400">Payment</p>
                            <div className="mt-1">
                              <Status value={customer.paymentStatus} />
                            </div>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                </>
              )}
            </section>
          )}

          {activeView === "profile" && (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
              <div className="mb-6">
                <h2 className="text-xl font-bold text-slate-900">
                  Your account
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Update your details and professional information.
                </p>
              </div>
              {loadingProfile ? (
                <div className="flex min-h-40 items-center justify-center gap-3 text-sm text-slate-500">
                  <LoaderCircle size={21} className="animate-spin" />
                  Loading profile...
                </div>
              ) : profile ? (
                <ProfileSection
                  role={role}
                  profile={profile}
                  onSaved={setProfile}
                />
              ) : (
                <EmptyState
                  icon={UserRound}
                  title="Profile unavailable"
                  description="Your signed-in account could not be linked to a team-member record."
                />
              )}
            </div>
          )}

          {activeView !== "profile" && (
            <section
              id="profile"
              className="scroll-mt-24 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
            >
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl bg-indigo-50 text-indigo-600">
                    {profile?.profileImage ? (
                      <img
                        src={profile.profileImage}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <UserRound size={23} />
                    )}
                  </div>
                  <div>
                    <h2 className="font-bold text-slate-900">
                      {profile?.name || "My profile"}
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      {profile?.email || "Manage your account details"}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => navigate("profile")}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700"
                >
                  View profile
                  <ArrowUpRight size={16} />
                </button>
              </div>
            </section>
          )}

          <footer className="flex flex-wrap items-center justify-between gap-3 py-2 text-xs text-slate-400">
<p>© 2026 Zeric. Team workspace.</p>
            <p className="flex items-center gap-2">
              <Activity size={14} />
              Booking management
            </p>
          </footer>
        </div>
      </div>
    </main>
  );
}
