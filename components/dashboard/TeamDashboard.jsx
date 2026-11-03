"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { signOut } from "next-auth/react";
import {
  Activity,
  AlertCircle,
  ArrowRight,
  CalendarCheck,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Clock3,
  CreditCard,
  LayoutDashboard,
  LoaderCircle,
  LogOut,
  Menu,
  Pencil,
  Phone,
  RefreshCw,
  Save,
  Search,
  Stethoscope,
  Upload,
  UserRound,
  Users,
  X,
  BriefcaseMedical,
  Plus,
  Play,
  Ticket,
  UserPlus,
} from "lucide-react";
import Image from "next/image";
import { toast } from "react-toastify";
import GoUpButton from "../goToUpButton";

const API = {
  schedule: "/api/team/schedule",
  profile: "/api/team/profile",
  uploadImage: "/api/team/profile/upload-image",
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
    return {
      label: slot,
      value: slot,
    };
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

function sortTodayPatients(patients) {
  const priorityOrder = (patient) => {
    const rank = getPriorityRank(patient);
    return rank === 0 ? 0 : rank === 1 ? 1 : 2;
  };

  return [...patients].sort((a, b) => {
    const aStatus = getCustomerStatus(a);
    const bStatus = getCustomerStatus(b);

    // Completed patients always go to the bottom.
    if (aStatus === "completed" && bStatus !== "completed") return 1;
    if (bStatus === "completed" && aStatus !== "completed") return -1;

    // Emergency, elderly, then normal patients.
    const priorityDifference = priorityOrder(a) - priorityOrder(b);
    if (priorityDifference !== 0) return priorityDifference;

    // Keep the existing relative order for patients with equal priority.
    return 0;
  });
}

function getStatus(value) {
  const status = String(value || "").toLowerCase().replace(/[_\s]+/g, "-");

  if (["completed", "complete", "done", "served", "finished"].includes(status)) {
    return "completed";
  }

  if (["serving", "in-progress", "inprogress", "processing", "active"].includes(status)) {
    return "serving";
  }

  if (["cancelled", "canceled", "rejected"].includes(status)) {
    return "cancelled";
  }

  return "waiting";
}

function getCustomerName(customer) {
  return (
    customer?.patientName ||
    customer?.customerName ||
    customer?.fullName ||
    customer?.name ||
    "Unknown customer"
  );
}

function getCustomerPhone(customer) {
  return (
    customer?.phone ||
    customer?.mobile ||
    customer?.phoneNumber ||
    customer?.patientPhone ||
    ""
  );
}

function getCustomerGender(customer) {
  return customer?.gender || "";
}

function getCustomerToken(customer) {
  return (
    customer?.tokenNumber ||
    customer?.token ||
    customer?.bookingReference ||
    customer?.reference ||
    "—"
  );
}

function getCustomerType(customer) {
  return (
    customer?.priority ||
    "—"
  );
}

function getCustomerStatus(customer) {
  return getStatus(customer?.status || customer?.bookingStatus);
}

function getPriorityRank(customer) {
  const priority = String(
    customer?.priority ?? customer?.bookingPriority ??
    customer?.bookingType ?? customer?.patientType ??
    customer?.urgency ?? "normal"
  ).toLowerCase();
  if (priority.includes("emergency") || customer?.isEmergency === true) return 0;

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
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${
        styles[normalized]
      }`}
    >
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
    <div className="min-w-0 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md sm:p-5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-medium text-slate-500 sm:text-sm">
            {title}
          </p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            {value}
          </p>
        </div>

        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1 ${colorStyles[color]}`}
        >
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
        {eyebrow && (
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-violet-600">
            {eyebrow}
          </p>
        )}
        <h2 className="mt-1 text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
          {title}
        </h2>
        {description && (
          <p className="mt-1 text-sm leading-6 text-slate-500">
            {description}
          </p>
        )}
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
      <p className="mt-1 max-w-sm text-sm leading-6 text-slate-500">
        {description}
      </p>
    </div>
  );
}

function Field({ label, children, hint }) {
  return (
    <label className="block min-w-0">
      <span className="mb-1.5 block text-sm font-medium text-slate-700">
        {label}
      </span>
      {children}
      {hint && (
        <span className="mt-1 block text-xs leading-5 text-slate-500">
          {hint}
        </span>
      )}
    </label>
  );
}

const inputClass =
  "w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-violet-400 focus:ring-4 focus:ring-violet-100 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500";

const DAYS_OF_WEEK = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

function normalizeTimeValue(value) {
  if (!value) return "09:00 AM";

  const text = String(value).trim();
  const twelveHour = text.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);

  if (twelveHour) {
    return `${String(Number(twelveHour[1])).padStart(2, "0")}:${twelveHour[2]} ${twelveHour[3].toUpperCase()}`;
  }

  const twentyFourHour = text.match(/^(\d{1,2}):(\d{2})$/);

  if (twentyFourHour) {
    const hours = Number(twentyFourHour[1]);
    const minutes = Number(twentyFourHour[2]);

    if (hours > 23 || minutes > 59) return "09:00 AM";

    const period = hours >= 12 ? "PM" : "AM";
    const hour = hours % 12 || 12;

    return `${String(hour).padStart(2, "0")}:${String(minutes).padStart(2, "0")} ${period}`;
  }

  return "09:00 AM";
}

function TimeSelect({ label, value, onChange, disabled }) {
  const normalized = normalizeTimeValue(value);
  const match = normalized.match(/^(\d{2}):(\d{2}) (AM|PM)$/);

  const hour = String(Number(match?.[1] || "09"));
  const minute = match?.[2] || "00";
  const period = match?.[3] || "AM";

  function updateTime(nextHour, nextMinute, nextPeriod) {
    onChange(
      `${String(Number(nextHour)).padStart(2, "0")}:${nextMinute} ${nextPeriod}`
    );
  }

  const selectClass = `${inputClass} appearance-none`;

  return (
    <Field label={label}>
      <div className="grid grid-cols-[1fr_1fr_1fr] gap-2">
        <select
          className={selectClass}
          value={hour}
          disabled={disabled}
          aria-label={`${label} hour`}
          onChange={(event) =>
            updateTime(event.target.value, minute, period)
          }
        >
          {Array.from({ length: 12 }, (_, index) => index + 1).map(
            (number) => (
              <option key={number} value={String(number)}>
                {String(number).padStart(2, "0")}
              </option>
            )
          )}
        </select>

        <select
          className={selectClass}
          value={minute}
          disabled={disabled}
          aria-label={`${label} minute`}
          onChange={(event) =>
            updateTime(hour, event.target.value, period)
          }
        >
          {Array.from({ length: 60 }, (_, index) => index).map((number) => (
            <option key={number} value={String(number).padStart(2, "0")}>
              {String(number).padStart(2, "0")}
            </option>
          ))}
        </select>

        <select
          className={selectClass}
          value={period}
          disabled={disabled}
          aria-label={`${label} AM or PM`}
          onChange={(event) =>
            updateTime(hour, minute, event.target.value)
          }
        >
          <option value="AM">AM</option>
          <option value="PM">PM</option>
        </select>
      </div>
    </Field>
  );
}

function normalizeTeamServices(services, profile) {
  if (!Array.isArray(services)) return [];

  return services.map((service, index) => {
    if (typeof service === "string") {
      return {
        id: `service-${index}`,
        name: service,
        charge: "",
      };
    }

    return {
      id: String(service?._id || service?.id || `service-${index}`),
      name: service?.name || service?.serviceName || "",
      charge: service?.charge ?? service?.price ?? "",
    };
  });
}

function normalizeWeeklySchedule(schedule) {
  const result = {};

  for (const day of DAYS_OF_WEEK) {
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
        open: normalizeTimeValue(
          slot?.open || slot?.start || "09:00 AM"
        ),
        close: normalizeTimeValue(
          slot?.close || slot?.end || "01:00 PM"
        ),
        checkupStartTime: normalizeTimeValue(
          slot?.checkupStartTime || slot?.open || "09:00 AM"
        ),
        capacity: slot?.capacity ?? 9,
      })),
    };
  }

  return result;
}

function TeamProfile({
  role,
  profile,
  schedule,
  onProfileSaved,
  onProfileChange,
  onScheduleChange,
}) {
  const isDoctor = role === "doctor";

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    experience: "",
    specialization: "",
    fee: "",
    duration: "",
    services: [],
    profileImage: "",
    businessName: "",
  });

  const [weeklySchedule, setWeeklySchedule] = useState(() =>
    normalizeWeeklySchedule(schedule)
  );

  const [holidayDate, setHolidayDate] = useState(getLocalDate());
  const [holidayDates, setHolidayDates] = useState(() =>
    Array.isArray(profile?.holidays)
      ? profile.holidays.filter((date) => date >= getLocalDate()).sort()
      : []
  );
  const [savingHolidays, setSavingHolidays] = useState(false);

  useEffect(() => {
    setForm({
      name: profile?.name || "",
      email: profile?.email || "",
      phone: profile?.phone || "",
      experience: profile?.experience ?? "",
      specialization: profile?.specialization || "",
      fee: profile?.fee ?? "",
      duration: profile?.duration ?? "",
      services: normalizeTeamServices(profile?.services, profile),
      profileImage: profile?.profileImage || "",
      businessName: profile?.businessName || "",
    });
  }, [profile]);

  useEffect(() => {
    setWeeklySchedule(normalizeWeeklySchedule(schedule));
  }, [schedule]);

  useEffect(() => {
    const today = getLocalDate();
    setHolidayDates(
      Array.isArray(profile?.holidays)
        ? [...new Set(profile.holidays.filter((date) => date >= today))].sort()
        : []
    );
  }, [profile?.holidays]);

  async function saveHolidayDates(nextDates) {
    setSavingHolidays(true);
    try {
      const response = await fetch(API.profile, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({  holidayDates: nextDates }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result?.message || "Unable to save holiday dates.");
      }

      const savedProfile = result?.profile;
      const today = getLocalDate();
      const savedDates = Array.isArray(savedProfile?.holidays)
        ? savedProfile.holidays.filter((date) => date >= today).sort()
        : nextDates;

      setHolidayDates(savedDates);
      if (savedProfile) {
        onProfileChange?.({ ...profile, ...savedProfile });
        onProfileSaved?.({ ...profile, ...savedProfile });
      }
      toast.success("Holiday dates saved.");
    } catch (error) {
      toast.error(error.message || "Unable to save holiday dates.");
    } finally {
      setSavingHolidays(false);
    }
  }

  function addHolidayDate() {
    const today = getLocalDate();
    if (!holidayDate || holidayDate < today) {
      toast.error("Choose today or a future date.");
      return;
    }
    if (holidayDates.includes(holidayDate)) {
      toast.info("This date is already selected.");
      return;
    }
    const nextDates = [...holidayDates, holidayDate].sort();
    setHolidayDates(nextDates);
    saveHolidayDates(nextDates);
  }

  function removeHolidayDate(dateToRemove) {
    const nextDates = holidayDates.filter((date) => date !== dateToRemove);
    setHolidayDates(nextDates);
    saveHolidayDates(nextDates);
  }

  function update(field, value) {
    setForm((previous) => ({ ...previous, [field]: value }));
    setError("");
    setSuccess("");
  }

  function updateDaySlot(day, index, field, value) {
    setWeeklySchedule((previous) => ({
      ...previous,
      [day]: {
        ...previous[day],
        slots: previous[day].slots.map((slot, slotIndex) =>
          slotIndex === index
            ? { ...slot, [field]: value }
            : slot
        ),
      },
    }));

    setError("");
    setSuccess("");
  }

  function addDaySlot(day) {
    setWeeklySchedule((previous) => ({
      ...previous,
      [day]: {
        ...previous[day],
        slots: [
          ...previous[day].slots,
          {
            open: "09:00 AM",
            close: "01:00 PM",
            checkupStartTime: "09:00 AM",
            capacity: 9,
          },
        ],
      },
    }));

    setError("");
    setSuccess("");
  }

  async function removeDaySlot(day, index) {
  const updatedSchedule = {
    ...weeklySchedule,
    [day]: {
      ...weeklySchedule[day],
      slots: weeklySchedule[day].slots.filter(
        (_, slotIndex) => slotIndex !== index
      ),
    },
  };

  // Update the page
  setWeeklySchedule(updatedSchedule);

  setError("");
  setSuccess("");

  try {
    const response = await fetch("/api/team/schedule", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        weeklySchedule: updatedSchedule,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Failed to save schedule");
    }

    setSuccess("Slot removed successfully.");
  } catch (error) {
    setError(error.message || "Failed to save schedule.");
  }
}

  function updateStaffService(index, field, value) {
    setForm((previous) => ({
      ...previous,
      services: previous.services.map((service, serviceIndex) =>
        serviceIndex === index
          ? { ...service, [field]: value }
          : service
      ),
    }));

    setError("");
    setSuccess("");
  }

  function addStaffService() {
    setForm((previous) => ({
      ...previous,
      services: [
        ...previous.services,
        {
          id: `new-${Date.now()}`,
          name: "",
          charge: "",
        },
      ],
    }));
  }

  function removeStaffService(index) {
    setForm((previous) => ({
      ...previous,
      services: previous.services.filter(
        (_, serviceIndex) => serviceIndex !== index
      ),
    }));
  }

  function cancelEditing() {
    setEditing(false);
    setError("");
    setSuccess("");

    setForm({
      name: profile?.name || "",
      email: profile?.email || "",
      phone: profile?.phone || "",
      experience: profile?.experience ?? "",
      specialization: profile?.specialization || "",
      fee: profile?.fee ?? "",
      duration: profile?.duration ?? "",
      services: normalizeTeamServices(profile?.services, profile),
      profileImage: profile?.profileImage || "",
    });

    setWeeklySchedule(normalizeWeeklySchedule(schedule));
  }

  async function uploadProfileImage(file) {
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError("Image size must be 5 MB or less.");
      return;
    }

    setUploading(true);
    setError("");
    setSuccess("");

    try {
      const body = new FormData();
      body.append("image", file);
      body.append("file", file);

      const response = await fetch(API.uploadImage, {
        method: "POST",
        body,
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          result?.error || result?.message || "Image upload failed."
        );
      }

      const imageUrl =
        result?.url ||
        result?.imageUrl ||
        result?.profileImage ||
        result?.data?.url;

      if (!imageUrl) {
        throw new Error("The server did not return an image URL.");
      }

      update("profileImage", imageUrl);
      toast.success("Image Uploaded!");
      setSuccess("Image uploaded. Save your profile to apply changes.");
    } catch (uploadError) {
      setError(uploadError.message || "Unable to upload image.");
    } finally {
      setUploading(false);
    }
  }

  function validateSchedule() {
    for (const day of DAYS_OF_WEEK) {
      const slots = weeklySchedule[day]?.slots || [];

      for (let index = 0; index < slots.length; index += 1) {
        const slot = slots[index];
        const capacity = Number(slot.capacity);

        if (!slot.open || !slot.close || !slot.checkupStartTime) {
          return `${day}, slot ${index + 1}: please select all times.`;
        }

        if (!Number.isInteger(capacity) || capacity < 1) {
          return `${day}, slot ${index + 1}: capacity must be at least 1.`;
        }
      }
    }

    return "";
  }

  async function saveProfile(event) {
    event.preventDefault();

    if (saving || uploading) return;

    const scheduleError = validateSchedule();

    if (scheduleError) {
      setError(scheduleError);
      return;
    }

    if (!form.name.trim()) {
      setError("Please enter your name.");
      return;
    }

    if (
      !isDoctor &&
      form.services.some((service) => !service.name.trim())
    ) {
      setError("Please enter a name for every staff service.");
      return;
    }

    if (
      isDoctor &&
      (form.fee === "" ||
        !Number.isFinite(Number(form.fee)) ||
        Number(form.fee) < 0)
    ) {
      setError("Please enter a valid consultation charge.");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const cleanSchedule = Object.fromEntries(
        DAYS_OF_WEEK.map((day) => [
          day,
          {
            ...weeklySchedule[day],
            slots: weeklySchedule[day].slots.map((slot) => ({
              open: slot.open,
              close: slot.close,
              checkupStartTime: slot.checkupStartTime,
              capacity: Number(slot.capacity),
            })),
          },
        ])
      );

      const staffServices = form.services
        .map((service) => service.name.trim())
        .filter(Boolean);

      const payload = {
        role,
        name: form.name.trim(),
        phone: form.phone.trim(),
        profileImage: form.profileImage,
        experience:
          form.experience === "" ? null : Number(form.experience),
        schedule: cleanSchedule,
      };

      if (isDoctor) {
        payload.specialization = form.specialization.trim();
        payload.fee = Number(form.fee);
        payload.duration =
          form.duration === "" ? null : Number(form.duration);

        payload.services = [
          {
            name: "General Consultation",
            charge: Number(form.fee),
          },
        ];
      } else {
        payload.services = staffServices;
      }

      const scheduleResponse = await fetch(
        `${API.schedule}?role=${encodeURIComponent(role)}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
          body: JSON.stringify({
            role,
            schedule: cleanSchedule,
          }),
        }
      );

      const scheduleResult = await scheduleResponse
        .json()
        .catch(() => ({}));

      if (!scheduleResponse.ok) {
        throw new Error(
          scheduleResult?.error ||
            scheduleResult?.message ||
            "Unable to save schedule."
        );
      }

      const profileResponse = await fetch(API.profile, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify(payload),
      });

      const profileResult = await profileResponse
        .json()
        .catch(() => ({}));

      if (!profileResponse.ok) {
        throw new Error(
          profileResult?.error ||
            profileResult?.message ||
            "Unable to save profile and services."
        );
      }

      const returnedProfile =
        profileResult?.profile ||
        profileResult?.data?.profile ||
        profileResult?.data ||
        {};

      const updatedProfile = {
        ...profile,
        ...returnedProfile,
        name: payload.name,
        phone: payload.phone,
        profileImage: payload.profileImage,
        experience: payload.experience,
        schedule: cleanSchedule,
        ...(isDoctor
          ? {
              specialization: payload.specialization,
              fee: payload.fee,
              duration: payload.duration,
              services: payload.services,
            }
          : {
              services: staffServices,
            }),
      };

      onProfileChange(updatedProfile);
      onScheduleChange?.(cleanSchedule);
      onProfileSaved?.(updatedProfile);

      setEditing(false);
      toast.success("Saved Successfully");
    } catch (saveError) {
      setError(saveError.message || "Unable to save changes.");
    } finally {
      setSaving(false);
    }
  }

  const displayedServices = normalizeTeamServices(
    profile?.services,
    profile
  );

  return (
    <div className="space-y-5">
      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm sm:rounded-3xl">
        <div className="h-24 bg-gradient-to-r from-violet-700 via-indigo-600 to-indigo-500 sm:h-32" />

        <div className="px-4 pb-5 sm:px-7 sm:pb-7">
          <div className="-mt-10 flex flex-col gap-4 sm:-mt-12 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex min-w-0 items-end gap-3 sm:gap-4">
              <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border-4 border-white bg-violet-100 text-violet-700 shadow-sm sm:h-24 sm:w-24">
                {form.profileImage ? (
                  <img
                    src={form.profileImage}
                    alt="Profile"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <UserRound size={34} />
                )}
              </div>

              <div className="min-w-0 pb-1">
                <h2 className="truncate text-lg font-bold text-slate-900 sm:text-xl">
                  {profile?.name || "Your profile"}
                </h2>
                <p className="mt-1 text-sm capitalize text-slate-500">
                  {isDoctor ? "Doctor profile" : "Staff profile"}
                </p>
              </div>
            </div>

            {!editing && (
              <button
                type="button"
                onClick={() => {
                  setEditing(true);
                  setSuccess("");
                  setError("");
                }}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-700 sm:w-auto"
              >
                <Pencil size={16} />
                Edit profile
              </button>
            )}
          </div>

          {error && (
            <div className="mt-5 flex gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
              <AlertCircle size={17} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="mt-5 flex gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
              <CheckCircle2 size={17} className="mt-0.5 shrink-0" />
              <span>{success}</span>
            </div>
          )}

          {editing ? (
            <form onSubmit={saveProfile} className="mt-7 space-y-8">
              <section>
                <h3 className="text-sm font-bold text-slate-900">
                  Personal information
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  Update your team account details.
                </p>

                <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label="Full name">
                    <input
                      className={inputClass}
                      value={form.name}
                      onChange={(event) =>
                        update("name", event.target.value)
                      }
                      required
                      maxLength={100}
                      placeholder="Enter your full name"
                    />
                  </Field>

                  <Field label="Email address">
                    <input
                      className={inputClass}
                      value={form.email}
                      type="email"
                      disabled
                      readOnly
                    />
                  </Field>

                  <Field label="Phone number">
                    <input
                      className={inputClass}
                      value={form.phone}
                      onChange={(event) =>
                        update("phone", event.target.value)
                      }
                      type="tel"
                      maxLength={20}
                      placeholder="Enter phone number"
                    />
                  </Field>

                  <Field label="Experience (years)">
                    <input
                      className={inputClass}
                      value={form.experience}
                      onChange={(event) =>
                        update("experience", event.target.value)
                      }
                      type="number"
                      min="0"
                      max="100"
                      placeholder="e.g. 3"
                    />
                  </Field>

                  {isDoctor && (
                    <>
                      <Field label="Specialization">
                        <input
                          className={inputClass}
                          value={form.specialization}
                          onChange={(event) =>
                            update("specialization", event.target.value)
                          }
                          maxLength={100}
                          placeholder="e.g. General Physician"
                        />
                      </Field>

                      <Field label="Consultation charge (₹)">
                        <input
                          className={inputClass}
                          value={form.fee}
                          onChange={(event) =>
                            update("fee", event.target.value)
                          }
                          type="number"
                          min="0"
                          step="1"
                          required
                          placeholder="e.g. 500"
                        />
                      </Field>

                      <Field label="Appointment duration (minutes)">
                        <input
                          className={inputClass}
                          value={form.duration}
                          onChange={(event) =>
                            update("duration", event.target.value)
                          }
                          type="number"
                          min="1"
                          step="1"
                          placeholder="e.g. 20"
                        />
                      </Field>
                    </>
                  )}
                </div>
              </section>

                <section className="rounded-2xl border border-slate-200 p-4">
                <h3 className="text-sm font-semibold text-slate-800">
                  Profile photo
                </h3>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  JPG, PNG or WebP. Maximum file size: 5 MB.
                </p>

                <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
                  <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                    {uploading ? (
                      <LoaderCircle size={17} className="animate-spin" />
                    ) : (
                      <Upload size={17} />
                    )}
                    {uploading ? "Uploading..." : "Choose image"}
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="hidden"
                      disabled={uploading}
                      onChange={(event) => {
                        uploadProfileImage(event.target.files?.[0]);
                        event.target.value = "";
                      }}
                    />
                  </label>

                  {form.profileImage && (
                    <button
                      type="button"
                      onClick={() => update("profileImage", "")}
                      className="text-sm font-medium text-rose-600 hover:text-rose-700"
                    >
                      Remove photo
                    </button>
                  )}
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200 p-4 sm:p-5">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h3 className="font-bold text-slate-900">
                      Services
                    </h3>
                    <p className="mt-1 text-sm text-slate-500">
                      {isDoctor
                        ? "General Consultation is fixed. You can change its charge."
                        : "Add the services you provide as a staff member."}
                    </p>
                  </div>

                  {!isDoctor && (
                    <button
                      type="button"
                      onClick={addStaffService}
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-3 py-2.5 text-sm font-semibold text-violet-700 hover:bg-violet-100"
                    >
                      <Plus size={16} />
                      Add service
                    </button>
                  )}
                </div>

                {isDoctor ? (
                  <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-violet-100 bg-violet-50/60 p-4">
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900">
                        General Consultation
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        Fixed service · Cannot be removed
                      </p>
                    </div>

                    <p className="shrink-0 text-lg font-bold text-violet-700">
                      ₹{form.fee === "" ? "—" : form.fee}
                    </p>
                  </div>
                ) : (
                  <div className="mt-4 space-y-3">
                    {form.services.length === 0 && (
                      <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center">
                        <p className="text-sm font-semibold text-slate-700">
                          No services added
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          Use Add service to create your first service.
                        </p>
                      </div>
                    )}

                    {form.services.map((service, index) => (
                      <div
                        key={service.id}
                        className="flex items-start gap-3 rounded-xl border border-slate-200 p-3"
                      >
                        <div className="min-w-0 flex-1">
                          <Field label={`Service ${index + 1}`}>
                            <input
                              className={inputClass}
                              value={service.name}
                              onChange={(event) =>
                                updateStaffService(
                                  index,
                                  "name",
                                  event.target.value
                                )
                              }
                              placeholder="e.g. Reception, Billing"
                              maxLength={100}
                            />
                          </Field>
                        </div>

                        <button
                          type="button"
                          onClick={() => removeStaffService(index)}
                          aria-label={`Remove service ${index + 1}`}
                          className="mt-7 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-rose-100 text-rose-600 hover:bg-rose-50"
                        >
                          <X size={17} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section className="rounded-2xl border border-slate-200 p-4 sm:p-5">
                <div>
                  <h3 className="font-bold text-slate-900">
                    Weekly schedule
                  </h3>
                  <p className="mt-1 text-sm text-slate-500">
                    Add one or more sessions for each day. Select times using
                    the dropdowns.
                  </p>
                </div>

                <div className="mt-5 space-y-4">
                  {DAYS_OF_WEEK.map((day) => {
                    const daySlots = weeklySchedule[day]?.slots || [];

                    return (
                      <div
                        key={day}
                        className="rounded-xl border border-slate-200 p-3 sm:p-4"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <h4 className="font-bold text-slate-900">
                              {day}
                            </h4>
                            <p className="mt-1 text-xs text-slate-500">
                              {daySlots.length} session
                              {daySlots.length === 1 ? "" : "s"}
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={() => addDaySlot(day)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-semibold text-violet-700 hover:bg-violet-100"
                          >
                            <Plus size={15} />
                            Add slot
                          </button>
                        </div>

                        {daySlots.length === 0 ? (
                          <p className="mt-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-500">
                            No sessions scheduled for this day.
                          </p>
                        ) : (
                          <div className="mt-4 space-y-4">
                            {daySlots.map((slot, index) => (
                              <div
                                key={`${day}-${index}`}
                                className="rounded-xl border border-slate-100 bg-slate-50/70 p-3 sm:p-4"
                              >
                                <div className="mb-4 flex items-center justify-between gap-2">
                                  <p className="text-sm font-semibold text-slate-800">
                                    Session {index + 1}
                                  </p>

                                  <button
                                    type="button"
                                    onClick={() =>
                                      removeDaySlot(day, index)
                                    }
                                    className="inline-flex items-center gap-1 rounded-lg px-2.5 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50"
                                  >
                                    <X size={15} />
                                    Remove
                                  </button>
                                </div>

                                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                                  <TimeSelect
                                    label="Opening time"
                                    value={slot.open}
                                    disabled={saving}
                                    onChange={(value) =>
                                      updateDaySlot(
                                        day,
                                        index,
                                        "open",
                                        value
                                      )
                                    }
                                  />

                                  <TimeSelect
                                    label="Closing time"
                                    value={slot.close}
                                    disabled={saving}
                                    onChange={(value) =>
                                      updateDaySlot(
                                        day,
                                        index,
                                        "close",
                                        value
                                      )
                                    }
                                  />

                                  {isDoctor && (
                                    <TimeSelect
                                      label="Checkup start time"
                                      value={slot.checkupStartTime}
                                      disabled={saving}
                                      onChange={(value) =>
                                        updateDaySlot(
                                          day,
                                          index,
                                          "checkupStartTime",
                                          value
                                        )
                                      }
                                    />
                                  )}

                                  <Field label="Capacity per slot">
                                    <input
                                      className={inputClass}
                                      type="number"
                                      min="1"
                                      step="1"
                                      required
                                      value={slot.capacity}
                                      disabled={saving}
                                      onChange={(event) =>
                                        updateDaySlot(
                                          day,
                                          index,
                                          "capacity",
                                          event.target.value === ""
                                            ? ""
                                            : Number(event.target.value)
                                        )
                                      }
                                    />
                                  </Field>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>

            

              <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={cancelEditing}
                  disabled={saving || uploading}
                  className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving || uploading}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-5 py-3 text-sm font-semibold text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving ? (
                    <LoaderCircle size={17} className="animate-spin" />
                  ) : (
                    <Save size={17} />
                  )}
                  {saving ? "Saving changes..." : "Save changes"}
                </button>
              </div>
            </form>
          ) : (
            <div className="mt-7 space-y-6">
              <section>
                <h3 className="text-sm font-bold text-slate-900">
                  Personal information
                </h3>

                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <InfoItem label="Full name" value={profile?.name} />
                  <InfoItem label="Email address" value={profile?.email} />
                  <InfoItem label="Phone number" value={profile?.phone} />
                  <InfoItem
                    label="Experience"
                    value={
                      profile?.experience !== null &&
                      profile?.experience !== undefined &&
                      profile?.experience !== ""
                        ? `${profile.experience} years`
                        : ""
                    }
                  />

                  {isDoctor && (
                    <>
                      <InfoItem
                        label="Specialization"
                        value={profile?.specialization}
                      />
                      <InfoItem
                        label="Consultation charge"
                        value={
                          profile?.fee !== null &&
                          profile?.fee !== undefined &&
                          profile?.fee !== ""
                            ? `₹${profile.fee}`
                            : ""
                        }
                      />
                      <InfoItem
                        label="Appointment duration"
                        value={
                          profile?.duration !== null &&
                          profile?.duration !== undefined &&
                          profile?.duration !== ""
                            ? `${profile.duration} minutes`
                            : ""
                        }
                      />
                    </>
                  )}

                  <InfoItem
                    label="Business / clinic"
                    value={profile?.businessName}
                  />
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200 p-4 sm:p-5">
                <h3 className="font-bold text-slate-900">Services</h3>

                {isDoctor ? (
                  <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-violet-100 bg-violet-50/60 p-4">
                    <div>
                      <p className="font-semibold text-slate-900">
                        General Consultation
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        Fixed doctor service
                      </p>
                    </div>
                    <p className="text-lg font-bold text-violet-700">
                      ₹{profile?.fee ?? "—"}
                    </p>
                  </div>
                ) : displayedServices.length ? (
                  <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {displayedServices.map((service, index) => (
                      <div
                        key={service.id || index}
                        className="flex items-center gap-3 rounded-xl border border-slate-200 p-4"
                      >
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
                  <p className="mt-3 text-sm text-slate-500">
                    No services have been added.
                  </p>
                )}
              </section>

              {isDoctor && (
                <section className="rounded-2xl border border-slate-200 p-4 sm:p-5">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <h3 className="font-bold text-slate-900">Set holidays</h3>
                    <span className="text-xs text-slate-500">
                      {holidayDates.length} upcoming date{holidayDates.length === 1 ? "" : "s"}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-slate-500">
                    Add individual dates when you are unavailable. Past dates expire automatically.
                  </p>

                  <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                    <input
                      type="date"
                      value={holidayDate}
                      min={getLocalDate()}
                      onChange={(event) => setHolidayDate(event.target.value)}
                      className="min-h-11 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
                      aria-label="Holiday date"
                    />
                    <button
                      type="button"
                      onClick={addHolidayDate}
                      disabled={savingHolidays}
                      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {savingHolidays ? <LoaderCircle size={16} className="animate-spin" /> : <Plus size={16} />}
                      Add date
                    </button>
                  </div>

                  {holidayDates.length ? (
                    <div className="mt-4 space-y-2">
                      {holidayDates.map((date) => (
                        <div
                          key={date}
                          className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-3 py-3"
                        >
                          <div className="flex min-w-0 items-center gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-700">
                              <CalendarDays size={17} />
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-slate-800">{formatDate(date)}</p>
                              <p className="text-xs text-slate-500">Doctor unavailable</p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeHolidayDate(date)}
                            disabled={savingHolidays}
                            className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                            aria-label={`Remove holiday ${date}`}
                          >
                            <X size={16} /> Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-4 rounded-xl bg-slate-50 p-3 text-sm text-slate-500">
                      No upcoming holidays selected.
                    </p>
                  )}
                </section>
              )}

              <section className="rounded-2xl border border-slate-200 p-4 sm:p-5">
                <h3 className="font-bold text-slate-900">Weekly schedule</h3>
                <p className="mt-1 text-sm text-slate-500">
                  Your configured working sessions.
                </p>

                <div className="mt-4 space-y-3">
                  {DAYS_OF_WEEK.map((day) => {
                    const daySlots =
                      normalizeWeeklySchedule(schedule)[day]?.slots || [];

                    return (
                      <div
                        key={day}
                        className="rounded-xl border border-slate-200 p-4"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <h4 className="font-semibold text-slate-900">
                            {day}
                          </h4>
                          <span className="text-xs text-slate-500">
                            {daySlots.length} session
                            {daySlots.length === 1 ? "" : "s"}
                          </span>
                        </div>

                        {daySlots.length === 0 ? (
                          <p className="mt-2 text-sm text-slate-500">
                            No sessions scheduled.
                          </p>
                        ) : (
                          <div className="mt-3 space-y-2">
                            {daySlots.map((slot, index) => (
                              <div
                                key={`${day}-${index}`}
                                className="rounded-lg bg-slate-50 p-3"
                              >
                                <p className="text-sm font-semibold text-slate-800">
                                  {slot.open} – {slot.close}
                                </p>

                                {isDoctor && (
                                  <p className="mt-1 text-xs text-slate-500">
                                    Checkup starts: {slot.checkupStartTime}
                                  </p>
                                )}

                                <p className="mt-1 text-xs text-slate-500">
                                  Capacity: {slot.capacity}
                                </p>
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
          )}
        </div>
      </div>
    </div>
  );
}

function InfoItem({ label, value }) {
  return (
    <div className="min-w-0 rounded-xl border border-slate-100 bg-slate-50/70 p-4">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-1 break-words text-sm font-semibold text-slate-800">
        {value !== null && value !== undefined && value !== ""
          ? value
          : "Not provided"}
      </p>
    </div>
  );
}

export default function TeamDashboard({ role = "staff" }) {
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

  const [notice, setNotice] = useState("");

  const roleLabel = isDoctor ? "Doctor" : "Staff";

  const [todayCustomers, setTodayCustomers] = useState([]);
  const [loadingToday, setLoadingToday] = useState(false);
  const [updatingCustomerId, setUpdatingCustomerId] = useState("");
  const [confirmComplete, setConfirmComplete] = useState(null);
  const [todaySessionStates, setTodaySessionStates] = useState({});
  const [updatingSessionId, setUpdatingSessionId] = useState("");

  // Patient manual booking modal state
  const [bookingModalOpen, setBookingModalOpen] = useState(false);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingForm, setBookingForm] = useState({
    patientName: "",
    phone: "",
    gender: "Male",
    priority: "normal",
    date: getLocalDate(),
    slot: "",
  });

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
    const raw = customer?.slotValue ?? customer?.slot ?? customer?.session ??
      customer?.slotLabel ?? customer?.timeSlot ?? customer?.sessionLabel ??
      customer?.sessionTime ?? "";
    if (raw && typeof raw === "object") {
      const open = raw.open || raw.start || raw.from || "";
      const close = raw.close || raw.end || raw.to || "";
      return String(raw.value || (open && close ? `${open}-${close}` : raw.label || ""));
    }
    return String(raw);
  };

  const getStatusRank = (status) => {
    switch (status) {
      case "serving":
        return 0;
      case "waiting":
        return 1;
      case "completed":
        return 2;
      case "cancelled":
        return 3;
      default:
        return 1;
    }
  };

  const sortSessionPatients = (patients) => [...patients].sort((a, b) => {
    const statusA = getCustomerStatus(a);
    const statusB = getCustomerStatus(b);
    
    // Sort active (serving/waiting) patients before completed or cancelled ones
    const statusDifference = getStatusRank(statusA) - getStatusRank(statusB);
    if (statusDifference) return statusDifference;

    // Within the same status group, sort by Priority: Emergency -> Elderly -> Normal
    const priorityDifference = getPriorityRank(a) - getPriorityRank(b);
    if (priorityDifference) return priorityDifference;

    // Finally sort by token sequence
    return Number(a?.sequence ?? a?.tokenSequence ?? Number.MAX_SAFE_INTEGER) -
      Number(b?.sequence ?? b?.tokenSequence ?? Number.MAX_SAFE_INTEGER);
  });

  const getTodaySessionPatients = (slot) => {
    const normalize = (value) => String(value || "").replace(/\s+/g, "").toLowerCase();
    const keys = [slot.value, slot.label, `${slot.open}-${slot.close}`].map(normalize);
    return sortSessionPatients(todayCustomers.filter((customer) => {
      const value = normalize(getCustomerSession(customer));
      return value && keys.includes(value);
    }));
  };

  const getSessionState = (slot) =>
    todaySessionStates[String(slot.value)]?.status || "not-started";

  async function updateTodaySession(slot, action) {
    const sessionId = String(slot.value || "");
    if (!sessionId) return toast.error("Session identifier is missing.");
    const current = getSessionState(slot);
    if (action === "start" && current === "closed") return toast.error("This session is already closed.");
    if (action === "close" && current !== "active") return toast.error("Start the session before closing it.");
    if (action === "close" && !window.confirm(`Close ${slot.label}? New checkups will be blocked for this session.`)) return;

    setUpdatingSessionId(sessionId);
    try {
      const response = await fetch(API.sessions, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          action: action === "start" ? "start-session" : "close-session",
          role, date: todayDate, sessionId, sessionLabel: slot.label,
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result?.error || result?.message || "Unable to update session.");
      const status = result?.session?.status || result?.status || (action === "start" ? "active" : "closed");
      setTodaySessionStates((previous) => ({
        ...previous, [sessionId]: { ...previous[sessionId], ...(result?.session || {}), status },
      }));
      toast.success(action === "start" ? "Today's checkup session started." : "Today's session closed.");
    } catch (error) {
      toast.error(error.message || "Unable to update session.");
    } finally {
      setUpdatingSessionId("");
    }
  }

  async function closeTodaySessionAndCancelBookings(slot) {
    const sessionId = String(slot.value || "");
    if (!sessionId) return toast.error("Session identifier is missing.");

    setUpdatingSessionId(sessionId);
    try {
      // 1. Close session via API
      const sessionResponse = await fetch(API.sessions, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          action: "close-session",
          role,
          date: todayDate,
          sessionId,
          sessionLabel: slot.label,
        }),
      });

      const sessionResult = await sessionResponse.json().catch(() => ({}));
      if (!sessionResponse.ok) {
        throw new Error(sessionResult?.error || sessionResult?.message || "Unable to close session.");
      }

      // 2. Cancel waiting bookings for this session
      const patients = getTodaySessionPatients(slot);
      const waitingPatients = patients.filter(
        (patient) => getCustomerStatus(patient) === "waiting"
      );

      await Promise.all(
        waitingPatients.map((patient) => {
          const id = patient?._id || patient?.id || patient?.bookingId;
          if (!id) return Promise.resolve();
          return fetch(API.customers, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            cache: "no-store",
            body: JSON.stringify({
              bookingId: String(id),
              status: "cancelled",
              role,
              date: todayDate,
            }),
          });
        })
      );

      setTodaySessionStates((previous) => ({
        ...previous,
        [sessionId]: { ...previous[sessionId], status: "closed" },
      }));

      await loadTodayCustomers();
      await loadCustomers();
      toast.success("Session closed and remaining waiting bookings cancelled.");
    } catch (error) {
      toast.error(error.message || "Unable to close session and cancel bookings.");
    } finally {
      setUpdatingSessionId("");
    }
  }

  const startTodaySession = (slot) => updateTodaySession(slot, "start");
  const closeTodaySession = (slot) => updateTodaySession(slot, "close");

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
      if (Array.isArray(list)) for (const session of list) {
        const key = String(session?.sessionId || session?.id || session?.value || "");
        if (key) next[key] = { ...session, status: session.status || "not-started" };
      }
      setTodaySessionStates(next);
    } catch (error) {
      console.error("Unable to load today's session states:", error);
    }
  }, [isDoctor, role, todayDate]);

  const todayCheckupStart = (slot) =>
    slot?.checkupStartTime || slot?.open || "Not configured";

  const loadInitialData = useCallback(async () => {
    setLoadingSchedule(true);
    setPageError("");

    try {
      const response = await fetch(
        `${API.schedule}?role=${encodeURIComponent(role)}`,
        {
          method: "GET",
          cache: "no-store",
          headers: { Accept: "application/json" },
        }
      );

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          result?.error || result?.message || "Unable to load your profile."
        );
      }

      const data = result?.data || result?.profile || result;

      const profileData = data?.profile || data?.teamMember || data;
      const scheduleData =
        data?.schedule ||
        profileData?.schedule ||
        result?.schedule ||
        {};

      const nextProfile = {
        ...profileData,
        name:
          profileData?.name ||
          profileData?.fullName ||
          profileData?.displayName ||
          "",
        email: profileData?.email || profileData?.emailAddress || "",
        phone: profileData?.phone || profileData?.mobile || "",
        profileImage:
          profileData?.profileImage ||
          profileData?.image ||
          profileData?.imageUrl ||
          "",
        businessName:
          data?.businessName ||
          profileData?.businessName ||
          profileData?.clinicName ||
          "",
        services: profileData?.services || [],
      
      };

      setProfile(nextProfile);
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
      const params = new URLSearchParams({
        role,
        date: selectedDate,
      });

      if (selectedSlot) {
        params.set("slot", selectedSlot);
      }

      const response = await fetch(`${API.customers}?${params.toString()}`, {
        method: "GET",
        cache: "no-store",
        headers: { Accept: "application/json" },
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          result?.error || result?.message || "Unable to load bookings."
        );
      }

      const list =
        result?.customers ||
        result?.patients ||
        result?.bookings ||
        result?.data?.customers ||
        result?.data?.patients ||
        result?.data?.bookings ||
        result?.data ||
        [];

      setCustomers(Array.isArray(list) ? list : []);
    } catch (error) {
      setCustomers([]);
      setPageError(error.message || "Unable to load bookings.");
    } finally {
      setLoadingCustomers(false);
    }
  }, [role, selectedDate, selectedSlot]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  useEffect(() => {
    loadCustomers();
  }, [loadCustomers]);

  const loadTodayCustomers = useCallback(async () => {
    setLoadingToday(true);

    try {
      const params = new URLSearchParams({
        role,
        date: getLocalDate(),
      });

      const response = await fetch(
        `${API.customers}?${params.toString()}`,
        {
          method: "GET",
          cache: "no-store",
          headers: { Accept: "application/json" },
        }
      );

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          result?.error || "Unable to load today's patients."
        );
      }

      const list =
        result?.customers ||
        result?.patients ||
        result?.bookings ||
        result?.data?.customers ||
        result?.data?.patients ||
        result?.data?.bookings ||
        result?.data ||
        [];

      setTodayCustomers(Array.isArray(list) ? list : []);
    } catch (error) {
      toast.error(error.message || "Unable to load today's patients.");
    } finally {
      setLoadingToday(false);
    }
  }, [role]);

  useEffect(() => {
    loadTodayCustomers();
  }, [loadTodayCustomers]);

  useEffect(() => {
    loadTodaySessionStates();
  }, [loadTodaySessionStates]);

  async function startCheckup(customer) {
    const id =
      customer?._id ||
      customer?.id ||
      customer?.bookingId;

    if (!id) {
      toast.error("Booking ID is missing.");
      return;
    }

    if (getCustomerStatus(customer) !== "waiting") return;

    const customerSession = getCustomerSession(customer);
    const normalizeSession = (value) => String(value || "").replace(/\s+/g, "").toLowerCase();
    const matchingSlot = todaySlots.find((slot) =>
      [slot.value, slot.label, `${slot.open}-${slot.close}`]
        .map(normalizeSession).includes(normalizeSession(customerSession))
    );
    if (isDoctor && matchingSlot && getSessionState(matchingSlot) !== "active") {
      toast.error(getSessionState(matchingSlot) === "closed"
        ? "This session is closed."
        : "Start today's checkup session before starting a patient's checkup.");
      return;
    }

    setUpdatingCustomerId(String(id));

    try {
      const response = await fetch(API.customers, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          bookingId: String(id),
          status: "serving",
          role,
          date: todayDate,
        }),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(result?.error || "Unable to start checkup.");
      }

      await loadTodayCustomers();
      await loadCustomers();
      toast.success("Checkup started.");
    } catch (error) {
      toast.error(error.message || "Unable to start checkup.");
    } finally {
      setUpdatingCustomerId("");
    }
  }

  async function completeCheckup() {
    const customer = confirmComplete;
    if (!customer) return;

    const id =
      customer?._id ||
      customer?.id ||
      customer?.bookingId;

    if (!id) {
      toast.error("Booking ID is missing.");
      return;
    }

    setUpdatingCustomerId(String(id));

    try {
      const response = await fetch(API.customers, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          bookingId: String(id),
          status: "completed",
          role,
          date: todayDate,
        }),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(result?.error || "Unable to complete checkup.");
      }

      setConfirmComplete(null);
      await loadTodayCustomers();
      await loadCustomers();
      toast.success("Patient checkup marked as complete.");
    } catch (error) {
      toast.error(error.message || "Unable to complete checkup.");
    } finally {
      setUpdatingCustomerId("");
    }
  }



const isSelectedDateHoliday = useMemo(() => {
    const holidayList = profile?.holidays || profile?.holidayDates || [];
    return isHolidayDate(selectedDate, holidayList);
  }, [selectedDate, profile?.holidays, profile?.holidayDates]);

  const slots = useMemo(() => {
    // If doctor is on holiday, return no slots
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

const isBookingDateHoliday = useMemo(() => {
    const holidayList = profile?.holidays || profile?.holidayDates || [];
    return isHolidayDate(bookingForm.date, holidayList);
  }, [bookingForm.date, profile?.holidays, profile?.holidayDates]);

  const modalSlots = useMemo(() => {
    if (!bookingForm.date || isBookingDateHoliday) return [];

    const dayName = getDayName(bookingForm.date);

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

    return daySlots
      .map(normalizeSlot)
      .filter((slot) => slot.value);
  }, [schedule, bookingForm.date, isBookingDateHoliday]);

  useEffect(() => {
    if (!slots.length) {
      setSelectedSlot("");
      return;
    }

    setSelectedSlot((previous) =>
      previous && slots.some((slot) => slot.value === previous)
        ? previous
        : slots[0].value
    );
  }, [slots]);


  useEffect(() => {
  if (!bookingModalOpen) return;

  setBookingForm((prev) => {
    const slotStillAvailable = modalSlots.some(
      (slot) => slot.value === prev.slot
    );

    const nextSlot = slotStillAvailable
      ? prev.slot
      : modalSlots[0]?.value || "";

    if (prev.slot === nextSlot) return prev;

    return {
      ...prev,
      slot: nextSlot,
    };
  });
}, [bookingModalOpen, modalSlots]);

  // Open patient booking modal pre-populated with active/selected slot
  function handleOpenBookingModal() {
    setBookingForm({
      patientName: "",
      phone: "",
      gender: "Male",
      priority: "normal",
      date: selectedDate || getLocalDate(),
      slot: selectedSlot || slots[0]?.value || "",
    });
    setBookingModalOpen(true);
  }

  
async function handleBookPatient(e) {
  e.preventDefault();

  if (!bookingForm.date) {
    toast.error("Please select a booking date.");
    return;
  }

  if (bookingForm.date < todayDate) {
    toast.error("Past dates cannot be selected.");
    return;
  }

  const selectedSlot = modalSlots.find(
    (slot) => slot.value === bookingForm.slot
  );

  if (!selectedSlot) {
    toast.error("Please select a valid session for the chosen date.");
    return;
  }

  if (!bookingForm.patientName?.trim()) {
    toast.error("Please enter patient name.");
    return;
  }

  setBookingLoading(true);

  try {
    const payload = {
      role,

      // Appointment details
      date: bookingForm.date,
      time:
        selectedSlot.time ||
        selectedSlot.checkupStartTime ||
        selectedSlot.checkupStart ||
        selectedSlot.open ||
        bookingForm.slot,

      slot: {
        open: selectedSlot.open || "",
        close: selectedSlot.close || "",
        checkupStartTime:
          selectedSlot.checkupStartTime ||
          selectedSlot.checkupStart ||
          selectedSlot.open ||
          "",
      },

      // Patient details
      patient: {
        name: bookingForm.patientName.trim(),
        type: "walk-in",
        gender: bookingForm.gender || "",
        ...(bookingForm.age !== undefined &&
        bookingForm.age !== ""
          ? { age: Number(bookingForm.age) }
          : {}),
      },

      phone: bookingForm.phone?.trim() || "",
      priority: bookingForm.priority || "normal",
      isEmergency: bookingForm.priority === "emergency",

      serviceName: "Consultation",
      service: "General Consultation",
    };

    const response = await fetch(API.customers, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      cache: "no-store",
      body: JSON.stringify(payload),
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(
        result?.error ||
          result?.message ||
          "Failed to book appointment."
      );
    }

    toast.success("Patient booked successfully!");

    setBookingModalOpen(false);

    await Promise.all([
      loadCustomers(),
      loadTodayCustomers(),
    ]);
  } catch (err) {
    toast.error(
      err.message || "Failed to book appointment."
    );
  } finally {
    setBookingLoading(false);
  }
}


  const filteredCustomers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return customers.filter((customer) => {
      const status = getCustomerStatus(customer);

      if (statusFilter !== "all" && status !== statusFilter) {
        return false;
      }

      if (!query) return true;

      const searchable = [
        getCustomerName(customer),
        getCustomerPhone(customer),
        getCustomerToken(customer),
        customer?.bookingReference,
        customer?.reference,
        customer?.status,
        customer?.service,
        customer?.serviceName,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchable.includes(query);
    });
  }, [customers, searchQuery, statusFilter]);

  const stats = useMemo(() => {
    return {
      total: customers.length,
      waiting: customers.filter(
        (customer) => getCustomerStatus(customer) === "waiting"
      ).length,
      serving: customers.filter(
        (customer) => getCustomerStatus(customer) === "serving"
      ).length,
      completed: customers.filter(
        (customer) => getCustomerStatus(customer) === "completed"
      ).length,
    };
  }, [customers]);

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

    const confirmed = window.confirm("Are you sure you want to log out?");
    if (!confirmed) return;

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
    setNotice("");
  }

  const firstName = profile?.name?.trim()
    ? profile.name.trim().replace(/^Dr\.?\s*/i, "").split(/\s+/)[0]
    : "";

  const welcomeName = firstName
    ? `${isDoctor ? "Dr. " : ""}${firstName}`
    : "";

  const navItems = [
    {
      id: "overview",
      label: "Overview",
      icon: LayoutDashboard,
    },
    {
      id: "bookings",
      label: isDoctor ? "Patient queue" : "Bookings",
      icon: Users,
    },
    ...(isDoctor
      ? [
          {
            id: "today-checkup",
            label: "Today's Checkup",
            icon: Stethoscope,
          },
        ]
      : []),
    {
      id: "profile",
      label: "My profile",
      icon: UserRound,
    },
  ];

  if (loadingInitial && !profile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-100 text-violet-700">
            <LoaderCircle className="animate-spin" size={27} />
          </div>
          <p className="mt-4 text-sm font-semibold text-slate-700">
            Preparing your dashboard...
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Loading your profile and schedule
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f7f8fc] text-slate-800">
      {mobileMenuOpen && (
        <button
          type="button"
          aria-label="Close navigation menu"
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-[2px] lg:hidden"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[260px] flex-col border-r border-slate-200/70 bg-white transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-[70px] shrink-0 items-center justify-between border-b border-slate-100 px-5">
          <button
            type="button"
            onClick={() => navigate("overview")}
            className="flex min-w-0 items-center gap-3 rounded-lg text-left"
          >
            <Image
              src="/logo.png"
              alt="Zeriy"
              width={42}
              height={42}
              priority
              className="h-9 w-9 shrink-0 rounded-lg object-contain sm:h-10 sm:w-10 sm:rounded-xl"
            />

            <div className="min-w-0">
              <p className="text-lg font-extrabold tracking-tight text-slate-900">
                Zeriy
              </p>
              <p className="text-[11px] font-medium text-slate-500">
                {roleLabel} workspace
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Close navigation"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 lg:hidden"
          >
            <X size={19} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3">
          <p className="px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
            MENU
          </p>

          <nav className="mt-3 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = activeView === item.id;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => navigate(item.id)}
                  aria-current={active ? "page" : undefined}
                  className={`group relative flex min-h-11 w-full items-center gap-3 rounded-xl px-3.5 py-3 text-left text-[13px] font-semibold transition-all duration-200 ${
                    active
                      ? "bg-violet-50 text-violet-700"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  }`}
                >
                  {active && (
                    <span className="absolute bottom-2.5 left-0 top-2.5 w-[3px] rounded-r-full bg-violet-600" />
                  )}

                  <Icon
                    size={19}
                    strokeWidth={active ? 2.2 : 1.8}
                    className={`shrink-0 ${
                      active
                        ? "text-violet-600"
                        : "text-slate-400 transition group-hover:text-slate-600"
                    }`}
                  />

                  <span className="min-w-0 flex-1">{item.label}</span>

                  {active && (
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-violet-600" />
                  )}
                </button>
              );
            })}
          </nav>

          <div className="mt-8">
            <p className="px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
              ACCOUNT
            </p>

            <div className="mt-3 rounded-2xl border border-slate-200/80 bg-slate-50/70 p-3">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-violet-100 text-violet-700">
                  {profile?.profileImage ? (
                    <img
                      src={profile.profileImage}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <UserRound size={20} />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-slate-900">
                    {profile?.name || `${roleLabel} account`}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-slate-500">
                    {profile?.email || roleLabel}
                  </p>
                </div>
              </div>

              {profile?.businessName && (
                <div className="mt-3 flex items-start gap-2 border-t border-slate-200/80 pt-3">
                  <BriefcaseMedical
                    size={14}
                    className="mt-0.5 shrink-0 text-violet-500"
                  />
                  <p className="break-words text-xs leading-5 text-slate-600">
                    {profile.businessName}
                  </p>
                </div>
              )}

              <button
                type="button"
                onClick={() => navigate("profile")}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-xs font-semibold text-slate-700 transition hover:border-violet-200 hover:text-violet-700"
              >
                <Pencil size={13} />
                Manage profile
                <ArrowRight size={13} className="ml-auto" />
              </button>
            </div>
          </div>
        </div>

        <div className="shrink-0 border-t border-slate-100 bg-white py-2 px-4">
          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-semibold text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loggingOut ? (
              <LoaderCircle size={18} className="shrink-0 animate-spin" />
            ) : (
              <LogOut size={18} className="shrink-0" />
            )}
            {loggingOut ? "Signing out..." : "Log out"}
          </button>
        </div>
      </aside>

      <div className="min-h-screen lg:pl-[260px]">
        <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl">
          <div className="flex h-[68px] items-center justify-between gap-3 px-4 sm:px-6 lg:h-[69px] lg:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-600 transition hover:bg-slate-50 lg:hidden"
                aria-label="Open navigation"
              >
                <Menu size={20} />
              </button>

              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-slate-900 sm:text-base">
                  {activeView === "overview"
                    ? "Overview"
                    : activeView === "bookings"
                      ? isDoctor
                        ? "Patient queue"
                        : "Bookings"
                      : activeView === "today-checkup"
                        ? "Today's Checkup"
                        : "My profile"}
                </p>
                <p className="hidden text-xs text-slate-500 sm:block">
                  {formatDate(selectedDate)}
                </p>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-4 sm:gap-5">
  {/* Book for Patient */}
  <button
    type="button"
    onClick={handleOpenBookingModal}
    title="Book for Patient"
    aria-label="Book for Patient"
    className="group relative flex h-9 w-9 sm:w-auto items-center justify-center gap-1.5 rounded-xl bg-violet-600 px-0 sm:px-3.5 text-xs font-semibold text-white shadow-sm transition hover:bg-violet-700"
  >
    <Plus size={16} />

    <span className="hidden sm:inline">Book for Patient</span>

    {/* Tooltip for mobile */}
    <span className="pointer-events-none absolute right-0 top-full z-50 mt-2 whitespace-nowrap rounded-lg bg-slate-900 px-3 py-2 text-xs font-medium text-white opacity-0 shadow-lg transition-opacity duration-200 group-hover:opacity-100 sm:hidden">
      Book for Patient
    </span>
  </button>

  {/* Refresh */}
  <button
    type="button"
    onClick={handleRefresh}
    disabled={refreshing || loadingSchedule || loadingCustomers}
    title="Refresh dashboard"
    aria-label="Refresh dashboard"
    className="group relative flex h-9 w-9 sm:w-auto items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-0 sm:px-3 text-sm font-semibold text-slate-600 transition hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700 disabled:opacity-50"
  >
    <RefreshCw
      size={16}
      className={
        refreshing || loadingSchedule || loadingCustomers
          ? "animate-spin"
          : ""
      }
    />

    <span className="hidden sm:inline">Refresh</span>

    {/* Tooltip for mobile */}
    <span className="pointer-events-none absolute right-0 top-full z-50 mt-2 whitespace-nowrap rounded-lg bg-slate-900 px-3 py-2 text-xs font-medium text-white opacity-0 shadow-lg transition-opacity duration-200 group-hover:opacity-100 sm:hidden">
      Refresh dashboard
    </span>
  </button>
</div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1600px] space-y-6 px-4 py-5 sm:px-6 sm:py-7 lg:space-y-8 lg:px-8 lg:py-8">
          {pageError && (
            <div className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
              <AlertCircle className="mt-0.5 shrink-0" size={18} />
              <div className="min-w-0 flex-1">
                <p className="font-semibold">Something needs your attention</p>
                <p className="mt-1 break-words leading-6">{pageError}</p>
              </div>
              <button
                type="button"
                onClick={() => setPageError("")}
                className="shrink-0 rounded-lg p-1 hover:bg-rose-100"
                aria-label="Dismiss error"
              >
                <X size={17} />
              </button>
            </div>
          )}

          {notice && (
            <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
              <CheckCircle2 size={17} />
              {notice}
            </div>
          )}

          {isDoctor && activeView === "today-checkup" && (
            <section className="space-y-6">
              <SectionHeading
                eyebrow="DOCTOR WORKSPACE"
                title="Today's Checkup"
                description="Manage patient checkups session by session. Emergency patients receive the highest priority."
              />

              {todaySlots.length > 0 && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100 text-violet-700">
                        <CalendarDays size={20} />
                      </div>
                      <div>
                        <p className="text-xs font-medium text-slate-500">
                          Today's sessions
                        </p>
                        <p className="mt-1 text-2xl font-bold text-slate-900">
                          {todaySlots.length}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-red-100 bg-white p-4 shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 text-red-600">
                        <AlertCircle size={20} />
                      </div>
                      <div>
                        <p className="text-xs font-medium text-slate-500">
                          Emergency patients
                        </p>
                        <p className="mt-1 text-2xl font-bold text-red-600">
                          {todaySlots.reduce(
                            (total, slot) =>
                              total +
                              getTodaySessionPatients(slot).filter(
                                (patient) => getPriorityRank(patient) === 0
                              ).length,
                            0
                          )}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-amber-100 bg-white p-4 shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                        <Users size={20} />
                      </div>
                      <div>
                        <p className="text-xs font-medium text-slate-500">
                          Total booked patients
                        </p>
                        <p className="mt-1 text-2xl font-bold text-slate-900">
                          {todaySlots.reduce(
                            (total, slot) =>
                              total + getTodaySessionPatients(slot).length,
                            0
                          )}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {todaySlots.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-12 text-center">
                  <div className={`mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-500
                    ${todaySlots.length === 0 ?"hidden":"block"} 
                    `}>
                    <CalendarDays size={26} />
                  </div>
                  <div className="mt-4">
                    <EmptyState
                      title="No sessions scheduled today"
                      description="There are no sessions configured for today. Check your weekly schedule."
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  {todaySlots.map((slot, index) => {
                    const sessionId = String(slot.value);
                    const sessionStatus = getSessionState(slot);
                    const patients = sortTodayPatients(getTodaySessionPatients(slot));

                    const hasPatientInCheckup = patients.some(
                      (patient) => getCustomerStatus(patient) === "serving"
                    );
                    const emergencyCount = patients.filter(
                      (patient) => getPriorityRank(patient) === 0
                    ).length;
                  
                    const busy = updatingSessionId === sessionId;
                    const capacity = Number(slot.capacity);
                    const hasCapacity =
                      slot.capacity !== null &&
                      slot.capacity !== undefined &&
                      slot.capacity !== "" &&
                      Number.isFinite(capacity) &&
                      capacity > 0;
                    const capacityPercent = hasCapacity
                      ? Math.min(100, (patients.length / capacity) * 100)
                      : 0;

                    return (
                      <section
                        key={`${sessionId}-${index}`}
                        className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md"
                      >
                        <div className="border-b border-slate-200 bg-gradient-to-br from-violet-50 via-white to-white p-4 sm:p-6">
                          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-3">
                                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-violet-100 text-violet-700 ring-1 ring-violet-200">
                                  <CalendarCheck size={23} />
                                </div>

                                <div className="min-w-0">
                                  <p className="text-xs font-semibold uppercase tracking-wider text-violet-600">
                                    Session {index + 1}
                                  </p>
                                  <h3 className="mt-1 break-words text-lg font-bold text-slate-900 sm:text-xl">
                                    {slot.label}
                                  </h3>
                                </div>

                                <span
                                  className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold ${
                                    sessionStatus === "active"
                                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                      : sessionStatus === "closed"
                                        ? "border-slate-200 bg-slate-100 text-slate-600"
                                        : "border-amber-200 bg-amber-50 text-amber-700"
                                  }`}
                                >
                                  <span
                                    className={`h-2 w-2 rounded-full ${
                                      sessionStatus === "active"
                                        ? "bg-emerald-500"
                                        : sessionStatus === "closed"
                                          ? "bg-slate-400"
                                          : "bg-amber-500"
                                    }`}
                                  />
                                  {sessionStatus === "active"
                                    ? "Session active"
                                    : sessionStatus === "closed"
                                      ? "Session closed"
                                      : "Not started"}
                                </span>
                              </div>

                              <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
                                <div className="rounded-xl border border-slate-200/80 bg-white p-4">
                                  <div className="flex items-center gap-2 text-slate-500">
                                    <Clock3 size={15} />
                                    <p className="text-xs font-medium">Session time</p>
                                  </div>
                                  <p className="mt-2 text-sm font-bold text-slate-900">
                                    {formatTime(slot.open)} – {formatTime(slot.close)}
                                  </p>
                                </div>

                                <div className="rounded-xl border border-emerald-100 bg-white p-4">
                                  <div className="flex items-center gap-2 text-emerald-600">
                                    <Stethoscope size={15} />
                                    <p className="text-xs font-medium">
                                      Checkup starts
                                    </p>
                                  </div>
                                  <p className="mt-2 text-sm font-bold text-slate-900">
                                    {formatTime(todayCheckupStart(slot))}
                                  </p>
                                </div>

                                <div className="rounded-xl border border-slate-200/80 bg-white p-4">
                                  <div className="flex items-center gap-2 text-slate-500">
                                    <Users size={15} />
                                    <p className="text-xs font-medium">
                                      Patient capacity
                                    </p>
                                  </div>
                                  <p className="mt-2 text-sm font-bold text-slate-900">
                                    {patients.length}
                                    <span className="font-medium text-slate-400">
                                      {" "}
                                      / {hasCapacity ? capacity : "Unlimited"}
                                    </span>
                                  </p>

                                  {hasCapacity && (
                                    <div
                                      className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100"
                                      role="progressbar"
                                      aria-label="Session capacity"
                                      aria-valuemin={0}
                                      aria-valuemax={capacity}
                                      aria-valuenow={Math.min(
                                        patients.length,
                                        capacity
                                      )}
                                    >
                                      <div
                                        className={`h-full rounded-full transition-all ${
                                          capacityPercent >= 100
                                            ? "bg-red-500"
                                            : capacityPercent >= 80
                                              ? "bg-amber-500"
                                              : "bg-violet-500"
                                        }`}
                                        style={{
                                          width: `${capacityPercent}%`,
                                        }}
                                      />
                                    </div>
                                  )}
                                </div>
                              </div>

                              <div className="mt-4 flex flex-wrap gap-2">
                                <span className="inline-flex items-center gap-2 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
                                  <AlertCircle size={15} />
                                  Emergency
                                  <span className="rounded-md bg-white px-2 py-0.5 font-bold">
                                    {emergencyCount}
                                  </span>
                                </span>

                              

                                <span className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600">
                                  <Users size={15} />
                                  Other patients
                                  <span className="rounded-md bg-slate-100 px-2 py-0.5 font-bold">
                                    {patients.length -
                                      emergencyCount
                                    }
                                  </span>
                                </span>
                              </div>
                            </div>

                            <div className="flex w-full flex-col gap-2 xl:w-72 xl:shrink-0">
                              {sessionStatus !== "closed" ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    sessionStatus === "active"
                                      ? closeTodaySession(slot)
                                      : startTodaySession(slot)
                                  }
                                  disabled={Boolean(updatingSessionId)}
                                  className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-50 ${
                                    sessionStatus === "active"
                                      ? "bg-amber-600 hover:bg-amber-700"
                                      : "bg-violet-600 hover:bg-violet-700"
                                  }`}
                                >
                                  {busy ? (
                                    <LoaderCircle size={17} className="animate-spin" />
                                  ) : sessionStatus === "active" ? (
                                    <CheckCircle2 size={17} />
                                  ) : (
                                    <Stethoscope size={17} />
                                  )}

                                  {sessionStatus === "active"
                                    ? "Close Session"
                                    : "Start Checkup Session"}
                                </button>
                              ) : (
                                <div className="rounded-xl border border-slate-200 bg-slate-100 px-4 py-3 text-center text-sm font-semibold text-slate-600">
                                  Today's session is closed
                                </div>
                              )}

                              {sessionStatus !== "closed" && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (
                                      window.confirm(
                                        "Close today's session and cancel all remaining waiting bookings for this session? Patients will be notified."
                                      )
                                    ) {
                                      closeTodaySessionAndCancelBookings(slot);
                                    }
                                  }}
                                  disabled={Boolean(updatingSessionId)}
                                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-3 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  <AlertCircle size={17} />
                                  Close Today's Session & Cancel Bookings
                                </button>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-col gap-3 border-b border-slate-100 bg-slate-50/70 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                          <div>
                            <h4 className="font-bold text-slate-900">
                              Patient queue
                            </h4>
                            <p className="mt-1 text-xs text-slate-500">
                              Emergency patients first and other patients.
                            </p>
                          </div>

                          <span className="inline-flex w-fit items-center rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600">
                            {patients.length}{" "}
                            {patients.length === 1 ? "patient" : "patients"}
                          </span>
                        </div>

                        {loadingToday ? (
                          <div className="flex min-h-44 flex-col items-center justify-center gap-3 p-8">
                            <LoaderCircle
                              size={27}
                              className="animate-spin text-violet-600"
                            />
                            <p className="text-sm font-medium text-slate-500">
                              Loading patients...
                            </p>
                          </div>
                        ) : patients.length === 0 ? (
                          <div className="px-4 py-8 sm:px-6">
                            <EmptyState
                              title="No patients in this session"
                              description="Patients booked for this session will appear here."
                            />
                          </div>
                        ) : (
                          <div className="divide-y divide-slate-100">
                            {patients.map((customer, patientIndex) => {
                              const id =
                                customer?._id ||
                                customer?.id ||
                                customer?.bookingId ||
                                `${getCustomerToken(customer)}-${patientIndex}`;

                              const status = getCustomerStatus(customer);
                              const priority = getPriorityRank(customer);
                              const isUpdating =
                                updatingCustomerId === String(id);
                              const customerName =
                                getCustomerName(customer) || "Unknown patient";
                              const token = getCustomerToken(customer) || "—";
                              const phone = getCustomerPhone(customer);

                              return (
                                <div
                                  key={String(id)}
                                  className={`flex flex-col gap-4 border-b border-slate-100 border-l-4 px-4 py-5 transition-colors last:border-b-0 sm:px-6 lg:flex-row lg:items-center lg:justify-between ${
                                    priority === 0
                                      ? "border-l-red-500 bg-red-50/60"
                                      : priority === 1
                                        ? "border-l-amber-400 bg-amber-50/40"
                                        : status === "serving"
                                          ? "border-l-emerald-500 bg-emerald-50/40"
                                          : status === "completed"
                                            ? "border-l-slate-300 bg-slate-50/70"
                                            : "border-l-transparent hover:bg-violet-50/40"
                                  }`}
                                >
                                  <div className="flex min-w-0 items-start gap-3 sm:gap-4">
                                    <div
                                      className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl font-bold ring-1 ${
                                        priority === 0
                                          ? "bg-red-100 text-red-700 ring-red-200"
                                          : priority === 1
                                            ? "bg-amber-100 text-amber-700 ring-amber-200"
                                            : status === "serving"
                                              ? "bg-emerald-100 text-emerald-700 ring-emerald-200"
                                              : "bg-violet-100 text-violet-700 ring-violet-200"
                                      }`}
                                    >
                                      {priority === 0 ? (
                                        <AlertCircle size={22} />
                                      ) : (
                                        customerName.charAt(0).toUpperCase()
                                      )}
                                    </div>

                                    <div className="min-w-0 flex-1">
                                      <div className="flex flex-wrap items-center gap-2">
                                        <h5 className="break-words font-bold text-slate-900">
                                          {customerName}
                                        </h5>

                                        {priority === 0 && (
                                          <span className="rounded-md border border-red-200 bg-red-100 px-2 py-1 text-[10px] font-extrabold tracking-wide text-red-700">
                                            EMERGENCY · P1
                                          </span>
                                        )}

                                        
                                      </div>

                                      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-500">
                                        <span className="inline-flex items-center gap-1.5 font-semibold text-slate-700">
                                          <Ticket size={14} />
                                          Token: {token}
                                        </span>

                                        {phone && (
                                          <span className="inline-flex items-center gap-1.5">
                                            <Phone size={14} />
                                            {phone}
                                          </span>
                                        )}
                                      </div>

                                      <div className="mt-3">
                                        <StatusBadge status={status} />
                                      </div>
                                    </div>
                                  </div>

                                  <div className="flex shrink-0 flex-col gap-2 lg:min-w-44 lg:items-end">
                                    {status === "waiting" && (
                                      <button
                                        type="button"
                                        onClick={() => startCheckup(customer)}
                                        disabled={
                                          Boolean(updatingCustomerId) ||
                                          Boolean(updatingSessionId) ||
                                          sessionStatus !== "active" ||
                                          hasPatientInCheckup
                                        }
                                        title={
                                          sessionStatus !== "active"
                                            ? "Start the session before starting checkups"
                                            : ""
                                        }
                                        className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 disabled:shadow-none lg:w-auto"
                                      >
                                        {isUpdating ? (
                                          <LoaderCircle
                                            size={16}
                                            className="animate-spin"
                                          />
                                        ) : (
                                          <Play size={16} />
                                        )}
                                        Start Checkup
                                      </button>
                                    )}

                                    {status === "serving" && (
                                      <button
                                        type="button"
                                        onClick={() => setConfirmComplete(customer)}
                                        disabled={
                                          Boolean(updatingCustomerId) ||
                                          Boolean(updatingSessionId)
                                        }
                                        className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 lg:w-auto"
                                      >
                                        <CheckCircle2 size={17} />
                                        Done
                                      </button>
                                    )}

                                    {status === "completed" && (
                                      <span className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm font-semibold text-emerald-700">
                                        <CheckCircle2 size={17} />
                                        Checkup completed
                                      </span>
                                    )}

                                    {status === "waiting" &&
                                      sessionStatus !== "active" && (
                                        <p className="text-center text-xs text-slate-500 lg:text-right">
                                          {sessionStatus === "closed"
                                            ? "Session closed"
                                            : "Waiting for session to start"}
                                        </p>
                                      )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </section>
                    );
                  })}
                </div>
              )}
            </section>
          )}

          {activeView === "overview" && (
            <>
              <section className="relative isolate overflow-hidden rounded-2xl bg-gradient-to-br from-violet-700 via-indigo-700 to-indigo-600 p-5 text-white shadow-lg shadow-indigo-200/50 sm:rounded-3xl sm:p-8 lg:p-9">
                <div className="pointer-events-none absolute -right-12 -top-24 -z-10 h-64 w-64 rounded-full bg-white/10 blur-2xl" />
                <div className="pointer-events-none absolute -bottom-24 right-1/4 -z-10 h-48 w-48 rounded-full bg-violet-300/20 blur-2xl" />

                <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 max-w-2xl">
                    <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white/90">
                      <span className="h-2 w-2 rounded-full bg-emerald-300" />
                      {roleLabel} workspace
                    </div>

                    <h1 className="mt-5 text-2xl font-extrabold leading-tight tracking-tight sm:text-3xl lg:text-4xl">
                      Welcome back{welcomeName ? `, ${welcomeName}` : ""}!
                    </h1>

                    <p className="mt-3 max-w-xl text-sm leading-6 text-indigo-100 sm:text-base">
                      {isDoctor
                        ? "Here is your patient queue and daily overview. Stay organized and keep your schedule running smoothly."
                        : "Here is your daily overview. Manage bookings, track customer progress, and keep your workspace organized."}
                    </p>

                    <button
                      type="button"
                      onClick={() => navigate("bookings")}
                      className="mt-5 inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-bold text-indigo-700 shadow-sm transition hover:bg-indigo-50"
                    >
                      View {isDoctor ? "patient queue" : "bookings"}
                      <ArrowRight size={16} />
                    </button>
                  </div>

                  <div className="hidden shrink-0 items-center justify-center sm:flex">
                    <div className="flex h-28 w-28 items-center justify-center rounded-[28px] border border-white/20 bg-white/10 shadow-inner backdrop-blur-sm lg:h-36 lg:w-36">
                      {isDoctor ? (
                        <Stethoscope
                          className="text-white/90"
                          size={60}
                          strokeWidth={1.4}
                        />
                      ) : (
                        <BriefcaseMedical
                          className="text-white/90"
                          size={60}
                          strokeWidth={1.4}
                        />
                      )}
                    </div>
                  </div>
                </div>
              </section>

              <section className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
                <StatCard
                  title="Total bookings"
                  value={stats.total}
                  description="For the selected session"
                  icon={CalendarCheck}
                  color="violet"
                />
                <StatCard
                  title="Waiting"
                  value={stats.waiting}
                  description="Awaiting their turn"
                  icon={Clock3}
                  color="amber"
                />
                <StatCard
                  title="In progress"
                  value={stats.serving}
                  description="Currently being served"
                  icon={Activity}
                  color="blue"
                />
                <StatCard
                  title="Completed"
                  value={stats.completed}
                  description="Successfully completed"
                  icon={CheckCircle2}
                  color="green"
                />
              </section>

              <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm sm:rounded-3xl sm:p-6">
                <SectionHeading
                  eyebrow="Daily schedule"
                  title="Your sessions"
                  description="Choose a date and scheduled session to view the relevant bookings."
                  action={
                    <span className="inline-flex w-fit items-center gap-2 rounded-full bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-700">
                      <CalendarDays size={14} />
                      {formatDate(selectedDate)}
                    </span>
                  }
                />

                <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label="Select date">
                    <input
                      type="date"
                      className={inputClass}
                      value={selectedDate}
                      onChange={(event) => {
                        setSelectedDate(event.target.value);
                        setSearchQuery("");
                      }}
                    />
                  </Field>

                  <Field label="Scheduled session">
                    <div className="relative">
                      <select
                        className={`${inputClass} appearance-none pr-10`}
                        value={selectedSlot}
                        onChange={(event) =>
                          setSelectedSlot(event.target.value)
                        }
                      >
                        {slots.length === 0 && (
                          <option value="">No sessions available</option>
                        )}

                        {slots.map((slot) => (
                          <option key={slot.value} value={slot.value}>
                            {slot.label}
                          </option>
                        ))}
                      </select>
                      <ChevronDown
                        size={17}
                        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                      />
                    </div>
                  </Field>
                </div>

            <div className="mt-5 flex flex-col gap-3 rounded-xl bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
  <div className="flex items-start gap-3">
    <div
      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl shadow-sm ${
        isSelectedDateHoliday
          ? "bg-amber-100 text-amber-700"
          : "bg-white text-violet-600"
      }`}
    >
      {isSelectedDateHoliday ? (
        <CalendarDays size={19} />
      ) : (
        <Clock3 size={19} />
      )}
    </div>

    <div>
      <p className="text-sm font-semibold text-slate-800">
        {isSelectedDateHoliday
          ? "Doctor is on Holiday"
          : selectedSlot || "No session selected"}
      </p>

      <p className="mt-1 text-xs text-slate-500">
        {isSelectedDateHoliday
          ? "The doctor is unavailable on this date."
          : slots.length
            ? `${slots.length} session${slots.length === 1 ? "" : "s"} available on this day`
            : "No sessions configured for this day of the week."}
      </p>
    </div>
  </div>

  {!isSelectedDateHoliday && slots.length > 0 && (
    <button
      type="button"
      onClick={() => navigate("bookings")}
      className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-violet-200 hover:text-violet-700"
    >
      Open queue
      <ArrowRight size={15} />
    </button>
  )}
 

                
                </div>
              </section>

              <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm sm:rounded-3xl">
                <div className="p-4 sm:p-6">
                  <SectionHeading
                    eyebrow="Latest activity"
                    title={isDoctor ? "Patient queue" : "Recent bookings"}
                    description="Bookings associated with your selected date and session."
                    action={
                      <button
                        type="button"
                        onClick={() => navigate("bookings")}
                        className="inline-flex items-center gap-1.5 text-sm font-semibold text-violet-700 hover:text-violet-800"
                      >
                        View all
                        <ArrowRight size={15} />
                      </button>
                    }
                  />
                </div>

                {loadingCustomers ? (
                  <div className="flex items-center justify-center gap-2 px-4 py-12 text-sm text-slate-500">
                    <LoaderCircle
                      size={18}
                      className="animate-spin text-violet-600"
                    />
                    Loading bookings...
                  </div>
                ) : customers.length === 0 ? (
                  <EmptyState
                    title="No bookings found"
                    description="Bookings will appear here when they are available for the selected date and session."
                  />
                ) : (
                  <div className="divide-y divide-slate-100">
                    {customers.slice(0, 5).map((customer, index) => (
                      <div
                        key={
                          customer?._id ||
                          customer?.id ||
                          customer?.bookingId ||
                          `${getCustomerToken(customer)}-${index}`
                        }
                        className="flex items-center gap-3 px-4 py-4 transition hover:bg-slate-50/80 sm:px-6"
                      >
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-sm font-bold text-violet-700">
                          {getCustomerName(customer)
                            .charAt(0)
                            .toUpperCase()}
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-slate-800">
                            {getCustomerName(customer)}
                          </p>
                          <p className="mt-1 truncate text-xs text-slate-500">
                            Token: {getCustomerToken(customer)}
                            {getCustomerPhone(customer)
                              ? ` · ${getCustomerPhone(customer)}`
                              : ""}
                          </p>
                        </div>

                        <div className="shrink-0">
                          <StatusBadge status={customer?.status} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </>
          )}

          {activeView === "bookings" && (
            <section className="space-y-5">
              <SectionHeading
                eyebrow={isDoctor ? "Patient management" : "Booking management"}
                title={isDoctor ? "Patient queue" : "Bookings"}
                description="Search bookings and filter them by their current status."
              />

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Date">
                  <input
                    type="date"
                    className={inputClass}
                    value={selectedDate}
                    onChange={(event) => setSelectedDate(event.target.value)}
                  />
                </Field>

                <Field label="Session">
                  <div className="relative">
                    <select
                      className={`${inputClass} appearance-none pr-10`}
                      value={selectedSlot}
                      onChange={(event) =>
                        setSelectedSlot(event.target.value)
                      }
                    >
                      {slots.length === 0 && (
                        <option value="">No sessions available</option>
                      )}
                      {slots.map((slot) => (
                        <option key={slot.value} value={slot.value}>
                          {slot.label}
                        </option>
                      ))}
                    </select>
                    <ChevronDown
                      size={17}
                      className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                    />
                  </div>
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  { label: "All", value: "all", count: customers.length },
                  { label: "Waiting", value: "waiting", count: stats.waiting },
                  {
                    label: "In progress",
                    value: "serving",
                    count: stats.serving,
                  },
                  {
                    label: "Completed",
                    value: "completed",
                    count: stats.completed,
                  },
                ].map((item) => (
                  <button
                    type="button"
                    key={item.value}
                    onClick={() => setStatusFilter(item.value)}
                    className={`rounded-2xl border p-3 text-left transition sm:p-4 ${
                      statusFilter === item.value
                        ? "border-violet-300 bg-violet-50 shadow-sm"
                        : "border-slate-200 bg-white hover:border-slate-300"
                    }`}
                  >
                    <p className="text-xs font-medium text-slate-500">
                      {item.label}
                    </p>
                    <p className="mt-1 text-xl font-bold text-slate-900">
                      {item.count}
                    </p>
                  </button>
                ))}
              </div>

              <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm sm:rounded-3xl">
                <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
                  <div>
                    <h3 className="font-bold text-slate-900">
                      Booking records
                    </h3>
                    <p className="mt-1 text-xs text-slate-500">
                      {filteredCustomers.length} result
                      {filteredCustomers.length === 1 ? "" : "s"}
                    </p>
                  </div>

                  <div className="relative w-full sm:max-w-xs">
                    <Search
                      size={17}
                      className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                    />
                    <input
                      className={`${inputClass} pl-10`}
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                      placeholder="Search name, phone, token..."
                      aria-label="Search bookings"
                    />
                  </div>
                </div>

                {loadingCustomers ? (
                  <div className="flex items-center justify-center gap-2 px-4 py-14 text-sm text-slate-500">
                    <LoaderCircle
                      size={18}
                      className="animate-spin text-violet-600"
                    />
                    Loading bookings...
                  </div>
                ) : filteredCustomers.length === 0 ? (
                  <EmptyState
                    title="No matching bookings"
                    description="Try changing the search text, date, session, or status filter."
                  />
                ) : (
                  <>
                    <div className="hidden overflow-x-auto md:block">
                      <table className="w-full min-w-[650px] text-left">
                        <thead>
                          <tr className="border-b border-slate-100 bg-slate-50/80">
                            <th className="px-5 py-3 text-xs font-semibold text-slate-500">
                              Customer
                            </th>
                            <th className="px-5 py-3 text-xs font-semibold text-slate-500">
                              Token / Reference
                            </th>
                              <th className="px-5 py-3 text-xs font-semibold text-slate-500">
                              Type
                            </th>
                            <th className="px-5 py-3 text-xs font-semibold text-slate-500">
                              Phone
                            </th>
                            <th className="px-5 py-3 text-xs font-semibold text-slate-500">
                              Gender
                            </th>
                            <th className="px-5 py-3 text-xs font-semibold text-slate-500">
                              Status
                            </th>
                          </tr>
                        </thead>

                        <tbody className="divide-y divide-slate-100">
                          {filteredCustomers.map((customer, index) => (
                            <tr
                              key={
                                customer?._id ||
                                customer?.id ||
                                customer?.bookingId ||
                                `${getCustomerToken(customer)}-${index}`
                              }
                              className="transition hover:bg-slate-50/70"
                            >
                              <td className="px-5 py-4">
                                <div className="flex items-center gap-3">
                                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-sm font-bold text-violet-700">
                                    {getCustomerName(customer)
                                      .charAt(0)
                                      .toUpperCase()}
                                  </div>
                                  <div className="min-w-0">
                                    <p className="max-w-56 truncate text-sm font-semibold text-slate-800">
                                      {getCustomerName(customer)}
                                    </p>
                                    {customer?.serviceName ||
                                    customer?.service ? (
                                      <p className="mt-1 max-w-56 truncate text-xs text-slate-500">
                                        {customer.serviceName ||
                                          customer.service}
                                      </p>
                                    ) : null}
                                  </div>
                                </div>
                              </td>

                              <td className="px-5 py-4 text-sm font-semibold text-slate-700">
                                {getCustomerToken(customer)}
                              </td>
<td className="px-5 py-4 text-sm text-slate-600 capitalize">
                                {getCustomerType(customer) || "—"}
                              </td>
                              <td className="px-5 py-4 text-sm text-slate-600">
                                {getCustomerPhone(customer) || "—"}
                              </td>
                              <td className="px-5 py-4 text-sm text-slate-600">
                                {getCustomerGender(customer) || "—"}
                              </td>
                              <td className="px-5 py-4">
                                <StatusBadge status={customer?.status} />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="divide-y divide-slate-100 md:hidden">
                      {filteredCustomers.map((customer, index) => (
                        <article
                          key={
                            customer?._id ||
                            customer?.id ||
                            customer?.bookingId ||
                            `${getCustomerToken(customer)}-${index}`
                          }
                          className="p-4"
                        >
                          
                          <div className="flex items-start gap-3">
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-sm font-bold text-violet-700">
                              {getCustomerName(customer)
                                .charAt(0)
                                .toUpperCase()}
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <h4 className="break-words text-sm font-bold text-slate-900">
                                    {getCustomerName(customer)}
                                  </h4>
                                  <p className="mt-1 text-xs text-slate-500">
                                    Token: {getCustomerToken(customer)}
                                  </p>
                                </div>
                                <StatusBadge status={customer?.status} />
                              </div>

                              {getCustomerPhone(customer) && (
                                <p className="mt-3 flex items-center gap-2 break-all text-xs text-slate-600">
                                  <Phone
                                    size={14}
                                    className="shrink-0 text-slate-400"
                                  />
                                  {getCustomerPhone(customer)}
                                </p>
                              )}

                              {(customer?.serviceName || customer?.service) && (
                                <p className="mt-2 text-xs text-slate-500">
                                  Service:{" "}
                                  {customer.serviceName || customer.service}
                                </p>
                              )}
                            </div>
                          </div>
                        </article>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </section>
          )}

          {activeView === "profile" && (
            <section className="space-y-5">
              <SectionHeading
                eyebrow="Account settings"
                title="My profile"
                description="Manage your personal information and professional details."
              />

              <TeamProfile
                role={role}
                profile={profile || {}}
                schedule={schedule || {}}
                onProfileChange={(nextProfile) => setProfile(nextProfile)}
                onScheduleChange={(nextSchedule) => setSchedule(nextSchedule)}
                onProfileSaved={() => {
                  setNotice("Profile, schedule, and services updated successfully.");
                  window.setTimeout(() => setNotice(""), 3500);
                }}
              />
            </section>
          )}

          {/* Book Patient Modal */}
        

{bookingModalOpen && (
  <div
    className="fixed h-screen inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-slate-950/60 p-3 backdrop-blur-sm"
  
  >
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="book-patient-title"
      className="my-auto flex max-h-[85dvh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
    >
      {/* Compact Header */}
      <div className="relative shrink-0 overflow-hidden border-b border-slate-100 bg-gradient-to-r from-violet-50 to-indigo-50 px-4 py-3.5">
        <div className="absolute -right-8 -top-10 h-24 w-24 rounded-full bg-violet-200/30 blur-2xl" />

        <div className="relative flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-600 text-white shadow-md shadow-violet-600/20">
              <UserPlus size={20} />
            </div>

            <div className="min-w-0">
              <h3
                id="book-patient-title"
                className="text-base font-bold tracking-tight text-slate-900"
              >
                Book for Patient
              </h3>
              <p className="mt-0.5 truncate text-xs text-slate-500">
                {profile?.name
                  ? `Doctor: ${profile.name}`
                  : "Create a patient appointment"}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setBookingModalOpen(false)}
            disabled={bookingLoading}
            aria-label="Close booking modal"
            className="shrink-0 rounded-lg p-2 text-slate-400 transition hover:bg-white hover:text-slate-700 disabled:opacity-50"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      <form
        onSubmit={handleBookPatient}
        className="flex min-h-0 flex-1 flex-col"
      >
        {/* Scrollable Form Content */}
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 py-4">

          {/* Patient Details */}
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="h-4 w-1 rounded-full bg-violet-600" />
              <h4 className="text-sm font-bold text-slate-800">
                Patient details
              </h4>
            </div>

            <Field label="Patient name *">
              <input
                className={`${inputClass} w-full`}
                value={bookingForm.patientName}
                onChange={(e) =>
                  setBookingForm((prev) => ({
                    ...prev,
                    patientName: e.target.value,
                  }))
                }
                placeholder="Enter patient's full name"
                autoComplete="name"
                disabled={bookingLoading}
                required
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Phone number">
                <input
                  className={`${inputClass} w-full min-w-0`}
                  value={bookingForm.phone}
                  onChange={(e) =>
                    setBookingForm((prev) => ({
                      ...prev,
                      phone: e.target.value,
                    }))
                  }
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="Mobile number"
                  disabled={bookingLoading}
                />
              </Field>

              <Field label="Gender">
                <select
                  className={`${inputClass} w-full appearance-none`}
                  value={bookingForm.gender}
                  onChange={(e) =>
                    setBookingForm((prev) => ({
                      ...prev,
                      gender: e.target.value,
                    }))
                  }
                  disabled={bookingLoading}
                >
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </Field>
            </div>
          </section>

          {/* Appointment Schedule */}
          <section className="space-y-3 rounded-xl border border-violet-100 bg-violet-50/60 p-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-violet-600 shadow-sm ring-1 ring-violet-100">
                <CalendarDays size={18} />
              </div>

              <div>
                <h4 className="text-sm font-bold text-slate-900">
                  Appointment schedule
                </h4>
                <p className="text-xs text-slate-500">
                  Select date and session
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <Field label="Appointment date *">
                <input
                  type="date"
                  className={`${inputClass} w-full bg-white`}
                  value={bookingForm.date}
                  min={todayDate}
                  onChange={(e) => {
                    const nextDate = e.target.value;

                    setBookingForm((prev) => ({
                      ...prev,
                      date: nextDate,
                      slot: "",
                    }));
                  }}
                  disabled={bookingLoading}
                  required
                />
              </Field>

              <Field label="Available session *">
                <select
                  className={`${inputClass} w-full appearance-none bg-white`}
                  value={bookingForm.slot}
                  onChange={(e) =>
                    setBookingForm((prev) => ({
                      ...prev,
                      slot: e.target.value,
                    }))
                  }
                  disabled={
                    bookingLoading || modalSlots.length === 0
                  }
                  required
                >
                  <option value="">
                    {modalSlots.length > 0
                      ? "Select a session"
                      : "No sessions available"}
                  </option>

                  {modalSlots.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

          <div
  className={`flex items-start gap-2 rounded-lg px-3 py-2 text-xs ${
    isBookingDateHoliday
      ? "bg-amber-50 text-amber-900 border border-amber-200"
      : modalSlots.length > 0
        ? "bg-white text-slate-600 border border-slate-100"
        : "bg-slate-100 text-slate-700"
  }`}
>
  <CalendarDays
    size={14}
    className={`mt-0.5 shrink-0 ${
      isBookingDateHoliday
        ? "text-amber-600"
        : modalSlots.length > 0
          ? "text-violet-600"
          : "text-slate-400"
    }`}
  />

  <p>
    {isBookingDateHoliday
      ? "Doctor is on holiday on this date. Please choose another date."
      : modalSlots.length > 0
        ? `${modalSlots.length} scheduled session${modalSlots.length === 1 ? "" : "s"} available for this weekday.`
        : "No scheduled sessions for this weekday. Please select another date."}
  </p>
</div>
          </section>

          {/* Patient Priority */}
          <section className="space-y-2.5">
            <div>
              <h4 className="text-sm font-bold text-slate-800">
                Patient priority
              </h4>
              <p className="mt-0.5 text-xs text-slate-500">
                Choose the appropriate category
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {[
                {
                  id: "normal",
                  label: "Normal",
                  description: "Standard",
                },
              
                {
                  id: "emergency",
                  label: "Emergency",
                  description: "Priority 1",
                },
              ].map((item) => {
                const active =
                  bookingForm.priority === item.id;

                const activeStyle =
                  item.id === "emergency"
                    ? "border-red-300 bg-red-50 text-red-800"
                    
                      : "border-violet-300 bg-violet-50 text-violet-800";

                return (
                  <button
                    key={item.id}
                    type="button"
                    disabled={bookingLoading}
                    onClick={() =>
                      setBookingForm((prev) => ({
                        ...prev,
                        priority: item.id,
                      }))
                    }
                    aria-pressed={active}
                    className={`min-w-0 rounded-lg border px-2 py-2.5 text-left transition ${
                      active
                        ? `${activeStyle} ring-1 ring-current/10`
                        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                    } disabled:cursor-not-allowed disabled:opacity-60`}
                  >
                    <span className="block truncate text-xs font-bold">
                      {item.label}
                    </span>
                    <span className="mt-1 block text-[10px] opacity-75">
                      {item.description}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        </div>

        {/* Fixed Compact Footer */}
        <div className="flex shrink-0 items-center justify-end gap-2 border-t border-slate-100 bg-white px-4 py-3">
          <button
            type="button"
            disabled={bookingLoading}
            onClick={() => setBookingModalOpen(false)}
            className="rounded-lg border border-slate-200 px-3.5 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
          >
            Cancel
          </button>

          <button
            type="submit"
            disabled={
              bookingLoading ||
              modalSlots.length === 0 ||
              !bookingForm.slot
            }
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {bookingLoading ? (
              <LoaderCircle
                size={15}
                className="animate-spin"
              />
            ) : (
              <UserPlus size={15} />
            )}

            {bookingLoading ? "Booking..." : "Book patient"}
          </button>
        </div>
      </form>
    </div>
  </div>
)}



          {isDoctor && confirmComplete && (
            <div
              className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm"
              onClick={(event) => {
                if (
                  event.target === event.currentTarget &&
                  !updatingCustomerId
                ) {
                  setConfirmComplete(null);
                }
              }}
            >
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="complete-checkup-title"
                className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                  <CheckCircle2 size={25} />
                </div>

                <h2
                  id="complete-checkup-title"
                  className="mt-4 text-lg font-bold text-slate-900"
                >
                  Are you sure?
                </h2>

                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Have you finished the checkup for{" "}
                  <span className="font-semibold text-slate-900">
                    {getCustomerName(confirmComplete)}
                  </span>
                  ? This will mark the patient's checkup as completed.
                </p>

                <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    disabled={Boolean(updatingCustomerId)}
                    onClick={() => setConfirmComplete(null)}
                    className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    disabled={Boolean(updatingCustomerId)}
                    onClick={completeCheckup}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {updatingCustomerId ? (
                      <LoaderCircle size={16} className="animate-spin" />
                    ) : (
                      <CheckCircle2 size={16} />
                    )}

                    {updatingCustomerId
                      ? "Updating..."
                      : "Yes, mark complete"}
                  </button>
                </div>
              </div>
            </div>
          )}

          <footer className="flex flex-col gap-2 border-t border-slate-200/80 py-4 text-xs text-slate-400 sm:flex-row sm:items-center sm:justify-between">
            <p>© {new Date().getFullYear()} Zeriy. All rights reserved.</p>
            <p>Made Simpler & Much Faster</p>
          </footer>
        </main>
      </div>
      <GoUpButton/>
    </div>
  );
}