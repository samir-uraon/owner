
"use client";

import { SessionProvider } from "next-auth/react";
import { Suspense } from "react";

export default function Providers({ children }) {
  return (
    <SessionProvider>
      <Suspense
        fallback={
          <div className="flex min-h-screen items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
          </div>
        }
      >
        {children}
      </Suspense>
    </SessionProvider>
  );
}
