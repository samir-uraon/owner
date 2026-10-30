
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  LoaderCircle,
  LockKeyhole,
  Mail,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  User,
  X,
} from "lucide-react";

const OTP_LENGTH = 6;
const RESEND_SECONDS = 30;

function normalizeRole(role) {
  const value = String(role || "owner").toLowerCase().trim();

  return ["owner", "staff", "doctor"].includes(value) ? value : "owner";
}

function getErrorMessage(data, fallback) {
  return data?.message || data?.error || fallback;
}

export default function ForgotPasswordModal({
  isOpen,
  onClose,
  defaultIdentifier = "",
  accountType = "owner",
}) {
  const normalizedRole = normalizeRole(accountType);

  const defaultIdentifierRef = useRef(defaultIdentifier);
  const otpRefs = useRef([]);
  const requestRef = useRef(false);
  const resendTimerRef = useRef(null);
  const focusTimerRef = useRef(null);

  const [step, setStep] = useState(1);
  const [identifier, setIdentifier] = useState("");
  const [otp, setOtp] = useState(Array(OTP_LENGTH).fill(""));
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(0);

  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [resetComplete, setResetComplete] = useState(false);

  useEffect(() => {
    defaultIdentifierRef.current = defaultIdentifier;
  }, [defaultIdentifier]);

  const clearTimers = useCallback(() => {
    if (resendTimerRef.current) {
      clearInterval(resendTimerRef.current);
      resendTimerRef.current = null;
    }

    if (focusTimerRef.current) {
      clearTimeout(focusTimerRef.current);
      focusTimerRef.current = null;
    }
  }, []);

  const resetForm = useCallback(() => {
    clearTimers();

    setStep(1);
    setIdentifier(defaultIdentifierRef.current || "");
    setOtp(Array(OTP_LENGTH).fill(""));
    setPassword("");
    setConfirmPassword("");

    setShowPassword(false);
    setShowConfirmPassword(false);

    setLoading(false);
    setResending(false);
    setResendCountdown(0);

    setError("");
    setSuccessMessage("");
    setResetComplete(false);

    otpRefs.current = [];
  }, [clearTimers]);

  useEffect(() => {
    if (isOpen) {
      resetForm();
    } else {
      clearTimers();
    }

    return clearTimers;
  }, [isOpen, normalizedRole, resetForm, clearTimers]);

  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (event) => {
      if (event.key === "Escape" && !requestRef.current) {
        onClose?.();
      }
    };

    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  useEffect(() => {
    if (resendCountdown <= 0) return;

    resendTimerRef.current = setInterval(() => {
      setResendCountdown((current) => {
        if (current <= 1) {
          if (resendTimerRef.current) {
            clearInterval(resendTimerRef.current);
            resendTimerRef.current = null;
          }

          return 0;
        }

        return current - 1;
      });
    }, 1000);

    return () => {
      if (resendTimerRef.current) {
        clearInterval(resendTimerRef.current);
        resendTimerRef.current = null;
      }
    };
  }, [resendCountdown > 0]);

  const closeModal = () => {
    if (requestRef.current) return;
    onClose?.();
  };

  const startResendCountdown = () => {
    setResendCountdown(RESEND_SECONDS);
  };

  const handleSendOtp = async (event) => {
    event?.preventDefault();

    if (!identifier.trim()) {
      setError("Enter your registered email or mobile number.");
      return;
    }

    if (requestRef.current) return;

    requestRef.current = true;
    setLoading(true);
    setError("");
    setSuccessMessage("");

    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          identifier: identifier.trim(),
          accountType: normalizedRole,
          action: "send-otp",
          accountType
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          getErrorMessage(
            data,
            "Unable to send the verification code. Please try again."
          )
        );
      }

      setStep(2);
      setOtp(Array(OTP_LENGTH).fill(""));
      setPassword("");
      setConfirmPassword("");
      setSuccessMessage(
        data?.message || "If your account is eligible, a verification code has been sent."
      );

      startResendCountdown();

      focusTimerRef.current = setTimeout(() => {
        otpRefs.current[0]?.focus();
      }, 150);
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      requestRef.current = false;
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendCountdown > 0 || requestRef.current) return;

    requestRef.current = true;
    setResending(true);
    setError("");
    setSuccessMessage("");

    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          identifier: identifier.trim(),
          accountType: normalizedRole,
          action: "send-otp",
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          getErrorMessage(data, "Unable to resend the code. Please try again.")
        );
      }

      setOtp(Array(OTP_LENGTH).fill(""));
      setSuccessMessage(data?.message || "A new verification code has been requested.");
      startResendCountdown();

      focusTimerRef.current = setTimeout(() => {
        otpRefs.current[0]?.focus();
      }, 100);
    } catch (err) {
      setError(err.message || "Unable to resend the code.");
    } finally {
      requestRef.current = false;
      setResending(false);
    }
  };

  const handleOtpChange = (index, rawValue) => {
    const digits = rawValue.replace(/\D/g, "");

    setError("");
    setSuccessMessage("");

    if (!digits) {
      setOtp((current) =>
        current.map((value, i) => (i === index ? "" : value))
      );
      return;
    }

    setOtp((current) => {
      const next = [...current];

      if (digits.length > 1) {
        const pastedDigits = digits.slice(0, OTP_LENGTH - index);

        pastedDigits.split("").forEach((digit, offset) => {
          next[index + offset] = digit;
        });
      } else {
        next[index] = digits;
      }

      const nextEmptyIndex = next.findIndex((value) => !value);

      focusTimerRef.current = setTimeout(() => {
        if (nextEmptyIndex !== -1) {
          otpRefs.current[nextEmptyIndex]?.focus();
        } else {
          otpRefs.current[OTP_LENGTH - 1]?.focus();
        }
      }, 0);

      return next;
    });
  };

  const handleOtpKeyDown = (index, event) => {
    if (event.key === "Backspace") {
      if (otp[index]) {
        setOtp((current) =>
          current.map((value, i) => (i === index ? "" : value))
        );
      } else if (index > 0) {
        otpRefs.current[index - 1]?.focus();
      }
    }

    if (event.key === "ArrowLeft" && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }

    if (event.key === "ArrowRight" && index < OTP_LENGTH - 1) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpPaste = (event) => {
    const pasted = event.clipboardData
      .getData("text")
      .replace(/\D/g, "")
      .slice(0, OTP_LENGTH);

    if (!pasted) return;

    event.preventDefault();

    setOtp(
      Array.from({ length: OTP_LENGTH }, (_, index) => pasted[index] || "")
    );

    const focusIndex = Math.min(pasted.length, OTP_LENGTH) - 1;

    focusTimerRef.current = setTimeout(() => {
      otpRefs.current[Math.max(focusIndex, 0)]?.focus();
    }, 0);
  };

  const handleResetPassword = async (event) => {
    event.preventDefault();

    setError("");
    setSuccessMessage("");

    const code = otp.join("");

    if (code.length !== OTP_LENGTH) {
      setError("Enter the complete six-digit verification code.");
      otpRefs.current[otp.findIndex((digit) => !digit)]?.focus();
      return;
    }

    if (password.length < 8) {
      setError("Your password must contain at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Your passwords do not match.");
      return;
    }

    if (requestRef.current) return;

    requestRef.current = true;
    setLoading(true);

    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          identifier: identifier.trim(),
          accountType: normalizedRole,
          otp: code,
          password,
          confirmPassword,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          getErrorMessage(
            data,
            "Unable to reset your password. Check the code and try again."
          )
        );
      }

      setResetComplete(true);
      setStep(3);
      setOtp(Array(OTP_LENGTH).fill(""));
      setPassword("");
      setConfirmPassword("");
      setSuccessMessage(
        data?.message || "Your password has been updated successfully."
      );
    } catch (err) {
      setError(err.message || "Unable to reset your password.");
    } finally {
      requestRef.current = false;
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const title =
    step === 1
      ? "Reset your password"
      : step === 2
        ? "Verify your identity"
        : "Password updated";

  const subtitle =
    step === 1
      ? "Enter the email or mobile number linked to your account."
      : step === 2
        ? "Enter your verification code and choose a new password."
        : "Your account is ready. You can sign in with your new password.";

  const roleLabel = {
    owner: "Owner account",
    staff: "Staff account",
    doctor: "Doctor account",
  }[normalizedRole];

  const inputClass =
    "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10";

  const labelClass = "mb-1.5 block text-sm font-medium text-slate-700";

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/55 p-3 backdrop-blur-sm sm:p-5"
      
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="forgot-password-title"
        className="relative flex max-h-[92dvh] w-full max-w-[420px] flex-col overflow-hidden rounded-2xl border border-white/70 bg-white shadow-2xl shadow-slate-950/20 sm:rounded-3xl"
      >
        <div className="relative shrink-0 border-b border-slate-100 px-5 pb-5 pt-5 sm:px-7 sm:pt-6">
          <button
            type="button"
            onClick={closeModal}
            disabled={loading || resending}
            aria-label="Close password reset"
            className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-40 sm:right-5 sm:top-5"
          >
            <X size={18} />
          </button>

          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-600/20">
              {step === 3 ? (
                <CheckCircle2 size={22} />
              ) : (
                <KeyRound size={21} />
              )}
            </div>

            <div>
              <p className="text-base font-bold tracking-tight text-slate-900">
                Zeric
              </p>
              <p className="mt-0.5 text-xs text-slate-500">{roleLabel}</p>
            </div>
          </div>

          <div className="mb-4 flex items-center gap-2">
            {[1, 2, 3].map((item) => (
              <div
                key={item}
                className={`h-1 flex-1 rounded-full transition-colors ${
                  item <= step ? "bg-indigo-600" : "bg-slate-100"
                }`}
              />
            ))}
          </div>

          <h2
            id="forgot-password-title"
            className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl"
          >
            {title}
          </h2>

          <p className="mt-1.5 max-w-[330px] text-sm leading-5 text-slate-500">
            {subtitle}
          </p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-7 sm:py-6">
          {error && (
            <div
              role="alert"
              className="mb-4 flex items-start gap-2.5 rounded-xl border border-red-100 bg-red-50 px-3.5 py-3 text-sm leading-5 text-red-700"
            >
              <ShieldCheck size={17} className="mt-0.5 shrink-0 rotate-180" />
              <span>{error}</span>
            </div>
          )}

          {successMessage && step !== 3 && (
            <div
              role="status"
              className="mb-4 flex items-start gap-2.5 rounded-xl border border-emerald-100 bg-emerald-50 px-3.5 py-3 text-sm leading-5 text-emerald-800"
            >
              <CheckCircle2 size={17} className="mt-0.5 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {step === 1 && (
            <form onSubmit={handleSendOtp} className="space-y-5">
              <div>
              <label htmlFor="reset-identifier" className={labelClass}>
  {accountType === "staff" || accountType === "doctor"
    ? "ID or Email"
    : "Email address or mobile number"}
</label>

<div className="relative">
  <div className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-slate-400">
  {accountType == "owner"?<Mail size={17} />:<User size={17}/>}  
  </div>

  <input
    id="reset-identifier"
    type="text"
    autoComplete="username"
    value={identifier}
    onChange={(event) => {
      setIdentifier(event.target.value);
      setError("");
    }}
    placeholder={
      accountType !== "owner"
        ? "Enter Your ID or email"
        : "Enter email or mobile number"
    }
    className={`${inputClass} pl-10`}
    required
    autoFocus
  />
</div>

                <p className="mt-2 text-xs leading-5 text-slate-500">
                  We’ll send a verification code if the account is eligible.
                </p>
              </div>

              <button
                type="submit"
                disabled={loading || !identifier.trim()}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-600/15 transition hover:bg-indigo-700 focus:outline-none focus:ring-4 focus:ring-indigo-500/20 disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none"
              >
                {loading ? (
                  <>
                    <LoaderCircle size={17} className="animate-spin" />
                    Sending code...
                  </>
                ) : (
                  <>
                    Send verification code
                    <ArrowRight size={17} />
                  </>
                )}
              </button>
            </form>
          )}

          {step === 2 && (
            <form onSubmit={handleResetPassword} className="space-y-5">
              <div>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <label className="text-sm font-medium text-slate-700">
                    Verification code
                  </label>

                  <button
                    type="button"
                    onClick={() => {
                      setStep(1);
                      setError("");
                      setSuccessMessage("");
                    }}
                    disabled={loading || resending}
                    className="text-xs font-semibold text-indigo-600 transition hover:text-indigo-800 disabled:opacity-50"
                  >
                    Change account
                  </button>
                </div>

                <div
                  className="grid grid-cols-6 gap-1.5 sm:gap-2"
                  aria-label="Six-digit verification code"
                >
                  {otp.map((digit, index) => (
                    <input
                      key={index}
                      ref={(element) => {
                        otpRefs.current[index] = element;
                      }}
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      autoComplete={index === 0 ? "one-time-code" : "off"}
                      aria-label={`Verification digit ${index + 1}`}
                      value={digit}
                      maxLength={OTP_LENGTH}
                      onChange={(event) =>
                        handleOtpChange(index, event.target.value)
                      }
                      onKeyDown={(event) => handleOtpKeyDown(index, event)}
                      onPaste={handleOtpPaste}
                      className="h-12 min-w-0 rounded-xl border border-slate-200 bg-slate-50 text-center text-lg font-bold text-slate-900 outline-none transition hover:border-slate-300 focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 sm:h-14 sm:text-xl"
                    />
                  ))}
                </div>

                <div className="mt-3 flex items-center justify-between gap-2">
                  <span className="text-xs text-slate-500">
                    Didn’t receive the code?
                  </span>

                  <button
                    type="button"
                    onClick={handleResendOtp}
                    disabled={resendCountdown > 0 || resending || loading}
                    className="inline-flex shrink-0 items-center gap-1.5 text-xs font-semibold text-indigo-600 transition hover:text-indigo-800 disabled:cursor-not-allowed disabled:text-slate-400"
                  >
                    {resending ? (
                      <LoaderCircle size={13} className="animate-spin" />
                    ) : (
                      <RefreshCw size={12} />
                    )}

                    {resending
                      ? "Sending..."
                      : resendCountdown > 0
                        ? `Resend in ${resendCountdown}s`
                        : "Resend code"}
                  </button>
                </div>
              </div>

              <div className="border-t border-slate-100" />

              <div>
                <label htmlFor="new-password" className={labelClass}>
                  New password
                </label>

                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-slate-400">
                    <LockKeyhole size={17} />
                  </div>

                  <input
                    id="new-password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    value={password}
                    onChange={(event) => {
                      setPassword(event.target.value);
                      setError("");
                    }}
                    placeholder="At least 8 characters"
                    minLength={8}
                    className={`${inputClass} pl-10 pr-11`}
                    required
                  />

                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="absolute inset-y-0 right-3 flex items-center text-slate-400 transition hover:text-slate-700"
                  >
                    {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>

                <p className="mt-1.5 text-xs text-slate-500">
                  Use at least 8 characters.
                </p>
              </div>

              <div>
                <label htmlFor="confirm-password" className={labelClass}>
                  Confirm new password
                </label>

                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-slate-400">
                    <LockKeyhole size={17} />
                  </div>

                  <input
                    id="confirm-password"
                    type={showConfirmPassword ? "text" : "password"}
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(event) => {
                      setConfirmPassword(event.target.value);
                      setError("");
                    }}
                    placeholder="Re-enter your password"
                    minLength={8}
                    className={`${inputClass} pl-10 pr-11`}
                    required
                  />

                  <button
                    type="button"
                    onClick={() =>
                      setShowConfirmPassword((value) => !value)
                    }
                    aria-label={
                      showConfirmPassword
                        ? "Hide confirm password"
                        : "Show confirm password"
                    }
                    className="absolute inset-y-0 right-3 flex items-center text-slate-400 transition hover:text-slate-700"
                  >
                    {showConfirmPassword ? (
                      <EyeOff size={17} />
                    ) : (
                      <Eye size={17} />
                    )}
                  </button>
                </div>

                {confirmPassword && (
                  <p
                    className={`mt-1.5 text-xs ${
                      password === confirmPassword
                        ? "text-emerald-600"
                        : "text-slate-500"
                    }`}
                  >
                    {password === confirmPassword
                      ? "Passwords match"
                      : "Passwords do not match yet"}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={
                  loading ||
                  otp.join("").length !== OTP_LENGTH ||
                  password.length < 8 ||
                  password !== confirmPassword
                }
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-600/15 transition hover:bg-indigo-700 focus:outline-none focus:ring-4 focus:ring-indigo-500/20 disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none"
              >
                {loading ? (
                  <>
                    <LoaderCircle size={17} className="animate-spin" />
                    Updating password...
                  </>
                ) : (
                  <>
                    <LockKeyhole size={16} />
                    Reset password
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  setStep(1);
                  setError("");
                  setSuccessMessage("");
                }}
                disabled={loading || resending}
                className="flex w-full items-center justify-center gap-2 py-1 text-sm font-medium text-slate-500 transition hover:text-slate-800 disabled:opacity-50"
              >
                <ArrowLeft size={15} />
                Back
              </button>
            </form>
          )}

          {step === 3 && resetComplete && (
            <div className="py-3 text-center">
              <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 ring-8 ring-emerald-50/60">
                <Check size={30} strokeWidth={2.5} />
              </div>

              <h3 className="text-lg font-bold text-slate-900">
                You’re all set!
              </h3>

              <p className="mx-auto mt-2 max-w-[290px] text-sm leading-6 text-slate-500">
                Your password has been reset. Use your new password the next
                time you sign in.
              </p>

              <button
                type="button"
                onClick={closeModal}
                className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700 focus:outline-none focus:ring-4 focus:ring-indigo-500/20"
              >
                Continue to sign in
                <ArrowRight size={17} />
              </button>
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center justify-center gap-2 border-t border-slate-100 bg-slate-50/70 px-5 py-3.5 text-xs text-slate-500">
          <ShieldCheck size={14} className="text-emerald-600" />
          Secure password recovery
        </div>
      </div>
    </div>
  );
}
