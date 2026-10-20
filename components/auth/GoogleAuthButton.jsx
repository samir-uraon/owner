
'use client';

import React from 'react';

export default function GoogleAuthButton({
  onGoogleClick,
  disabled = false,
}) {
  return (
    <button
      type="button"
      onClick={onGoogleClick}
      disabled={disabled}
      className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-800 shadow-sm transition hover:bg-slate-50 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
    >
      {/* Google Icon */}
            <svg
              className="h-5 w-5 transition-transform duration-200 group-hover:scale-110"
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

            <span>
              {disabled
                ? "Connecting to Google..."
                : "Continue with Google"}
            </span>
          </button>
  );
}
