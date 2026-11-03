
"use client";

import React, { useState } from "react";
import { signIn, getSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import ForgotPasswordModal from "./ForgotPasswordModal";
import {
  ArrowLeft,
  Eye,
  EyeOff,
  LoaderCircle,
  LockKeyhole,
  Mail,
  UserRound,
  Phone,
} from "lucide-react";
import { toast } from "react-toastify";
import GoogleAuthButton from "./GoogleAuthButton";
import Image from "next/image";

export default function AuthContainer({
  mode = "login",
  initialTab = "owner",
  onLoginSuccess,
}) {
  const router = useRouter();

  const [activeTab, setActiveTab] = useState(initialTab);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [agreed, setAgreed] = useState(false);

  const [isForgotPasswordOpen, setIsForgotPasswordOpen] =
    useState(false);

  const isRegister = mode === "register";
  const isStaff = !isRegister && activeTab === "staff";
  const isDoctor = !isRegister && activeTab === "doctor";

  const showGoogleAuth = isRegister || activeTab === "owner";

  const getDashboard = (role) => {
    if (role === "staff") return "/staff/dashboard";
    if (role === "doctor") return "/doctor/dashboard";
    return "/owner/dashboard";
  };

  const handleBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push("/");
    }
  };

  const handleGoogleSignIn = async () => {
    if (loading) return;

    setLoading(true);

    const role = isRegister ? "owner" : activeTab;

    const callbackUrl = isRegister
      ? "/owner/select-category"
      : getDashboard(role);

    try {
      document.cookie = [
        `zeriy_login_role=${role}`,
        "Path=/",
        "Max-Age=600",
        "SameSite=Lax",
        ...(window.location.protocol === "https:" ? ["Secure"] : []),
      ].join("; ");

      await signIn("google", {
        callbackUrl,
        redirect: true,
      });
    } catch (error) {
      console.error("Google sign-in error:", error);
      toast.error("Unable to continue with Google. Please try again.");
      setLoading(false);
    }
  };

  const handleManualLogin = async (event) => {
    event.preventDefault();

    if (loading) return;

    if (!identifier.trim() || !password) {
      toast.error("Please enter your ID/email/mobile and password.");
      return;
    }

    setLoading(true);

    try {
      const role = activeTab;
      const destination = getDashboard(role);

      const result = await signIn("credentials", {
        identifier: identifier.trim(),
        password,
        role,
        redirect: false,
        callbackUrl: destination,
      });

      if (result?.error || !result?.ok) {
        toast.error("Invalid ID/email, password, or account access.");
        return;
      }

      const session = await getSession();
      const user = session?.user;

      if (!user || user.role !== role) {
        throw new Error("Unable to establish your login session.");
      }

      toast.success("Login successful.");
      setIdentifier("");
setPassword("");
setConfirmPassword("");
setShowPassword(false);
setAgreed(false);

      if (onLoginSuccess) {
        onLoginSuccess(user);
      } else {
        router.replace(result.url || destination);
        router.refresh();
      }
    } catch (error) {
      console.error("Login error:", error);
      toast.error(error.message || "Unable to log in. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (event) => {
    event.preventDefault();

    if (loading) return;

    if (
      !name.trim() ||
      !email.trim() ||
      !phone.trim() ||
      !password ||
      !confirmPassword
    ) {
      toast.error("Please fill in all required fields.");
      return;
    }

    if (!/^[6-9]\d{9}$/.test(phone.trim())) {
      toast.error("Please enter a valid 10-digit Indian mobile number.");
      return;
    }

    if (password !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }

    if (password.length < 8) {
      toast.error("Password must contain at least 8 characters.");
      return;
    }

    setLoading(true);

    try {
      const normalizedEmail = email.trim().toLowerCase();
      const normalizedPhone = phone.trim();

      const response = await fetch("/api/owner/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fullName: name.trim(),
          email: normalizedEmail,
          mobile: normalizedPhone,
          password,
          confirmPassword,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.error || result.message || "Registration failed."
        );
      }
      setName("");
setEmail("");
setPhone("");
setPassword("");
setConfirmPassword("");
setIdentifier("");
setShowPassword(false);
setAgreed(false);

      sessionStorage.setItem(
        "zeriy_registration",
        JSON.stringify({
          name: name.trim(),
          email: normalizedEmail,
          password:password,
          phone: normalizedPhone,
        })
      );


      router.push(
        `/verify-otp?email=${encodeURIComponent(normalizedEmail)}`
      );
    } catch (error) {
      toast.error(error.message || "Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    "w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/10";

  return (
    <div className="mx-auto my-5 w-full max-w-md px-4 sm:my-10 sm:px-0">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xl shadow-slate-200/50 sm:rounded-3xl sm:p-8">
        <button
          type="button"
          onClick={handleBack}
          aria-label="Go back"
          className="mb-5 inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-600 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-600"
        >
          <ArrowLeft size={20} />
        </button>

        <div className="mb-7 text-center">
          <div className="mx-auto mb-4 flex h-[60px] w-[60px] items-center justify-center overflow-hidden rounded-2xl bg-indigo-600 shadow-lg shadow-indigo-600/20">
            <Image
              src="/logo.png"
              alt="Zeriy Logo"
              width={52}
              height={52}
              className="h-full w-full object-contain"
              priority
            />
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            {isRegister ? "Create your account" : "Welcome to Zeriy"}
          </h1>

          <p className="mt-2 text-sm text-slate-500">
            {isRegister
              ? "Create an account to get started."
              : "Sign in to continue to your account."}
          </p>
        </div>

        {!isRegister && (
          <div className="mb-6 grid grid-cols-3 rounded-xl bg-slate-100 p-1">
            {["owner", "staff", "doctor"].map((role) => (
              <button
                key={role}
                type="button"
                onClick={() => setActiveTab(role)}
                className={`rounded-lg px-2 py-2.5 text-sm font-semibold capitalize transition ${
                  activeTab === role
                    ? "bg-white text-indigo-700 shadow-sm"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                {role}
              </button>
            ))}
          </div>
        )}

        {showGoogleAuth && (
          <>
            <GoogleAuthButton
              onGoogleClick={handleGoogleSignIn}
              disabled={loading}
            />

            <div className="my-6 flex items-center gap-3">
              <div className="h-px flex-1 bg-slate-200" />
              <span className="text-xs font-medium text-slate-400">
                OR CONTINUE WITH EMAIL
              </span>
              <div className="h-px flex-1 bg-slate-200" />
            </div>
          </>
        )}

        <form
          onSubmit={isRegister ? handleRegister : handleManualLogin}
          className="space-y-4"
        >
          {isRegister && (
            <>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Full name
                </label>
                <div className="relative">
                  <UserRound
                    size={17}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    type="text"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Enter your full name"
                    autoComplete="name"
                    className={inputClass}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Email address
                </label>
                <div className="relative">
                  <Mail
                    size={17}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@example.com"
                    autoComplete="email"
                    className={inputClass}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Phone number
                </label>
                <div className="relative">
                  <Phone
                    size={17}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    type="tel"
                    value={phone}
                    onChange={(event) =>
                      setPhone(
                        event.target.value.replace(/\D/g, "").slice(0, 10)
                      )
                    }
                    placeholder="Enter 10-digit mobile number"
                    autoComplete="tel"
                    inputMode="numeric"
                    maxLength={10}
                    pattern="[6-9][0-9]{9}"
                    className={inputClass}
                    required
                  />
                </div>
              </div>
            </>
          )}

          {!isRegister && (
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                {isStaff || isDoctor
                  ? "ID or Email"
                  : "Email or mobile number"}
              </label>

              <div className="relative">
                {isStaff || isDoctor ? (
                  <UserRound
                    size={17}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                ) : (
                  <Mail
                    size={17}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                )}

                <input
                  type="text"
                  value={identifier}
                  onChange={(event) => setIdentifier(event.target.value)}
                  placeholder={
                    isStaff || isDoctor
                      ? "Enter your ID or email"
                      : "Enter email or mobile number"
                  }
                  autoComplete="username"
                  className={inputClass}
                  required
                />
              </div>
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Password
            </label>

            <div className="relative">
              <LockKeyhole
                size={17}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
              />

              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder={
                  isRegister ? "Create a password" : "Enter your password"
                }
                autoComplete={isRegister ? "new-password" : "current-password"}
                className={`${inputClass} pr-11`}
                required
              />

              <button
                type="button"
                onClick={() => setShowPassword((previous) => !previous)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-700"
              >
                {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
          </div>

          {isRegister && (
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Confirm password
              </label>

              <div className="relative">
                <LockKeyhole
                  size={17}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  type={showPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder="Confirm your password"
                  autoComplete="new-password"
                  className={inputClass}
                  required
                />
              </div>

              {confirmPassword.length > 0 && (
                <p
                  className={`mt-1.5 text-xs font-medium ${
                    password === confirmPassword
                      ? "text-emerald-600"
                      : "text-rose-500"
                  }`}
                >
                  {password === confirmPassword
                    ? "Passwords match"
                    : "Passwords do not match"}
                </p>
              )}
            </div>
          )}

          {!isRegister && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setIsForgotPasswordOpen(true)}
                className="-mt-3 text-xs font-semibold text-indigo-600 hover:text-indigo-700 hover:underline"
              >
                Forgot password?
              </button>
            </div>
          )}
          
            <div className="flex items-start gap-2 mt-8">
  <input
  type="checkbox"
  required
  name="agree"
  id="agree"
  checked={agreed}
  onChange={(e) => setAgreed(e.target.checked)}
  className="mt-1 h-4 w-4 shrink-0 cursor-pointer rounded border-gray-300 text-indigo-600"
/>

  <label
    htmlFor="agree"
    className="mt-1 text-sm leading-5 text-gray-600"
  >
    I agree to the{" "}
    <a
      href="/terms"
      className="font-medium text-indigo-600 hover:text-indigo-700 hover:underline"
    >
      Terms & Conditions
    </a>{" "}
    and{" "}
    <a
      href="/privacy"
      className="font-medium text-indigo-600 hover:text-indigo-700 hover:underline"
    >
      Privacy Policy
    </a>
    .
  </label>
</div>

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-600/20 transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading && <LoaderCircle size={17} className="animate-spin" />}

            {loading
              ? "Please wait..."
              : isRegister
                ? "Create account"
                : isDoctor
                  ? "Sign in as Doctor"
                  : isStaff
                    ? "Sign in as Staff"
                    : "Sign in as Owner"}
          </button>
          
        </form>

        <p className="mt-6 text-center text-sm text-slate-500">
          {isRegister ? "Already have an account?" : "Don't have an account?"}{" "}
          <button
            type="button"
            onClick={() => router.push(isRegister ? "/signin" : "/register")}
            className="font-semibold text-indigo-600 hover:text-indigo-700"
          >
            {isRegister ? "Sign in" : "Create account"}
          </button>
        </p>
      </div>

      {!isRegister && (
        <ForgotPasswordModal
          isOpen={isForgotPasswordOpen}
          onClose={() => setIsForgotPasswordOpen(false)}
          defaultIdentifier={identifier}
          accountType={activeTab}
        />
      )}
    </div>
  );
}
