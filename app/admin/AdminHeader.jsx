
"use client";

import { usePathname, useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import {
  Menu,
  Bell,
  ChevronDown,
  ShieldCheck,
  LogOut,
  UserCircle,
} from "lucide-react";
import { useState } from "react";
import Link from "next/link";

const pageTitles = {
  "/admin": "Dashboard Overview",
  "/admin/users": "User Management",
  "/admin/owners": "Owner Management",
  "/admin/businesses": "Business Management",
  "/admin/team-members": "Team Members",
  "/admin/bookings": "Booking Management",
  "/admin/payments": "Payment Management",
  "/admin/refunds": "Refund Management",
  "/admin/reports": "Reports & Analytics",
  "/admin/notifications": "Notifications",
  "/admin/support": "Customer Support",
  "/admin/activity-logs": "Activity Logs",
  "/admin/settings": "Platform Settings",
};

export default function AdminHeader({ onMenuClick }) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();

  const [profileOpen, setProfileOpen] = useState(false);

  const title =
    pageTitles[pathname] ||
    Object.entries(pageTitles).find(
      ([path]) => path !== "/admin" && pathname.startsWith(`${path}/`)
    )?.[1] ||
    "Admin Panel";

  const adminName = session?.user?.name || "Super Admin";
  const adminEmail = session?.user?.email || "Administrator";

  const handleLogout = async () => {
    await signOut({
      redirect: false,
      callbackUrl: "/admin",
    });

    router.replace("/admin");
    router.refresh();
  };

  return (
    <header className="sticky top-0 z-30 flex h-[76px] items-center justify-between border-b border-gray-100 bg-white/95 px-4 backdrop-blur-xl sm:px-6 lg:px-8">

      {/* Left */}
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          onClick={onMenuClick}
          aria-label="Open navigation"
          className="rounded-xl border border-gray-200 p-2 text-gray-600 transition hover:bg-gray-50 lg:hidden"
        >
          <Menu size={20} />
        </button>

        <div className="min-w-0">
          <h1 className="truncate text-base font-bold text-gray-900 sm:text-lg">
            {title}
          </h1>
          <p className="hidden text-xs text-gray-400 sm:block">
            Welcome to your Zeriy control center
          </p>
        </div>
      </div>

      {/* Right */}
      <div className="flex items-center gap-2 sm:gap-4">

        {/* Notifications */}
        <Link
          href="/admin/notifications"
          aria-label="Notifications"
          className="relative rounded-xl border border-gray-200 p-2.5 text-gray-600 transition hover:bg-gray-50"
        >
          <Bell size={19} />
        </Link>

        {/* Profile */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setProfileOpen(!profileOpen)}
            className="flex items-center gap-2 rounded-xl border border-gray-100 p-1.5 pr-2 transition hover:bg-gray-50 sm:gap-3 sm:pr-3"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-violet-100 text-violet-700">
              <ShieldCheck size={19} />
            </div>

            <div className="hidden min-w-0 text-left sm:block">
              <p className="max-w-[130px] truncate text-xs font-semibold text-gray-900">
                {adminName}
              </p>
              <p className="text-[10px] text-gray-400">
                Super Admin
              </p>
            </div>

            <ChevronDown
              size={15}
              className="hidden text-gray-400 sm:block"
            />
          </button>

          {profileOpen && (
            <>
              <button
                type="button"
                aria-label="Close profile menu"
                className="fixed inset-0 z-40 cursor-default"
                onClick={() => setProfileOpen(false)}
              />

              <div className="absolute right-0 top-14 z-50 w-64 rounded-2xl border border-gray-100 bg-white p-3 shadow-xl">
                <div className="border-b border-gray-100 px-3 pb-3">
                  <div className="flex items-center gap-2">
                    <UserCircle size={19} className="text-violet-600" />
                    <p className="text-sm font-semibold text-gray-900">
                      {adminName}
                    </p>
                  </div>

                  <p className="mt-1 truncate pl-7 text-xs text-gray-400">
                    {adminEmail}
                  </p>

                  <span className="mt-2 inline-flex rounded-full bg-violet-50 px-2.5 py-1 text-[10px] font-semibold text-violet-700">
                    Super Administrator
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleLogout}
                  className="mt-2 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-red-600 transition hover:bg-red-50"
                >
                  <LogOut size={17} />
                  Sign out
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
