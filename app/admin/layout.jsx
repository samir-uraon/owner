
import { Suspense } from "react";
import { connection } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import AdminLogin from "./AdminLogin";
import AdminDashboardLayout from "./AdminDashboardLayout";
 
 
function AdminLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f8f9fc]">
      <div className="h-9 w-9 animate-spin rounded-full border-4 border-violet-600 border-t-transparent" />
    </div>
  );
}

async function AdminAccess({ children }) {
  await connection();

  const session = await getAdminSession();

  if (!session) {
    return <AdminLogin />;
  }

  return (
    <AdminDashboardLayout>
      {children}
    </AdminDashboardLayout>
  );
}

export default function AdminLayout({ children }) {
  return (
    <Suspense fallback={<AdminLoading />}>
      <AdminAccess>{children}</AdminAccess>
    </Suspense>
  );
}
