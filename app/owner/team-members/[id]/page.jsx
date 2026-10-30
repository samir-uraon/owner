"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  ArrowLeft,
  CalendarCheck,
  CalendarDays,
  Clock,
  Mail,
  Phone,
  RefreshCw,
  Search,
  Stethoscope,
  Users,
  AlertCircle,
  Building2,
  CalendarX,
  X,
  Ticket,
  Clock3,
		CoinsIcon,
		Clock1,
		Clock8,
		Sandwich,
		BriefcaseBusiness,
} from "lucide-react";

const DAYS_OF_WEEK = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

function getLocalDate() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value])
  );
  return `${values.year}-${values.month}-${values.day}`;
}

function formatDate(dateString) {
  if (!dateString) return "—";
  const date = new Date(`${dateString}T12:00:00`);
  if (Number.isNaN(date.getTime())) return dateString;

  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  }).format(date);
}

function getDayName(dateString) {
  const date = new Date(`${dateString}T12:00:00`);
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    timeZone: "Asia/Kolkata",
  }).format(date);
}

function getPriority(cust) {
  const priority = String(
    cust?.priority ||
      cust?.bookingPriority ||
      cust?.patientType ||
      cust?.urgency ||
      "normal"
  ).toLowerCase();

  if (priority.includes("emergency") || cust?.isEmergency === true) {
    return "emergency";
  }
  if (priority.includes("elderly") || cust?.isElderly === true) {
    return "elderly";
  }
  return "normal";
}

function normalizeSlot(slot) {
  if (typeof slot === "string") return { label: slot, value: slot };
  const open = slot?.open || slot?.start || slot?.from || "";
  const close = slot?.close || slot?.end || slot?.to || "";
  const value = slot?.value || (open && close ? `${open}-${close}` : "");
  return {
    ...slot,
    value,
    label: slot?.label || value || "Scheduled Session",
    open,
    close,
  };
}

function MemberWorkspaceContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { status } = useSession();

  const memberId = params?.id;
  const businessId = searchParams.get("businessId") || "";
  const category = searchParams.get("category") || "clinic";

  const [member, setMember] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  // Filters
  const [selectedDate, setSelectedDate] = useState(getLocalDate());
  const [selectedSession, setSelectedSession] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/signin");
    }
  }, [status, router]);

  const fetchMemberWorkspace = useCallback(async () => {
    if (!memberId) return;

    setLoading(true);
    setError("");

    try {
      const queryParams = new URLSearchParams({ memberId });
      if (businessId) queryParams.set("businessId", businessId);
      if (category) queryParams.set("category", category);

      const response = await fetch(
        `/api/owner/team-members?${queryParams.toString()}`
      );
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Failed to load workspace data.");
      }

      setMember(data.member);
      setCustomers(data.customers || []);
    } catch (err) {
      setError(err.message || "An error occurred while loading details.");
    } finally {
      setLoading(false);
    }
  }, [memberId, businessId, category]);

  useEffect(() => {
    if (status === "authenticated") {
      fetchMemberWorkspace();
    }
  }, [status, fetchMemberWorkspace]);

  // Extract Holidays
  const holidaysList = useMemo(() => {
    if (!member) return [];
    const list = member.holidays || member.holidayDates || [];
    const today = getLocalDate();
    return Array.isArray(list)
      ? [...new Set(list)].filter((d) => d >= today).sort()
      : [];
  }, [member]);

  const isSelectedDateHoliday = useMemo(() => {
    if (!selectedDate || !holidaysList.length) return false;
    return holidaysList.includes(selectedDate);
  }, [selectedDate, holidaysList]);

  // Normalize Weekly Schedule Object
  const weeklySchedule = useMemo(() => {
    const rawSchedule = member?.schedule || {};
    const result = {};

    for (const day of DAYS_OF_WEEK) {
      const dayData =
        rawSchedule[day] ||
        rawSchedule[day.toLowerCase()] ||
        rawSchedule[day.toUpperCase()] ||
        {};

      const slots = Array.isArray(dayData)
        ? dayData
        : Array.isArray(dayData?.slots)
        ? dayData.slots
        : [];

      result[day] = slots.map(normalizeSlot);
    }

    return result;
  }, [member]);

  // Available Sessions for the chosen date dropdown
  const dateSessions = useMemo(() => {
    if (!selectedDate || isSelectedDateHoliday || !member?.schedule) return [];

    const dayName = getDayName(selectedDate);
    return weeklySchedule[dayName] || [];
  }, [selectedDate, isSelectedDateHoliday, member, weeklySchedule]);

  // Reset Session Selection when Date changes
  useEffect(() => {
    setSelectedSession("all");
  }, [selectedDate]);

  // Filtered Patients / Customers List
  const filteredCustomers = useMemo(() => {
    const q = search.trim().toLowerCase();

    return customers.filter((cust) => {
      // 1. Date Filter
      if (selectedDate && cust.date && cust.date !== selectedDate) {
        return false;
      }

      // 2. Session Filter
      if (selectedSession !== "all") {
        const custSession = String(
          cust?.slotValue || cust?.slot || cust?.session || cust?.timeSlot || ""
        ).toLowerCase();
        const activeSession = String(selectedSession).toLowerCase();
        if (custSession && !custSession.includes(activeSession)) {
          return false;
        }
      }

      // 3. Priority Filter (Emergency / Elderly / Normal)
      const priority = getPriority(cust);
      if (priorityFilter !== "all" && priority !== priorityFilter) {
        return false;
      }

      // 4. Text Search
      if (!q) return true;

      return (
        cust.customerName?.toLowerCase().includes(q) ||
        cust.phone?.toLowerCase().includes(q) ||
        cust.serviceName?.toLowerCase().includes(q) ||
        cust.status?.toLowerCase().includes(q)
      );
    });
  }, [customers, search, selectedDate, selectedSession, priorityFilter]);

  // Emergency Counter for selected scope
  const currentEmergencyCount = useMemo(() => {
    return filteredCustomers.filter((c) => getPriority(c) === "emergency").length;
  }, [filteredCustomers]);

  if (status === "loading" || loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f7f8fc]">
        <div className="flex items-center gap-3 text-sm font-medium text-slate-600">
          <RefreshCw size={20} className="animate-spin text-indigo-600" />
          Loading workspace...
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-[#f7f8fc] px-4 text-center">
        <div className="rounded-2xl bg-rose-50 p-4 text-rose-600">
          <AlertCircle size={32} />
        </div>
        <h2 className="mt-4 text-lg font-bold text-slate-800">
          Error Loading Workspace
        </h2>
        <p className="mt-2 max-w-md text-sm text-slate-500">{error}</p>
        <button
          type="button"
          onClick={() => router.back()}
          className="mt-5 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
        >
          Go Back
        </button>
      </main>
    );
  }

  const isDoctor = member?.type === "doctor";

  return (
    <main className="min-h-screen bg-[#f7f8fc] text-slate-900 pb-12">
      <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8 lg:py-6">
        {/* Navigation */}
        <div className="mb-6 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            <ArrowLeft size={17} />
            Back
          </button>

          <button
            type="button"
            onClick={fetchMemberWorkspace}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-600 shadow-sm transition hover:border-indigo-200 hover:text-indigo-600"
          >
            <RefreshCw size={16} />
            Refresh
          </button>
        </div>

        {/* Header Profile Info */}
       
<section className="mb-8 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
  <div className="p-4 sm:p-6">
    <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between lg:gap-8">

      {/* Profile */}
      <div className="flex min-w-0 items-center gap-4">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-indigo-50 text-xl font-bold text-indigo-700 ring-1 ring-indigo-100 sm:h-[72px] sm:w-[72px]">
          {member?.profileImage ? (
            <img
              src={member.profileImage}
              alt={member?.name || "Profile"}
              className="h-full w-full object-cover"
            />
          ) : (
            member?.name?.charAt(0).toUpperCase() || "U"
          )}
        </div>

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="break-words text-lg font-bold tracking-tight text-slate-900 sm:text-2xl">
              {member?.name || "Team Member"}
            </h1>

            <span
              className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${
                isDoctor
                  ? "bg-indigo-50 text-indigo-700"
                  : "bg-emerald-50 text-emerald-700"
              }`}
            >
              {isDoctor ? "Doctor" : "Staff"}
            </span>
          </div>

          <p className="mt-1 break-words text-sm text-slate-500">
            {isDoctor
              ? member?.specialization || "General Consultation"
              : member?.role || "Staff Member"}
          </p>

          {member?.businessName && (
            <div className="mt-2 flex min-w-0 items-center gap-2 text-sm text-slate-600">
              <Building2
                size={15}
                className="shrink-0 text-indigo-600"
              />
              <span className="break-words">
                {member.businessName}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Details */}
      <div className="grid min-w-0 grid-cols-1 gap-x-6 gap-y-4 border-t border-slate-100 pt-4 sm:grid-cols-2 lg:w-[54%] lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">

        {member?.phone && (
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-50">
              <Phone size={15} className="text-slate-500" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Phone
              </p>
              <a
                href={`tel:${member.phone}`}
                className="mt-0.5 block break-all text-sm font-medium text-slate-700 hover:text-indigo-600"
              >
                {member.phone}
              </a>
            </div>
          </div>
        )}

        {member?.email && (
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-50">
              <Mail size={15} className="text-slate-500" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Email
              </p>
              <a
                href={`mailto:${member.email}`}
                className="mt-0.5 block break-all text-sm font-medium text-slate-700 hover:text-indigo-600"
              >
                {member.email}
              </a>
            </div>
          </div>
        )}

        {isDoctor && member?.experience != null && (
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-50">
              <BriefcaseBusiness size={15} className="text-indigo-600" />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Experience
              </p>
              <p className="mt-0.5 text-sm font-semibold text-slate-800">
                {member.experience}{" "}
                {Number(member.experience) === 1 ? "Year" : "Years"}
              </p>
            </div>
          </div>
        )}

        {member?.fee != null && Number.isFinite(Number(member.fee)) && (
          <div className="flex items-center gap-3">
            <div
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                isDoctor ? "bg-indigo-50" : "bg-emerald-50"
              }`}
            >
              {isDoctor ? (
                <Stethoscope size={15} className="text-indigo-600" />
              ) : (
                <CoinsIcon size={15} className="text-emerald-600" />
              )}
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                {isDoctor ? "Consultation Fee" : "Fee"}
              </p>
              <p className="mt-0.5 text-sm font-bold text-slate-900">
                ₹{Number(member.fee).toLocaleString("en-IN")}
              </p>
            </div>
          </div>
        )}

        {isDoctor && member?.duration != null && (
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-50">
              <Clock size={15} className="text-indigo-600" />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Consultation Duration
              </p>
              <p className="mt-0.5 text-sm font-semibold text-slate-800">
                {member.duration} minutes
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  </div>
</section>


        {/* Weekly Schedule Section */}
        <section className="mb-8 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-700">
              <CalendarCheck size={18} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Weekly Schedule
              </h3>
              <p className="text-xs text-slate-500">
                Configured operating hours and availability
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {DAYS_OF_WEEK.map((day) => {
              const slots = weeklySchedule[day] || [];

              return (
                <div
                  key={day}
                  className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5"
                >
                  <p className="text-xs font-bold text-slate-900">{day}</p>

                  {slots.length === 0 ? (
                    <p className="mt-2 text-xs text-slate-400 italic">
                      No sessions scheduled
                    </p>
                  ) : (
                    <div className="mt-2 space-y-2">
                      {slots.map((slot, idx) => (
                        <div
                          key={idx}
                          className="rounded-lg bg-white p-2.5 border border-slate-200/60 text-xs"
                        >
                          <p className="font-bold text-slate-800">
                            {slot.open || slot.start || "—"} -{" "}
                            {slot.close || slot.end || "—"}
                          </p>

                          {isDoctor && slot.checkupStartTime && (
                            <p className="mt-1 text-[11px] text-slate-500">
                              Checkup starts: {slot.checkupStartTime}
                            </p>
                          )}

                          {slot.capacity != null && (
                            <p className="mt-0.5 text-[11px] text-slate-500">
                              Capacity: {slot.capacity}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* Scheduled Holidays & Leave Section */}
        <section className="mb-8 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
                <CalendarX size={18} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Scheduled Holidays & Leave
                </h3>
                <p className="text-xs text-slate-500">
                  Upcoming days when this member is unavailable
                </p>
              </div>
            </div>

            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
              {holidaysList.length} Upcoming
            </span>
          </div>

          {holidaysList.length === 0 ? (
            <p className="mt-4 text-xs text-slate-400 italic">
              No upcoming holidays scheduled for this team member.
            </p>
          ) : (
            <div className="mt-4 flex flex-wrap gap-2">
              {holidaysList.map((holidayDate) => (
                <div
                  key={holidayDate}
                  className="inline-flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50/80 px-3 py-1.5 text-xs font-semibold text-amber-800"
                >
                  <CalendarDays size={14} className="text-amber-600" />
                  <span>{formatDate(holidayDate)}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Assigned Patients / Customers */}
        <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-4 sm:p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-lg font-bold">
                  {isDoctor ? "Assigned Patients" : "Customer Bookings"}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Manage patient checkups session-by-session
                </p>
              </div>

              {/* Date & Search Inputs */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:w-auto">
                {/* Date Selection */}
                <div className="relative">
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white py-2 px-3 text-sm text-slate-800 outline-none focus:border-indigo-500"
                  />
                  
                </div>

                {/* Work Session Selection */}
               <div className="relative">
  <select
    value={selectedSession}
    onChange={(e) => setSelectedSession(e.target.value)}
    disabled={
      !selectedDate ||
      isSelectedDateHoliday ||
      dateSessions.length === 0
    }
    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-indigo-500 disabled:bg-slate-50 disabled:text-slate-400"
  >
    {dateSessions.length === 0 ? (
      <option value="">No sessions available</option>
    ) : (
      <>
        <option value="all">All Sessions</option>
        {dateSessions.map((session) => (
          <option key={session.value} value={session.value}>
            {session.label}
          </option>
        ))}
      </>
    )}
  </select>
</div>

                {/* Text Search */}
                <div className="relative">
                  <Search
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search name, phone..."
                    className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-indigo-500"
                  />
                </div>
              </div>
            </div>

            {/* Date Shortcuts & Priority Badges */}
            <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
              <button
                type="button"
                onClick={() => setSelectedDate(getLocalDate())}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  selectedDate === getLocalDate()
                    ? "bg-indigo-600 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                Today ({formatDate(getLocalDate())})
              </button>

              <button
                type="button"
                onClick={() => setSelectedDate("")}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  !selectedDate
                    ? "bg-indigo-600 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                All Dates
              </button>

              {/* Priority Filters */}
              <div className="ml-auto flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setPriorityFilter("all")}
                  className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                    priorityFilter === "all"
                      ? "bg-slate-800 text-white"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  All Priorities
                </button>

                <button
                  type="button"
                  onClick={() => setPriorityFilter("emergency")}
                  className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                    priorityFilter === "emergency"
                      ? "bg-red-600 text-white"
                      : "bg-red-50 text-red-700 border border-red-200"
                  }`}
                >
                  <AlertCircle size={12} />
                  Emergency ({currentEmergencyCount})
                </button>

                <button
                  type="button"
                  onClick={() => setPriorityFilter("normal")}
                  className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                    priorityFilter === "normal"
                      ? "bg-slate-700 text-white"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  Normal
                </button>
              </div>
            </div>

            {isSelectedDateHoliday && (
              <div className="mt-3 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-bold text-amber-800">
                <CalendarX size={16} className="text-amber-600" />
                <span>Doctor is on holiday on {formatDate(selectedDate)}. No checkup sessions scheduled.</span>
              </div>
            )}
          </div>

          {/* Patients Table */}
          <div className="p-4 sm:p-6">
            {filteredCustomers.length === 0 ? (
              <div className="flex min-h-48 flex-col items-center justify-center text-center">
                <Users size={32} className="text-slate-300" />
                <p className="mt-3 text-sm font-medium text-slate-600">
                  No patient records found
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  {selectedDate
                    ? `No bookings found for ${formatDate(selectedDate)} under the selected filters.`
                    : "No patient records match your search criteria."}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-700">
                  <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500 border-b border-slate-100">
                    <tr>
                      <th className="px-4 py-3">Patient Name</th>
                      <th className="px-4 py-3">Priority / Type</th>
                      <th className="px-4 py-3">Session / Time</th>
                      <th className="px-4 py-3">Phone</th>
                      <th className="px-4 py-3">Service</th>
                      <th className="px-4 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredCustomers.map((cust) => {
                      const priority = getPriority(cust);
                      const status = String(cust.status || "").toLowerCase();

                      return (
                        <tr
                          key={cust.id}
                          className={`hover:bg-slate-50/70 transition-colors ${
                            priority === "emergency" ? "bg-red-50/40" : ""
                          }`}
                        >
                          {/* Patient Name & Token */}
                          <td className="px-4 py-3">
                            <p className="font-bold text-slate-900">
                              {cust.customerName}
                            </p>
                            {cust.token && (
                              <p className="text-xs text-slate-500 inline-flex items-center gap-1">
                                <Ticket size={12} /> Token: {cust.token}
                              </p>
                            )}
                          </td>

                          {/* Patient Priority Type */}
                          <td className="px-4 py-3">
                            {priority === "emergency" ? (
                              <span className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-red-100 px-2.5 py-0.5 text-[10px] font-extrabold text-red-700">
                                <AlertCircle size={12} /> EMERGENCY (P1)
                              </span>
                            ) : priority === "elderly" ? (
                              <span className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-100 px-2.5 py-0.5 text-[10px] font-extrabold text-amber-700">
                                ELDERLY (P2)
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-100 px-2.5 py-0.5 text-[10px] font-semibold text-slate-600">
                                NORMAL
                              </span>
                            )}
                          </td>

                          {/* Session & Date */}
                          <td className="px-4 py-3">
                            <p className="font-semibold text-slate-800">
                              {formatDate(cust.date)}
                            </p>
                            <p className="text-xs text-slate-500 inline-flex items-center gap-1">
                              <Clock3 size={12} />
                              {cust.time || cust.slotValue || "Scheduled Session"}
                            </p>
                          </td>

                          <td className="px-4 py-3">{cust.phone || "—"}</td>
                          <td className="px-4 py-3">{cust.serviceName || "General Checkup"}</td>

                          {/* Booking Status */}
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${
                                status === "completed"
                                  ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                                  : status === "cancelled"
                                  ? "bg-rose-50 text-rose-700 ring-1 ring-rose-200"
                                  : status === "serving" || status === "in-progress"
                                  ? "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200"
                                  : "bg-amber-50 text-amber-700 ring-1 ring-amber-200"
                              }`}
                            >
                              <span
                                className={`h-1.5 w-1.5 rounded-full ${
                                  status === "completed"
                                    ? "bg-emerald-500"
                                    : status === "cancelled"
                                    ? "bg-rose-500"
                                    : status === "serving" || status === "in-progress"
                                    ? "bg-indigo-500"
                                    : "bg-amber-500"
                                }`}
                              />
                              {cust.status}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

export default function MemberWorkspacePage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-[#f7f8fc]">
          <div className="flex items-center gap-3 text-sm font-medium text-slate-600">
            <RefreshCw size={20} className="animate-spin text-indigo-600" />
            Loading workspace...
          </div>
        </main>
      }
    >
      <MemberWorkspaceContent />
    </Suspense>
  );
}