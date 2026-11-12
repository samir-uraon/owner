"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  ShieldCheck,
  LockKeyhole,
  Mail,
  Eye,
  EyeOff,
  Loader2,
  AlertCircle,
  ArrowUpRight,
} from "lucide-react";

export default function AdminLogin() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(e) {
    e.preventDefault();
    if (loading) return;

    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail || !password) {
      setError("Please enter your email and password.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const result = await signIn("credentials", {
        identifier: normalizedEmail,
        password,
        role: "admin",
        redirect: false,
      });

      if (!result || result.error || result.ok !== true) {
        setError("Invalid admin email or password.");
        setLoading(false);
        return;
      }

      const response = await fetch("/api/auth/session", {
        method: "GET",
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error("Unable to verify admin session.");
      }

      const session = await response.json();

      if (
        !session?.user?.email ||
        session.user.role !== "admin" ||
        session.user.email.toLowerCase() !== normalizedEmail
      ) {
        setError("Admin session verification failed. Please try again.");
        setLoading(false);
        return;
      }

      router.replace("/admin");
      router.refresh();
    } catch (err) {
      console.error("Admin login error:", err);
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f5f6fa] px-5 py-12">
      <div className="grid w-full max-w-[960px] overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-[0_12px_50px_rgba(15,23,42,0.07)] md:min-h-[570px] md:grid-cols-2">

        {/* Left branding panel */}
        <section className="relative hidden flex-col justify-between overflow-hidden bg-[#17152e] p-10 text-white md:flex">
          <div className="absolute -right-28 -top-28 h-80 w-80 rounded-full border border-white/[0.07]" />
          <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full border border-white/[0.07]" />
          <div className="absolute -bottom-32 -left-28 h-80 w-80 rounded-full bg-violet-600/20 blur-3xl" />

          <div className="relative z-10 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-xl bg-white">
              <img
                src="/logo2.png"
                alt="Zeriy"
                className="h-full w-full object-contain"
              />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">ZERIY</h1>
              <p className="text-[10px] font-medium tracking-[0.2em] text-violet-200">
                ADMINISTRATION
              </p>
            </div>
          </div>

          <div className="relative z-10 py-12">
            <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl border border-violet-300/20 bg-violet-400/10 text-violet-200">
              <ShieldCheck size={25} />
            </div>

            <h2 className="max-w-sm text-[34px] font-bold leading-[1.2] tracking-tight">
              One platform.
              <br />
              Complete control.
            </h2>

            <p className="mt-5 max-w-sm text-sm leading-7 text-gray-300">
              Manage users, business accounts, platform activity and
              operations through your centralized administration portal.
            </p>

            <div className="mt-9 flex items-center gap-3">
              <div className="h-px w-10 bg-violet-400" />
              <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-violet-200">
                Made Simpler & Much Faster
              </span>
            </div>
          </div>

          <div className="relative z-10 flex items-center justify-between border-t border-white/10 pt-5 text-xs text-gray-400">
            <span>Secure Admin Portal</span>
            <span>© 2026 Zeriy</span>
          </div>
        </section>

        {/* Right login panel */}
        <section className="flex flex-col justify-center px-6 py-10 sm:px-12 md:px-11">
          <div className="mx-auto w-full max-w-[360px]">

            {/* Mobile branding */}
            <div className="mb-10 flex items-center gap-3 md:hidden">
              <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl border border-gray-100 bg-white">
                <img src="/logo.png" alt="Zeriy" className="h-full w-full object-contain" />
              </div>
              <div>
                <h1 className="font-bold tracking-tight text-gray-900">ZERIY</h1>
                <p className="text-[10px] font-semibold tracking-widest text-violet-600">
                  ADMINISTRATION
                </p>
              </div>
            </div>

            <div className="mb-8">
              <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-violet-50 text-violet-700">
                <LockKeyhole size={22} />
              </div>

              <p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-violet-600">
                Administrator access
              </p>

              <h2 className="text-[28px] font-bold tracking-tight text-gray-900">
                Welcome back
              </h2>

              <p className="mt-2 text-sm leading-6 text-gray-500">
                Sign in to access your Zeriy control panel.
              </p>
            </div>

            {error && (
              <div
                role="alert"
                className="mb-5 flex items-start gap-2.5 rounded-lg border border-red-100 bg-red-50 p-3 text-sm text-red-700"
              >
                <AlertCircle size={17} className="mt-0.5 shrink-0" />
                <p>{error}</p>
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label
                  htmlFor="admin-email"
                  className="mb-2 block text-[13px] font-semibold text-gray-700"
                >
                  Email address
                </label>

                <div className="relative">
                  <Mail
                    size={17}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
                  />
                  <input
                    id="admin-email"
                    type="email"
                    required
                    autoComplete="username"
                    autoCapitalize="none"
                    spellCheck={false}
                    disabled={loading}
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setError("");
                    }}
                    placeholder="admin@example.com"
                    className="h-12 w-full rounded-lg border border-gray-200 bg-white pl-10 pr-3 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 hover:border-gray-300 focus:border-violet-500 focus:ring-[3px] focus:ring-violet-100 disabled:bg-gray-50"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="admin-password"
                  className="mb-2 block text-[13px] font-semibold text-gray-700"
                >
                  Password
                </label>

                <div className="relative">
                  <LockKeyhole
                    size={17}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
                  />
                  <input
                    id="admin-password"
                    type={showPassword ? "text" : "password"}
                    required
                    autoComplete="current-password"
                    disabled={loading}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setError("");
                    }}
                    placeholder="Enter your password"
                    className="h-12 w-full rounded-lg border border-gray-200 bg-white pl-10 pr-11 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 hover:border-gray-300 focus:border-violet-500 focus:ring-[3px] focus:ring-violet-100 disabled:bg-gray-50"
                  />

                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 transition hover:text-violet-700"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || !email.trim() || !password}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-violet-600 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Verifying credentials...
                  </>
                ) : (
                  <>
                    Sign in to dashboard
                    <ArrowUpRight size={17} />
                  </>
                )}
              </button>
            </form>

            <div className="mt-8 border-t border-gray-100 pt-5">
              <div className="flex items-center justify-center gap-2 text-[11px] text-gray-400">
                <ShieldCheck size={14} />
                Protected administrator access
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}