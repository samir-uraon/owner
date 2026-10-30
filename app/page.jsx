
import { connection } from "next/server";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export default async function HomePage() {
  // Wait until an actual request arrives before reading the session.
  await connection();

  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/signin");
  }

  const role = String(session.user.role || "").toLowerCase();

  if (role === "owner") {
    redirect("/owner/dashboard");
  }

  if (role === "doctor") {
    redirect("/doctor/dashboard");
  }

  if (role === "staff") {
    redirect("/staff/dashboard");
  }

  // Handle authenticated users with an unknown or missing role.
  redirect("/signin");
}
