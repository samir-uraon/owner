
"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Check,
  ChevronDown,
  LoaderCircle,
  LogOut,
 
  Settings,
  ShieldAlert,
  Phone,
  LogIn,
} from "lucide-react";
import Image from "next/image";
 
import { ArrowLeft } from "lucide-react";




const categories = [
  {
    id: "clinic",
    title: "Clinic",
    description:
      "Doctor consultations, general OPD, dental, pediatric & skin care.",
    services: [
      "Doctor Consultation",
      "Dental Scaling",
      "Pediatric OPD",
      "Skin Care",
    ],
    icon: "🩺",
  },
  {
    id: "saloon",
    title: "Saloon",
    description: "Haircuts, beard grooming, styling, spas & treatments.",
    services: ["Haircut", "Beard Trim", "Hair Spa", "Head Massage"],
    icon: "💈",
  },
  {
    id: "beauty-parlour",
    title: "Beauty Parlour",
    description:
      "Facials, skin care, hair spa, manicure, pedicure & makeup.",
    services: [
      "Glow Facial",
      "Hair Spa",
      "Manicure",
      "Pedicure",
      "Threading",
    ],
    icon: "💄",
  },
  {
    id: "diagnostic-centre",
    title: "Diagnostic Centre",
    description:
      "Blood tests, health checkups, pathology panels & scan reports.",
    services: [
      "Complete Blood Count (CBC)",
      "Thyroid Profile",
      "Blood Sugar",
      "Lipid Profile",
    ],
    icon: "🧪",
  },
];

export default function BusinessCategorySelector() {
  const router = useRouter();
  const { data: session, status } = useSession();

  const [selectedCategory, setSelectedCategory] = useState("clinic");
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [error, setError] = useState("");
  const [navigating, setNavigating] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const role = String(session?.user?.role || "").toLowerCase();

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

  // Reset transient navigation state when the page becomes active again.
  useEffect(() => {
    const resetNavigation = () => {
      setNavigating(false);
      setIsProfileOpen(false);
    };

    window.addEventListener("pageshow", resetNavigation);
    window.addEventListener("popstate", resetNavigation);

    return () => {
      window.removeEventListener("pageshow", resetNavigation);
      window.removeEventListener("popstate", resetNavigation);
    };
  }, []);

  const userName =
    session?.user?.name ||
    session?.user?.email?.split("@")[0] ||
    "Business Owner";

  const initials = userName
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 1)
    .toUpperCase();


const handleContinue = useCallback(() => {
  if (!isAuthorized || navigating || loggingOut) return;

  const category = categories.find(
    (item) => item.id === selectedCategory
  );

  if (!category) {
    setError("Please select a valid business category.");
    return;
  }

  setError("");
  setNavigating(true);

  router.push(`/owner/${category.id}/details`);
  setNavigating(false)
}, [
  isAuthorized,
  navigating,
  loggingOut,
  selectedCategory,
  router,
]);


  const handleLogout = async () => {
    if (loggingOut) return;

    setLoggingOut(true);
    setIsProfileOpen(false);

    try {
      await signOut({ callbackUrl: "/signin" });
    } catch {
      setError("Unable to log out. Please try again.");
      setLoggingOut(false);
    }
  };

  if (status === "loading" || !isAuthorized) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <LoaderCircle
            className="h-8 w-8 animate-spin text-indigo-600"
            aria-hidden="true"
          />
          <p className="text-sm font-medium text-slate-500">
            Checking your account...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 font-sans">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
       
  
<div className="flex gap-2">

          <button
   onClick={() => {
      if (window.history.length > 1) {
        router.back();
      } else {
        router.push("/owner/dashboard");
      }
    }}
    className="inline-flex items-center gap-2 mr-5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition-all hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-600 active:scale-[0.98]"
  >
    <ArrowLeft size={18} />
    Back
  </button>
 
       
</div>
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsProfileOpen((prev) => !prev)}
              className="flex items-center gap-2 rounded-full p-1 transition hover:bg-white"
              aria-expanded={isProfileOpen}
              aria-haspopup="true"
              aria-label="Open profile menu"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-600 text-sm font-bold text-white shadow-md shadow-indigo-600/20">
                {initials}
              </div>
              <ChevronDown
                size={15}
                className={`text-slate-500 transition-transform ${
                  isProfileOpen ? "rotate-180" : ""
                }`}
              />
            </button>

            {isProfileOpen && (
              <>
                <button
                  type="button"
                  aria-label="Close profile menu"
                  className="fixed inset-0 z-40 cursor-default"
                  onClick={() => setIsProfileOpen(false)}
                />

                <div className="absolute right-0 z-50 mt-2 w-72 overflow-hidden rounded-2xl border border-slate-200 bg-white py-2 shadow-xl">
                  <div className="border-b border-slate-100 px-4 py-3">
                    <p className="truncate text-sm font-semibold text-slate-900">
                      {userName}
                    </p>
                    <p className="mt-1 truncate text-xs text-slate-500">
                      {session.user.email || "No email available"}
                    </p>
                    <p className="mt-1 flex items-center gap-1 truncate text-xs text-slate-500">
                      <Phone size={13} className="shrink-0" />
                      {session.user.phone ||
                        session.user.mobile ||
                        "No mobile number added"}
                    </p>
                    <span className="mt-2 inline-flex rounded-full bg-indigo-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-indigo-600">
                      Business Owner
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setIsProfileOpen(false);
                      router.push("/owner/dashboard");
                    }}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-slate-700 transition hover:bg-slate-100"
                  >
                    <Settings size={16} />
                    Dashboard
                  </button>
<button
                    type="button"
                    onClick={() => {
                      setIsProfileOpen(false);
                      router.push("/signin");
                    }}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-slate-700 transition hover:bg-slate-100"
                  >
                    <LogIn size={16} />
                    Signin
                  </button>
                  <button
                    type="button"
                    onClick={handleLogout}
                    disabled={loggingOut}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {loggingOut ? (
                      <LoaderCircle size={16} className="animate-spin" />
                    ) : (
                      <LogOut size={16} />
                    )}
                    {loggingOut ? "Logging out..." : "Logout"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>
      
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center px-4 py-8 sm:px-6">
    

        <h1 className="text-center text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
          Select Your Business Category
        </h1>

        <p className="mb-8 mt-3 max-w-md text-center text-sm leading-6 text-slate-500">
          Welcome,{" "}
          <span className="font-semibold text-slate-800">
            {userName}
          </span>
          ! Choose a category to customize your business setup.
        </p>

        <div
          className="mb-7 grid w-full grid-cols-1 gap-4 sm:grid-cols-2"
          role="group"
          aria-label="Business categories"
        >
          {categories.map((cat) => {
            const isSelected = selectedCategory === cat.id;

            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => {
                  if (navigating || loggingOut) return;
                  setSelectedCategory(cat.id);
                  setError("");
                }}
                disabled={navigating || loggingOut}
                aria-pressed={isSelected}
                className={`relative flex min-h-64 flex-col justify-between rounded-2xl border-2 bg-white p-5 text-left transition-all duration-200 disabled:cursor-not-allowed ${
                  isSelected
                    ? "border-indigo-600 shadow-md shadow-indigo-600/10"
                    : "border-slate-200 hover:border-slate-300 hover:shadow-sm"
                }`}
              >
                <div className="w-full">
                  <div className="mb-4 flex items-start justify-between">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-100 bg-slate-50 text-xl">
                      {cat.icon}
                    </div>

                    {isSelected ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-indigo-600 px-3 py-1 text-[11px] font-semibold text-white">
                        <Check size={13} />
                        Selected
                      </span>
                    ) : (
                      <span className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-slate-300" />
                    )}
                  </div>

                  <h2 className="mb-1 text-base font-bold text-slate-900">
                    {cat.title}
                  </h2>
                  <p className="text-xs leading-5 text-slate-500">
                    {cat.description}
                  </p>
                </div>

                <div className="mt-5 w-full border-t border-slate-100 pt-3">
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Included Services
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {cat.services.map((service) => (
                      <span
                        key={service}
                        className="rounded-md bg-slate-50 px-2 py-1 text-[10px] font-medium text-slate-600"
                      >
                        {service}
                      </span>
                    ))}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {error && (
          <div
            role="alert"
            className="mb-4 flex w-full max-w-md items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
          >
            <ShieldAlert size={18} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <button
          type="button"
          onClick={handleContinue}
          disabled={navigating || loggingOut}
          className="flex w-full max-w-md items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3.5 text-sm font-semibold text-white shadow-lg shadow-indigo-600/20 transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {navigating ? (
            <>
              <LoaderCircle size={18} className="animate-spin" />
              Opening Setup...
            </>
          ) : (
            <>
              Continue
              <ArrowRight size={17} />
            </>
          )}
        </button>
      </main>

      <footer className="px-4 py-6 text-center text-xs text-slate-400">
        ZERIC © 2026 · Made Simpler And Much Faster
      </footer>
    </div>
  );
}
