 
"use client";

import React, {
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import {
  ArrowLeft,
  CheckCircle2,
  LoaderCircle,
  Mail,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { toast } from "react-toastify";

function VerifyOtpContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get("email") || "";

  const [otp, setOtp] = useState(Array(6).fill(""));
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendSeconds, setResendSeconds] = useState(30);
  const [resendDeadline, setResendDeadline] = useState(
    () => Date.now() + 30_000
  );

  const inputRefs = useRef([]);

  // Accurate countdown based on the actual deadline
  useEffect(() => {
    let timerId;

    const tick = () => {
      const remaining = Math.max(
        0,
        Math.ceil((resendDeadline - Date.now()) / 1000)
      );

      setResendSeconds(remaining);

      if (remaining > 0) {
        timerId = setTimeout(tick, 250);
      }
    };

    tick();

    return () => {
      if (timerId) clearTimeout(timerId);
    };
  }, [resendDeadline]);

  const handleOtpChange = (value, index) => {
    const digit = value.replace(/\D/g, "").slice(-1);
    const updatedOtp = [...otp];

    updatedOtp[index] = digit;
    setOtp(updatedOtp);

    if (digit && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (event, index) => {
    if (
      event.key === "Backspace" &&
      !otp[index] &&
      index > 0
    ) {
      inputRefs.current[index - 1]?.focus();
    }

    if (event.key === "ArrowLeft" && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }

    if (event.key === "ArrowRight" && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (event) => {
    event.preventDefault();

    const pasted = event.clipboardData
      .getData("text")
      .replace(/\D/g, "")
      .slice(0, 6);

    if (!pasted) return;

    const updatedOtp = Array(6).fill("");

    pasted.split("").forEach((digit, index) => {
      updatedOtp[index] = digit;
    });

    setOtp(updatedOtp);

    const focusIndex = Math.min(pasted.length, 5);
    inputRefs.current[focusIndex]?.focus();
  };

  const handleVerify = async (event) => {
    event.preventDefault();

    if (!email) {
      toast.error("Email address is missing. Please register again.");
      return;
    }

    const code = otp.join("");

    if (code.length !== 6) {
      toast.error("Please enter the complete 6-digit OTP.");
      return;
    }

    setLoading(true);

    try {
     const response = await fetch("/api/owner/verify-otp", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    email,
    otp,
  }),
});

const data = await response.json();

if (!response.ok || !data.success) {
  throw new Error(data.error || "OTP verification failed.");
}

const result = await signIn("credentials", {
  identifier: email,
  password,
  role: "owner",
  redirect: false,
  callbackUrl: "/owner/select-categoty",
});

if (result?.error) {
  toast.error("Email verified. Please log in to continue.");
  return;
}



    
      if (!response.ok) {
        throw new Error(data.message || data.error || "OTP verification failed.");
      }

      toast.success(data.message || "Email verified successfully!");

      router.replace("/owner/select-category");
    } catch (error) {
      toast.error(error.message || "Unable to verify OTP.");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = useCallback(async () => {
    if (!email) {
      toast.error("Email address is missing. Please register again.");
      return;
    }

    if (resendSeconds > 0 || resending || loading) {
      return;
    }

    setResending(true);

    try {
      const response = await fetch("/api/owner/resend-register-otp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || data.error || "Could not resend OTP.");
      }

      setOtp(Array(6).fill(""));
      setResendDeadline(Date.now() + 30_000);

      toast.success(data.message || "A new OTP has been sent.");

      inputRefs.current[0]?.focus();
    } catch (error) {
      toast.error(error.message || "Unable to resend OTP.");
    } finally {
      setResending(false);
    }
  }, [email, resendSeconds, resending, loading]);

  const formattedTime = `00:${String(resendSeconds).padStart(2, "0")}`;

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-50 px-4 py-10">
      <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-indigo-200/40 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-violet-200/40 blur-3xl" />

      <button
        type="button"
        onClick={() => router.back()}
        className="absolute left-5 top-5 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-100 sm:left-8 sm:top-8"
      >
        <ArrowLeft size={17} />
        Back
      </button>

      <section className="relative w-full max-w-md rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xl shadow-indigo-950/5 sm:p-9">
  

        <div className="mb-6 flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 ring-1 ring-indigo-100">
       <Image
            src="/logo.png"
            alt="Zeric"
            width={140}
            height={48}
            priority
            className="h-12 w-auto object-contain"
          />
          </div>
        </div>

        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Verify your email
          </h1>

          <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-slate-500">
            Enter the 6-digit verification code sent to your email address.
          </p>
        </div>

        <div className="mt-6 flex items-center gap-3 rounded-2xl border border-indigo-100 bg-indigo-50/70 p-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-indigo-600 shadow-sm">
            <Mail size={19} />
          </div>

          <div className="min-w-0">
            <p className="text-xs font-medium text-slate-500">
              Verification email
            </p>
            <p className="break-all text-sm font-semibold text-slate-800">
              {email || "Email address unavailable"}
            </p>
          </div>
        </div>

        <form onSubmit={handleVerify} className="mt-8">
          <label className="mb-3 block text-center text-sm font-semibold text-slate-700">
            Enter verification code
          </label>

          <div
            className="flex justify-center gap-2 sm:gap-3"
            onPaste={handlePaste}
          >
            {otp.map((digit, index) => (
              <input
                key={index}
                ref={(element) => {
                  inputRefs.current[index] = element;
                }}
                type="text"
                inputMode="numeric"
                autoComplete={index === 0 ? "one-time-code" : "off"}
                aria-label={`OTP digit ${index + 1}`}
                maxLength={1}
                value={digit}
                disabled={loading}
                onChange={(event) =>
                  handleOtpChange(event.target.value, index)
                }
                onKeyDown={(event) => handleKeyDown(event, index)}
                className="h-12 w-10 rounded-xl border border-slate-200 bg-slate-50 text-center text-lg font-bold text-slate-900 outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-100 disabled:opacity-60 sm:h-14 sm:w-12 sm:text-xl"
              />
            ))}
          </div>

          <button
            type="submit"
            disabled={loading || otp.join("").length !== 6 || !email}
            className="mt-7 flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3.5 text-sm font-semibold text-white shadow-lg shadow-indigo-600/20 transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? (
              <>
                <LoaderCircle size={18} className="animate-spin" />
                Verifying...
              </>
            ) : (
              <>
                <CheckCircle2 size={18} />
                Verify email
              </>
            )}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-sm text-slate-500">
            Didn&apos;t receive the code?
          </p>

          <button
            type="button"
            onClick={handleResend}
            disabled={
              !email ||
              resendSeconds > 0 ||
              resending ||
              loading
            }
            className="mt-3 inline-flex min-h-9 items-center justify-center gap-2 rounded-lg px-3 text-sm font-semibold text-indigo-600 transition hover:bg-indigo-50 disabled:cursor-not-allowed disabled:text-slate-400 disabled:hover:bg-transparent"
          >
            {resending ? (
              <>
                <LoaderCircle size={16} className="animate-spin" />
                Sending new code...
              </>
            ) : resendSeconds > 0 ? (
              <>
                <RefreshCw size={15} />
                Resend code in {formattedTime}
              </>
            ) : (
              <>
                <RefreshCw size={15} />
                Resend verification code
              </>
            )}
          </button>
        </div>

        <p className="mt-7 text-center text-xs leading-5 text-slate-400">
          Keep your verification code private. Never share it with anyone.
        </p>
      </section>
    </main>
  );
}

export default function VerifyOtpPage() {
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
      <VerifyOtpContent />
    </Suspense>
  );
}
