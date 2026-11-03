"use client";

import {
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useSearchParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import Image from "next/image";
import { useSession } from "next-auth/react";
import { toast } from "react-toastify";
import {
  ArrowLeft,
  MapPin,
  Phone,
  Mail,
  Store,
  LoaderCircle,
  Building2,
  IndianRupee,
  AlertCircle,
  Save,
  Pencil,
  Plus,
  Trash2,
  Users,
  CalendarDays,
  X,
  Clock,
  ImagePlus,
  Upload,
  CheckCircle2,
  RefreshCw,
  KeyRound,
  ShieldCheck,
  Stethoscope,
  Copy,
  Eye,
  EyeOff,
  Check,
} from "lucide-react";

const DAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

const TIME_FORMAT_HINT = "HH:MM AM/PM";

function normalizeTime12Hour(value) {
  const input = String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, " ");

  // Accept 9:00 AM or 09:00 AM.
  const twelveHourMatch = input.match(
    /^(0?[1-9]|1[0-2]):([0-5]\d)\s*(AM|PM)$/
  );

  if (twelveHourMatch) {
    const hour = String(
      Number(twelveHourMatch[1])
    ).padStart(2, "0");

    return `${hour}:${twelveHourMatch[2]} ${twelveHourMatch[3]}`;
  }

  // Also accept existing 24-hour values such as 13:00.
  const twentyFourHourMatch = input.match(
    /^([01]\d|2[0-3]):([0-5]\d)$/
  );

  if (twentyFourHourMatch) {
    const hour24 = Number(twentyFourHourMatch[1]);
    const minute = twentyFourHourMatch[2];

    const period = hour24 >= 12 ? "PM" : "AM";
    const hour12 = hour24 % 12 || 12;

    return `${String(hour12).padStart(2, "0")}:${minute} ${period}`;
  }

  return "";
}

function time12HourToMinutes(value) {
  const normalized = normalizeTime12Hour(value);

  if (!normalized) return null;

  const match = normalized.match(
    /^(\d{2}):(\d{2}) (AM|PM)$/
  );

  if (!match) return null;

  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const period = match[3];

  if (period === "AM") {
    if (hour === 12) hour = 0;
  } else if (hour !== 12) {
    hour += 12;
  }

  return hour * 60 + minute;
}

function isValidSlotTime(slot) {
  const open = time12HourToMinutes(slot.open);
  const close = time12HourToMinutes(slot.close);
  const checkup = time12HourToMinutes(
    slot.checkupStartTime
  );

  if (
    open === null ||
    close === null ||
    checkup === null
  ) {
    return false;
  }

  return (
    open < close &&
    checkup >= open &&
    checkup < close
  );
}

function hasOverlappingSlots(slots) {
  const ranges = slots.map((slot) => ({
    open: time12HourToMinutes(slot.open),
    close: time12HourToMinutes(slot.close),
  }));

  if (
    ranges.some(
      (range) =>
        range.open === null ||
        range.close === null
    )
  ) {
    return false;
  }

  ranges.sort((a, b) => a.open - b.open);

  for (let index = 1; index < ranges.length; index++) {
    if (ranges[index].open < ranges[index - 1].close) {
      return true;
    }
  }

  return false;
}

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
];

const PROFILE_CACHE_TTL = 30 * 1000;
const businessProfileCache = new Map();

const emptySchedule = () =>
  Object.fromEntries(
    DAYS.map((day) => [
      day,
      {
        active: false,
        slots: [],
      },
    ])
  );

function normalizeSchedule(schedule = {}) {
  return Object.fromEntries(
    DAYS.map((day) => {
      const dayData = schedule?.[day] || {};

      const slots = Array.isArray(dayData.slots)
        ? dayData.slots
        : [];

      return [
        day,
        {
          active: dayData.active === true,
          slots: slots.map((slot) => {
            const open = String(slot?.open ?? "").trim();
            const close = String(slot?.close ?? "").trim();

            const checkupStartTime = String(
              slot?.checkupStartTime ?? ""
            ).trim();

            const capacity = Number(slot?.capacity);

            return {
              open: normalizeTime12Hour(open) || open,
              close: normalizeTime12Hour(close) || close,
              checkupStartTime:
                normalizeTime12Hour(checkupStartTime) ||
                checkupStartTime,
              capacity:
                Number.isInteger(capacity) && capacity >= 1
                  ? capacity
                  : 1,
            };
          }),
        },
      ];
    })
  );
}

function emptyDoctor() {
  return {
    name: "",
    specialization: "",
    experience: 0,
    duration: 20,
    fee: 500,
    bookingCharge: 20,
    services: [
      {
        name: "General Consultation",
        charge: 500,
      },
    ],
    schedule: emptySchedule(),
  };
}

function emptyStaff() {
  return {
    name: "",
    role: "",
    phone: "",
    email: "",
    experience: 0,
    services: [],
  };
}

const MapPicker = dynamic(
  () => import("@/components/MapPicker"),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-80 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50">
        <LoaderCircle
          size={28}
          className="animate-spin text-indigo-600"
        />
        <span className="ml-3 text-sm text-slate-500">
          Loading map...
        </span>
      </div>
    ),
  }
);

function isClinic(category) {
  return String(category || "").toLowerCase() === "clinic";
}

async function readResponse(response, fallback) {
  const result = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      result.message || result.error || fallback
    );
  }

  return result;
}

async function getCachedBusinessProfile(
  cacheKey,
  fetcher,
  { force = false } = {}
) {
  const existing = businessProfileCache.get(cacheKey);

  if (
    !force &&
    existing?.data !== null &&
    existing?.data !== undefined &&
    existing.expiresAt > Date.now()
  ) {
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

  businessProfileCache.set(cacheKey, entry);

  const request = Promise.resolve()
    .then(fetcher)
    .then((data) => {
      if (businessProfileCache.get(cacheKey) === entry) {
        entry.data = data;
        entry.expiresAt = Date.now() + PROFILE_CACHE_TTL;
        entry.promise = null;
      }

      return data;
    })
    .catch((error) => {
      if (businessProfileCache.get(cacheKey) === entry) {
        businessProfileCache.delete(cacheKey);
      }

      throw error;
    });

  entry.promise = request;

  return request;
}

function invalidateBusinessProfileCache(cacheKey) {
  if (cacheKey) {
    businessProfileCache.delete(cacheKey);
  }
}



function TimeSelect({ value, onChange, label, disabled = false }) {
  const normalized = normalizeTime12Hour(value);
  const match = normalized.match(/^(\d{2}):(\d{2}) (AM|PM)$/);

  const selectedHour = match
    ? String(Number(match[1]))
    : "9";

  const selectedMinute = match ? match[2] : "00";
  const selectedPeriod = match ? match[3] : "AM";

  const updateTime = (hour, minute, period) => {
    onChange(
      `${String(Number(hour)).padStart(2, "0")}:${minute} ${period}`
    );
  };

  const selectClass =
    "mt-1.5 min-w-0 w-full rounded-xl border border-slate-200 bg-white px-2 py-3 text-sm outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50 disabled:cursor-not-allowed disabled:bg-slate-100";

  return (
    <fieldset disabled={disabled} className="min-w-0">
      <legend className="block text-sm font-semibold text-slate-700">
        {label}
      </legend>

      <div className="mt-0.5 grid grid-cols-[1fr_1fr_1fr] gap-2">
        <select
          aria-label={`${label} hour`}
          className={selectClass}
          value={selectedHour}
          onChange={(e) =>
            updateTime(
              e.target.value,
              selectedMinute,
              selectedPeriod
            )
          }
        >
          {Array.from({ length: 12 }, (_, i) => i + 1).map(
            (hour) => (
              <option key={hour} value={String(hour)}>
                {String(hour).padStart(2, "0")}
              </option>
            )
          )}
        </select>

        <select
          aria-label={`${label} minutes`}
          className={selectClass}
          value={selectedMinute}
          onChange={(e) =>
            updateTime(
              selectedHour,
              e.target.value,
              selectedPeriod
            )
          }
        >
          {Array.from({ length: 60 }, (_, minute) => minute).map(
            (minute) => (
              <option
                key={minute}
                value={String(minute).padStart(2, "0")}
              >
                {String(minute).padStart(2, "0")}
              </option>
            )
          )}
        </select>

        <select
          aria-label={`${label} AM or PM`}
          className={selectClass}
          value={selectedPeriod}
          onChange={(e) =>
            updateTime(
              selectedHour,
              selectedMinute,
              e.target.value
            )
          }
        >
          <option value="AM">AM</option>
          <option value="PM">PM</option>
        </select>
      </div>
    </fieldset>
  );
}


function BusinessProfileContent() {
  const params = useSearchParams();
  const router = useRouter();

  const businessId = params.get("businessId") || "";
  const category = params.get("category") || "";

  const {
    data: session,
    status: sessionStatus,
  } = useSession();

  const ownerCacheId =
    session?.user?.id ||
    session?.user?.email ||
    null;

  const cacheKey =
    ownerCacheId && businessId && category
      ? `${ownerCacheId}:${category}:${businessId}`
      : null;

  const clinic = isClinic(category);
  const teamLabel = clinic ? "Doctor" : "Staff member";

  const fileInputRef = useRef(null);
  const objectUrlRef = useRef(null);

  const [business, setBusiness] = useState(null);
  const [mapOpen, setMapOpen] = useState(false);

  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    address: "",
    lat: "",
    lng: "",
    imageUrl: "",
    services: [],
  });

  const [team, setTeam] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [teamSaving, setTeamSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [draggingImage, setDraggingImage] = useState(false);
  const [deletingId, setDeletingId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editing, setEditing] = useState(false);
  const [teamEditor, setTeamEditor] = useState(null);
  const [pendingImageFile, setPendingImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState("");
  const [deletingBusiness, setDeletingBusiness] = useState(false);

  const [visiblePasswords, setVisiblePasswords] = useState({});
  const [copiedField, setCopiedField] = useState("");

  const inputClass =
    "mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50";

  const labelClass =
    "block text-sm font-semibold text-slate-700";

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
      }
    };
  }, []);

  const updateForm = (key, value) => {
    setForm((previous) => ({
      ...previous,
      [key]: value,
    }));
  };

  const copyValue = async (value, field) => {
    if (!value) return;

    try {
      await navigator.clipboard.writeText(String(value));
      setCopiedField(field);

      window.setTimeout(() => {
        setCopiedField((previous) =>
          previous === field ? "" : previous
        );
      }, 1500);
    } catch {
      toast.error("Failed to copy");
    }
  };

  const loadData = useCallback(
    async ({ force = false, silent = false } = {}) => {
      if (!businessId || !category) {
        setError("Business ID or category is missing.");
        setLoading(false);
        return;
      }

      if (sessionStatus === "loading") return;

      if (!silent) setLoading(true);
      setError("");

      const query = new URLSearchParams({
        businessId,
        category,
      });

      const fetchProfileData = async () => {
        const [businessResponse, teamResponse] =
          await Promise.all([
            fetch(
              `/api/owner/business/profile?${query}`,
              {
                method: "GET",
                cache: "no-store",
                credentials: "same-origin",
              }
            ),
            fetch(`/api/owner/team?${query}`, {
              method: "GET",
              cache: "no-store",
              credentials: "same-origin",
            }),
          ]);

        const businessResult = await readResponse(
          businessResponse,
          "Could not load business profile."
        );

        const teamResult = await readResponse(
          teamResponse,
          "Could not load team members."
        );

        if (!businessResult.business) {
          throw new Error(
            "Business profile was not returned by the server."
          );
        }

        return {
          business: businessResult.business,
          team: Array.isArray(teamResult.team)
            ? teamResult.team
            : [],
        };
      };

      try {
        const data = cacheKey
          ? await getCachedBusinessProfile(
              cacheKey,
              fetchProfileData,
              { force }
            )
          : await fetchProfileData();

        setBusiness(data.business);

        setForm({
          name:
            data.business.name ||
            data.business.businessName ||
            "",
          phone: data.business.phone || "",
          email: data.business.email || "",
          address: data.business.address || "",
          lat:
            data.business.lat ??
            data.business.location?.latitude ??
            "",
          lng:
            data.business.lng ??
            data.business.location?.longitude ??
            "",
          imageUrl: data.business.imageUrl || "",
          services: Array.isArray(data.business.services)
            ? data.business.services.map((service) =>
                typeof service === "string"
                  ? {
                      name: service,
                      charge: "",
                    }
                  : {
                      name: service.name || "",
                      charge: service.charge ?? "",
                    }
              )
            : [],
        });

        setImagePreview(data.business.imageUrl || "");
        setTeam(data.team);
      } catch (err) {
        setError(
          err.message || "Could not load profile."
        );
      } finally {
        if (!silent) {
          setLoading(false);
        }
      }
    },
    [businessId, category, cacheKey, sessionStatus]
  );

  useEffect(() => {
    if (sessionStatus === "loading") return;

    loadData();
  }, [loadData, sessionStatus]);

  // ---------------------------------------------
  // Delete business
  // ---------------------------------------------

  const deleteBusiness = async () => {
    if (deletingBusiness || saving || teamSaving) return;

    const confirmed = window.confirm(
      `Are you sure you want to permanently delete "${
        business?.businessName ||
        business?.name ||
        form.name
      }"? This action cannot be undone.`
    );

    if (!confirmed) return;

    setDeletingBusiness(true);
    setError("");
    setNotice("");

    try {
      const query = new URLSearchParams({
        businessId,
        category,
      });

      const response = await fetch(
        `/api/owner/business/profile?${query}`,
        {
          method: "DELETE",
          credentials: "same-origin",
          cache: "no-store",
        }
      );

      await readResponse(
        response,
        "Could not delete business."
      );

      invalidateBusinessProfileCache(cacheKey);

      router.replace("/owner/dashboard");
    } catch (err) {
      setError(
        err.message || "Could not delete business."
      );
      setDeletingBusiness(false);
    }
  };

  // ---------------------------------------------
  // Image selection
  // ---------------------------------------------

  const uploadBusinessImage = (file) => {
    if (!file || saving || uploadingImage) return;

    setError("");
    setNotice("");

    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setError("Choose a JPG, PNG, or WebP image.");
      return;
    }

    if (file.size > MAX_IMAGE_SIZE) {
      setError("Image size must be 5 MB or less.");
      return;
    }

    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }

    const previewUrl = URL.createObjectURL(file);
    objectUrlRef.current = previewUrl;

    setPendingImageFile(file);
    setImagePreview(previewUrl);

    setNotice(
      "Image selected. Click Save changes to apply it."
    );
  };

  const handleImageInput = (event) => {
    const file = event.target.files?.[0];

    if (file) {
      uploadBusinessImage(file);
    }

    event.target.value = "";
  };

  const handleImageDrop = (event) => {
    event.preventDefault();
    setDraggingImage(false);

    const file = event.dataTransfer.files?.[0];

    if (file) {
      uploadBusinessImage(file);
    }
  };

  const removeBusinessImage = () => {
    if (uploadingImage || saving) return;

    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }

    setPendingImageFile(null);
    setImagePreview("");
    updateForm("imageUrl", "");

    setNotice(
      "Image removal selected. Click Save changes to apply it."
    );
    setError("");

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // ---------------------------------------------
  // Save business
  // ---------------------------------------------

  const saveBusiness = async (event) => {
    event.preventDefault();

    if (
      saving ||
      uploadingImage ||
      deletingBusiness ||
      teamSaving
    ) {
      return;
    }

    setSaving(true);
    setError("");
    setNotice("");

    let imageUploadStarted = false;

    try {
      const name = String(form.name || "").trim();
      const address = String(form.address || "").trim();
      const phone = String(form.phone || "").trim();
      const email = String(form.email || "").trim();

      if (!name) {
        throw new Error("Business name is required.");
      }

      if (!address) {
        throw new Error("Business address is required.");
      }

      if (
        phone &&
        !/^[6-9]\d{9}$/.test(phone)
      ) {
        throw new Error(
          "Enter a valid 10-digit Indian mobile number."
        );
      }

      let imageUrl = form.imageUrl;

      if (pendingImageFile) {
        setUploadingImage(true);
        imageUploadStarted = true;

        const formData = new FormData();

        formData.append("image", pendingImageFile);
        formData.append("businessId", businessId);
        formData.append("category", category);

        const uploadResponse = await fetch(
          "/api/owner/business/upload-image",
          {
            method: "POST",
            body: formData,
            credentials: "same-origin",
          }
        );

        const uploadResult = await readResponse(
          uploadResponse,
          "Could not upload business image."
        );

        imageUrl =
          uploadResult.imageUrl ||
          uploadResult.url ||
          "";

        if (!imageUrl) {
          throw new Error(
            "The upload API did not return an image URL."
          );
        }
      }

      const response = await fetch(
        "/api/owner/business/profile",
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "same-origin",
          cache: "no-store",
          body: JSON.stringify({
            ...form,
            name,
            phone,
            email,
            address,
            businessId,
            category,
            imageUrl,
          }),
        }
      );

      await readResponse(
        response,
        "Could not save business profile."
      );

      // Update local form only after successful API response.
      setForm((previous) => ({
        ...previous,
        name,
        phone,
        email,
        address,
        imageUrl,
      }));

      setPendingImageFile(null);
      setImagePreview(imageUrl);
      setEditing(false);
      setMapOpen(false);

      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }

      invalidateBusinessProfileCache(cacheKey);

      setNotice(
        "Business profile updated successfully."
      );

      // Background refresh: don't flash the page loader.
      await loadData({
        force: true,
        silent: true,
      });
    } catch (err) {
      setError(
        err.message || "Could not save business profile."
      );
    } finally {
      setSaving(false);

      if (imageUploadStarted) {
        setUploadingImage(false);
      }
    }
  };

  // ---------------------------------------------
  // Team editor
  // ---------------------------------------------

  const openNewMember = () => {
    if (saving || teamSaving || deletingBusiness) return;

    setError("");
    setNotice("");

    setTeamEditor(
      clinic ? emptyDoctor() : emptyStaff()
    );
  };

  const openEditMember = (member) => {
    if (saving || teamSaving || deletingBusiness) return;

    setError("");
    setNotice("");

    setTeamEditor({
      ...(clinic ? emptyDoctor() : emptyStaff()),
      ...member,
      schedule: clinic
        ? normalizeSchedule(
            member.schedule || emptySchedule()
          )
        : undefined,
      services: Array.isArray(member.services)
        ? member.services.map((service) =>
            typeof service === "string"
              ? { name: service, charge: "" }
              : {
                  name: service.name || "",
                  charge: service.charge ?? "",
                }
          )
        : [],
    });
  };

  const updateTeamEditor = (key, value) => {
    setTeamEditor((previous) => {
      if (!previous) return previous;

      return {
        ...previous,
        [key]: value,
      };
    });
  };

  const addSlot = (day) => {
    setTeamEditor((previous) => {
      if (!previous) return previous;

      const schedule = structuredClone(
        previous.schedule || emptySchedule()
      );

      const current = schedule[day] || {
        active: false,
        slots: [],
      };

      current.active = true;
      current.slots = [
        ...(current.slots || []),
        {
          open: "09:00 AM",
          close: "01:00 PM",
          checkupStartTime: "09:10 AM",
          capacity: 9,
        },
      ];

      schedule[day] = current;

      return {
        ...previous,
        schedule,
      };
    });
  };

  const updateSlot = (day, index, key, value) => {
    setTeamEditor((previous) => {
      if (!previous) return previous;

      const schedule = structuredClone(
        previous.schedule || emptySchedule()
      );

      schedule[day] = schedule[day] || {
        active: false,
        slots: [],
      };

      schedule[day].slots[index] = {
        ...schedule[day].slots[index],
        [key]: value,
      };

      return {
        ...previous,
        schedule,
      };
    });
  };

  const toggleDay = (day, active) => {
    setTeamEditor((previous) => {
      if (!previous) return previous;

      const schedule = structuredClone(
        previous.schedule || emptySchedule()
      );

      schedule[day] = schedule[day] || {
        active: false,
        slots: [],
      };

      schedule[day].active = active;

      return {
        ...previous,
        schedule,
      };
    });
  };

  const removeSlot = (day, index) => {
    setTeamEditor((previous) => {
      if (!previous) return previous;

      const schedule = structuredClone(
        previous.schedule || emptySchedule()
      );

      schedule[day] = schedule[day] || {
        active: false,
        slots: [],
      };

      schedule[day].slots.splice(index, 1);

      return {
        ...previous,
        schedule,
      };
    });
  };

  // ---------------------------------------------
  // Save team member
  // ---------------------------------------------

  const saveTeamMember = async (event) => {
    event.preventDefault();

    if (
      !teamEditor ||
      teamSaving ||
      saving ||
      uploadingImage ||
      deletingBusiness
    ) {
      return;
    }

    setTeamSaving(true);
    setError("");
    setNotice("");

    try {
      const editingMember = Boolean(
        teamEditor._id || teamEditor.memberId
      );

      const schedule = clinic
        ? normalizeSchedule(
            teamEditor.schedule || emptySchedule()
          )
        : undefined;

      const memberName = String(
        teamEditor.name || ""
      ).trim();

      if (!memberName) {
        throw new Error("Full name is required.");
      }

      if (clinic) {
        const experience = Number(teamEditor.experience);
        const fee = Number(teamEditor.fee);
        const duration = Number(teamEditor.duration);

        if (
          !String(teamEditor.specialization || "").trim()
        ) {
          throw new Error(
            "Doctor specialization is required."
          );
        }

        if (
          !Number.isFinite(experience) ||
          experience < 0 ||
          experience > 100
        ) {
          throw new Error(
            "Enter a valid experience between 0 and 100 years."
          );
        }

        if (
          !Number.isFinite(fee) ||
          fee < 0
        ) {
          throw new Error(
            "Enter a valid consultation fee."
          );
        }

        if (
          !Number.isFinite(duration) ||
          duration < 1 ||
          duration > 1440
        ) {
          throw new Error(
            "Consultation duration must be between 1 and 1440 minutes."
          );
        }

      for (const day of DAYS) {
  const dayData = schedule[day];

  if (!dayData.active) continue;

  if (!dayData.slots.length) {
    throw new Error(
      `${day} is enabled but has no time slots. Add a slot or disable this day.`
    );
  }

  for (let index = 0; index < dayData.slots.length; index++) {
    const slot = dayData.slots[index];
    const capacity = Number(slot.capacity);

    if (!isValidSlotTime(slot)) {
      throw new Error(
        `Invalid ${day} slot ${index + 1}. Use HH:MM AM/PM, ensure opening is before closing, and keep checkup start within the slot.`
      );
    }

    if (
      !Number.isInteger(capacity) ||
      capacity < 1
    ) {
      throw new Error(
        `Capacity for ${day} slot ${index + 1} must be a positive whole number.`
      );
    }

    // Save consistently formatted time values.
    slot.open = normalizeTime12Hour(slot.open);
    slot.close = normalizeTime12Hour(slot.close);
    slot.checkupStartTime = normalizeTime12Hour(
      slot.checkupStartTime
    );
    slot.capacity = capacity;
  }

  if (hasOverlappingSlots(dayData.slots)) {
    throw new Error(
      `${day} has overlapping time slots. Adjust the opening and closing times before saving.`
    );
  }
}
      } else {
        if (!String(teamEditor.role || "").trim()) {
          throw new Error(
            "Staff role or designation is required."
          );
        }

        const phone = String(
          teamEditor.phone || ""
        ).trim();

        if (phone && !/^[6-9]\d{9}$/.test(phone)) {
          throw new Error(
            "Enter a valid 10-digit Indian mobile number."
          );
        }

        const email = String(
          teamEditor.email || ""
        ).trim();

        if (
          email &&
          !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
        ) {
          throw new Error("Enter a valid email address.");
        }

        const experience = Number(teamEditor.experience);

        if (
          teamEditor.experience !== "" &&
          (
            !Number.isFinite(experience) ||
            experience < 0 ||
            experience > 100
          )
        ) {
          throw new Error(
            "Enter a valid experience between 0 and 100 years."
          );
        }

        const services = Array.isArray(teamEditor.services)
          ? teamEditor.services
          : [];

        for (const service of services) {
          const name = String(
            service?.name || ""
          ).trim();

          const charge = Number(service?.charge);

          if (!name) {
            throw new Error(
              "Enter a name for every staff service."
            );
          }

          if (
            service?.charge === "" ||
            service?.charge == null ||
            !Number.isFinite(charge) ||
            charge < 0
          ) {
            throw new Error(
              `Enter a valid charge for "${name}".`
            );
          }
        }
      }

      const payload = {
  ...teamEditor,
  name: memberName,
  businessId,
  category,
  type: clinic ? "doctor" : "staff",

  ...(clinic
    ? {
        fee: Number(teamEditor.fee),
        services: [
          {
            name: "General Consultation",
            charge: Number(teamEditor.fee),
          },
        ],
        schedule,
      }
    : {
        services: (Array.isArray(teamEditor.services)
          ? teamEditor.services
          : []
        ).map((service) => ({
          name: String(service.name || "").trim(),
          charge: Number(service.charge),
        })),
      }),
};

      const response = await fetch(
        "/api/owner/team",
        {
          method: editingMember ? "PUT" : "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "same-origin",
          cache: "no-store",
          body: JSON.stringify(payload),
        }
      );

      const result = await readResponse(
        response,
        `Could not save ${teamLabel.toLowerCase()}.`
      );

      if (result.success !== true) {
        throw new Error(
          result.message ||
            result.error ||
            `Could not save ${teamLabel.toLowerCase()}.`
        );
      }

      invalidateBusinessProfileCache(cacheKey);

      setTeamEditor(null);

      setNotice(
        `${teamLabel} saved successfully.`
      );

      await loadData({
        force: true,
        silent: true,
      });
    } catch (err) {
      setError(
        err.message ||
          `Could not save ${teamLabel.toLowerCase()}.`
      );
    } finally {
      setTeamSaving(false);
    }
  };

  // ---------------------------------------------
  // Delete team member
  // ---------------------------------------------

  const deleteTeamMember = async (member) => {
    if (
      deletingId ||
      teamSaving ||
      saving ||
      deletingBusiness
    ) {
      return;
    }

    const confirmed = window.confirm(
      `Remove ${member.name || teamLabel}?`
    );

    if (!confirmed) return;

    const memberId = String(
      member.memberId ||
      member._id ||
      member.id ||
      ""
    );

    if (!memberId) {
      setError("Could not identify this team member.");
      return;
    }

    setDeletingId(memberId);
    setError("");
    setNotice("");

    try {
      const query = new URLSearchParams({
        businessId,
        category,
        memberId,
      });

      const response = await fetch(
        `/api/owner/team?${query}`,
        {
          method: "DELETE",
          credentials: "same-origin",
          cache: "no-store",
        }
      );

      await readResponse(
        response,
        `Could not remove ${teamLabel.toLowerCase()}.`
      );

      invalidateBusinessProfileCache(cacheKey);

      setTeam((previous) =>
        previous.filter(
          (item) =>
            String(
              item.memberId ||
              item._id ||
              item.id ||
              ""
            ) !== memberId
        )
      );

      setNotice(
        `${teamLabel} removed successfully.`
      );

      await loadData({
        force: true,
        silent: true,
      });
    } catch (err) {
      setError(
        err.message ||
          `Could not remove ${teamLabel.toLowerCase()}.`
      );
    } finally {
      setDeletingId("");
    }
  };

  // ---------------------------------------------
  // Loading and error screens
  // ---------------------------------------------

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        <LoaderCircle
          className="animate-spin text-indigo-600"
          size={27}
        />
        <span className="ml-3 text-sm text-slate-500">
          Loading profile...
        </span>
      </main>
    );
  }

  if (error && !business) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
        <div className="w-full max-w-md rounded-3xl border bg-white p-8 text-center">
          <AlertCircle
            className="mx-auto text-red-500"
            size={32}
          />

          <h1 className="mt-4 text-xl font-bold">
            Unable to open business
          </h1>

          <p className="mt-2 text-sm text-slate-500">
            {error}
          </p>

          <button
            type="button"
            onClick={() => loadData({ force: true })}
            className="mt-5 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white"
          >
            Retry
          </button>
        </div>
      </main>
    );
  }

  // ---------------------------------------------
  // Page
  // ---------------------------------------------

  return (
    <main className="min-h-screen bg-[#f7f8fc] text-slate-900">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 py-1 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6">
          <button
            type="button"
            onClick={() => router.push("/owner/dashboard")}
            className="inline-flex items-center gap-2 rounded-xl bg-gray-500 px-3 py-2 text-sm font-semibold text-white transition hover:bg-gray-700"
          >
            <ArrowLeft size={18} />
            Dashboard
          </button>

          <div className="flex items-center gap-2">
            <Image
              src="/logo.png"
              alt="Zeriy"
              width={35}
              height={35}
              priority
              className="h-9 w-9 shrink-0 rounded-lg object-contain sm:h-10 sm:w-10 sm:rounded-xl"
            />

            <span className="font-extrabold tracking-tight">
              Zeriy
              <span className="text-indigo-600">.</span>
            </span>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-7 sm:px-6 lg:py-10">
        {error && (
          <div
            role="alert"
            className="mb-4 flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
          >
            <AlertCircle
              size={18}
              className="mt-0.5 shrink-0"
            />

            <span className="flex-1">{error}</span>

            <button
              type="button"
              onClick={() => setError("")}
              aria-label="Dismiss error"
            >
              <X size={17} />
            </button>
          </div>
        )}

        {notice && (
          <div
            role="status"
            className="mb-4 flex items-start gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-700"
          >
            <CheckCircle2
              size={18}
              className="mt-0.5"
            />

            <span className="flex-1">{notice}</span>

            <button
              type="button"
              onClick={() => setNotice("")}
              aria-label="Dismiss notice"
            >
              <X size={17} />
            </button>
          </div>
        )}

        {/* Business profile */}

        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="h-2 bg-gradient-to-r from-indigo-600 via-violet-500 to-indigo-400" />

          <div className="p-5 sm:p-8">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 flex-1 items-center gap-4 sm:gap-5">
                <div className="relative h-32 w-36 shrink-0 overflow-hidden rounded-2xl border border-slate-200 bg-indigo-50 text-indigo-600 sm:h-44 sm:w-56 lg:h-52 lg:w-64">
                  {imagePreview || form.imageUrl ? (
                    <img
                      src={imagePreview || form.imageUrl}
                      alt={form.name || "Business"}
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <Store size={48} />
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <span className="inline-flex max-w-full rounded-full bg-indigo-50 px-3 py-1 text-xs font-bold capitalize text-indigo-700">
                    {(
                      business?.categoryName ||
                      category ||
                      ""
                    ).replaceAll("-", " ")}
                  </span>

                  <h1 className="mt-2 break-words text-xl font-extrabold leading-tight text-slate-900 sm:text-2xl">
                    {form.name || "Business profile"}
                  </h1>

                  <p className="mt-2 text-sm leading-5 text-slate-500">
                    Manage your business information and team.
                  </p>
                </div>
              </div>

              {!editing && (
                <div className="flex w-full shrink-0 flex-col gap-y-3 sm:w-auto sm:items-center">
                  <button
                    type="button"
                    disabled={
                      deletingBusiness ||
                      saving ||
                      teamSaving
                    }
                    onClick={() => {
                      setError("");
                      setNotice("");
                      setEditing(true);
                    }}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                  >
                    <Pencil size={16} />
                    Edit profile
                  </button>

                  <button
                    type="button"
                    disabled={
                      deletingBusiness ||
                      saving ||
                      teamSaving
                    }
                    onClick={deleteBusiness}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-3 text-sm font-bold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                  >
                    {deletingBusiness ? (
                      <LoaderCircle
                        size={16}
                        className="animate-spin"
                      />
                    ) : (
                      <Trash2 size={16} />
                    )}

                    {deletingBusiness
                      ? "Deleting..."
                      : "Delete business"}
                  </button>
                </div>
              )}
            </div>

            {editing ? (
              <form
                onSubmit={saveBusiness}
                className="mt-8 grid gap-5 sm:grid-cols-2"
              >
                <label className={labelClass}>
                  Business name

                  <input
                    required
                    maxLength={150}
                    className={inputClass}
                    value={form.name}
                    onChange={(e) =>
                      updateForm("name", e.target.value)
                    }
                  />
                </label>

                <label className={labelClass}>
                  Phone

                  <input
                    type="tel"
                    inputMode="numeric"
                    maxLength={10}
                    className={inputClass}
                    value={form.phone}
                    onChange={(e) =>
                      updateForm("phone", e.target.value)
                    }
                  />
                </label>

                <label className={labelClass}>
                  Email

                  <input
                    type="email"
                    className={inputClass}
                    value={form.email}
                    onChange={(e) =>
                      updateForm("email", e.target.value)
                    }
                  />
                </label>

                <label className={`${labelClass} sm:col-span-2`}>
                  Address

                  <textarea
                    required
                    rows={2}
                    className={inputClass}
                    value={form.address}
                    onChange={(e) =>
                      updateForm("address", e.target.value)
                    }
                  />
                </label>

                {/* Business image */}

                <div className="sm:col-span-2">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="flex items-center gap-2 text-lg font-bold text-slate-800">
                        <ImagePlus
                          size={22}
                          className="text-indigo-600"
                        />
                        Business image
                      </h3>

                      <p className="mt-1 text-sm text-slate-500">
                        Upload a clear photo or logo of your business.
                      </p>
                    </div>

                    <span className="rounded-full bg-slate-100 px-3.5 py-1.5 text-xs font-semibold text-slate-600">
                      JPG, PNG, WebP · Max 5 MB
                    </span>
                  </div>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleImageInput}
                    className="hidden"
                  />

                  <div
                    onDragEnter={(e) => {
                      e.preventDefault();
                      setDraggingImage(true);
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDraggingImage(true);
                    }}
                    onDragLeave={(e) => {
                      e.preventDefault();

                      if (
                        !e.currentTarget.contains(
                          e.relatedTarget
                        )
                      ) {
                        setDraggingImage(false);
                      }
                    }}
                    onDrop={handleImageDrop}
                    className={`relative overflow-hidden rounded-3xl border-2 border-dashed transition ${
                      draggingImage
                        ? "border-indigo-500 bg-indigo-50"
                        : "border-slate-300 bg-slate-50 hover:border-indigo-300"
                    }`}
                  >
                    {imagePreview ? (
                      <div className="grid gap-6 p-5 sm:grid-cols-[minmax(280px,420px)_1fr] sm:items-center sm:p-7">
                        <div className="relative h-64 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm sm:h-80">
                          <img
                            src={imagePreview}
                            alt="Business image preview"
                            className="h-full w-full object-cover"
                          />

                          {uploadingImage && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/60 text-white">
                              <LoaderCircle
                                size={34}
                                className="animate-spin"
                              />

                              <span className="mt-3 text-sm font-semibold">
                                Uploading...
                              </span>
                            </div>
                          )}
                        </div>

                        <div className="min-w-0 py-2">
                          <p className="text-xl font-bold text-slate-800">
                            {uploadingImage
                              ? "Uploading your image"
                              : "Image selected"}
                          </p>

                          <p className="mt-2 text-sm leading-6 text-slate-500">
                            {uploadingImage
                              ? "Please wait until the upload finishes."
                              : "Your selected image will be applied when you click Save changes."}
                          </p>

                          <div className="mt-6 flex flex-wrap gap-3">
                            <button
                              type="button"
                              disabled={
                                uploadingImage || saving
                              }
                              onClick={() =>
                                fileInputRef.current?.click()
                              }
                              className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {uploadingImage ? (
                                <LoaderCircle
                                  size={18}
                                  className="animate-spin"
                                />
                              ) : (
                                <RefreshCw size={18} />
                              )}

                              Replace image
                            </button>

                            <button
                              type="button"
                              disabled={
                                uploadingImage || saving
                              }
                              onClick={removeBusinessImage}
                              className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-5 py-3 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                            >
                              <Trash2 size={18} />
                              Remove image
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        disabled={
                          uploadingImage || saving
                        }
                        onClick={() =>
                          fileInputRef.current?.click()
                        }
                        className="flex min-h-80 w-full flex-col items-center justify-center px-6 py-12 text-center transition hover:bg-indigo-50/50 disabled:cursor-not-allowed"
                      >
                        <div
                          className={`flex h-20 w-20 items-center justify-center rounded-3xl ${
                            draggingImage
                              ? "bg-indigo-100 text-indigo-700"
                              : "bg-white text-indigo-600 shadow-sm"
                          }`}
                        >
                          {uploadingImage ? (
                            <LoaderCircle
                              size={36}
                              className="animate-spin"
                            />
                          ) : (
                            <Upload size={36} />
                          )}
                        </div>

                        <p className="mt-5 text-lg font-bold text-slate-800">
                          Drag and drop your image here
                        </p>

                        <p className="mt-2 text-sm text-slate-500">
                          or click below to browse your files
                        </p>

                        <span className="mt-5 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 text-sm font-bold text-white">
                          <ImagePlus size={19} />
                          Choose image
                        </span>
                      </button>
                    )}
                  </div>

                  {(form.imageUrl || pendingImageFile) &&
                    !uploadingImage && (
                      <p className="mt-3 flex items-center gap-2 text-sm text-emerald-700">
                        <CheckCircle2 size={16} />
                        Image selected. Click Save changes to apply the update.
                      </p>
                    )}
                </div>

                {/* Location */}

                <div className="space-y-3 sm:col-span-2">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-800">
                        Business location
                      </p>

                      <p className="text-xs text-slate-500">
                        Set the exact position using the map.
                      </p>
                    </div>

                    <button
                      type="button"
                      disabled={saving || uploadingImage}
                      onClick={() => setMapOpen(true)}
                      className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-50"
                    >
                      <MapPin size={16} />
                      Pick on map
                    </button>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <label className={labelClass}>
                      Latitude

                      <input
                        type="number"
                        step="any"
                        readOnly
                        className={inputClass}
                        value={form.lat}
                      />
                    </label>

                    <label className={labelClass}>
                      Longitude

                      <input
                        type="number"
                        step="any"
                        readOnly
                        className={inputClass}
                        value={form.lng}
                      />
                    </label>
                  </div>

                  {mapOpen && (
                    <MapPicker
                      position={{
                        latitude:
                          form.lat !== "" &&
                          Number.isFinite(Number(form.lat))
                            ? Number(form.lat)
                            : undefined,
                        longitude:
                          form.lng !== "" &&
                          Number.isFinite(Number(form.lng))
                            ? Number(form.lng)
                            : undefined,
                      }}
                      onChange={({
                        latitude,
                        longitude,
                      }) => {
                        updateForm(
                          "lat",
                          String(latitude)
                        );

                        updateForm(
                          "lng",
                          String(longitude)
                        );
                      }}
                      onClose={() => setMapOpen(false)}
                    />
                  )}
                </div>

                {/* Business save actions */}

                <div className="flex flex-wrap gap-3 sm:col-span-2">
                  <button
                    type="submit"
                    disabled={
                      saving ||
                      uploadingImage ||
                      deletingBusiness ||
                      teamSaving
                    }
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {saving || uploadingImage ? (
                      <LoaderCircle
                        className="animate-spin"
                        size={16}
                      />
                    ) : (
                      <Save size={16} />
                    )}

                    {uploadingImage
                      ? "Uploading image..."
                      : saving
                        ? "Saving changes..."
                        : "Save changes"}
                  </button>

                  <button
                    type="button"
                    disabled={
                      saving ||
                      uploadingImage ||
                      teamSaving
                    }
                    onClick={async () => {
                      setEditing(false);
                      setMapOpen(false);
                      setError("");
                      setNotice("");
                      setPendingImageFile(null);

                      if (objectUrlRef.current) {
                        URL.revokeObjectURL(
                          objectUrlRef.current
                        );
                        objectUrlRef.current = null;
                      }

                      await loadData({
                        force: true,
                        silent: true,
                      });
                    }}
                    className="rounded-xl border px-5 py-3 text-sm font-semibold transition hover:bg-slate-50 disabled:opacity-60"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <div className="mt-8 grid gap-4 sm:grid-cols-2">
                {[
                  [Phone, "Phone", form.phone],
                  [Mail, "Email", form.email],
                  [MapPin, "Address", form.address],
                ].map(([Icon, title, value]) => (
                  <div
                    key={title}
                    className="rounded-2xl border border-slate-200 p-4"
                  >
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-400">
                      <Icon size={15} />
                      {title}
                    </div>

                    <p className="mt-2 break-words text-sm font-semibold">
                      {value || "Not provided"}
                    </p>
                  </div>
                ))}

                <div className="rounded-2xl border border-slate-200 p-4">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-400">
                    <Building2 size={15} />
                    Setup status
                  </div>

                  <p className="mt-2 text-sm font-semibold">
                    {business?.setupCompleted
                      ? "Setup completed"
                      : "Setup in progress"}
                  </p>
                </div>

                {form.lat !== "" &&
                  form.lng !== "" &&
                  Number.isFinite(Number(form.lat)) &&
                  Number.isFinite(Number(form.lng)) && (
                    <a
                      className="text-sm font-semibold text-indigo-600 hover:underline sm:col-span-2"
                      target="_blank"
                      rel="noreferrer"
                      href={`https://www.google.com/maps?q=${form.lat},${form.lng}`}
                    >
                      View business location on Google Maps
                    </a>
                  )}
              </div>
            )}
          </div>
        </section>

        {/* Team members */}

        <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Users
                  className="text-indigo-600"
                  size={21}
                />

                <h2 className="text-xl font-extrabold">
                  {clinic ? "Doctors" : "Staff members"}
                </h2>

                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold">
                  {team.length}
                </span>
              </div>

              <p className="mt-1 text-sm text-slate-500">
                Manage the people working at this business.
              </p>
            </div>

            <button
              type="button"
              disabled={
                saving ||
                teamSaving ||
                deletingBusiness
              }
              onClick={openNewMember}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Plus size={17} />
              Add {teamLabel.toLowerCase()}
            </button>
          </div>

          {team.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-dashed border-slate-200 px-4 py-10 text-center">
              <Users
                className="mx-auto text-slate-400"
                size={28}
              />

              <p className="mt-3 font-semibold">
                No {clinic ? "doctors" : "staff members"} added yet
              </p>

              <p className="mt-1 text-sm text-slate-500">
                Use the button above to add your first team member.
              </p>
            </div>
          ) : (
            <div className="mt-5 divide-y divide-slate-100">
              {team.map((member) => {
                const memberId = String(
                  member.memberId ||
                  member._id ||
                  member.id ||
                  ""
                );

                const password =
                  member.temporaryPassword ||
                  member.password ||
                  "";

                const passwordVisible =
                  Boolean(visiblePasswords[memberId]);

                const idCopyKey = `${memberId}-id`;
                const passwordCopyKey =
                  `${memberId}-password`;

                return (
                  <div
                    key={memberId}
                    className="group py-5 first:pt-1 last:pb-1"
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="flex min-w-0 items-start gap-3.5">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50 to-violet-50 text-indigo-600 shadow-sm">
                          {clinic ? (
                            <CalendarDays
                              size={21}
                              strokeWidth={1.8}
                            />
                          ) : (
                            <Users
                              size={21}
                              strokeWidth={1.8}
                            />
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="break-words text-sm font-bold text-slate-900 sm:text-base">
                              {member.name || "Unnamed member"}
                            </h3>

                            <span className="inline-flex items-center rounded-full border border-emerald-100 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700">
                              Team member
                            </span>
                          </div>

                          <p className="mt-1 text-sm text-slate-500">
                            {clinic
                              ? `${
                                  member.specialization ||
                                  "General"
                                } · ${
                                  member.experience || 0
                                } years experience`
                              : `${
                                  member.role || "Staff"
                                } · ${
                                  member.phone || "No phone"
                                }`}
                          </p>

                          {clinic && (
                            <p className="mt-2 inline-flex items-center gap-1 rounded-lg bg-slate-50 px-2.5 py-1 text-sm font-bold text-slate-700">
                              <IndianRupee
                                size={14}
                                className="text-slate-500"
                              />

                              {member.fee ?? 0}

                              <span className="ml-1 text-xs font-medium text-slate-400">
                                consultation fee
                              </span>
                            </p>
                          )}

                          <div className="mt-4 grid max-w-xl gap-3 sm:grid-cols-2">
                            {/* Member ID */}

                            <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-3 transition hover:border-indigo-200 hover:shadow-sm">
                              <div className="mb-2 flex items-center justify-between gap-2">
                                <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                                  <KeyRound size={13} />
                                  Member ID
                                </span>

                                <button
                                  type="button"
                                  disabled={!memberId}
                                  onClick={() =>
                                    copyValue(
                                      memberId,
                                      idCopyKey
                                    )
                                  }
                                  title="Copy member ID"
                                  aria-label="Copy member ID"
                                  className="rounded-lg p-1.5 text-slate-400 transition hover:bg-indigo-50 hover:text-indigo-600 disabled:opacity-40"
                                >
                                  {copiedField ===
                                  idCopyKey ? (
                                    <Check
                                      size={15}
                                      className="text-emerald-600"
                                    />
                                  ) : (
                                    <Copy size={15} />
                                  )}
                                </button>
                              </div>

                              <p className="break-all font-mono text-xs font-semibold leading-5 text-slate-800">
                                {memberId || "Not available"}
                              </p>

                              <p className="mt-1 text-[10px] text-slate-400">
                                Use this ID to sign in
                              </p>
                            </div>

                            {/* Temporary password */}

                            <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-3 transition hover:border-indigo-200 hover:shadow-sm">
                              <div className="mb-2 flex items-center justify-between gap-2">
                                <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                                  <ShieldCheck size={13} />
                                  Temporary password
                                </span>

                                <div className="flex items-center gap-0.5">
                                  <button
                                    type="button"
                                    disabled={!password}
                                    onClick={() =>
                                      setVisiblePasswords(
                                        (previous) => ({
                                          ...previous,
                                          [memberId]:
                                            !previous[memberId],
                                        })
                                      )
                                    }
                                    title={
                                      passwordVisible
                                        ? "Hide password"
                                        : "Show password"
                                    }
                                    aria-label={
                                      passwordVisible
                                        ? "Hide password"
                                        : "Show password"
                                    }
                                    className="rounded-lg p-1.5 text-slate-400 transition hover:bg-indigo-50 hover:text-indigo-600 disabled:opacity-40"
                                  >
                                    {passwordVisible ? (
                                      <EyeOff size={15} />
                                    ) : (
                                      <Eye size={15} />
                                    )}
                                  </button>

                                  <button
                                    type="button"
                                    disabled={!password}
                                    onClick={() =>
                                      copyValue(
                                        password,
                                        passwordCopyKey
                                      )
                                    }
                                    title="Copy password"
                                    aria-label="Copy password"
                                    className="rounded-lg p-1.5 text-slate-400 transition hover:bg-indigo-50 hover:text-indigo-600 disabled:opacity-40"
                                  >
                                    {copiedField ===
                                    passwordCopyKey ? (
                                      <Check
                                        size={15}
                                        className="text-emerald-600"
                                      />
                                    ) : (
                                      <Copy size={15} />
                                    )}
                                  </button>
                                </div>
                              </div>

                              <p className="break-all font-mono text-xs font-semibold leading-5 text-slate-800">
                                {password
                                  ? passwordVisible
                                    ? password
                                    : "••••••••••••"
                                  : "Not available"}
                              </p>

                              <p className="mt-1 text-[10px] text-slate-400">
                                {password
                                  ? "Use this password to log in"
                                  : "Password will be available once credentials are generated"}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex shrink-0 gap-2 pl-[62px] sm:pl-0">
                        <button
                          type="button"
                          disabled={
                            saving ||
                            teamSaving ||
                            deletingBusiness
                          }
                          onClick={() =>
                            openEditMember(member)
                          }
                          className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700 disabled:opacity-50"
                        >
                          <Pencil size={14} />
                          Edit
                        </button>

                        <button
                          type="button"
                          disabled={
                            deletingId === memberId ||
                            saving ||
                            teamSaving ||
                            deletingBusiness
                          }
                          onClick={() =>
                            deleteTeamMember(member)
                          }
                          className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-xl border border-red-100 bg-white px-3 py-2 text-xs font-semibold text-red-600 transition hover:border-red-200 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {deletingId === memberId ? (
                            <LoaderCircle
                              className="animate-spin"
                              size={14}
                            />
                          ) : (
                            <Trash2 size={14} />
                          )}

                          {deletingId === memberId
                            ? "Removing..."
                            : "Remove"}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Team member editor modal */}

        {teamEditor && (
          <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/50 p-3 sm:p-6">
            <section className="my-auto w-full max-w-3xl rounded-3xl bg-white shadow-2xl">
              <div className=" top-0 z-10 flex items-center justify-between rounded-t-3xl border-b bg-white p-5 sm:p-6">
                <div>
                  <h2 className="text-xl font-extrabold">
                    {teamEditor._id ||
                    teamEditor.memberId
                      ? "Edit"
                      : "Add"}{" "}
                    {teamLabel}
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    {clinic
                      ? "Profile, charges and weekly availability"
                      : "Staff contact and role details"}
                  </p>
                </div>

                <button
                  type="button"
                  disabled={teamSaving}
                  onClick={() => setTeamEditor(null)}
                  className="rounded-xl p-2 transition hover:bg-slate-100 disabled:opacity-50"
                  aria-label="Close"
                >
                  <X size={20} />
                </button>
              </div>

              <form
                onSubmit={saveTeamMember}
                className="space-y-6 p-5 sm:p-6"
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className={labelClass}>
                    Full name

                    <input
                      required
                      maxLength={150}
                      className={inputClass}
                      value={teamEditor.name || ""}
                      onChange={(e) =>
                        updateTeamEditor(
                          "name",
                          e.target.value
                        )
                      }
                    />
                  </label>

                  {clinic ? (
                    <>
                      <label className={labelClass}>
                        Specialization

                        <input
                          required
                          maxLength={120}
                          className={inputClass}
                          placeholder="Dermatology"
                          value={
                            teamEditor.specialization || ""
                          }
                          onChange={(e) =>
                            updateTeamEditor(
                              "specialization",
                              e.target.value
                            )
                          }
                        />
                      </label>

                      <label className={labelClass}>
                        Experience (years)

                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="1"
                          required
                          className={inputClass}
                          value={
                            teamEditor.experience ?? ""
                          }
                          onChange={(e) =>
                            updateTeamEditor(
                              "experience",
                              e.target.value === ""
                                ? ""
                                : Number(e.target.value)
                            )
                          }
                        />
                      </label>

                      <label className={labelClass}>
                        Consultation duration (minutes)

                        <input
                          type="number"
                          min="1"
                          max="1440"
                          step="1"
                          required
                          className={inputClass}
                          value={
                            teamEditor.duration ?? 20
                          }
                          onChange={(e) =>
                            updateTeamEditor(
                              "duration",
                              e.target.value === ""
                                ? ""
                                : Number(e.target.value)
                            )
                          }
                        />
                      </label>

                      {/* Fixed doctor service */}

                      <div className="rounded-2xl border border-indigo-100 bg-white p-4 sm:col-span-2 sm:p-5">
                        <div className="mb-4">
                          <h3 className="text-sm font-bold text-slate-900 sm:text-base">
                            Doctor service
                          </h3>

                          <p className="mt-1 text-sm text-slate-500">
                            General Consultation is fixed. You can update its charge.
                          </p>
                        </div>

                        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_200px] sm:items-end">
                          <div className="flex min-h-[58px] items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                            <div className="flex min-w-0 items-center gap-3">
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600">
                                <Stethoscope size={20} />
                              </div>

                              <div className="min-w-0">
                                <p className="truncate font-semibold text-slate-800">
                                  General Consultation
                                </p>

                                <p className="mt-0.5 text-xs text-slate-500">
                                  Default doctor service
                                </p>
                              </div>
                            </div>

                            <span className="shrink-0 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
                              Fixed
                            </span>
                          </div>

                          <label className={labelClass}>
                            Consultation charge (₹)

                            <div className="relative mt-1">
                              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center font-semibold text-slate-500">
                                ₹
                              </span>

                              <input
                                type="number"
                                min="0"
                                step="1"
                                required
                                className={`${inputClass} pl-8`}
                                placeholder="Enter charge"
                                value={teamEditor.fee ?? ""}
                                onChange={(e) =>
                                  updateTeamEditor(
                                    "fee",
                                    e.target.value === ""
                                      ? ""
                                      : Number(e.target.value)
                                  )
                                }
                              />
                            </div>

                            <span className="mt-1 block text-xs font-normal text-slate-500">
                              Amount charged per consultation
                            </span>
                          </label>
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <label className={labelClass}>
                        Role / designation

                        <input
                          required
                          maxLength={120}
                          className={inputClass}
                          placeholder="Receptionist, stylist, technician..."
                          value={teamEditor.role || ""}
                          onChange={(e) =>
                            updateTeamEditor(
                              "role",
                              e.target.value
                            )
                          }
                        />
                      </label>

                      <label className={labelClass}>
                        Phone

                        <input
                          type="tel"
                          inputMode="numeric"
                          maxLength={10}
                          className={inputClass}
                          value={teamEditor.phone || ""}
                          onChange={(e) =>
                            updateTeamEditor(
                              "phone",
                              e.target.value
                            )
                          }
                        />
                      </label>

                      <label className={labelClass}>
                        Email

                        <input
                          type="email"
                          className={inputClass}
                          value={teamEditor.email || ""}
                          onChange={(e) =>
                            updateTeamEditor(
                              "email",
                              e.target.value
                            )
                          }
                        />
                      </label>

                      <label className={labelClass}>
                        Experience (years)

                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="1"
                          className={inputClass}
                          value={
                            teamEditor.experience ?? 0
                          }
                          onChange={(e) =>
                            updateTeamEditor(
                              "experience",
                              e.target.value === ""
                                ? ""
                                : Number(e.target.value)
                            )
                          }
                        />
                      </label>

                      {/* Staff services */}

                      <div className="rounded-2xl border border-slate-200 p-4 sm:col-span-2">
                        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <h3 className="font-bold text-slate-900">
                              Staff services and charges
                            </h3>

                            <p className="mt-1 text-sm text-slate-500">
                              Add multiple services and set a charge for each.
                            </p>
                          </div>

                          <button
                            type="button"
                            disabled={teamSaving}
                            onClick={() =>
                              updateTeamEditor(
                                "services",
                                [
                                  ...(
                                    Array.isArray(
                                      teamEditor.services
                                    )
                                      ? teamEditor.services
                                      : []
                                  ),
                                  {
                                    name: "",
                                    charge: "",
                                  },
                                ]
                              )
                            }
                            className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                          >
                            <Plus
                              size={15}
                              className="mr-1 inline"
                            />
                            Add service
                          </button>
                        </div>

                        <div className="space-y-3">
                          {(Array.isArray(
                            teamEditor.services
                          )
                            ? teamEditor.services
                            : []
                          ).map((service, index) => {
                            const serviceName =
                              typeof service === "string"
                                ? service
                                : service?.name || "";

                            const serviceCharge =
                              typeof service === "object" &&
                              service !== null
                                ? service.charge ?? ""
                                : "";

                            return (
                              <div
                                key={index}
                                className="grid gap-3 rounded-xl border border-slate-200 p-3 sm:grid-cols-[minmax(0,1fr)_160px_auto] sm:items-end"
                              >
                                <label className={labelClass}>
                                  Service name

                                  <input
                                    type="text"
                                    required
                                    maxLength={100}
                                    className={inputClass}
                                    placeholder="e.g. Haircut"
                                    value={serviceName}
                                    onChange={(e) => {
                                      const services = [
                                        ...(Array.isArray(
                                          teamEditor.services
                                        )
                                          ? teamEditor.services
                                          : []),
                                      ];

                                      services[index] = {
                                        name: e.target.value,
                                        charge: serviceCharge,
                                      };

                                      updateTeamEditor(
                                        "services",
                                        services
                                      );
                                    }}
                                  />
                                </label>

                                <label className={labelClass}>
                                  Charge (₹)

                                  <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    required
                                    className={inputClass}
                                    placeholder="Enter charge"
                                    value={serviceCharge}
                                    onChange={(e) => {
                                      const services = [
                                        ...(Array.isArray(
                                          teamEditor.services
                                        )
                                          ? teamEditor.services
                                          : []),
                                      ];

                                      services[index] = {
                                        name: serviceName,
                                        charge:
                                          e.target.value === ""
                                            ? ""
                                            : Number(
                                                e.target.value
                                              ),
                                      };

                                      updateTeamEditor(
                                        "services",
                                        services
                                      );
                                    }}
                                  />
                                </label>

                                <button
                                  type="button"
                                  disabled={teamSaving}
                                  onClick={() =>
                                    updateTeamEditor(
                                      "services",
                                      (
                                        Array.isArray(
                                          teamEditor.services
                                        )
                                          ? teamEditor.services
                                          : []
                                      ).filter(
                                        (_, serviceIndex) =>
                                          serviceIndex !== index
                                      )
                                    )
                                  }
                                  className="rounded-xl border border-red-200 px-4 py-3 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
                                >
                                  <Trash2
                                    size={15}
                                    className="mr-1 inline"
                                  />
                                  Remove
                                </button>
                              </div>
                            );
                          })}

                          {(!Array.isArray(
                            teamEditor.services
                          ) ||
                            teamEditor.services.length === 0) && (
                            <p className="rounded-xl bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
                              No services added. Click Add service.
                            </p>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {/* Doctor schedule */}

                {clinic && (
                  <div>
                    <div className="mb-4 flex items-start gap-3">
                      <CalendarDays
                        className="mt-1 text-indigo-600"
                        size={21}
                      />

                      <div>
                        <h3 className="font-extrabold">
                          Weekly doctor schedule
                        </h3>

                        <p className="mt-1 text-sm text-slate-500">
                          Enable days and add one or more time slots for each day.
                        </p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      {DAYS.map((day) => {
                        const daySchedule =
                          teamEditor.schedule?.[day] || {
                            active: false,
                            slots: [],
                          };

                        return (
                          <div
                            key={day}
                            className="rounded-2xl border border-slate-200 p-4"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <label className="flex items-center gap-3 font-bold capitalize">
                                <input
                                  type="checkbox"
                                  checked={Boolean(
                                    daySchedule.active
                                  )}
                                  onChange={(e) =>
                                    toggleDay(
                                      day,
                                      e.target.checked
                                    )
                                  }
                                  className="h-4 w-4 accent-indigo-600"
                                />

                                {day}
                              </label>

                              <button
                                type="button"
                                disabled={
                                  !daySchedule.active ||
                                  teamSaving
                                }
                                onClick={() => addSlot(day)}
                                className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-bold transition hover:bg-slate-50 disabled:opacity-40"
                              >
                                <Plus size={14} />
                                Add time slot
                              </button>
                            </div>

                            {daySchedule.active && (
                              <div className="mt-4 space-y-3">
                                {daySchedule.slots.map(
                                  (slot, index) => (
                                    <div
                                      key={index}
                                      className="rounded-xl bg-slate-50 p-3"
                                    >
                                      <div className="mb-3 flex items-center justify-between">
                                        <p className="flex items-center gap-2 text-sm font-bold">
                                          <Clock size={15} />
                                          Slot {index + 1}
                                        </p>

                                        <button
                                          type="button"
                                          disabled={teamSaving}
                                          onClick={() =>
                                            removeSlot(
                                              day,
                                              index
                                            )
                                          }
                                          className="text-xs font-semibold text-red-600 hover:text-red-700 disabled:opacity-50"
                                        >
                                          Remove
                                        </button>
                                      </div>

                                    
<div className="grid gap-4 sm:grid-cols-2">
  {[
    ["open", "Opening time"],
    ["close", "Closing time"],
    ["checkupStartTime", "Checkup start time"],
  ].map(([key, title]) => (
    <TimeSelect
      key={key}
      label={title}
      value={slot[key] || ""}
      disabled={teamSaving}
      onChange={(value) =>
        updateSlot(day, index, key, value)
      }
    />
  ))}

  <label className={labelClass}>
    Capacity per slot

    <input
      required
      type="number"
      min="1"
      step="1"
      className={inputClass}
      value={slot.capacity ?? 9}
      disabled={teamSaving}
      onChange={(e) =>
        updateSlot(
          day,
          index,
          "capacity",
          e.target.value === ""
            ? ""
            : Number(e.target.value)
        )
      }
    />
  </label>
</div>

                                    </div>
                                  )
                                )}

                                {daySchedule.slots.length ===
                                  0 && (
                                  <p className="text-sm text-amber-700">
                                    This day is active but has no time slots.
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Modal actions */}

                <div className="flex flex-wrap justify-end gap-3 border-t pt-5">
                  <button
                    type="button"
                    disabled={teamSaving}
                    onClick={() => setTeamEditor(null)}
                    className="rounded-xl border px-5 py-3 text-sm font-semibold transition hover:bg-slate-50 disabled:opacity-60"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={
                      teamSaving ||
                      saving ||
                      uploadingImage ||
                      deletingBusiness
                    }
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {teamSaving ? (
                      <LoaderCircle
                        className="animate-spin"
                        size={16}
                      />
                    ) : (
                      <Save size={16} />
                    )}

                    {teamSaving
                      ? "Saving changes..."
                      : "Save changes"}
                  </button>
                </div>
              </form>
            </section>
          </div>
        )}

        <p className="mt-8 text-center text-xs text-slate-400">
          © {new Date().getFullYear()} Zeriy · Made Simpler &amp; Much Faster
        </p>
      </div>
    </main>
  );
}

export default function BusinessProfilePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-slate-50">
          <LoaderCircle
            className="animate-spin text-indigo-600"
            size={25}
          />
        </div>
      }
    >
      <BusinessProfileContent />
    </Suspense>
  );
}