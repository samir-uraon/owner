
"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Home,
  Search,
  Compass,
  AlertCircle,
} from "lucide-react";

export default function NotFound() {
  const router = useRouter();

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-indigo-50 via-white to-violet-50 px-5 py-12">
      {/* Background decoration */}
      <div className="pointer-events-none absolute -left-32 -top-32 h-80 w-80 rounded-full bg-indigo-200/30 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-violet-200/30 blur-3xl" />

      <div className="relative w-full max-w-2xl text-center">
        {/* Logo */}
        <Link
          href="/"
          className="mb-12 inline-flex items-center justify-center"
        >
          <Image
            src="/logo.png"
            alt="Zeriy"
            width={150}
            height={55}
            priority
            className="h-12 w-auto object-contain"
          />
        </Link>

        {/* 404 illustration */}
        <div className="relative mx-auto mb-7 flex h-48 w-64 items-center justify-center sm:h-56 sm:w-80">
          <div className="absolute inset-0 rounded-full bg-indigo-100/60 blur-2xl" />

          <div className="relative flex items-center justify-center gap-2">
            <span className="text-[100px] font-black leading-none tracking-tighter text-indigo-200 sm:text-[130px]">
              4
            </span>

            <div className="relative flex h-24 w-24 items-center justify-center rounded-[30px] border border-indigo-100 bg-white shadow-xl shadow-indigo-100/70 sm:h-28 sm:w-28">
              <Compass
                size={65}
                strokeWidth={1.5}
                className="text-indigo-600"
              />
              <span className="absolute -right-2 -top-2 flex h-8 w-8 items-center justify-center rounded-full bg-violet-600 text-white shadow-lg">
                <AlertCircle size={17} />
              </span>
            </div>

            <span className="text-[100px] font-black leading-none tracking-tighter text-indigo-200 sm:text-[130px]">
              4
            </span>
          </div>
        </div>

        {/* Message */}
        <div className="mb-8">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-white px-4 py-2 text-xs font-bold uppercase tracking-[0.15em] text-indigo-600 shadow-sm">
            <span className="h-2 w-2 rounded-full bg-indigo-500" />
            Error 404
          </div>

          <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 sm:text-5xl">
            Oops! Page not found
          </h1>

          <p className="mx-auto mt-4 max-w-md text-sm leading-7 text-gray-500 sm:text-base">
            The page you're looking for may have been moved, deleted, or
            doesn't exist. Let's get you back on track.
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/"
            className="group inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-7 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-200 transition-all duration-200 hover:-translate-y-0.5 hover:bg-indigo-700 hover:shadow-xl active:scale-[0.98] sm:w-auto"
          >
            <Home size={18} />
            Back to Home
            <ArrowRight
              size={16}
              className="transition-transform group-hover:translate-x-1"
            />
          </Link>

          <button
            type="button"
            onClick={() => router.back()}
            className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-7 py-3 text-sm font-semibold text-gray-700 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700 active:scale-[0.98] sm:w-auto"
          >
            <ArrowLeft size={18} />
            Go Back
          </button>
        </div>

        {/* Footer */}
        <div className="mt-16 border-t border-indigo-100 pt-6">
          <p className="text-xs font-medium text-gray-400">
            Made Simpler & Much Faster
          </p>
          <p className="mt-2 text-xs text-gray-400">
            © {new Date().getFullYear()} Zeriy. All rights reserved.
          </p>
        </div>
      </div>
    </main>
  );
}
