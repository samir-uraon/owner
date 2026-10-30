"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { signOut } from "next-auth/react";
import {
  Activity,
  AlertCircle,
  ArrowRight,
  BriefcaseMedical,
  CalendarCheck,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Eye,
  LayoutDashboard,
  LoaderCircle,
  LogOut,
  Menu,
  Phone,
  RefreshCw,
  Search,
  Stethoscope,
  Ticket,
  UserRound,
  Users,
  X,
} from "lucide-react";
import Image from "next/image";
import GoUpButton from "../goToUpButton";

const API = {
  schedule: "/api/team/schedule",
  profile: "/api/team/profile",
  customers: "/api/team/customer",
  sessions: "/api/team/session",
};

function getLocalDate() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function getDayName(dateString) {
  const date = new Date(`${dateString}T12:00:00`);
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    timeZone: "Asia/Kolkata",
  }).format(date);
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

function formatTime(value) {
  if (!value) return "—";
  const match = String(value).match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return value;

  let hours = Number(match[1]);
  const minutes = match[2];
  const period = hours >= 12 ? "PM" : "AM";
  hours = hours % 12 || 12;

  return `${hours}:${minutes} ${period}`;
}

function isHolidayDate(dateString, holidaysList) {
  if (!dateString || !Array.isArray(holidaysList) || holidaysList.length === 0) {
    return false;
  }
  return holidaysList.includes(dateString);
}

function normalizeSlot(slot) {
  if (typeof slot === "string") {
    return { label: slot, value: slot };
  }
  const open = slot?.open || slot?.start || slot?.from || "";
  const close = slot?.close || slot?.end || slot?.to || "";
  const value = slot?.value || (open && close ? `${open}-${close}` : "");

  return {
    ...slot,
    value,
    label: slot?.label || value || "Scheduled session",
    open,
    close,
  };
}

function normalizeTeamServices(services) {
  if (!Array.isArray(services)) return [];
  return services.map((service, index) => {
    if (typeof service === "string") {
      return { id: `service-${index}`, name: service, charge: "" };
    }
    return {
      id: String(service?._id || service?.id || `service-${index}`),
      name: service?.name || service?.serviceName || "",
      charge: service?.charge ?? service?.price ?? "",
    };
  });
}

function normalizeWeeklySchedule(schedule) {
  const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const result = {};

  for (const day of DAYS) {
    const existing =
      schedule?.[day] ||
      schedule?.[day.toLowerCase()] ||
      schedule?.[day.toUpperCase()] ||
      {};

    const originalSlots = Array.isArray(existing)
      ? existing
      : Array.isArray(existing?.slots)
        ? existing.slots
        : [];

    result[day] = {
      ...(!Array.isArray(existing) ? existing : {}),
      slots: originalSlots.map((slot) => ({
        ...slot,
        open: slot?.open || slot?.start || "09:00 AM",
        close: slot?.close || slot?.end || "01:00 PM",
        checkupStartTime: slot?.checkupStartTime || slot?.open || "09:00 AM",
        capacity: slot?.capacity ?? 9,
      })),
    };
  }
  return result;
}

function getStatus(value) {
  const status = String(value || "").toLowerCase().replace(/[_\s]+/g, "-");
  if (["completed", "complete", "done", "served", "finished"].includes(status)) return "completed";
  if (["serving", "in-progress", "inprogress", "processing", "active"].includes(status)) return "serving";
  if (["cancelled", "canceled", "rejected"].includes(status)) return "cancelled";
  return "waiting";
}

function getCustomerName(customer) {
  return customer?.patientName || customer?.customerName || customer?.fullName || customer?.name || "Unknown customer";
}

function getCustomerPhone(customer) {
  return customer?.phone || customer?.mobile || customer?.phoneNumber || customer?.patientPhone || "";
}

function getCustomerGender(customer) {
  return customer?.gender || "";
}

function getCustomerToken(customer) {
  return customer?.tokenNumber || customer?.token || customer?.bookingReference || customer?.reference || "—";
}

function getCustomerStatus(customer) {
  return getStatus(customer?.status || customer?.bookingStatus);
}

function getPriorityRank(customer) {
  const priority = String(
    customer?.priority ?? customer?.bookingPriority ?? customer?.bookingType ?? customer?.patientType ?? customer?.urgency ?? "normal"
  ).toLowerCase();
  if (priority.includes("emergency") || customer?.isEmergency === true) return 0;
  if (priority.includes("elderly") || customer?.isElderly === true) return 1;
  return 2;
}

function StatusBadge({ status }) {
  const normalized = getStatus(status);
  const styles = {
    waiting: "bg-amber-50 text-amber-700 ring-amber-200",
    serving: "bg-indigo-50 text-indigo-700 ring-indigo-200",
    completed: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    cancelled: "bg-rose-50 text-rose-700 ring-rose-200",
  };

  const labels = {
    waiting: "Waiting",
    serving: "In progress",
    completed: "Completed",
    cancelled: "Cancelled",
  };

  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${styles[normalized]}`}>
      {labels[normalized]}
    </span>
  );
}

function StatCard({ title, value, description, icon: Icon, color }) {
  const colorStyles = {
    violet: "bg-violet-50 text-violet-700 ring-violet-100",
    amber: "bg-amber-50 text-amber-700 ring-amber-100",
    blue: "bg-blue-50 text-blue-700 ring-blue-100",
    green: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  };

  return (
    <div className="min-w-0 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-medium text-slate-500 sm:text-sm">{title}</p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">{value}</p>
        </div>
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1 ${colorStyles[color]}`}>
          <Icon size={19} />
        </div>
      </div>
      <p className="mt-3 text-xs text-slate-500 sm:text-sm">{description}</p>
    </div>
  );
}

function SectionHeading({ eyebrow, title, description, action }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow && <p className="text-xs font-bold uppercase tracking-[0.16em] text-violet-600">{eyebrow}</p>}
        <h2 className="mt-1 text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">{title}</h2>
        {description && <p className="mt-1 text-sm leading-6 text-slate-500">{description}</p>}
      </div>
      {action}
    </div>
  );
}

function EmptyState({ title, description }) {
  return (
    <div className="flex flex-col items-center justify-center px-5 py-12 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
        <CalendarCheck size={25} />
      </div>
      <h3 className="mt-4 text-sm font-semibold text-slate-800">{title}</h3>
      <p className="mt-1 max-w-sm text-sm leading-6 text-slate-500">{description}</p>
    </div>
  );
}

function Field({ label, children, hint }) {
  return (
    <label className="block min-w-0">
      <span className="mb-1.5 block text-sm font-medium text-slate-700">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs leading-5 text-slate-500">{hint}</span>}
    </label>
  );
}

const inputClass =
  "w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-violet-400 focus:ring-4 focus:ring-violet-100 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500";

function InfoItem({ label, value }) {
  return (
    <div className="min-w-0 rounded-xl border border-slate-100 bg-slate-50/70 p-4">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-1 break-words text-sm font-semibold text-slate-800">
        {value !== null && value !== undefined && value !== "" ? value : "Not provided"}
      </p>
    </div>
  );
}

/* ---------------- Read-Only Profile Component ---------------- */

function OwnerProfileView({ role, profile, schedule }) {
  const isDoctor = role === "doctor";
  const DAYS_OF_WEEK = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const displayedServices = normalizeTeamServices(profile?.services);
  const holidayDates = Array.isArray(profile?.holidays) ? profile.holidays : [];

  return (
    <div className="space-y-5">
      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm sm:rounded-3xl">
        <div className="h-24 bg-gradient-to-r from-violet-700 via-indigo-600 to-indigo-500 sm:h-32" />

        <div className="px-4 pb-5 sm:px-7 sm:pb-7">
          <div className="-mt-10 flex flex-col gap-4 sm:-mt-12 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex min-w-0 items-end gap-3 sm:gap-4">
              <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border-4 border-white bg-violet-100 text-violet-700 shadow-sm sm:h-24 sm:w-24">
                {profile?.profileImage ? (
                  <img src={profile.profileImage} alt="Profile" className="h-full w-full object-cover" />
                ) : (
                  <UserRound size={34} />
                )}
              </div>

              <div className="min-w-0 pb-1">
                <h2 className="truncate text-lg font-bold text-slate-900 sm:text-xl">
                  {profile?.name || "Profile"}
                </h2>
                <p className="mt-1 text-sm capitalize text-slate-500">
                  {isDoctor ? "Doctor Profile" : "Staff Profile"}
                </p>
              </div>
            </div>

            <div className="inline-flex items-center gap-1.5 rounded-xl bg-slate-100 px-3.5 py-2 text-xs font-semibold text-slate-600">
              <Eye size={15} /> Read-Only View
            </div>
          </div>

          <div className="mt-7 space-y-6">
            <section>
              <h3 className="text-sm font-bold text-slate-900">Personal Information</h3>
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <InfoItem label="Full name" value={profile?.name} />
                <InfoItem label="Email address" value={profile?.email} />
                <InfoItem label="Phone number" value={profile?.phone} />
                <InfoItem
                  label="Experience"
                  value={profile?.experience ? `${profile.experience} years` : ""}
                />
                {isDoctor && (
                  <>
                    <InfoItem label="Specialization" value={profile?.specialization} />
                    <InfoItem
                      label="Consultation charge"
                      value={profile?.fee !== undefined && profile?.fee !== null ? `₹${profile.fee}` : ""}
                    />
                    <InfoItem
                      label="Appointment duration"
                      value={profile?.duration ? `${profile.duration} minutes` : ""}
                    />
                  </>
                )}
                <InfoItem label="Business / clinic" value={profile?.businessName} />
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 p-4 sm:p-5">
              <h3 className="font-bold text-slate-900">Services</h3>
              {isDoctor ? (
                <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-violet-100 bg-violet-50/60 p-4">
                  <div>
                    <p className="font-semibold text-slate-900">General Consultation</p>
                    <p className="mt-1 text-xs text-slate-500">Fixed doctor service</p>
                  </div>
                  <p className="text-lg font-bold text-violet-700">₹{profile?.fee ?? "—"}</p>
                </div>
              ) : displayedServices.length ? (
                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {displayedServices.map((service, index) => (
                    <div key={service.id || index} className="flex items-center gap-3 rounded-xl border border-slate-200 p-4">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-700">
                        <BriefcaseMedical size={18} />
                      </div>
                      <p className="break-words text-sm font-semibold text-slate-800">
                        {service.name || "Unnamed service"}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-sm text-slate-500">No services added.</p>
              )}
            </section>

            {isDoctor && (
              <section className="rounded-2xl border border-slate-200 p-4 sm:p-5">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-slate-900">Scheduled Holidays</h3>
                  <span className="text-xs text-slate-500">{holidayDates.length} date(s)</span>
                </div>
                {holidayDates.length ? (
                  <div className="mt-4 space-y-2">
                    {holidayDates.map((date) => (
                      <div key={date} className="flex items-center gap-3 rounded-xl border border-slate-200 px-3 py-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-700">
                          <CalendarDays size={17} />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-800">{formatDate(date)}</p>
                          <p className="text-xs text-slate-500">Doctor unavailable</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-slate-500">No scheduled holidays.</p>
                )}
              </section>
            )}

            <section className="rounded-2xl border border-slate-200 p-4 sm:p-5">
              <h3 className="font-bold text-slate-900">Weekly Schedule</h3>
              <div className="mt-4 space-y-3">
                {DAYS_OF_WEEK.map((day) => {
                  const daySlots = normalizeWeeklySchedule(schedule)[day]?.slots || [];
                  return (
                    <div key={day} className="rounded-xl border border-slate-200 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <h4 className="font-semibold text-slate-900">{day}</h4>
                        <span className="text-xs text-slate-500">{daySlots.length} session(s)</span>
                      </div>
                      {daySlots.length === 0 ? (
                        <p className="mt-2 text-sm text-slate-500">No sessions scheduled.</p>
                      ) : (
                        <div className="mt-3 space-y-2">
                          {daySlots.map((slot, index) => (
                            <div key={`${day}-${index}`} className="rounded-lg bg-slate-50 p-3">
                              <p className="text-sm font-semibold text-slate-800">
                                {slot.open} – {slot.close}
                              </p>
                              {isDoctor && (
                                <p className="mt-1 text-xs text-slate-500">
                                  Checkup starts: {slot.checkupStartTime}
                                </p>
                              )}
                              <p className="mt-1 text-xs text-slate-500">Capacity: {slot.capacity}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Main Owner Dashboard Component ---------------- */

export default function OwnerDashboardView({ role = "doctor" }) {
  const isDoctor = role === "doctor";

  const [activeView, setActiveView] = useState("overview");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [selectedDate, setSelectedDate] = useState(getLocalDate);
  const [selectedSlot, setSelectedSlot] = useState("");

  const [profile, setProfile] = useState(null);
  const [schedule, setSchedule] = useState(null);
  const [customers, setCustomers] = useState([]);

  const [loadingInitial, setLoadingInitial] = useState(true);
  const [loadingCustomers, setLoadingCustomers] = useState(false);
  const [loadingSchedule, setLoadingSchedule] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [pageError, setPageError] = useState("");

  const roleLabel = isDoctor ? "Doctor" : "Staff";
  const [todayCustomers, setTodayCustomers] = useState([]);
  const [loadingToday, setLoadingToday] = useState(false);
  const [todaySessionStates, setTodaySessionStates] = useState({});

  const todayDate = getLocalDate();
  const todayDayName = getDayName(todayDate);

  const todaySlots = useMemo(() => {
    const daySchedule =
      schedule?.[todayDayName] ||
      schedule?.[todayDayName.toLowerCase()] ||
      schedule?.[todayDayName.toUpperCase()] ||
      {};

    const daySlots = Array.isArray(daySchedule)
      ? daySchedule
      : Array.isArray(daySchedule?.slots)
        ? daySchedule.slots
        : [];

    return daySlots.map(normalizeSlot).filter((slot) => slot.value);
  }, [schedule, todayDayName]);

  const getCustomerSession = (customer) => {
    const raw =
      customer?.slotValue ?? customer?.slot ?? customer?.session ??
      customer?.slotLabel ?? customer?.timeSlot ?? customer?.sessionTime ?? "";
    if (raw && typeof raw === "object") {
      const open = raw.open || raw.start || raw.from || "";
      const close = raw.close || raw.end || raw.to || "";
      return String(raw.value || (open && close ? `${open}-${close}` : raw.label || ""));
    }
    return String(raw);
  };

  const getStatusRank = (status) => {
    switch (status) {
      case "serving": return 0;
      case "waiting": return 1;
      case "completed": return 2;
      case "cancelled": return 3;
      default: return 1;
    }
  };

  const sortSessionPatients = (patients) =>
    [...patients].sort((a, b) => {
      const statusDifference = getStatusRank(getCustomerStatus(a)) - getStatusRank(getCustomerStatus(b));
      if (statusDifference) return statusDifference;

      const priorityDifference = getPriorityRank(a) - getPriorityRank(b);
      if (priorityDifference) return priorityDifference;

      return Number(a?.sequence ?? a?.tokenSequence ?? Number.MAX_SAFE_INTEGER) -
        Number(b?.sequence ?? b?.tokenSequence ?? Number.MAX_SAFE_INTEGER);
    });

  const getTodaySessionPatients = (slot) => {
    const normalize = (value) => String(value || "").replace(/\s+/g, "").toLowerCase();
    const keys = [slot.value, slot.label, `${slot.open}-${slot.close}`].map(normalize);
    return sortSessionPatients(
      todayCustomers.filter((customer) => {
        const value = normalize(getCustomerSession(customer));
        return value && keys.includes(value);
      })
    );
  };

  const getSessionState = (slot) =>
    todaySessionStates[String(slot.value)]?.status || "not-started";

  const loadTodaySessionStates = useCallback(async () => {
    if (!isDoctor) return;
    try {
      const params = new URLSearchParams({ role, date: todayDate });
      const response = await fetch(`${API.sessions}?${params.toString()}`, {
        method: "GET", cache: "no-store", headers: { Accept: "application/json" },
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result?.error || "Unable to load session states.");
      const list = result?.sessions || result?.data?.sessions || [];
      const next = {};
      if (Array.isArray(list)) {
        for (const session of list) {
          const key = String(session?.sessionId || session?.id || session?.value || "");
          if (key) next[key] = { ...session, status: session.status || "not-started" };
        }
      }
      setTodaySessionStates(next);
    } catch (error) {
      console.error("Unable to load session states:", error);
    }
  }, [isDoctor, role, todayDate]);

  const loadInitialData = useCallback(async () => {
    setLoadingSchedule(true);
    setPageError("");

    try {
      const response = await fetch(`${API.schedule}?role=${encodeURIComponent(role)}`, {
        method: "GET",
        cache: "no-store",
        headers: { Accept: "application/json" },
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result?.error || result?.message || "Unable to load profile.");

      const data = result?.data || result?.profile || result;
      const profileData = data?.profile || data?.teamMember || data;
      const scheduleData = data?.schedule || profileData?.schedule || result?.schedule || {};

      setProfile({
        ...profileData,
        name: profileData?.name || profileData?.fullName || "",
        email: profileData?.email || "",
        phone: profileData?.phone || "",
        profileImage: profileData?.profileImage || "",
        businessName: data?.businessName || profileData?.businessName || "",
        services: profileData?.services || [],
      });
      setSchedule(scheduleData);
    } catch (error) {
      setPageError(error.message || "Unable to load dashboard.");
    } finally {
      setLoadingSchedule(false);
      setLoadingInitial(false);
    }
  }, [role]);

  const loadCustomers = useCallback(async () => {
    setLoadingCustomers(true);
    setPageError("");

    try {
      const params = new URLSearchParams({ role, date: selectedDate });
      if (selectedSlot) params.set("slot", selectedSlot);

      const response = await fetch(`${API.customers}?${params.toString()}`, {
        method: "GET",
        cache: "no-store",
        headers: { Accept: "application/json" },
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result?.error || "Unable to load bookings.");

      const list = result?.customers || result?.patients || result?.bookings || result?.data || [];
      setCustomers(Array.isArray(list) ? list : []);
    } catch (error) {
      setCustomers([]);
      setPageError(error.message || "Unable to load bookings.");
    } finally {
      setLoadingCustomers(false);
    }
  }, [role, selectedDate, selectedSlot]);

  const loadTodayCustomers = useCallback(async () => {
    setLoadingToday(true);
    try {
      const params = new URLSearchParams({ role, date: getLocalDate() });
      const response = await fetch(`${API.customers}?${params.toString()}`, {
        method: "GET",
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result?.error || "Unable to load today's patients.");

      const list = result?.customers || result?.patients || result?.bookings || result?.data || [];
      setTodayCustomers(Array.isArray(list) ? list : []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoadingToday(false);
    }
  }, [role]);

  useEffect(() => { loadInitialData(); }, [loadInitialData]);
  useEffect(() => { loadCustomers(); }, [loadCustomers]);
  useEffect(() => { loadTodayCustomers(); }, [loadTodayCustomers]);
  useEffect(() => { loadTodaySessionStates(); }, [loadTodaySessionStates]);

  const isSelectedDateHoliday = useMemo(() => {
    const holidayList = profile?.holidays || profile?.holidayDates || [];
    return isHolidayDate(selectedDate, holidayList);
  }, [selectedDate, profile?.holidays, profile?.holidayDates]);

  const slots = useMemo(() => {
    if (isSelectedDateHoliday) return [];
    const dayName = getDayName(selectedDate);
    const daySchedule =
      schedule?.[dayName] ||
      schedule?.[dayName.toLowerCase()] ||
      schedule?.[dayName.toUpperCase()] ||
      {};

    const daySlots = Array.isArray(daySchedule)
      ? daySchedule
      : Array.isArray(daySchedule?.slots)
        ? daySchedule.slots
        : [];

    return daySlots.map(normalizeSlot).filter((slot) => slot.value);
  }, [schedule, selectedDate, isSelectedDateHoliday]);

  useEffect(() => {
    if (!slots.length) {
      setSelectedSlot("");
      return;
    }
    setSelectedSlot((previous) =>
      previous && slots.some((slot) => slot.value === previous) ? previous : slots[0].value
    );
  }, [slots]);

  const filteredCustomers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return customers.filter((customer) => {
      const status = getCustomerStatus(customer);
      if (statusFilter !== "all" && status !== statusFilter) return false;
      if (!query) return true;

      const searchable = [
        getCustomerName(customer),
        getCustomerPhone(customer),
        getCustomerToken(customer),
        customer?.bookingReference,
        customer?.status,
        customer?.service,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchable.includes(query);
    });
  }, [customers, searchQuery, statusFilter]);

  const stats = useMemo(() => ({
    total: customers.length,
    waiting: customers.filter((c) => getCustomerStatus(c) === "waiting").length,
    serving: customers.filter((c) => getCustomerStatus(c) === "serving").length,
    completed: customers.filter((c) => getCustomerStatus(c) === "completed").length,
  }), [customers]);

  async function handleRefresh() {
    setRefreshing(true);
    await Promise.all([
      loadInitialData(),
      loadCustomers(),
      loadTodayCustomers(),
      loadTodaySessionStates(),
    ]);
    setRefreshing(false);
  }

  async function handleLogout() {
    if (loggingOut) return;
    if (!window.confirm("Are you sure you want to log out?")) return;
    setLoggingOut(true);
    try {
      await signOut({ callbackUrl: "/signin" });
    } catch (error) {
      console.error("Logout failed:", error);
      setLoggingOut(false);
    }
  }

  function navigate(view) {
    setActiveView(view);
    setMobileMenuOpen(false);
  }

  const firstName = profile?.name?.trim()
    ? profile.name.trim().replace(/^Dr\.?\s*/i, "").split(/\s+/)[0]
    : "";
  const welcomeName = firstName ? `${isDoctor ? "Dr. " : ""}${firstName}` : "";

  const navItems = [
    { id: "overview", label: "Overview", icon: LayoutDashboard },
    { id: "bookings", label: isDoctor ? "Patient Queue" : "Bookings", icon: Users },
    ...(isDoctor ? [{ id: "today-checkup", label: "Today's Checkup", icon: Stethoscope }] : []),
    { id: "profile", label: "Profile Info", icon: UserRound },
  ];

  if (loadingInitial && !profile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-100 text-violet-700">
            <LoaderCircle className="animate-spin" size={27} />
          </div>
          <p className="mt-4 text-sm font-semibold text-slate-700">Loading owner view...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f7f8fc] text-slate-800">
      {mobileMenuOpen && (
        <button
          type="button"
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-[2px] lg:hidden"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[260px] flex-col border-r border-slate-200/70 bg-white transition-transform duration-300 lg:translate-x-0 ${
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-[70px] shrink-0 items-center justify-between border-b border-slate-100 px-5">
          <button type="button" onClick={() => navigate("overview")} className="flex min-w-0 items-center gap-3">
            <Image src="/logo.png" alt="Zeric" width={42} height={42} priority className="h-9 w-9 rounded-lg object-contain" />
            <div className="min-w-0">
              <p className="text-lg font-extrabold tracking-tight text-slate-900">Zeric</p>
              <p className="text-[11px] font-medium text-slate-500">Owner View Mode</p>
            </div>
          </button>
          <button type="button" onClick={() => setMobileMenuOpen(false)} className="lg:hidden text-slate-500">
            <X size={19} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3">
          <p className="px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">MONITORING</p>
          <nav className="mt-3 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = activeView === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => navigate(item.id)}
                  className={`relative flex min-h-11 w-full items-center gap-3 rounded-xl px-3.5 py-3 text-left text-[13px] font-semibold transition ${
                    active ? "bg-violet-50 text-violet-700" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  }`}
                >
                  {active && <span className="absolute bottom-2.5 left-0 top-2.5 w-[3px] rounded-r-full bg-violet-600" />}
                  <Icon size={19} className={active ? "text-violet-600" : "text-slate-400"} />
                  <span className="min-w-0 flex-1">{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        <div className="shrink-0 border-t border-slate-100 bg-white py-2 px-4">
          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-semibold text-rose-600 hover:bg-rose-50"
          >
            {loggingOut ? <LoaderCircle size={18} className="animate-spin" /> : <LogOut size={18} />}
            {loggingOut ? "Signing out..." : "Log out"}
          </button>
        </div>
      </aside>

      {/* Main Container */}
      <div className="min-h-screen lg:pl-[260px]">
        <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl">
          <div className="flex h-[68px] items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <button type="button" onClick={() => setMobileMenuOpen(true)} className="lg:hidden p-2 rounded-xl border border-slate-200">
                <Menu size={20} />
              </button>
              <div>
                <p className="truncate text-sm font-bold text-slate-900">
                  {activeView === "overview"
                    ? "Overview"
                    : activeView === "bookings"
                      ? "Bookings"
                      : activeView === "today-checkup"
                        ? "Today's Checkups"
                        : "Profile Info"}
                </p>
                <p className="hidden text-xs text-slate-500 sm:block">{formatDate(selectedDate)}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 ring-1 ring-amber-200">
                <Eye size={14} /> Owner Mode (Read-Only)
              </span>
              <button
                type="button"
                onClick={handleRefresh}
                disabled={refreshing}
                className="flex h-9 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-600 hover:bg-slate-50"
              >
                <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />
                <span className="hidden sm:inline">Refresh</span>
              </button>
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1600px] space-y-6 px-4 py-5 sm:px-6 lg:px-8">
          {pageError && (
            <div className="flex items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
              <AlertCircle size={18} />
              <p>{pageError}</p>
            </div>
          )}

          {/* Today Checkup Read-Only Section */}
          {isDoctor && activeView === "today-checkup" && (
            <section className="space-y-6">
              <SectionHeading
                eyebrow="OWNER MONITORING"
                title="Today's Checkup Sessions"
                description="Live monitor of patient flow across configured sessions."
              />

              {todaySlots.length === 0 ? (
                <EmptyState title="No sessions scheduled today" description="No working sessions set for today." />
              ) : (
                <div className="space-y-6">
                  {todaySlots.map((slot, index) => {
                    const sessionStatus = getSessionState(slot);
                    const patients = sortSessionPatients(getTodaySessionPatients(slot));

                    return (
                      <section key={slot.value} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                        <div className="border-b border-slate-200 bg-slate-50/50 p-4 sm:p-6">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100 text-violet-700">
                                <CalendarCheck size={20} />
                              </div>
                              <div>
                                <p className="text-xs font-semibold text-violet-600">Session {index + 1}</p>
                                <h3 className="text-lg font-bold text-slate-900">{slot.label}</h3>
                              </div>
                            </div>

                            <span className={`rounded-full px-3 py-1 text-xs font-bold ${
                              sessionStatus === "active" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"
                            }`}>
                              Status: {sessionStatus}
                            </span>
                          </div>
                        </div>

                        <div className="divide-y divide-slate-100">
                          {patients.length === 0 ? (
                            <p className="p-6 text-center text-sm text-slate-500">No patients in this session queue.</p>
                          ) : (
                            patients.map((customer) => (
                              <div key={customer._id || customer.id} className="flex items-center justify-between p-4">
                                <div>
                                  <p className="font-bold text-slate-900">{getCustomerName(customer)}</p>
                                  <p className="text-xs text-slate-500">
                                    Token: {getCustomerToken(customer)} · Phone: {getCustomerPhone(customer) || "N/A"}
                                  </p>
                                </div>
                                <StatusBadge status={customer?.status} />
                              </div>
                            ))
                          )}
                        </div>
                      </section>
                    );
                  })}
                </div>
              )}
            </section>
          )}

          {/* Overview Read-Only View */}
          {activeView === "overview" && (
            <>
              <section className="rounded-2xl bg-gradient-to-br from-violet-700 to-indigo-700 p-6 text-white shadow-lg sm:p-8">
                <h1 className="text-2xl font-extrabold sm:text-3xl">
                  {profile?.businessName ? `${profile.businessName} Overview` : `Welcome to ${welcomeName}'s Dashboard`}
                </h1>
                <p className="mt-2 text-indigo-100 text-sm">
                  You are viewing this workspace as an Owner/Admin. All features are set to read-only.
                </p>
              </section>

              <section className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
                <StatCard title="Total Bookings" value={stats.total} description="Selected session" icon={CalendarCheck} color="violet" />
                <StatCard title="Waiting" value={stats.waiting} description="In queue" icon={Clock3} color="amber" />
                <StatCard title="In Progress" value={stats.serving} description="Being served" icon={Activity} color="blue" />
                <StatCard title="Completed" value={stats.completed} description="Finished" icon={CheckCircle2} color="green" />
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 shadow-sm">
                <SectionHeading title="Daily Schedule Overview" description="Select date and session to monitor current bookings." />
                <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label="Date">
                    <input type="date" className={inputClass} value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} />
                  </Field>
                  <Field label="Scheduled Session">
                    <select className={`${inputClass} appearance-none pr-10`} value={selectedSlot} onChange={(e) => setSelectedSlot(e.target.value)}>
                      {slots.length === 0 && <option value="">No sessions available</option>}
                      {slots.map((s) => (
                        <option key={s.value} value={s.value}>{s.label}</option>
                      ))}
                    </select>
                  </Field>
                </div>
              </section>
            </>
          )}

          {/* Bookings Queue View */}
          {activeView === "bookings" && (
            <section className="space-y-5">
              <SectionHeading eyebrow="MONITORING" title="All Bookings" description="Search and inspect all customer records." />
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="relative w-full sm:max-w-xs">
                    <Search size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      className={`${inputClass} pl-10`}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search name, phone, token..."
                    />
                  </div>
                </div>

                <div className="divide-y divide-slate-100">
                  {filteredCustomers.length === 0 ? (
                    <EmptyState title="No bookings found" description="No results match your criteria." />
                  ) : (
                    filteredCustomers.map((customer) => (
                      <div key={customer._id || customer.id} className="flex items-center justify-between p-4 hover:bg-slate-50">
                        <div>
                          <p className="font-semibold text-slate-800">{getCustomerName(customer)}</p>
                          <p className="text-xs text-slate-500">
                            Token: {getCustomerToken(customer)} · Phone: {getCustomerPhone(customer) || "—"}
                          </p>
                        </div>
                        <StatusBadge status={customer?.status} />
                      </div>
                    ))
                  )}
                </div>
              </div>
            </section>
          )}

          {/* Read-Only Profile View */}
          {activeView === "profile" && (
            <section className="space-y-5">
              <SectionHeading eyebrow="ACCOUNT DETAILS" title="Profile & Schedule Information" description="Overview of account configuration." />
              <OwnerProfileView role={role} profile={profile || {}} schedule={schedule || {}} />
            </section>
          )}

          <footer className="flex flex-col gap-2 border-t border-slate-200 py-4 text-xs text-slate-400 sm:flex-row sm:items-center sm:justify-between">
            <p>© {new Date().getFullYear()} Zeric. All rights reserved.</p>
            <p>Owner Dashboard Mode</p>
          </footer>
        </main>
      </div>
      <GoUpButton />
    </div>
  );
}