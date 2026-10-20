
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";

export default async function HomePage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/signin");
  }

  const role = session.user.role;

  switch (role) {
    case "owner":
      redirect("/owner/dashboard");

    case "doctor":
      redirect("/doctor/dashboard");

    case "staff":
      redirect("/staff/dashboard");

    default:
      redirect("/");
  }
}
