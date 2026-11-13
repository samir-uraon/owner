
"use client";

import { useEffect, useRef, useState } from "react";
import { signIn } from "next-auth/react";
import { ArrowLeft } from "lucide-react";

export default function MobileLogin() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const started = useRef(false);

  const handleGoogleLogin = async () => {
    if (loading) return;

    setLoading(true);
    setError("");

    try {
      await signIn("google", {
        callbackUrl:
          "https://zeriy-owner.vercel.app/api/mobile-auth/complete",
        redirect: true,
      });
    } catch (err) {
      console.error("Mobile Google login error:", err);
      setError("Google login failed. Please try again.");
      setLoading(false);
      started.current = false;
    }
  };

  // Automatically start Google login when the app opens this page
  useEffect(() => {
    if (started.current) return;

    started.current = true;
    handleGoogleLogin();
  }, []);

  const handleBack = () => {
    window.location.href = "/login";
  };

  return (
    <div className="min-h-screen bg-slate-50 px-3 py-5 sm:px-6 sm:py-8">
      <div className="mx-auto w-full max-w-md">

        {/* Back Button */}
        <div className="mx-auto mb-5 w-full max-w-md">
          <button
            type="button"
            onClick={handleBack}
            className="
              group inline-flex items-center gap-2
              rounded-xl border border-slate-200
              bg-white px-4 py-2.5
              text-sm font-semibold text-slate-600
              shadow-sm transition-all duration-200
              hover:border-indigo-200
              hover:bg-indigo-50
              hover:text-indigo-700
              hover:shadow-md
              active:scale-95
            "
          >
            <ArrowLeft
              size={17}
              className="transition-transform duration-200 group-hover:-translate-x-1"
            />
            Back to Login
          </button>
        </div>

        {/* Login Card */}
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-7 shadow-sm sm:rounded-3xl sm:p-8">

          {/* Header */}
          <div className="mb-7 text-center">
            <h2 className="text-xl font-black tracking-tight text-slate-900 sm:text-2xl">
              Welcome to Zeriy
            </h2>

            <p className="mx-auto mt-1.5 max-w-xs text-[11px] leading-relaxed text-slate-500 sm:text-sm">
              Made simpler and Much faster
            </p>
          </div>

          {/* Google Login Icon */}
          <div className="mb-5 flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-slate-100 bg-slate-50 shadow-sm">

              <svg
                className="h-9 w-9"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  fill="#4285F4"
                  d="M21.35 12.27c0-.71-.06-1.39-.18-2.05H12v3.88h5.24a4.48 4.48 0 0 1-1.94 2.94v2.45h3.14c1.84-1.69 2.91-4.18 2.91-7.22Z"
                />
                <path
                  fill="#34A853"
                  d="M12 21.6c2.63 0 4.84-.87 6.45-2.35l-3.14-2.45c-.87.58-1.98.92-3.31.92-2.54 0-4.7-1.72-5.47-4.03H3.28v2.53A9.75 9.75 0 0 0 12 21.6Z"
                />
                <path
                  fill="#FBBC05"
                  d="M6.53 13.69a5.86 5.86 0 0 1 0-3.38V7.78H3.28a9.75 9.75 0 0 0 0 8.44l3.25-2.53Z"
                />
                <path
                  fill="#EA4335"
                  d="M12 6.28c1.43 0 2.71.49 3.72 1.46l2.79-2.79C16.84 3.43 14.63 2.4 12 2.4a9.75 9.75 0 0 0-8.72 5.38l3.25 2.53C7.3 8 9.46 6.28 12 6.28Z"
                />
              </svg>

            </div>
          </div>

          {/* Login Information */}
          <div className="mb-6 text-center">
            <h3 className="text-base font-bold text-slate-800">
              Continue with Google
            </h3>

            <p className="mx-auto mt-2 max-w-xs text-xs leading-relaxed text-slate-500 sm:text-sm">
              Sign in securely using your Google account.
              Choose your Gmail account in the browser to continue.
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-3 text-center text-xs font-medium text-red-600">
              {error}
            </div>
          )}

          {/* Google Button */}
          <button
            type="button"
            onClick={() => {
              started.current = true;
              handleGoogleLogin();
            }}
            disabled={loading}
            className="
              group flex min-h-[30px] w-full
              items-center justify-center gap-3
              rounded-xl border border-slate-200
              bg-white px-4 py-3
              text-sm font-semibold text-slate-700
              shadow-sm transition-all duration-200
              hover:-translate-y-0.5
              hover:border-slate-300
              hover:shadow-md
              active:translate-y-0
              disabled:cursor-not-allowed
              disabled:opacity-60
            "
          >
            {loading ? (
              <>
                <span className="h-5 w-5 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
                <span>Connecting to Google...</span>
              </>
            ) : (
              <>
                <span>Continue with Google</span>
              </>
            )}
          </button>

          {/* Security Information */}
          <div className="mt-6 rounded-xl bg-slate-50 px-3 py-3 text-center">
            <p className="text-[11px] leading-relaxed text-slate-500 sm:text-xs">
              🔒 Secure authentication powered by Google and ZERIY.
            </p>
          </div>

          {/* Bottom Information */}
          <div className="mt-5 border-t border-slate-100 pt-4 text-center">
            <p className="text-[11px] leading-relaxed text-slate-400 sm:text-xs">
              💡 Login to book tokens and manage your appointments.
            </p>
          </div>

        </div>
      </div>
    </div>
  );
}
