
import { connection } from "next/server";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export default async function HomePage() {
  await connection();

  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/signin");
  }

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
