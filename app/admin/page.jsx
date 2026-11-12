
import { Suspense } from "react";
import {
  Users,
  UserRound,
  Building2,
  CalendarCheck,
  IndianRupee,
  TrendingUp,
  Activity,
  Store,
  Stethoscope,
  Scissors,
  Sparkles,
  FlaskConical,
  ArrowUpRight,
  Clock,
  ShieldCheck,
  RefreshCw,
} from "lucide-react";
 
 
async function getDashboardData() {
  const empty = {
    totalUsers: 0,
    totalOwners: 0,
    totalClinics: 0,
    totalSaloons: 0,
    totalParlours: 0,
    totalDiagnostics: 0,
    totalBookings: 0,
    totalRevenue: 0,
    recentUsers: [],
    recentOwners: [],
  };

  try {
    const clientPromise = (await import("@/lib/mongodb")).default;
    const client = await clientPromise;
    const db = client.db(process.env.MONGODB || "rahul");

    const [
      totalUsers,
      totalOwners,
      totalClinics,
      totalSaloons,
      totalParlours,
      totalDiagnostics,
      totalBookings,
      recentUsers,
      recentOwners,
    ] = await Promise.all([
      db.collection("users").countDocuments(),
      db.collection("owners").countDocuments(),
      db.collection("clinics").countDocuments(),
      db.collection("saloons").countDocuments(),
      db.collection("parlour").countDocuments(),
      db.collection("diagnostic").countDocuments(),

      // Update this collection name if your booking collection differs.
      db.collection("bookings").countDocuments(),

      db.collection("users")
        .find({})
        .sort({ createdAt: -1 })
        .limit(5)
        .project({ name: 1, email: 1, createdAt: 1 })
        .toArray(),

      db.collection("owners")
        .find({})
        .sort({ createdAt: -1 })
        .limit(5)
        .project({ name: 1, email: 1, createdAt: 1, status: 1 })
        .toArray(),
    ]);

    return {
      ...empty,
      totalUsers,
      totalOwners,
      totalClinics,
      totalSaloons,
      totalParlours,
      totalDiagnostics,
      totalBookings,
      recentUsers: JSON.parse(JSON.stringify(recentUsers)),
      recentOwners: JSON.parse(JSON.stringify(recentOwners)),
    };
  } catch (error) {
    console.error("Admin dashboard error:", error);
    return empty;
  }
}

function formatDate(date) {
  if (!date) return "Date unavailable";

  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return "Date unavailable";

  return parsed.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function StatCard({ title, value, icon: Icon, description }) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-md">
      <div className="flex items-center justify-between">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
          <Icon size={21} />
        </div>
        <ArrowUpRight size={17} className="text-gray-400" />
      </div>

      <p className="mt-5 text-sm font-medium text-gray-500">{title}</p>
      <h2 className="mt-1 text-2xl font-bold tracking-tight text-gray-900">
        {Number(value || 0).toLocaleString("en-IN")}
      </h2>
      <p className="mt-2 text-xs text-gray-400">{description}</p>
    </div>
  );
}

function BusinessCard({ title, count, icon: Icon }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-gray-100 bg-white p-4">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
          <Icon size={19} />
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-800">{title}</p>
          <p className="text-xs text-gray-400">Registered businesses</p>
        </div>
      </div>
      <p className="text-lg font-bold text-gray-900">
        {count.toLocaleString("en-IN")}
      </p>
    </div>
  );
}

function RecentUsers({ users }) {
  if (!users.length) {
    return (
      <p className="py-8 text-center text-sm text-gray-400">
        No registrations yet.
      </p>
    );
  }

  return (
    <div className="divide-y divide-gray-100">
      {users.map((user, index) => (
        <div key={user._id || user.email || index} className="flex items-center gap-3 py-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-violet-50 text-sm font-bold text-violet-600">
            {(user.name || user.email || "U").charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-gray-800">
              {user.name || "Unnamed user"}
            </p>
            <p className="truncate text-xs text-gray-400">
              {user.email || "No email"}
            </p>
          </div>
          <p className="shrink-0 text-xs text-gray-400">
            {formatDate(user.createdAt)}
          </p>
        </div>
      ))}
    </div>
  );
}

async function AdminDashboardContent() {
 
  const data = await getDashboardData();

  const totalBusinesses =
    data.totalClinics +
    data.totalSaloons +
    data.totalParlours +
    data.totalDiagnostics;

  return (
    <div className="min-h-screen bg-[#f8f9fc] p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-[1600px] space-y-7">

        {/* Header */}
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="text-violet-600" size={23} />
              <span className="text-xs font-bold uppercase tracking-[0.18em] text-violet-600">
                Zeriy Super Admin
              </span>
            </div>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
              Dashboard Overview
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Monitor and manage your entire Zeriy platform.
            </p>
          </div>

          <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-600 shadow-sm">
            <Activity size={16} className="text-green-500" />
            Platform overview
          </div>
        </div>

        {/* Main Statistics */}
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Platform Statistics</h2>
            <span className="text-xs text-gray-400">Live database counts</span>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              title="Total Users"
              value={data.totalUsers}
              icon={Users}
              description="Registered platform users"
            />
            <StatCard
              title="Total Owners"
              value={data.totalOwners}
              icon={UserRound}
              description="Registered business owners"
            />
            <StatCard
              title="Total Businesses"
              value={totalBusinesses}
              icon={Building2}
              description="All business categories"
            />
            <StatCard
              title="Total Bookings"
              value={data.totalBookings}
              icon={CalendarCheck}
              description="Platform booking records"
            />
          </div>
        </section>

        {/* Business Distribution */}
        <section>
          <h2 className="mb-4 font-semibold text-gray-900">
            Business Distribution
          </h2>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <BusinessCard title="Clinics" count={data.totalClinics} icon={Stethoscope} />
            <BusinessCard title="Salons" count={data.totalSaloons} icon={Scissors} />
            <BusinessCard title="Beauty Parlours" count={data.totalParlours} icon={Sparkles} />
            <BusinessCard title="Diagnostic Centres" count={data.totalDiagnostics} icon={FlaskConical} />
          </div>
        </section>

        {/* Activity and Registration */}
        <section className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-gray-900">Recent Users</h2>
                <p className="mt-1 text-xs text-gray-400">
                  Latest registered users
                </p>
              </div>
              <Users size={19} className="text-violet-500" />
            </div>
            <RecentUsers users={data.recentUsers} />
          </div>

          <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-gray-900">Recent Owners</h2>
                <p className="mt-1 text-xs text-gray-400">
                  Latest registered business owners
                </p>
              </div>
              <Store size={19} className="text-violet-500" />
            </div>
            <RecentUsers users={data.recentOwners} />
          </div>
        </section>

        {/* Admin Quick Information */}
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-gray-100 bg-white p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-blue-50 p-2.5 text-blue-600">
                <Clock size={19} />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-800">Platform Management</p>
                <p className="text-xs text-gray-400">Centralized admin control</p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-gray-100 bg-white p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-green-50 p-2.5 text-green-600">
                <TrendingUp size={19} />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-800">Business Growth</p>
                <p className="text-xs text-gray-400">{totalBusinesses} businesses registered</p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-gray-100 bg-white p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-orange-50 p-2.5 text-orange-600">
                <IndianRupee size={19} />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-800">Payments & Refunds</p>
                <p className="text-xs text-gray-400">Management section to be connected</p>
              </div>
            </div>
          </div>
        </section>

        <p className="border-t border-gray-200 pt-5 text-center text-xs text-gray-400">
          Zeriy Super Admin Control Center
        </p>
      </div>
    </div>
  );
}

function DashboardLoading() {
  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <RefreshCw className="animate-spin text-violet-600" size={28} />
    </div>
  );
}

export default function AdminPage() {
  return (
    <Suspense fallback={<DashboardLoading />}>
      <AdminDashboardContent />
    </Suspense>
  );
}
