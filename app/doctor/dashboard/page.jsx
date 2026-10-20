
import { Suspense } from "react";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import TeamDashboard from "@/components/dashboard/TeamDashboard";

export const metadata = {
  title: "Doctor Dashboard | Zeric",
  description: "Manage patient appointments and your profile.",
};

export const instant = false;

async function DoctorDashboardContent() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/signin");
  }

  if (session.user.role !== "doctor") {
    redirect("/");
  }

  return <TeamDashboard role="doctor" />;
}

export default function DoctorDashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
        </div>
      }
    >
      <DoctorDashboardContent />
    </Suspense>
  );
}
