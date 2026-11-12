
"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  LayoutDashboard,
  Users,
  UserRound,
  Building2,
  UserCog,
  CalendarCheck,
  CreditCard,
  RefreshCcw,
  BarChart3,
  Bell,
  Headset,
  ClipboardList,
  Settings,
  ShieldCheck,
  LogOut,
  X,
  ChevronRight,
} from "lucide-react";

const navigation = [
  {
    title: "MAIN MENU",
    items: [
      { name: "Overview", href: "/admin", icon: LayoutDashboard },
      { name: "Users", href: "/admin/users", icon: Users },
      { name: "Owners", href: "/admin/owners", icon: UserRound },
      { name: "Businesses", href: "/admin/businesses", icon: Building2 },
      { name: "Team Members", href: "/admin/team-members", icon: UserCog },
    ],
  },
  {
    title: "OPERATIONS",
    items: [
      { name: "Bookings", href: "/admin/bookings", icon: CalendarCheck },
      { name: "Payments", href: "/admin/payments", icon: CreditCard },
      { name: "Refunds", href: "/admin/refunds", icon: RefreshCcw },
    ],
  },
  {
    title: "MANAGEMENT",
    items: [
      { name: "Reports", href: "/admin/reports", icon: BarChart3 },
      { name: "Notifications", href: "/admin/notifications", icon: Bell },
      { name: "Support", href: "/admin/support", icon: Headset },
      { name: "Activity Logs", href: "/admin/activity-logs", icon: ClipboardList },
      { name: "Settings", href: "/admin/settings", icon: Settings },
    ],
  },
];

export default function AdminSidebar({
  mobileOpen = false,
  setMobileOpen,
}) {
  const pathname = usePathname();
  const router = useRouter();

  const isActive = (href) => {
    if (href === "/admin") return pathname === "/admin";
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  const handleLogout = async () => {
    await signOut({
      redirect: false,
      callbackUrl: "/admin",
    });

    router.replace("/admin");
    router.refresh();
  };

  const closeMobile = () => {
    setMobileOpen?.(false);
  };

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={closeMobile}
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px] lg:hidden"
        />
      )}

      <aside
        className={`
          fixed inset-y-0 left-0 z-50 flex w-[270px] flex-col
          border-r border-gray-100 bg-white
          transition-transform duration-300
          lg:translate-x-0
          ${mobileOpen ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        {/* Brand */}
        <div className="flex h-[76px] items-center justify-between border-b border-gray-100 px-5">
          <Link
            href="/admin"
            onClick={closeMobile}
            className="flex items-center gap-3"
          >
            <img
              src="/logo2.png"
              alt="Zeriy"
              className="h-10 w-10 rounded-xl object-contain"
            />

            <div>
              <h1 className="text-lg font-extrabold tracking-tight text-gray-900">
                ZERIY
              </h1>
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-violet-600">
                Super Admin
              </p>
            </div>
          </Link>

          <button
            type="button"
            onClick={closeMobile}
            className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 lg:hidden"
          >
            <X size={19} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-7 overflow-y-auto px-4 py-6">
          {navigation.map((group) => (
            <div key={group.title}>
              <p className="mb-3 px-3 text-[10px] font-bold tracking-[0.16em] text-gray-400">
                {group.title}
              </p>

              <div className="space-y-1">
                {group.items.map((item) => {
                  const active = isActive(item.href);
                  const Icon = item.icon;

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={closeMobile}
                      className={`
                        group flex items-center justify-between rounded-xl
                        px-3 py-3 text-[13px] font-medium transition-all
                        ${
                          active
                            ? "bg-violet-50 text-violet-700"
                            : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                        }
                      `}
                    >
                      <span className="flex items-center gap-3">
                        <Icon
                          size={18}
                          strokeWidth={active ? 2.3 : 1.8}
                        />
                        {item.name}
                      </span>

                      {active && (
                        <ChevronRight size={15} />
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Admin identity */}
        <div className="border-t border-gray-100 p-4">
          <div className="mb-3 flex items-center gap-3 rounded-xl bg-gray-50 p-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-100 text-violet-700">
              <ShieldCheck size={20} />
            </div>

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-gray-900">
                Super Admin
              </p>
              <p className="text-xs text-gray-400">
                Platform Administrator
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-red-600 transition hover:bg-red-50"
          >
            <LogOut size={18} />
            Sign out
          </button>
        </div>
      </aside>
    </>
  );
}
