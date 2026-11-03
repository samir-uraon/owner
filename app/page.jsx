 
import { Suspense } from "react";
import { connection } from "next/server";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

function Loading() {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-white">
      <div className="h-9 w-9 animate-spin rounded-full border-4 border-gray-200 border-t-indigo-600" />
    </div>
  );
}

async function HomeRedirect() {
  await connection();

  const session = await getServerSession(authOptions);

  if (!session?.user) redirect("/signin");

  const role = String(session.user.role || "").toLowerCase();

  switch (role) {
    case "owner":
      redirect("/owner/dashboard");
    case "doctor":
      redirect("/doctor/dashboard");
    case "staff":
      redirect("/staff/dashboard");
    default:
      redirect("/signin");
  }
}

export default function HomePage() {
  return (
    <Suspense fallback={<Loading />}>
      <HomeRedirect />
    </Suspense>
  );
}
