"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Users, ShieldAlert, Activity, FileText, Settings, Search, LogOut } from "lucide-react";
import { signOut } from "next-auth/react";

export default function AdminDashboard() {
  const { data: session } = useSession();
  const [stats, setStats] = useState({
    totalUsers: 0,
    pendingApprovals: 0,
    activeInvestigations: 486,
    systemLoad: "42%"
  });

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch("http://127.0.0.1:8000/api/v1/auth/admin/stats");
        if (res.ok) {
          const data = await res.json();
          setStats(prev => ({
            ...prev,
            totalUsers: data.total_users,
            pendingApprovals: data.pending_approvals
          }));
        }
      } catch (err) {
        console.error("Failed to fetch admin stats:", err);
      }
    };
    fetchStats();
  }, []);

  return (
    <div className="min-h-screen bg-[#fafafa] text-[#0a0a0a]" style={{ fontFamily: "Inter, system-ui, sans-serif" }}>
      {/* ─── Navbar ─── */}
      <nav className="bg-white border-b border-[#e5e5e5] shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-[#CC2200] rounded flex items-center justify-center shadow-md">
                <ShieldAlert className="h-5 w-5 text-white" />
              </div>
              <span className="font-bold text-lg tracking-tight">DeepGuard Admin</span>
            </div>
            
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium text-[#0a0a0a]/70">
                {session?.user?.email || "superuser@example.com"}
              </span>
              <button 
                onClick={() => signOut({ callbackUrl: '/' })}
                className="p-2 text-[#0a0a0a]/60 hover:text-[#CC2200] hover:bg-[#CC2200]/10 rounded-full transition-colors"
                title="Sign out"
              >
                <LogOut className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col md:flex-row gap-8">
        
        {/* ─── Sidebar ─── */}
        <aside className="w-full md:w-64 flex-shrink-0">
          <div className="bg-white border border-[#e5e5e5] rounded-lg shadow-sm p-4 sticky top-24">
            <nav className="space-y-1">
              {[
                { icon: <Activity className="h-5 w-5" />, label: "Overview", active: true },
                { icon: <Users className="h-5 w-5" />, label: "User Management" },
                { icon: <ShieldAlert className="h-5 w-5" />, label: "System Alerts" },
                { icon: <FileText className="h-5 w-5" />, label: "Audit Logs" },
                { icon: <Settings className="h-5 w-5" />, label: "Configuration" },
              ].map((item) => (
                <a
                  key={item.label}
                  href="#"
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
                    item.active
                      ? "bg-[#CC2200]/10 text-[#CC2200]"
                      : "text-[#0a0a0a]/60 hover:bg-[#fafafa] hover:text-[#0a0a0a]"
                  }`}
                >
                  {item.icon}
                  {item.label}
                </a>
              ))}
            </nav>
          </div>
        </aside>

        {/* ─── Main Content ─── */}
        <main className="flex-1 space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold tracking-tight">System Overview</h1>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#0a0a0a]/40" />
              <input 
                type="text" 
                placeholder="Search logs, users..." 
                className="pl-9 pr-4 py-2 bg-white border border-[#e5e5e5] rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#CC2200] focus:border-transparent w-64"
              />
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: "Total Users", value: stats.totalUsers.toLocaleString(), change: "+12%", trend: "up" },
              { label: "Pending Approvals", value: stats.pendingApprovals.toString(), change: "+3", trend: "neutral" },
              { label: "Active Investigations", value: stats.activeInvestigations.toString(), change: "+18%", trend: "up" },
              { label: "System Load", value: stats.systemLoad, change: "-5%", trend: "down" },
            ].map((stat, i) => (
              <div key={i} className="bg-white border border-[#e5e5e5] rounded-lg p-5 shadow-sm hover:shadow-md transition-shadow">
                <div className="text-xs font-semibold text-[#0a0a0a]/50 uppercase tracking-wider mb-2">
                  {stat.label}
                </div>
                <div className="flex items-end justify-between">
                  <div className="text-3xl font-bold text-[#0a0a0a]">{stat.value}</div>
                  <div className={`text-sm font-medium ${
                    stat.trend === "up" ? "text-green-600" : stat.trend === "down" ? "text-blue-600" : "text-amber-600"
                  }`}>
                    {stat.change}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Recent Alerts */}
            <div className="bg-white border border-[#e5e5e5] rounded-lg shadow-sm col-span-2">
              <div className="px-5 py-4 border-b border-[#e5e5e5] flex justify-between items-center">
                <h2 className="font-semibold text-lg">System Activity</h2>
                <button className="text-xs font-medium text-[#CC2200] hover:underline">View All</button>
              </div>
              <div className="p-5">
                <div className="flex items-end gap-2 h-40">
                  {/* Mock Activity Chart */}
                  {[30, 45, 25, 60, 80, 50, 40, 75, 90, 65, 85, 55, 70, 95].map((h, i) => (
                    <div
                      key={i}
                      className="flex-1 rounded-t-sm bg-[#CC2200]/20 hover:bg-[#CC2200] transition-colors cursor-pointer group relative"
                      style={{ height: `${h}%` }}
                    >
                      <div className="opacity-0 group-hover:opacity-100 absolute -top-8 left-1/2 -translate-x-1/2 bg-[#0a0a0a] text-white text-[10px] py-1 px-2 rounded whitespace-nowrap z-10 pointer-events-none transition-opacity">
                        {h} Events
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Pending Approvals List */}
            <div className="bg-white border border-[#e5e5e5] rounded-lg shadow-sm">
              <div className="px-5 py-4 border-b border-[#e5e5e5]">
                <h2 className="font-semibold text-lg">Pending Approvals</h2>
              </div>
              <div className="p-0">
                {[
                  { name: "John Doe", agency: "NYPD", time: "2h ago" },
                  { name: "Sarah Smith", agency: "FBI", time: "5h ago" },
                  { name: "Michael Chang", agency: "Europol", time: "1d ago" },
                ].map((user, i) => (
                  <div key={i} className="flex items-center justify-between px-5 py-3 border-b border-[#f0f0f0] last:border-0 hover:bg-[#fafafa] transition-colors">
                    <div>
                      <div className="text-sm font-medium text-[#0a0a0a]">{user.name}</div>
                      <div className="text-xs text-[#0a0a0a]/50">{user.agency} • {user.time}</div>
                    </div>
                    <div className="flex gap-2">
                      <button className="text-[#CC2200] text-xs font-medium hover:underline bg-[#CC2200]/10 px-2 py-1 rounded">Approve</button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="px-5 py-3 border-t border-[#e5e5e5] bg-[#fafafa] text-center rounded-b-lg">
                <Link href="#" className="text-sm font-medium text-[#0a0a0a]/60 hover:text-[#0a0a0a]">
                  View all 24 requests
                </Link>
              </div>
            </div>
          </div>
          
        </main>
      </div>
    </div>
  );
}
