
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  UserRound,
  Mail,
  Phone,
  Save,
  X,
  LoaderCircle,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
} from "lucide-react";
import { toast } from "react-toastify";

const MOBILE_REGEX = /^[6-9]\d{9}$/;
const PROFILE_CACHE_TTL = 30 * 1000;

// Module-level cache: survives component unmounts during client-side navigation.
const ownerProfileCache = new Map();

const EMPTY_FORM = {
  name: "",
  email: "",
  phone: "",
};

function getProfileCacheKey(session) {
  const userId = session?.user?.id || session?.user?.email;

  return userId ? `owner-profile:${userId}` : null;
}

async function getCachedProfile(cacheKey, fetcher) {
  const existing = ownerProfileCache.get(cacheKey);

  // Return cached data while it is fresh.
  if (
    existing &&
    existing.data !== null &&
    existing.expiresAt > Date.now()
  ) {
    return existing.data;
  }

  // Reuse an in-progress request.
  if (existing?.promise) {
    return existing.promise;
  }

  const entry = {
    data: null,
    expiresAt: 0,
    promise: null,
  };

  // Register the entry before starting the request to avoid duplicate fetches.
  ownerProfileCache.set(cacheKey, entry);

  const request = Promise.resolve()
    .then(fetcher)
    .then((data) => {
      // Prevent an older request from overwriting a newer cache entry.
      if (ownerProfileCache.get(cacheKey) === entry) {
        entry.data = data;
        entry.expiresAt = Date.now() + PROFILE_CACHE_TTL;
        entry.promise = null;
      }

      return data;
    })
    .catch((error) => {
      if (ownerProfileCache.get(cacheKey) === entry) {
        ownerProfileCache.delete(cacheKey);
      }

      throw error;
    });

  entry.promise = request;

  return request;
}

function setCachedProfile(cacheKey, data) {
  if (!cacheKey) return;

  ownerProfileCache.set(cacheKey, {
    data,
    expiresAt: Date.now() + PROFILE_CACHE_TTL,
    promise: null,
  });
}

function invalidateProfileCache(cacheKey) {
  if (cacheKey) {
    ownerProfileCache.delete(cacheKey);
  }
}

async function readJsonResponse(response, fallbackMessage) {
  let data;

  try {
    data = await response.json();
  } catch {
    throw new Error(fallbackMessage);
  }

  if (!response.ok || data?.success === false) {
    throw new Error(data?.message || fallbackMessage);
  }

  return data;
}

export default function OwnerEditProfilePage() {
  const router = useRouter();
  const { data: session, status, update } = useSession();

  const cacheKey = getProfileCacheKey(session);

  const [form, setForm] = useState(EMPTY_FORM);
  const [initialForm, setInitialForm] = useState(EMPTY_FORM);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profileLoaded, setProfileLoaded] = useState(false);

  const [phoneStatus, setPhoneStatus] = useState("idle");
  const [phoneMessage, setPhoneMessage] = useState("");

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const initialPhone = useRef("");
  const phoneRequest = useRef(0);
  const loadRequest = useRef(0);

  const loadProfile = useCallback(
    async ({ force = false } = {}) => {
      if (status === "loading") return;

      if (!session?.user?.email) {
        router.replace("/login");
        return;
      }

      const currentRequest = ++loadRequest.current;

      setError("");

      // Show fresh cached data immediately when navigating back.
      const cached = cacheKey
        ? ownerProfileCache.get(cacheKey)
        : null;

      if (
        !force &&
        cached?.data !== null &&
        cached?.data !== undefined &&
        cached.expiresAt > Date.now()
      ) {
        const cachedForm = cached.data;

        initialPhone.current = cachedForm.phone;
        setForm(cachedForm);
        setInitialForm(cachedForm);
        setProfileLoaded(true);
        setLoading(false);

        return;
      }

      setLoading(true);

      try {
        const fetchProfile = async () => {
          const response = await fetch("/api/owner/edit", {
            method: "GET",
            cache: "no-store",
            credentials: "same-origin",
          });

          const data = await readJsonResponse(
            response,
            "Unable to load your profile."
          );

          const user = data.user || {};

          return {
            name: String(user.name || session.user.name || ""),
            email: String(user.email || session.user.email || ""),
            phone: String(user.phone || ""),
          };
        };

        let loadedForm;

        if (cacheKey) {
          if (force) {
            invalidateProfileCache(cacheKey);
          }

          loadedForm = await getCachedProfile(cacheKey, fetchProfile);
        } else {
          loadedForm = await fetchProfile();
        }

        // Ignore stale responses if a newer load has started.
        if (currentRequest !== loadRequest.current) return;

        initialPhone.current = loadedForm.phone;

        setForm(loadedForm);
        setInitialForm(loadedForm);

        if (
          loadedForm.phone &&
          MOBILE_REGEX.test(loadedForm.phone)
        ) {
          setPhoneStatus("available");
          setPhoneMessage("Your current mobile number is saved.");
        } else if (loadedForm.phone) {
          setPhoneStatus("unchanged");
          setPhoneMessage(
            "This is your existing number. Enter a new valid number to change it."
          );
        } else {
          setPhoneStatus("idle");
          setPhoneMessage(
            "Add a mobile number if you want to update it."
          );
        }

        setProfileLoaded(true);
      } catch (err) {
        if (currentRequest !== loadRequest.current) return;

        setError(err.message || "Something went wrong.");
      } finally {
        if (currentRequest === loadRequest.current) {
          setLoading(false);
        }
      }
    },
    [cacheKey, session, status, router]
  );

  useEffect(() => {
    if (status === "loading") return;

    loadProfile();

    return () => {
      loadRequest.current += 1;
    };
  }, [loadProfile, status]);

  const updateField = (field, value) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));

    setError("");
    setSuccess("");
  };

  const phoneChanged =
    form.phone.trim() !== initialPhone.current;

  useEffect(() => {
    if (!profileLoaded) return;

    const phone = form.phone.trim();

    if (!phoneChanged) {
      if (phone && MOBILE_REGEX.test(phone)) {
        setPhoneStatus("available");
        setPhoneMessage("Your current mobile number is saved.");
      } else if (phone) {
        setPhoneStatus("unchanged");
        setPhoneMessage(
          "Your existing number will remain unchanged unless you enter a new one."
        );
      } else {
        setPhoneStatus("idle");
        setPhoneMessage("No mobile number is currently saved.");
      }

      return;
    }

    if (!phone) {
      setPhoneStatus("invalid");
      setPhoneMessage(
        "Mobile number is required when changing your number."
      );
      return;
    }

    if (!MOBILE_REGEX.test(phone)) {
      setPhoneStatus("invalid");
      setPhoneMessage(
        "Enter a valid 10-digit Indian mobile number."
      );
      return;
    }

    let cancelled = false;
    const requestId = ++phoneRequest.current;

    setPhoneStatus("checking");
    setPhoneMessage("Checking mobile number availability...");

    const timeout = setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/owner/edit?phone=${encodeURIComponent(phone)}`,
          {
            method: "GET",
            cache: "no-store",
            credentials: "same-origin",
          }
        );

        const data = await readJsonResponse(
          response,
          "Could not verify this mobile number."
        );

        if (
          cancelled ||
          requestId !== phoneRequest.current
        ) {
          return;
        }

        if (data.available) {
          setPhoneStatus("available");
          setPhoneMessage("Mobile number is available.");
        } else {
          setPhoneStatus("taken");
          setPhoneMessage(
            "This mobile number is already in use."
          );
        }
      } catch (err) {
        if (
          !cancelled &&
          requestId === phoneRequest.current
        ) {
          setPhoneStatus("error");
          setPhoneMessage(
            err.message ||
              "Unable to check the mobile number. Try again."
          );
        }
      }
    }, 450);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [form.phone, phoneChanged, profileLoaded]);

  const hasChanges =
    form.name.trim() !== initialForm.name.trim() ||
    form.phone.trim() !== initialForm.phone.trim();

  const saveDisabled =
    saving ||
    loading ||
    !profileLoaded ||
    !hasChanges ||
    !form.name.trim() ||
    form.name.trim().length > 100 ||
    (phoneChanged &&
      (!MOBILE_REGEX.test(form.phone.trim()) ||
        phoneStatus !== "available"));

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (saveDisabled) return;

    const name = form.name.trim();
    const phone = form.phone.trim();
    const changedPhone = phone !== initialPhone.current;

    setError("");
    setSuccess("");

    if (!name) {
      setError("Name is required.");
      return;
    }

    if (name.length > 100) {
      setError("Name must be 100 characters or fewer.");
      return;
    }

    if (changedPhone) {
      if (!MOBILE_REGEX.test(phone)) {
        setError(
          "Enter a valid 10-digit Indian mobile number."
        );
        return;
      }

      if (phoneStatus !== "available") {
        setError(
          "Please verify that your new mobile number is available."
        );
        return;
      }
    }

    setSaving(true);

    try {
      const payload = { name };

      if (changedPhone) {
        payload.phone = phone;
      }

      const response = await fetch("/api/owner/edit", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "same-origin",
        body: JSON.stringify(payload),
      });

      const data = await readJsonResponse(
        response,
        "Unable to update your profile."
      );

      const savedUser = data.user || {};

      const savedForm = {
        name: String(savedUser.name || name),
        email: String(savedUser.email || form.email),
        phone: String(savedUser.phone ?? phone),
      };

      initialPhone.current = savedForm.phone;

      setForm(savedForm);
      setInitialForm(savedForm);

      if (
        savedForm.phone &&
        MOBILE_REGEX.test(savedForm.phone)
      ) {
        setPhoneStatus("available");
        setPhoneMessage("Your current mobile number is saved.");
      } else if (savedForm.phone) {
        setPhoneStatus("unchanged");
        setPhoneMessage("Your existing mobile number is saved.");
      } else {
        setPhoneStatus("idle");
        setPhoneMessage("No mobile number is currently saved.");
      }

      // Keep the cache synchronized with the successfully saved data.
      setCachedProfile(cacheKey, savedForm);

      // Update the NextAuth client session.
      await update({
        name: savedForm.name,
        phone: savedForm.phone,
      });

      setSuccess("Profile updated successfully.");
      toast.success("Profile updated successfully.");
    } catch (err) {
      setError(
        err.message || "Something went wrong while saving."
      );
      toast.error(
        err.message || "Unable to update your profile."
      );
    } finally {
      setSaving(false);
    }
  };

  const statusColor = {
    available: "text-emerald-600",
    checking: "text-indigo-600",
    taken: "text-red-600",
    invalid: "text-red-600",
    error: "text-red-600",
    unchanged: "text-slate-500",
    idle: "text-slate-500",
  };

  if (status === "loading" || loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-6 py-5 shadow-sm">
          <LoaderCircle className="h-5 w-5 animate-spin text-indigo-600" />
          <span className="text-sm font-medium text-slate-600">
            Loading your profile...
          </span>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">
        <button
          type="button"
          onClick={() => router.push("/owner/dashboard")}
          className="mb-6 inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-white hover:text-indigo-600"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to dashboard
        </button>

        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="bg-indigo-600 px-6 py-8 text-white sm:px-9">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15">
                <UserRound className="h-7 w-7" />
              </div>

              <div>
                <h1 className="text-2xl font-bold tracking-tight">
                  Edit profile
                </h1>
                <p className="mt-1 text-sm text-indigo-100">
                  Update your owner account details.
                </p>
              </div>
            </div>
          </div>

          <form
            onSubmit={handleSubmit}
            className="space-y-6 p-6 sm:p-9"
          >
            {error && (
              <div
                role="alert"
                className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
              >
                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
                <p>{error}</p>
              </div>
            )}

            {success && (
              <div
                role="status"
                className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700"
              >
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
                <p>{success}</p>
              </div>
            )}

            <div>
              <label
                htmlFor="name"
                className="mb-2 block text-sm font-semibold text-slate-700"
              >
                Full name
              </label>

              <div className="relative">
                <UserRound className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                <input
                  id="name"
                  type="text"
                  autoComplete="name"
                  maxLength={100}
                  required
                  value={form.name}
                  onChange={(event) =>
                    updateField("name", event.target.value)
                  }
                  placeholder="Enter your full name"
                  className="w-full rounded-xl border border-slate-200 bg-white py-3.5 pl-12 pr-4 text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="email"
                className="mb-2 block text-sm font-semibold text-slate-700"
              >
                Email address
              </label>

              <div className="relative">
                <Mail className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                <input
                  id="email"
                  type="email"
                  value={form.email}
                  readOnly
                  className="w-full cursor-not-allowed rounded-xl border border-slate-200 bg-slate-100 py-3.5 pl-12 pr-12 text-slate-500 outline-none"
                />
                <ShieldCheck className="absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              </div>

              <p className="mt-2 text-xs text-slate-500">
                Your registered email address cannot be changed here.
              </p>
            </div>

            <div>
              <label
                htmlFor="phone"
                className="mb-2 block text-sm font-semibold text-slate-700"
              >
                Mobile number
              </label>

              <div className="relative">
                <Phone className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                <input
                  id="phone"
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel-national"
                  maxLength={10}
                  value={form.phone}
                  onChange={(event) =>
                    updateField(
                      "phone",
                      event.target.value
                        .replace(/\D/g, "")
                        .slice(0, 10)
                    )
                  }
                  placeholder="10-digit Indian mobile number"
                  className="w-full rounded-xl border border-slate-200 bg-white py-3.5 pl-12 pr-4 text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
                />
              </div>

              <p
                className={`mt-2 flex items-start gap-1.5 text-xs ${
                  statusColor[phoneStatus] || "text-slate-500"
                }`}
              >
                {phoneStatus === "checking" ? (
                  <LoaderCircle className="h-4 w-4 shrink-0 animate-spin" />
                ) : phoneStatus === "available" ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                ) : ["taken", "invalid", "error"].includes(
                    phoneStatus
                  ) ? (
                  <AlertCircle className="h-4 w-4 shrink-0" />
                ) : null}

                <span>{phoneMessage}</span>
              </p>

              <p className="mt-1 text-xs text-slate-500">
                Use a number starting with 6, 7, 8, or 9.
              </p>
            </div>

            <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-6 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => router.push("/owner/dashboard")}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                <X className="h-4 w-4" />
                Cancel
              </button>

              <button
                type="submit"
                disabled={saveDisabled}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
              >
                {saving ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}

                {saving ? "Saving..." : "Save changes"}
              </button>
            </div>

            <p className="text-center text-xs text-slate-400">
              Save becomes available when you make a valid change.
            </p>
          </form>
        </section>
      </div>
    </main>
  );
}
