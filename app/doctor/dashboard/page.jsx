
"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

import TeamDashboard from "@/components/dashboard/TeamDashboard";
import { LoaderCircle } from "lucide-react";

export default function DoctorDashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "loading") return;

    if (!session?.user) {
      router.replace("/signin");
      return;
    }

    if (session.user.role === "staff") {
      router.replace("/staff/dashboard");
      return;
    }

    if (session.user.role === "owner") {
      router.replace("/owner/dashboard");
      return;
    }

    if (session.user.role !== "doctor") {
      router.replace("/signin");
    }
  }, [session, status, router]);

  if (status === "loading" || !session?.user) {
    return(
    <> 
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-100 text-violet-700">
            <LoaderCircle className="animate-spin" size={27} />
          </div>
          <p className="mt-4 text-sm font-semibold text-slate-700">
            Preparing your dashboard...
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Loading your profile and schedule
          </p>
        </div>
      </div>
      </>);
  }

  if (session.user.role !== "doctor") {
    return <div className="p-6">Redirecting...</div>;
  }

  return <TeamDashboard role="doctor" />;
}
