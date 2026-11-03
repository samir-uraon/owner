
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import TeamDashboard from "@/components/dashboard/TeamDashboard";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export const metadata = {
  title: "Staff Dashboard | Zeriy",
  description: "Manage customer bookings and your profile.",
};

export const instant = false;

async function StaffDashboardContent() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/signin");
  }

  if (session.user.role !== "staff") {
    redirect("/");
  }

  return <TeamDashboard role="staff" />;
}

export default function StaffDashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
        </div>
      }
    >
      <StaffDashboardContent />
    </Suspense>
  );
}
