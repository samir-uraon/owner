
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export async function getAdminSession() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return null;
  }

  const adminEmails = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

  const email = session.user.email.trim().toLowerCase();

  if (
    session.user.role !== "admin" ||
    !adminEmails.includes(email)
  ) {
    return null;
  }

  return session;
}
