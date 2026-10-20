"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
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
} from "lucide-react";
import { Copy, Eye, EyeOff, Check } from "lucide-react";
import Image from "next/image";
 

import { useSession } from "next-auth/react";
import { toast } from "react-toastify";

const DAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

const emptySchedule = () =>
  Object.fromEntries(
    DAYS.map((day) => [day, { active: false, slots: [] }])
  );

  const normalizeSchedule = (schedule = {}) =>
  Object.fromEntries(
    DAYS.map((day) => {
      const dayData = schedule?.[day] || {};
      const slots = Array.isArray(dayData.slots)
        ? dayData.slots
        : [];

      return [
        day,
        {
          active: dayData.active === true,
          slots: slots.map((slot) => ({
            open: String(slot?.open ?? "").trim(),
            close: String(slot?.close ?? "").trim(),
            checkupStartTime: String(
              slot?.checkupStartTime ?? ""
            ).trim(),
            capacity: Math.max(
              1,
              Math.floor(Number(slot?.capacity) || 1)
            ),
          })),
        },
      ];
    })
  );

const emptyDoctor = () => ({
  name: "",
  specialization: "",
  experience: 0,
  duration: 20,
  fee: 500,
  bookingCharge: 20,
  schedule: emptySchedule(),
});

const emptyStaff = () => ({
  name: "",
  role: "",
  phone: "",
  email: "",
  experience: 0,
  services: [],
});



const MapPicker = dynamic(() => import("@/components/MapPicker"), {
  ssr: false,
  loading: () => (
    <div className="flex h-80 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50">
      <LoaderCircle size={28} className="animate-spin text-indigo-600" />
      <span className="ml-3 text-sm text-slate-500">Loading map...</span>
    </div>
  ),
});

function isClinic(category) {
  return category?.toLowerCase() === "clinic";
}

async function readResponse(response, fallback) {
  const result = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(result.message || result.error || fallback);
  }

  return result;
}



const PROFILE_CACHE_TTL = 30 * 1000;

const businessProfileCache = new Map();

async function getCachedBusinessProfile(
  cacheKey,
  fetcher,
  { force = false } = {}
) {
  const existing = businessProfileCache.get(cacheKey);

  if (
    !force &&
    existing &&
    existing.data !== null &&
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

function BusinessProfileContent() {
  const params = useSearchParams();
  const router = useRouter();

  const businessId = params.get("businessId") || "";
  const category = params.get("category") || "";

  const { data: session, status: sessionStatus } = useSession();

  const ownerCacheId =
    session?.user?.id || session?.user?.email || null;

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

const copyValue = async (value, field) => {
  if (!value) return;

  try {
    await navigator.clipboard.writeText(String(value));
    setCopiedField(field);
    setTimeout(() => setCopiedField(""), 1500);
  } catch {
    toast.error("Failed to copy");
  }
};

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
      }
    };
  }, []);

  const deleteBusiness = async () => {
  const confirmed = window.confirm(
    `Are you sure you want to permanently delete "${
      business?.businessName || business?.name || form.name
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
      }
    );

    await readResponse(response, "Could not delete business.");

  if (cacheKey) {
  invalidateBusinessProfileCache(cacheKey);
}

router.replace("/owner/dashboard");
  } catch (err) {
    setError(err.message || "Could not delete business.");
    setDeletingBusiness(false);
  }
};

const loadData = useCallback(
  async ({ force = false } = {}) => {
    if (!businessId || !category) {
      setError("Business ID or category is missing.");
      setLoading(false);
      return;
    }

    if (sessionStatus === "loading") {
      return;
    }

    setLoading(true);
    setError("");

    const query = new URLSearchParams({
      businessId,
      category,
    });

    const fetchProfileData = async () => {
      const [businessResponse, teamResponse] = await Promise.all([
        fetch(`/api/owner/business/profile?${query}`, {
          method: "GET",
          cache: "no-store",
          credentials: "same-origin",
        }),

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
        throw new Error("Business profile was not returned by the server.");
      }

      return {
        business: businessResult.business,
        team: Array.isArray(teamResult.team) ? teamResult.team : [],
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
        name: data.business.name || data.business.businessName || "",
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
                ? { name: service, charge: "" }
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
      setError(err.message || "Could not load profile.");
    } finally {
      setLoading(false);
    }
  },
  [businessId, category, cacheKey, sessionStatus]
);
useEffect(() => {
  if (sessionStatus === "loading") return;

  loadData();
}, [loadData, sessionStatus]);

  const updateForm = (key, value) => {
    setForm((previous) => ({ ...previous, [key]: value }));
  };

const uploadBusinessImage = (file) => {
  if (!file) return;

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
  }

  const previewUrl = URL.createObjectURL(file);
  objectUrlRef.current = previewUrl;

  setPendingImageFile(file);
  setImagePreview(previewUrl);

  setNotice("Image selected. Click Save changes to apply it.");
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
  if (uploadingImage) return;

  if (objectUrlRef.current) {
    URL.revokeObjectURL(objectUrlRef.current);
    objectUrlRef.current = null;
  }

  setPendingImageFile(null);
  setImagePreview("");
  updateForm("imageUrl", "");
  setNotice("Image removed. Click Save changes to apply this update.");
  setError("");

  if (fileInputRef.current) {
    fileInputRef.current.value = "";
  }
};

const saveBusiness = async (event) => {
  event.preventDefault();

  if (uploadingImage) {
    setError("Please wait for the image upload to finish.");
    return;
  }

  setSaving(true);
  setError("");
  setNotice("");

  try {
    let imageUrl = form.imageUrl;

    if (pendingImageFile) {
      setUploadingImage(true);

      const formData = new FormData();
      formData.append("image", pendingImageFile);
      formData.append("businessId", businessId);
      formData.append("category", category);

      const uploadResponse = await fetch(
        "/api/owner/business/upload-image",
        {
          method: "POST",
          body: formData,
        }
      );

      const uploadResult = await readResponse(
        uploadResponse,
        "Could not upload business image."
      );

      imageUrl = uploadResult.imageUrl || uploadResult.url;

      if (!imageUrl) {
        throw new Error("The upload API did not return an image URL.");
      }

      setUploadingImage(false);
    }

    const response = await fetch("/api/owner/business/profile", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...form,
        businessId,
        category,
        imageUrl,
      }),
    });

    await readResponse(response, "Could not save business profile.");

    setPendingImageFile(null);
    setForm((previous) => ({
      ...previous,
      imageUrl,
    }));

    setImagePreview(imageUrl);

    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }

    setNotice("Business profile updated successfully.");
    setEditing(false);

  await loadData({ force: true });
  } catch (err) {
    setError(err.message || "Could not save business profile.");
  } finally {
    setSaving(false);
    setUploadingImage(false);
  }
};

const saveTeamMember = async (event) => {
  event.preventDefault();

  if (!teamEditor || teamSaving) return;

  setTeamSaving(true);
  setError("");
  setNotice("");

  try {
    const editingMember = Boolean(teamEditor._id);

    const schedule = clinic
      ? normalizeSchedule(
          teamEditor.schedule || emptySchedule()
        )
      : undefined;

    if (clinic) {
      for (const day of DAYS) {
        const dayData = schedule[day];

        if (!dayData.active) continue;

        if (dayData.slots.length === 0) {
          throw new Error(
            `${day} is enabled but has no time slots. Add a slot or disable this day.`
          );
        }

        const invalidSlot = dayData.slots.some(
          (slot) =>
            !slot.open ||
            !slot.close ||
            !slot.checkupStartTime
        );

        if (invalidSlot) {
          throw new Error(
            `Complete opening, closing, and checkup start times for every ${day} slot.`
          );
        }
      }
    }

    const payload = {
      ...teamEditor,
      businessId,
      category,
      type: clinic ? "doctor" : "staff",
      ...(clinic ? { schedule } : {}),
    };

   
    

    const response = await fetch("/api/owner/team", {
      method: editingMember ? "PUT" : "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "same-origin",
      cache: "no-store",
      body: JSON.stringify(payload),
    });

    const result = await readResponse(
      response,
      `Could not save ${teamLabel.toLowerCase()}.`
    );

    if (!result.success) {
      throw new Error(
        result.message ||
          `Could not save ${teamLabel.toLowerCase()}.`
      );
    }

    if (cacheKey) {
      invalidateBusinessProfileCache(cacheKey);
    }

    setTeamEditor(null);
    setNotice(`${teamLabel} saved successfully.`);

    await loadData({ force: true });
  } catch (err) {
    setError(
      err.message ||
        `Could not save ${teamLabel.toLowerCase()}.`
    );
  } finally {
    setTeamSaving(false);
  }
};

  const deleteTeamMember = async (member) => {
    if (!window.confirm(`Remove ${member.name || teamLabel}?`)) return;

    setDeletingId(String(member._id));
    setError("");
    setNotice("");

    try {
      const query = new URLSearchParams({
        businessId,
        category,
        memberId: String(member._id),
      });

      const response = await fetch(`/api/owner/team?${query}`, {
        method: "DELETE",
      });

      await readResponse(
        response,
        `Could not remove ${teamLabel.toLowerCase()}.`
      );

      setTeam((previous) =>
        previous.filter((item) => String(item._id) !== String(member._id))
      );

    setNotice(`${teamLabel} removed successfully.`);

await loadData({ force: true });
    } catch (err) {
      setError(err.message || `Could not remove ${teamLabel.toLowerCase()}.`);
    } finally {
      setDeletingId("");
    }
  };

  const openNewMember = () => {
    setError("");
    setNotice("");
    setTeamEditor(clinic ? emptyDoctor() : emptyStaff());
  };

  const openEditMember = (member) => {
    setError("");
    setNotice("");

    setTeamEditor({
      ...(clinic ? emptyDoctor() : emptyStaff()),
      ...member,
      schedule: clinic
        ? {
            ...emptySchedule(),
            ...(member.schedule || {}),
          }
        : undefined,
      services: Array.isArray(member.services) ? member.services : [],
    });
  };

  const updateTeamEditor = (key, value) => {
    setTeamEditor((previous) => ({
      ...previous,
      [key]: value,
    }));
  };

  const addSlot = (day) => {
    setTeamEditor((previous) => {
      const schedule = structuredClone(previous.schedule || emptySchedule());

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

      return { ...previous, schedule };
    });
  };

  const updateSlot = (day, index, key, value) => {
    setTeamEditor((previous) => {
      const schedule = structuredClone(previous.schedule || emptySchedule());

      schedule[day] = schedule[day] || {
        active: false,
        slots: [],
      };

      schedule[day].slots[index] = {
        ...schedule[day].slots[index],
        [key]: value,
      };

      return { ...previous, schedule };
    });
  };

  const toggleDay = (day, active) => {
    setTeamEditor((previous) => {
      const schedule = structuredClone(previous.schedule || emptySchedule());

      schedule[day] = schedule[day] || {
        active: false,
        slots: [],
      };

      schedule[day].active = active;

      return { ...previous, schedule };
    });
  };

  const removeSlot = (day, index) => {
    setTeamEditor((previous) => {
      const schedule = structuredClone(previous.schedule || emptySchedule());

      schedule[day] = schedule[day] || {
        active: false,
        slots: [],
      };

      schedule[day].slots.splice(index, 1);

      return { ...previous, schedule };
    });
  };

  const inputClass =
    "mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50";

  const labelClass = "block text-sm font-semibold text-slate-700";

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        <LoaderCircle className="animate-spin text-indigo-600" size={27} />
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
          <AlertCircle className="mx-auto text-red-500" size={32} />
          <h1 className="mt-4 text-xl font-bold">Unable to open business</h1>
          <p className="mt-2 text-sm text-slate-500">{error}</p>
          <button
            onClick={loadData}
            className="mt-5 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white"
          >
            Retry
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f7f8fc] text-slate-900">
      <header className="sticky
       top-0 z-30 border-b border-slate-200 bg-white/95 py-1 backdrop-blur-xl sm:py-1">
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
              alt="Zeric"
              width={42}
              height={42}
              priority
              className="h-9 w-9 shrink-0 rounded-lg object-contain sm:h-12 sm:w-12 sm:rounded-xl"
            />
            <span className="font-extrabold tracking-tight">
              Zeric<span className="text-indigo-600">.</span>
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
            <AlertCircle size={18} className="mt-0.5 shrink-0" />
            <span className="flex-1">{error}</span>
            <button
              type="button"
              className="ml-auto"
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
            <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
            <span className="mt-1 flex-1">{notice}</span>
            <button
              type="button"
              onClick={() => setNotice("")}
              aria-label="Dismiss notice"
            >
              <X size={17} />
            </button>
          </div>
        )}

        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
         <div className="h-2 bg-gradient-to-r from-indigo-600 via-violet-500 to-indigo-400" />

  <div className="p-5 sm:p-8">
    <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
      {/* Business information */}
  
<div className="flex min-w-0 flex-1 items-center gap-4 sm:gap-5">
  <div className="relative h-40 w-56 shrink-0 overflow-hidden rounded-2xl border border-slate-200 bg-indigo-50 text-indigo-600 sm:h-52 sm:w-72 lg:h-60 lg:w-80">
    {form.imageUrl ? (
      <img
        src={form.imageUrl}
        alt={form.name || "Business"}
        className="absolute inset-0 h-full w-full object-cover"
      />
    ) : (
      <div className="flex h-full w-full items-center justify-center">
        <Store size={56} />
      </div>
    )}
  </div>
 

 

        <div className="min-w-0 flex-1">
          <span className="inline-flex max-w-full rounded-full bg-indigo-50 px-3 py-1 text-xs font-bold capitalize text-indigo-700">
            {(business?.categoryName || category || "").replaceAll("-", " ")}
          </span>

          <h1 className="mt-2 break-words text-xl font-extrabold leading-tight text-slate-900 sm:text-2xl">
            {form.name || "Business profile"}
          </h1>

          <p className="mt-2 text-sm leading-5 text-slate-500">
            Manage your business information and team.
          </p>
        </div>
      </div>

      {/* Edit button */}
    {!editing && (
  <div className="flex w-full shrink-0  gap-y-3 sm:w-auto flex-col sm:items-center">
    <button
      type="button"
      disabled={deletingBusiness}
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
      disabled={deletingBusiness}
      onClick={deleteBusiness}
      className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-3 text-sm font-bold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
    >
      {deletingBusiness ? (
        <LoaderCircle size={16} className="animate-spin" />
      ) : (
        <Trash2 size={16} />
      )}
      {deletingBusiness ? "Deleting..." : "Delete business"}
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
                    className={inputClass}
                    value={form.name}
                    onChange={(e) => updateForm("name", e.target.value)}
                  />
                </label>

                <label className={labelClass}>
                  Phone
                  <input
                    type="tel"
                    className={inputClass}
                    value={form.phone}
                    onChange={(e) => updateForm("phone", e.target.value)}
                  />
                </label>

                <label className={labelClass}>
                  Email
                  <input
                    type="email"
                    className={inputClass}
                    value={form.email}
                    onChange={(e) => updateForm("email", e.target.value)}
                  />
                </label>

                <label className={`${labelClass} sm:col-span-2`}>
                  Address
                  <textarea
                    required
                    rows={2}
                    className={inputClass}
                    value={form.address}
                    onChange={(e) => updateForm("address", e.target.value)}
                  />
                </label>

                
<div className="sm:col-span-2">
  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
    <div>
      <h3 className="flex items-center gap-2 text-lg font-bold text-slate-800">
        <ImagePlus size={22} className="text-indigo-600" />
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

      if (!e.currentTarget.contains(e.relatedTarget)) {
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
              <LoaderCircle size={34} className="animate-spin" />
              <span className="mt-3 text-sm font-semibold">
                Uploading...
              </span>
            </div>
          )}
        </div>

        <div className="min-w-0 py-2">
          <p className="text-xl font-bold text-slate-800">
            {uploadingImage ? "Uploading your image" : "Image selected"}
          </p>

          <p className="mt-2 text-sm leading-6 text-slate-500">
            {uploadingImage
              ? "Please wait until the upload finishes."
              : "Your selected image will be applied to your business profile when you click Save changes."}
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              disabled={uploadingImage}
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {uploadingImage ? (
                <LoaderCircle size={18} className="animate-spin" />
              ) : (
                <RefreshCw size={18} />
              )}
              Replace image
            </button>

            <button
              type="button"
              disabled={uploadingImage}
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
        disabled={uploadingImage}
        onClick={() => fileInputRef.current?.click()}
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
            <LoaderCircle size={36} className="animate-spin" />
          ) : (
            <Upload size={36} />
          )}
        </div>

        <p className="mt-5 text-lg font-bold text-slate-800">
          {uploadingImage
            ? "Uploading image..."
            : "Drag and drop your image here"}
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

  {form.imageUrl && !uploadingImage && (
    <p className="mt-3 flex items-center gap-2 text-sm text-emerald-700">
      <CheckCircle2 size={16} />
      Image selected. Click Save changes to update your profile.
    </p>
  )}
</div>


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
                      onClick={() => setMapOpen(true)}
                      className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
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
                      onChange={({ latitude, longitude }) => {
                        updateForm("lat", String(latitude));
                        updateForm("lng", String(longitude));
                      }}
                      onClose={() => setMapOpen(false)}
                    />
                  )}
                </div>

                <div className="sm:col-span-2">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="font-bold">Services and charges</h3>
                      <p className="mt-1 text-xs text-slate-500">
                        Add or update your service list.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        updateForm("services", [
                          ...form.services,
                          { name: "", charge: "" },
                        ])
                      }
                      className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-sm font-semibold transition hover:bg-slate-50"
                    >
                      <Plus size={15} />
                      Add service
                    </button>
                  </div>

                  <div className="mt-3 space-y-3">
                    {form.services.map((service, index) => (
                      <div
                        key={index}
                        className="grid gap-2 sm:grid-cols-[1fr_160px_auto]"
                      >
                        <input
                          aria-label="Service name"
                          placeholder="Service name"
                          className={inputClass}
                          value={service.name}
                          onChange={(e) =>
                            updateForm(
                              "services",
                              form.services.map((item, i) =>
                                i === index
                                  ? { ...item, name: e.target.value }
                                  : item
                              )
                            )
                          }
                        />

                        <input
                          aria-label="Service charge"
                          type="number"
                          min="0"
                          placeholder="Charge (₹)"
                          className={inputClass}
                          value={service.charge}
                          onChange={(e) =>
                            updateForm(
                              "services",
                              form.services.map((item, i) =>
                                i === index
                                  ? { ...item, charge: e.target.value }
                                  : item
                              )
                            )
                          }
                        />

                        <button
                          type="button"
                          aria-label="Remove service"
                          onClick={() =>
                            updateForm(
                              "services",
                              form.services.filter((_, i) => i !== index)
                            )
                          }
                          className="mt-1 flex h-11 items-center justify-center rounded-xl border border-red-100 px-3 text-red-600 transition hover:bg-red-50"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex flex-wrap gap-3 sm:col-span-2">
              <button
  type="submit"
  disabled={teamSaving}
  className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
>
  {teamSaving ? (
    <LoaderCircle className="animate-spin" size={16} />
  ) : (
    <Save size={16} />
  )}

  {teamSaving ? "Saving..." : "Save changes"}
</button>

                  <button
                    type="button"
                    disabled={saving || uploadingImage}
                    onClick={async () => {
                      setEditing(false);
                      setMapOpen(false);
                      await loadData();
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

        <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Users className="text-indigo-600" size={21} />
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
              onClick={openNewMember}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-indigo-700"
            >
              <Plus size={17} />
              Add {teamLabel.toLowerCase()}
            </button>
          </div>

          {team.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-dashed border-slate-200 px-4 py-10 text-center">
              <Users className="mx-auto text-slate-400" size={28} />
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
      member.memberId || member._id || member.id || ""
    );
    const password =
      member.temporaryPassword || member.password || "";
    const passwordVisible = !!visiblePasswords[memberId];

    const idCopyKey = `${memberId}-id`;
    const passwordCopyKey = `${memberId}-password`;

    return (
      <div
        key={member._id || memberId}
        className="group py-5 first:pt-1 last:pb-1"
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-start gap-3.5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50 to-violet-50 text-indigo-600 shadow-sm">
              {clinic ? (
                <CalendarDays size={21} strokeWidth={1.8} />
              ) : (
                <Users size={21} strokeWidth={1.8} />
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="break-words text-sm font-bold text-slate-900 sm:text-base">
                  {member.name}
                </h3>

                <span className="inline-flex items-center rounded-full border border-emerald-100 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700">
                  Team member
                </span>
              </div>

              <p className="mt-1 text-sm text-slate-500">
                {clinic
                  ? `${member.specialization || "General"} · ${
                      member.experience || 0
                    } years experience`
                  : `${member.role || "Staff"} · ${
                      member.phone || "No phone"
                    }`}
              </p>

              {clinic && (
                <p className="mt-2 inline-flex items-center gap-1 rounded-lg bg-slate-50 px-2.5 py-1 text-sm font-bold text-slate-700">
                  <IndianRupee size={14} className="text-slate-500" />
                  {member.fee ?? 0}
                  <span className="ml-1 text-xs font-medium text-slate-400">
                    consultation fee
                  </span>
                </p>
              )}

              <div className="mt-4 grid max-w-xl gap-3 sm:grid-cols-2">
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
                        copyValue(memberId, idCopyKey)
                      }
                      title="Copy member ID"
                      aria-label="Copy member ID"
                      className="rounded-lg p-1.5 text-slate-400 transition hover:bg-indigo-50 hover:text-indigo-600 disabled:opacity-40"
                    >
                      {copiedField === idCopyKey ? (
                        <Check size={15} className="text-emerald-600" />
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
                          setVisiblePasswords((previous) => ({
                            ...previous,
                            [memberId]: !previous[memberId],
                          }))
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
                          copyValue(password, passwordCopyKey)
                        }
                        title="Copy password"
                        aria-label="Copy password"
                        className="rounded-lg p-1.5 text-slate-400 transition hover:bg-indigo-50 hover:text-indigo-600 disabled:opacity-40"
                      >
                        {copiedField === passwordCopyKey ? (
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
              onClick={() => openEditMember(member)}
              className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700 active:scale-[0.98]"
            >
              <Pencil size={14} />
              Edit
            </button>

            <button
              type="button"
              disabled={deletingId === String(member._id)}
              onClick={() => deleteTeamMember(member)}
              className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-xl border border-red-100 bg-white px-3 py-2 text-xs font-semibold text-red-600 transition hover:border-red-200 hover:bg-red-50 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {deletingId === String(member._id) ? (
                <LoaderCircle
                  className="animate-spin"
                  size={14}
                />
              ) : (
                <Trash2 size={14} />
              )}
              Remove
            </button>
          </div>
        </div>
      </div>
    );
  })}
</div>

 

          )}
        </section>

        {teamEditor && (
          <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/50 p-3 sm:p-6">
            <section className="my-auto w-full max-w-3xl rounded-3xl bg-white shadow-2xl">
              <div className=" top-0 z-10 flex items-center justify-between rounded-t-3xl border-b bg-white p-5 sm:p-6">
                <div>
                  <h2 className="text-xl font-extrabold">
                    {teamEditor._id ? "Edit" : "Add"} {teamLabel}
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {clinic
                      ? "Profile, charges and weekly availability"
                      : "Staff contact and role details"}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setTeamEditor(null)}
                  className="rounded-xl p-2 transition hover:bg-slate-100"
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
                      className={inputClass}
                      value={teamEditor.name || ""}
                      onChange={(e) =>
                        updateTeamEditor("name", e.target.value)
                      }
                    />
                  </label>

                  {clinic ? (
                    <>
                      <label className={labelClass}>
                        Specialization
                        <input
                          required
                          className={inputClass}
                          placeholder="Dermatology"
                          value={teamEditor.specialization || ""}
                          onChange={(e) =>
                            updateTeamEditor("specialization", e.target.value)
                          }
                        />
                      </label>

                      <label className={labelClass}>
  Experience (years)
  <input
    type="number"
    min="0"
    step="1"
    required
    className={inputClass}
    value={teamEditor.experience ?? ""}
    onChange={(e) => {
      const value = e.target.value;
      updateTeamEditor(
        "experience",
        value === "" ? "" : Number(value)
      );
    }}
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
  value={teamEditor.duration ?? 20}
  onChange={(e) => {
    const value = e.target.value;

    updateTeamEditor(
      "duration",
      value === "" ? "" : Number(value)
    );
  }}
/>
                      </label>

                      <label className={labelClass}>
                        Consultation fee (₹)
                        <input
                          type="number"
                          min="0"
                          required
                          className={inputClass}
                          value={teamEditor.fee ?? 0}
                        onChange={(e) => {
      const value = e.target.value;
      updateTeamEditor(
        "fee",
        value === "" ? "" : Number(value)
      );
    }}
                        />
                      </label>

                    
                    </>
                  ) : (
                    <>
                      <label className={labelClass}>
                        Role / designation
                        <input
                          required
                          className={inputClass}
                          placeholder="Receptionist, stylist, technician..."
                          value={teamEditor.role || ""}
                          onChange={(e) =>
                            updateTeamEditor("role", e.target.value)
                          }
                        />
                      </label>

                      <label className={labelClass}>
                        Phone
                        <input
                          type="tel"
                          className={inputClass}
                          value={teamEditor.phone || ""}
                          onChange={(e) =>
                            updateTeamEditor("phone", e.target.value)
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
                            updateTeamEditor("email", e.target.value)
                          }
                        />
                      </label>

                      <label className={labelClass}>
                        Experience (years)
                        <input
                          type="number"
                          min="0"
                          className={inputClass}
                          value={teamEditor.experience ?? 0}
                          onChange={(e) =>
                            updateTeamEditor(
                              "experience",
                              Number(e.target.value)
                            )
                          }
                        />
                      </label>

                      <label className={`${labelClass} sm:col-span-2`}>
                        Services handled (comma-separated)
                        <input
                          className={inputClass}
                          value={
                            Array.isArray(teamEditor.services)
                              ? teamEditor.services.join(", ")
                              : teamEditor.services || ""
                          }
                          onChange={(e) =>
                            updateTeamEditor(
                              "services",
                              e.target.value
                                .split(",")
                                .map((service) => service.trim())
                                .filter(Boolean)
                            )
                          }
                        />
                      </label>
                    </>
                  )}
                </div>

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
                          Enable days and add one or more time slots for each
                          day.
                        </p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      {DAYS.map((day) => {
                        const daySchedule = teamEditor.schedule?.[day] || {
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
                                  checked={Boolean(daySchedule.active)}
                                  onChange={(e) =>
                                    toggleDay(day, e.target.checked)
                                  }
                                  className="h-4 w-4 accent-indigo-600"
                                />
                                {day}
                              </label>

                              <button
                                type="button"
                                disabled={!daySchedule.active}
                                onClick={() => addSlot(day)}
                                className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-bold transition hover:bg-slate-50 disabled:opacity-40"
                              >
                                <Plus size={14} />
                                Add time slot
                              </button>
                            </div>

                            {daySchedule.active && (
                              <div className="mt-4 space-y-3">
                                {daySchedule.slots.map((slot, index) => (
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
                                        onClick={() => removeSlot(day, index)}
                                        className="text-xs font-semibold text-red-600 hover:text-red-700"
                                      >
                                        Remove
                                      </button>
                                    </div>

                                    <div className="grid gap-3 sm:grid-cols-2">
                                      {[
                                        ["open", "Opening time"],
                                        ["close", "Closing time"],
                                        [
                                          "checkupStartTime",
                                          "Checkup start time",
                                        ],
                                      ].map(([key, title]) => (
                                        <label
                                          key={key}
                                          className={labelClass}
                                        >
                                          {title}
                                          <input
                                            required
                                            className={inputClass}
                                            placeholder="09:00 AM"
                                            value={slot[key] || ""}
                                            onChange={(e) =>
                                              updateSlot(
                                                day,
                                                index,
                                                key,
                                                e.target.value
                                              )
                                            }
                                          />
                                        </label>
                                      ))}

                                      <label className={labelClass}>
                                        Capacity per slot
                                        <input
                                          required
                                          type="number"
                                          min="1"
                                          className={inputClass}
                                          value={slot.capacity ?? 9}
                                          onChange={(e) =>
                                            updateSlot(
                                              day,
                                              index,
                                              "capacity",
                                              Number(e.target.value)
                                            )
                                          }
                                        />
                                      </label>
                                    </div>
                                  </div>
                                ))}

                                {daySchedule.slots.length === 0 && (
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
  disabled={saving || uploadingImage}
  className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
>
  {saving || uploadingImage ? (
    <LoaderCircle className="animate-spin" size={16} />
  ) : (
    <Save size={16} />
  )}

  {saving
    ? "Saving..."
    : uploadingImage
      ? "Uploading..."
      : "Save changes"}
</button>
                </div>
              </form>
            </section>
          </div>
        )}

        <p className="mt-8 text-center text-xs text-slate-400">
          © {new Date().getFullYear()} Zeric · Made Simpler &amp; Much Faster
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