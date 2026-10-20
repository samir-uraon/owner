 
"use client";

import React, {
  Suspense,
  useCallback,
  useEffect,
  useState,
} from "react";
import dynamic from "next/dynamic";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  MapPin,
  ImagePlus,
  X,
  MapPinned,
  Phone,
  UserRound,
  LoaderCircle,
  Plus,
  Navigation,
  CheckCircle2,
  BriefcaseBusiness,
  IndianRupee,
  Pencil,
} from "lucide-react";

const MapPicker = dynamic(() => import("@/components/MapPicker"), {
  ssr: false,
  loading: () => (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/50 p-4">
      <div className="flex items-center gap-3 rounded-2xl bg-white px-6 py-5 shadow-xl">
        <LoaderCircle
          size={24}
          className="animate-spin text-indigo-600"
        />
        <span className="text-sm font-medium text-slate-600">
          Loading map...
        </span>
      </div>
    </div>
  ),
});

const categories = {
  clinic: {
    title: "Clinic Details",
    description: "Add your clinic information and services.",
    businessLabel: "Clinic Name",
    servicesPlaceholder: "e.g. General Consultation",
    nextRoute: "/owner/setup/clinic",
  },
  saloon: {
    title: "Salon Details",
    description: "Add your salon information and services.",
    businessLabel: "Salon Name",
    servicesPlaceholder: "e.g. Haircut",
    nextRoute: "/owner/setup/saloon",
  },
  "beauty-parlour": {
    title: "Beauty Parlour Details",
    description: "Add your beauty parlour information and services.",
    businessLabel: "Beauty Parlour Name",
    servicesPlaceholder: "e.g. Facial",
    nextRoute: "/owner/setup/beauty-parlour",
  },
  "diagnostic-centre": {
    title: "Diagnostic Centre Details",
    description: "Add your diagnostic centre information and services.",
    businessLabel: "Diagnostic Centre Name",
    servicesPlaceholder: "e.g. Blood Test",
    nextRoute: "/owner/setup/diagnostic-centre",
  },
};

const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
];

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

function BusinessDetailsForm() {
  const params = useParams();
  const router = useRouter();
  const { data: session, status } = useSession();

  const categoryId = Array.isArray(params?.category)
    ? params.category[0]
    : params?.category;

  const category = categories[categoryId];
  const ownerName = session?.user?.name || "";
  const role = String(session?.user?.role || "").toLowerCase();

  const [serviceCharge, setServiceCharge] = useState("");
  const [serviceInput, setServiceInput] = useState("");
  const [showMapPicker, setShowMapPicker] = useState(false);

  const [form, setForm] = useState({
    businessName: "",
    phone: "",
    address: "",
    city: "",
    pincode: "",
    services: [],
    latitude: 22.5726,
    longitude: 88.3639,
  });

  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const [addressSearch, setAddressSearch] = useState("");
  const [searchingAddress, setSearchingAddress] = useState(false);
  const [addressMessage, setAddressMessage] = useState("");
const [locationSelected, setLocationSelected] = useState(false);
  const [businessImage, setBusinessImage] = useState(null);
  const [businessImagePreview, setBusinessImagePreview] = useState("");

  const isAuthorized =
    status === "authenticated" &&
    !!session?.user &&
    role === "owner";

  useEffect(() => {
    if (status === "loading") return;

    if (status === "unauthenticated" || role !== "owner") {
      router.replace("/signin");
    }
  }, [status, role, router]);

  const updateField = useCallback((name, value) => {
    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  }, []);

  const handleImageChange = useCallback((event) => {
    const file = event.target.files?.[0];

    if (!file) return;

    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setError("Please select a JPG, PNG, or WebP image.");
      event.target.value = "";
      return;
    }

    if (file.size > MAX_IMAGE_SIZE) {
      setError("Image size must not exceed 5 MB.");
      event.target.value = "";
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result === "string") {
        setBusinessImage(file);
        setBusinessImagePreview(reader.result);
        setError("");
      }
    };

    reader.onerror = () => {
      setError("Unable to preview this image. Please try another.");
    };

    reader.readAsDataURL(file);
    event.target.value = "";
  }, []);

  const removeBusinessImage = useCallback(() => {
    setBusinessImage(null);
    setBusinessImagePreview("");
    setError("");
  }, []);

  const addService = useCallback(() => {
    const name = serviceInput.trim();
    const chargeText = serviceCharge.trim();
    const charge = Number(chargeText);

    if (!name) {
      setError("Enter a service name.");
      return;
    }

    if (
      !chargeText ||
      !Number.isFinite(charge) ||
      charge < 0
    ) {
      setError("Enter a valid service charge.");
      return;
    }

    if (
      form.services.some(
        (service) =>
          service.name.toLowerCase() === name.toLowerCase()
      )
    ) {
      setError("This service has already been added.");
      return;
    }

    setForm((previous) => ({
      ...previous,
      services: [
        ...previous.services,
        {
          name,
          charge,
        },
      ],
    }));

    setServiceInput("");
    setServiceCharge("");
    setError("");
  }, [serviceInput, serviceCharge, form.services]);

  const removeService = useCallback((name) => {
    setForm((previous) => ({
      ...previous,
      services: previous.services.filter(
        (service) => service.name !== name
      ),
    }));
  }, []);

  const searchAddressOnMap = useCallback(async () => {
    const query = addressSearch.trim();

    if (!query) {
      setAddressMessage("Enter an address or nearby landmark.");
      return;
    }

    setSearchingAddress(true);
    setAddressMessage("");

    try {
      const params = new URLSearchParams({
        format: "jsonv2",
        limit: "1",
        q: query,
      });

      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?${params.toString()}`,
        {
          headers: {
            Accept: "application/json",
          },
        }
      );

      if (!response.ok) {
        throw new Error("Address search failed.");
      }

      const results = await response.json();

      if (!Array.isArray(results) || results.length === 0) {
        setAddressMessage(
          "Address not found. Try including the city or PIN code."
        );
        return;
      }

      const result = results[0];
      const latitude = Number(result.lat);
      const longitude = Number(result.lon);

      if (
        !Number.isFinite(latitude) ||
        !Number.isFinite(longitude) ||
        latitude < -90 ||
        latitude > 90 ||
        longitude < -180 ||
        longitude > 180
      ) {
        throw new Error("Invalid coordinates returned.");
      }

      setForm((previous) => ({
        ...previous,
        latitude,
        longitude,
        address:
          previous.address || result.display_name || "",
      }));

      setAddressMessage(
        "Location found. Open the map to verify the marker."
      );
      setError("");
    } catch {
      setAddressMessage(
        "Unable to search this address right now. Select the location directly on the map."
      );
    } finally {
      setSearchingAddress(false);
    }
  }, [addressSearch]);

  const useMyLocation = useCallback(() => {
    setError("");

    if (!navigator.geolocation) {
      setError("Location is not supported by this browser.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setForm((previous) => ({
          ...previous,
          latitude: coords.latitude,
          longitude: coords.longitude,
        }));

        setAddressMessage(
          "Your current location was selected. Open the map to verify the business location."
        );
      },
      (geoError) => {
        if (geoError.code === 1) {
          setError(
            "Location permission denied. Allow location access or select a location on the map."
          );
        } else if (geoError.code === 3) {
          setError(
            "Location request timed out. Please try again."
          );
        } else {
          setError(
            "Unable to access your location. Allow location permission or select a location on the map."
          );
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000,
      }
    );
  }, []);

const handleMapChange = useCallback((location) => {
  setForm((prev) => ({
    ...prev,
    latitude: location.latitude,
    longitude: location.longitude,
    address: location.address || prev.address,
  }));

  setLocationSelected(true);
}, []);

  const handleSubmit = useCallback(
    async (event) => {
      event.preventDefault();
      setError("");

      if (saving) return;

      if (!category) {
        setError("Invalid business category.");
        return;
      }

      if (status === "loading") {
        setError("Please wait while your account loads.");
        return;
      }

      if (!isAuthorized) {
        setError("Please sign in with an owner account.");
        router.replace("/signin");
        return;
      }

      if (!ownerName.trim()) {
        setError(
          "Your account name is unavailable. Update your profile and try again."
        );
        return;
      }

      const businessName = form.businessName.trim();
      const phone = form.phone.trim();
      const address = form.address.trim();
      const city = form.city.trim();
      const pincode = form.pincode.trim();

      if (
        !businessName ||
        !phone ||
        !address ||
        !city ||
        !pincode
      ) {
        setError("Please complete all required fields.");
        return;
      }

      if (!/^[6-9]\d{9}$/.test(phone)) {
        setError(
          "Enter a valid 10-digit Indian mobile number."
        );
        return;
      }

      if (!/^\d{6}$/.test(pincode)) {
        setError("Enter a valid 6-digit PIN code.");
        return;
      }

      if (!form.services.length) {
        setError("Add at least one service.");
        return;
      }

    if (
  !locationSelected ||
  !Number.isFinite(Number(form.latitude)) ||
  !Number.isFinite(Number(form.longitude)) ||
  Number(form.latitude) < -90 ||
  Number(form.latitude) > 90 ||
  Number(form.longitude) < -180 ||
  Number(form.longitude) > 180
) {
  setError("Please select your business location on the map.");
  return;
}

      if (businessImage) {
        if (!ALLOWED_IMAGE_TYPES.includes(businessImage.type)) {
          setError(
            "Only JPG, PNG, and WebP images are allowed."
          );
          return;
        }

        if (businessImage.size > MAX_IMAGE_SIZE) {
          setError(
            "Business image must be 5 MB or smaller."
          );
          return;
        }
      }

      setSaving(true);

      try {
        const details = {
          ownerName: ownerName.trim(),
          businessName,
          phone,
          address: [address, city, pincode].join(", "),
          city,
          pincode,
          lat: Number(form.latitude),
          lng: Number(form.longitude),
          services: form.services.map((service) => ({
            name: service.name.trim(),
            charge: Number(service.charge),
          })),
          category: categoryId,
          categoryName: category.title,
        };

        const formData = new FormData();

        formData.append("details", JSON.stringify(details));

        if (businessImage) {
          formData.append("businessImage", businessImage);
        }

        const response = await fetch("/api/owner/business", {
          method: "POST",
          body: formData,
        });

        let result;

        try {
          result = await response.json();
        } catch {
          throw new Error(
            "The server returned an invalid response."
          );
        }

        if (!response.ok || !result.success) {
          throw new Error(
            result.message ||
              "Unable to save business details."
          );
        }

        sessionStorage.setItem(
          "zeric-business-details",
          JSON.stringify({
            ...details,
            businessId: result.businessId,
            imageUrl: result.imageUrl || "",
            businessImageName: businessImage?.name || "",
          })
        );

        router.push(result.nextRoute || category.nextRoute);
      } catch (err) {
        setError(
          err.message || "Unable to save business details."
        );
        setSaving(false);
      }
    },
    [
      category,
      categoryId,
      form,
      ownerName,
      router,
      isAuthorized,
      status,
      businessImage,
      saving,
    ]
  );

  const inputClass =
    "mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10";

  if (status === "loading" || !session?.user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        <LoaderCircle
          size={32}
          className="animate-spin text-indigo-600"
        />
      </main>
    );
  }

  if (role !== "owner") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-5">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-xl font-bold text-slate-900">
            Owner access required
          </h1>

          <p className="mt-2 text-sm text-slate-500">
            Sign in with an owner account to set up your business.
          </p>

          <button
            type="button"
            onClick={() => router.replace("/signin")}
            className="mt-5 rounded-xl bg-indigo-600 px-5 py-3 font-semibold text-white hover:bg-indigo-700"
          >
            Go to sign in
          </button>
        </div>
      </main>
    );
  }

  if (!category) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-5">
        <div className="max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-xl font-bold text-slate-900">
            Invalid business category
          </h1>

          <p className="mt-2 text-sm text-slate-500">
            Please return to the category selection page.
          </p>

          <button
            type="button"
            onClick={() => router.push("/owner/setup")}
            className="mt-5 rounded-xl bg-indigo-600 px-5 py-3 font-semibold text-white hover:bg-indigo-700"
          >
            Back to categories
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 lg:py-12">
      <div className="mx-auto max-w-3xl">
        <button
          type="button"
          onClick={() => router.back()}
          className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-slate-600 transition hover:text-indigo-600"
        >
          <ArrowLeft size={18} />
          Back
        </button>

        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 bg-gradient-to-br from-indigo-50 to-white px-6 py-8 sm:px-9">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-600/20">
              <Building2 size={24} />
            </div>

            <p className="text-sm font-semibold text-indigo-600">
              Business setup · Step 1
            </p>

            <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              {category.title}
            </h1>

            <p className="mt-2 text-sm text-slate-500">
              {category.description}
            </p>

            <div className="mt-6 flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white">
                1
              </span>

              <span className="h-1 flex-1 rounded-full bg-indigo-200" />

              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-200 text-xs font-bold text-slate-500">
                2
              </span>

        

            </div>
          </div>

          <form
            onSubmit={handleSubmit}
            className="space-y-8 p-6 sm:p-9"
          >
            <section>
              <h2 className="mb-4 flex items-center gap-2 text-base font-bold text-slate-900">
                <BriefcaseBusiness
                  size={19}
                  className="text-indigo-600"
                />
                Basic information
              </h2>

              <div className="grid gap-5 sm:grid-cols-2">
                <label className="text-sm font-medium text-slate-700 sm:col-span-2">
                  {category.businessLabel} *
                  <div className="relative">
                    <Building2
                      size={18}
                      className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                    />

                    <input
                      className={`${inputClass} pl-10`}
                      placeholder={`Enter ${category.businessLabel.toLowerCase()}`}
                      value={form.businessName}
                      onChange={(e) =>
                        updateField("businessName", e.target.value)
                      }
                      autoComplete="organization"
                      maxLength={120}
                      required
                    />
                  </div>
                </label>

                <label className="text-sm font-medium text-slate-700">
                  Owner name *
                  <div className="relative">
                    <UserRound
                      size={18}
                      className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                    />

                    <input
                      className={`${inputClass} pl-10`}
                      placeholder="Full name"
                      value={ownerName}
                      readOnly
                      required
                    />
                  </div>
                </label>

                <label className="text-sm font-medium text-slate-700">
                  Contact number *
                  <div className="relative">
                    <Phone
                      size={18}
                      className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                    />

                    <input
                      className={`${inputClass} pl-10`}
                      placeholder="10-digit mobile number"
                      type="tel"
                      inputMode="numeric"
                      autoComplete="tel-national"
                      maxLength={10}
                      value={form.phone}
                      onChange={(e) =>
                        updateField(
                          "phone",
                          e.target.value.replace(/\D/g, "").slice(0, 10)
                        )
                      }
                      required
                    />
                  </div>
                </label>
              </div>
            </section>

            <section>
              <h2 className="mb-2 text-base font-bold text-slate-900">
                Business image
                <span className="ml-2 text-sm font-normal text-slate-400">
                  (Optional)
                </span>
              </h2>

              <p className="mb-4 text-sm text-slate-500">
                Upload a photo of your business. JPG, PNG or WebP,
                up to 5 MB.
              </p>

              {businessImagePreview ? (
                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                  <div className="relative flex min-h-48 w-full items-center justify-center bg-slate-100 p-3 sm:p-5">
                    <img
                      src={businessImagePreview}
                      alt="Business image preview"
                      className="block h-auto max-h-64 max-w-full rounded-xl object-contain"
                    />

                    <button
                      type="button"
                      onClick={removeBusinessImage}
                      aria-label="Remove business image"
                      className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-md transition hover:bg-red-50 hover:text-red-600"
                    >
                      <X size={18} />
                    </button>
                  </div>

                  <div className="flex flex-col gap-3 border-t border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                        <ImagePlus size={20} />
                      </div>

                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-800">
                          {businessImage?.name}
                        </p>

                        <p className="mt-1 text-xs text-slate-500">
                          {businessImage
                            ? `${(
                                businessImage.size /
                                (1024 * 1024)
                              ).toFixed(2)} MB`
                            : ""}
                        </p>
                      </div>
                    </div>

                    <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700">
                      <ImagePlus size={17} />
                      Replace image

                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="hidden"
                        onChange={handleImageChange}
                      />
                    </label>
                  </div>
                </div>
              ) : (
                <label className="group flex min-h-52 w-full cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 px-5 py-8 text-center transition hover:border-indigo-400 hover:bg-indigo-50/50">
                  <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-600 transition group-hover:scale-105">
                    <ImagePlus size={27} />
                  </div>

                  <p className="text-sm font-semibold text-slate-800">
                    Click to upload your business image
                  </p>

                  <p className="mt-2 text-xs text-slate-500">
                    JPG, PNG or WebP
                  </p>

                  <p className="mt-1 text-xs text-slate-400">
                    Maximum file size: 5 MB
                  </p>

                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={handleImageChange}
                  />
                </label>
              )}
            </section>

            <section>
              <h2 className="mb-4 flex items-center gap-2 text-base font-bold text-slate-900">
                <MapPin size={19} className="text-indigo-600" />
                Business address
              </h2>

              <label className="text-sm font-medium text-slate-700">
                Full address *
                <div className="relative">
                  <MapPin
                    size={18}
                    className="absolute left-3.5 top-4 text-slate-400"
                  />

                  <textarea
                    className={`${inputClass} min-h-24 resize-y pl-10`}
                    placeholder="Building, street, area"
                    value={form.address}
                    onChange={(e) =>
                      updateField("address", e.target.value)
                    }
                    autoComplete="street-address"
                    maxLength={500}
                    required
                  />
                </div>
              </label>

              <div className="mt-4 grid gap-5 sm:grid-cols-2">
                <label className="text-sm font-medium text-slate-700">
                  City *
                  <input
                    className={inputClass}
                    placeholder="Enter city"
                    value={form.city}
                    onChange={(e) =>
                      updateField("city", e.target.value)
                    }
                    autoComplete="address-level2"
                    maxLength={100}
                    required
                  />
                </label>

                <label className="text-sm font-medium text-slate-700">
                  PIN code *
                  <input
                    className={inputClass}
                    placeholder="6-digit PIN code"
                    inputMode="numeric"
                    autoComplete="postal-code"
                    maxLength={6}
                    value={form.pincode}
                    onChange={(e) =>
                      updateField(
                        "pincode",
                        e.target.value.replace(/\D/g, "").slice(0, 6)
                      )
                    }
                    required
                  />
                </label>
              </div>
            </section>

            <section>
              <h2 className="flex items-center gap-2 text-base font-bold text-slate-900">
                <IndianRupee
                  size={19}
                  className="text-indigo-600"
                />
                Services offered
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Add each service with its individual charge.
              </p>

              <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_140px_auto]">
                <input
                  value={serviceInput}
                  onChange={(e) => setServiceInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addService();
                    }
                  }}
                  placeholder={category.servicesPlaceholder}
                  aria-label="Service name"
                  maxLength={100}
                  className="min-w-0 rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
                />

                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={serviceCharge}
                  onChange={(e) =>
                    setServiceCharge(e.target.value)
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addService();
                    }
                  }}
                  placeholder="Charge (₹)"
                  aria-label="Service charge in rupees"
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
                />

                <button
                  type="button"
                  onClick={addService}
                  className="flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700"
                >
                  <Plus size={18} />
                  Add
                </button>
              </div>

              {form.services.length > 0 ? (
                <div className="mt-4 flex flex-col gap-2">
                  {form.services.map((service) => (
                    <div
                      key={service.name.toLowerCase()}
                      className="flex items-center justify-between gap-3 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-indigo-600">
                          <CheckCircle2 size={18} />
                        </div>

                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-indigo-900">
                            {service.name}
                          </p>

                          <p className="mt-1 text-sm font-semibold text-indigo-700">
                            ₹
                            {service.charge.toLocaleString("en-IN", {
                              maximumFractionDigits: 2,
                            })}
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => removeService(service.name)}
                        aria-label={`Remove ${service.name}`}
                        className="shrink-0 rounded-full p-2 text-slate-500 transition hover:bg-red-50 hover:text-red-600"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-3 rounded-xl border border-dashed border-slate-200 px-4 py-5 text-center text-sm text-slate-400">
                  No services added yet.
                </p>
              )}
            </section>

            <section>
              <div className="mb-4">
                <h2 className="flex items-center gap-2 text-base font-bold text-slate-900">
                  <MapPinned
                    size={19}
                    className="text-indigo-600"
                  />
                  Pin your business on the map
                </h2>

            
              </div>

            

          
<div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
    <div className="flex min-w-0 items-start gap-3">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
        <MapPin size={21} />
      </div>

      <div className="min-w-0">
        <p className="text-sm font-semibold text-slate-900">
          Selected business location
        </p>

        <p className="mt-1 break-all font-mono text-xs text-slate-500">
          {Number(form.latitude).toFixed(6)},{" "}
          {Number(form.longitude).toFixed(6)}
        </p>

        <p className="mt-1 text-xs text-slate-500">
          {locationSelected
            ? form.address || "Location selected on map."
            : "Default location: Kolkata, West Bengal. Select your business location."}
        </p>
      </div>
    </div>

    <button
      type="button"
      onClick={() => {
        setError("");
        setShowMapPicker(true);
      }}
      className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 active:scale-[0.99]"
    >
      <Pencil size={17} />
      Select on map
    </button>
  </div>
</div>
            </section>

            {error && (
              <p
                role="alert"
                className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600"
              >
                {error}
              </p>
            )}

            <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-6 sm:flex-row sm:justify-between">
              <button
                type="button"
                disabled={saving}
                onClick={() => router.push("/owner/setup")}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <X size={17} />
                Close
              </button>

              <button
                type="submit"
                disabled={saving || status === "loading"}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-indigo-600/20 transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? (
                  <>
                    <LoaderCircle
                      size={18}
                      className="animate-spin"
                    />
                    Saving details...
                  </>
                ) : (
                  <>
                    Save & Continue
                    <ArrowRight size={18} />
                  </>
                )}
              </button>
            </div>

            <p className="text-center text-xs text-slate-400">
              Your business details will be saved before continuing
              to the next setup step.
            </p>
          </form>
        </div>
      </div>

      {showMapPicker && (
        <MapPicker
          key="business-location-picker"
          value={{
            latitude: form.latitude,
            longitude: form.longitude,
            address: form.address,
          }}
          initialPosition={{
            latitude: form.latitude,
            longitude: form.longitude,
          }}
          initialAddress={form.address}
          onChange={handleMapChange}
          onClose={() => setShowMapPicker(false)}
        />
      )}
    </main>
  );
}

export default function BusinessDetailsPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-slate-50">
          <LoaderCircle
            size={32}
            className="animate-spin text-indigo-600"
          />
        </main>
      }
    >
      <BusinessDetailsForm />
    </Suspense>
  );
}
