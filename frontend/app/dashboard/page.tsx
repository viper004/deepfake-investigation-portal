"use client";

import Link from "next/link";
import { useState } from "react";

/* ─── Mock data ─── */
const statsCards = [
  {
    label: "Active Cases",
    value: "24",
    change: "+3 this week",
    up: true,
    color: "#CC2200",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
      </svg>
    ),
  },
  {
    label: "Confirmed Deepfakes",
    value: "186",
    change: "+12 this month",
    up: true,
    color: "#059669",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/>
      </svg>
    ),
  },
  {
    label: "Pending Review",
    value: "12",
    change: "4 high priority",
    up: false,
    color: "#d97706",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
      </svg>
    ),
  },
  {
    label: "Reports Generated",
    value: "341",
    change: "+28 this month",
    up: true,
    color: "#7c3aed",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/>
      </svg>
    ),
  },
];

const recentCases = [
  { id: "DG-2024-089", name: "Political ad video manipulation", status: "confirmed", confidence: 97, date: "2 hours ago", type: "Video" },
  { id: "DG-2024-088", name: "CEO voiceover impersonation", status: "processing", confidence: 82, date: "5 hours ago", type: "Audio" },
  { id: "DG-2024-087", name: "News anchor face-swap", status: "confirmed", confidence: 99, date: "1 day ago", type: "Video" },
  { id: "DG-2024-086", name: "Social media profile photo", status: "authentic", confidence: 12, date: "1 day ago", type: "Image" },
  { id: "DG-2024-085", name: "Interview footage suspect", status: "pending", confidence: 58, date: "2 days ago", type: "Video" },
  { id: "DG-2024-084", name: "Financial fraud audio clip", status: "confirmed", confidence: 94, date: "3 days ago", type: "Audio" },
];

const chartBars = [35, 55, 42, 78, 62, 89, 71, 95, 66, 82, 74, 91];
const chartLabels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const navItems = [
  {
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
      </svg>
    ),
    label: "Overview",
    href: "/dashboard",
    active: true,
  },
  {
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
      </svg>
    ),
    label: "Investigations",
    href: "/dashboard/investigations",
    active: false,
  },
  {
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/>
      </svg>
    ),
    label: "Evidence Vault",
    href: "/dashboard/evidence",
    active: false,
  },
  {
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
      </svg>
    ),
    label: "Reports",
    href: "/dashboard/reports",
    active: false,
  },
  {
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    ),
    label: "Team",
    href: "/dashboard/team",
    active: false,
  },
];

const statusConfig: Record<string, { label: string; dot: string; text: string; bg: string }> = {
  confirmed:  { label: "Confirmed", dot: "#CC2200", text: "#CC2200", bg: "#CC220012" },
  processing: { label: "Processing", dot: "#d97706", text: "#d97706", bg: "#d9770612" },
  pending:    { label: "Pending",    dot: "#6b7280", text: "#6b7280", bg: "#6b728012" },
  authentic:  { label: "Authentic",  dot: "#059669", text: "#059669", bg: "#05966912" },
};

export default function DashboardPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#fafafa] flex" style={{ fontFamily: "Inter, system-ui, sans-serif" }}>
      {/* ─── Sidebar ─── */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-40 w-52 bg-white border-r border-[#e5e5e5] flex flex-col transform transition-transform duration-300 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        } lg:translate-x-0`}
      >
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-5 py-5 border-b border-[#f0f0f0]">
          <div className="w-7 h-7 bg-[#CC2200] rounded flex items-center justify-center flex-shrink-0">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
          </div>
          <span className="font-bold text-sm tracking-tight">DeepGuard</span>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 flex flex-col gap-0.5">
          <div className="text-[10px] font-semibold uppercase tracking-widest text-[#0a0a0a]/30 px-2 pb-2">Workspace</div>
          {navItems.map((item, i) => (
            <Link
              key={item.label}
              href={item.href}
              className={`sidebar-item flex items-center gap-2.5 px-3 py-2 rounded text-sm font-medium transition-colors ${
                item.active
                  ? "bg-[#CC2200]/8 text-[#CC2200]"
                  : "text-[#0a0a0a]/60 hover:text-[#0a0a0a] hover:bg-[#f5f5f5]"
              }`}
              style={{ animationDelay: `${i * 40}ms` }}
            >
              <span className={item.active ? "text-[#CC2200]" : "text-[#0a0a0a]/40"}>
                {item.icon}
              </span>
              {item.label}
            </Link>
          ))}

          <div className="mt-4 text-[10px] font-semibold uppercase tracking-widest text-[#0a0a0a]/30 px-2 pb-2">Tools</div>
          {[
            { label: "Upload Media", href: "#", icon: (
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/>
                <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/>
              </svg>
            )},
            { label: "API Keys", href: "#", icon: (
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/>
              </svg>
            )},
          ].map((item, i) => (
            <Link
              key={item.label}
              href={item.href}
              className="sidebar-item flex items-center gap-2.5 px-3 py-2 rounded text-sm font-medium text-[#0a0a0a]/60 hover:text-[#0a0a0a] hover:bg-[#f5f5f5] transition-colors"
              style={{ animationDelay: `${(navItems.length + i) * 40}ms` }}
            >
              <span className="text-[#0a0a0a]/40">{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>

        {/* User profile */}
        <div className="px-3 py-4 border-t border-[#f0f0f0]">
          <div 
            onClick={() => {
              localStorage.removeItem("user");
              window.location.href = "/login";
            }}
            title="Click to sign out"
            className="flex items-center gap-2.5 px-2 py-2 rounded hover:bg-red-50 hover:text-[#CC2200] transition-colors cursor-pointer"
          >
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#CC2200] to-[#ff6644] flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
              {typeof window !== "undefined" && localStorage.getItem("user") ? (
                JSON.parse(localStorage.getItem("user")!).first_name.substring(0, 1) + 
                JSON.parse(localStorage.getItem("user")!).last_name.substring(0, 1)
              ) : "U"}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold truncate">
                {typeof window !== "undefined" && localStorage.getItem("user") ? (
                  JSON.parse(localStorage.getItem("user")!).first_name + " " + JSON.parse(localStorage.getItem("user")!).last_name
                ) : "Sarah Andersen"}
              </div>
              <div className="text-[10px] text-[#0a0a0a]/40 truncate">Click to Sign out</div>
            </div>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-[#0a0a0a]/30 flex-shrink-0">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>
            </svg>
          </div>
        </div>
      </aside>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-30 bg-black/20 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* ─── Main content ─── */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="flex items-center justify-between px-6 py-4 border-b border-[#e5e5e5] bg-white/80 backdrop-blur-sm sticky top-0 z-20">
          <div className="flex items-center gap-4">
            {/* Mobile sidebar toggle */}
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden p-1.5 rounded hover:bg-black/5 transition-colors"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/>
              </svg>
            </button>
            <div>
              <h1 className="font-bold text-base tracking-tight">Overview</h1>
              <p className="text-xs text-[#0a0a0a]/40">Wednesday, {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Search */}
            <div className="hidden md:flex items-center gap-2 px-3 py-2 rounded border border-[#e5e5e5] bg-[#fafafa] w-52">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#0a0a0a]/30">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
              <input placeholder="Search cases…" className="flex-1 text-xs bg-transparent outline-none placeholder:text-[#0a0a0a]/30" />
              <kbd className="text-[9px] font-mono text-[#0a0a0a]/25 bg-[#f0f0f0] px-1 py-0.5 rounded">⌘K</kbd>
            </div>

            {/* Notification bell */}
            <button className="relative p-2 rounded hover:bg-black/5 transition-colors">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
              </svg>
              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-[#CC2200] rounded-full" />
            </button>

            {/* New case button */}
            <button className="btn-primary flex items-center gap-1.5 px-4 py-2 bg-[#CC2200] text-white text-xs font-semibold rounded hover:opacity-90 transition-opacity">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              New Case
            </button>
          </div>
        </header>

        {/* Page content */}
        <div className="flex-1 overflow-y-auto p-6">

          {/* ─── Stats grid ─── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {statsCards.map((card, i) => (
              <div
                key={card.label}
                className="card-pop bg-white border border-[#e5e5e5] rounded-lg p-5"
                style={{ animationDelay: `${i * 70}ms` }}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="p-2 rounded" style={{ backgroundColor: card.color + "12", color: card.color }}>
                    {card.icon}
                  </div>
                  <span className={`text-[10px] font-medium ${card.up ? "text-green-600" : "text-amber-600"}`}>
                    {card.change}
                  </span>
                </div>
                <div className="count-in text-2xl font-bold tracking-tight" style={{ animationDelay: `${i * 70 + 200}ms` }}>
                  {card.value}
                </div>
                <div className="text-xs text-[#0a0a0a]/50 mt-0.5 font-medium">{card.label}</div>
              </div>
            ))}
          </div>

          {/* ─── Chart + feed ─── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
            {/* Activity chart */}
            <div className="card-pop d-200 lg:col-span-2 bg-white border border-[#e5e5e5] rounded-lg p-5">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="font-semibold text-sm tracking-tight">Detection Activity</h2>
                  <p className="text-xs text-[#0a0a0a]/40 mt-0.5">Monthly confirmed deepfakes</p>
                </div>
                <div className="flex gap-1">
                  {["3M", "6M", "1Y"].map((t, i) => (
                    <button
                      key={t}
                      className={`text-xs px-2.5 py-1 rounded font-medium transition-colors ${
                        i === 2 ? "bg-[#CC2200]/8 text-[#CC2200]" : "text-[#0a0a0a]/40 hover:text-[#0a0a0a]"
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              {/* Chart */}
              <div className="flex items-end gap-1.5 h-36 mb-2">
                {chartBars.map((h, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <div
                      className="w-full rounded-sm chart-reveal"
                      style={{
                        height: `${h}%`,
                        backgroundColor: i === chartBars.length - 1 ? "#CC2200" : "#CC2200" + "30",
                        animationDelay: `${i * 50}ms`,
                      }}
                    />
                  </div>
                ))}
              </div>
              <div className="flex gap-1.5">
                {chartLabels.map((l, i) => (
                  <div key={i} className="flex-1 text-center text-[9px] text-[#0a0a0a]/30 font-medium">{l}</div>
                ))}
              </div>
            </div>

            {/* Quick stats / feed */}
            <div className="card-pop d-300 bg-white border border-[#e5e5e5] rounded-lg p-5 flex flex-col">
              <h2 className="font-semibold text-sm tracking-tight mb-1">Detection Breakdown</h2>
              <p className="text-xs text-[#0a0a0a]/40 mb-5">By media type this month</p>

              {[
                { type: "Video", count: 124, pct: 67, color: "#CC2200" },
                { type: "Image", count: 42, pct: 23, color: "#7c3aed" },
                { type: "Audio", count: 20, pct: 11, color: "#059669" },
              ].map((item) => (
                <div key={item.type} className="mb-4">
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="text-xs font-medium">{item.type}</span>
                    <span className="text-xs text-[#0a0a0a]/50">{item.count}</span>
                  </div>
                  <div className="h-1.5 bg-[#f0f0f0] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full step-bar"
                      style={{ width: `${item.pct}%`, backgroundColor: item.color }}
                    />
                  </div>
                </div>
              ))}

              <div className="mt-auto pt-4 border-t border-[#f0f0f0]">
                <div className="text-xs font-semibold text-[#0a0a0a]/50 mb-3 uppercase tracking-wider">Recent Alerts</div>
                {[
                  { msg: "High confidence deepfake in case #089", time: "2h ago", level: "high" },
                  { msg: "New case assigned by team lead", time: "5h ago", level: "info" },
                  { msg: "Report generated: DG-2024-087", time: "1d ago", level: "success" },
                ].map((alert, i) => (
                  <div key={i} className="feed-item flex gap-2.5 mb-2.5 last:mb-0" style={{ animationDelay: `${i * 80}ms` }}>
                    <div
                      className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0"
                      style={{ backgroundColor: alert.level === "high" ? "#CC2200" : alert.level === "success" ? "#059669" : "#6b7280" }}
                    />
                    <div>
                      <p className="text-xs text-[#0a0a0a]/70 leading-snug">{alert.msg}</p>
                      <p className="text-[10px] text-[#0a0a0a]/30 mt-0.5">{alert.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ─── Recent cases table ─── */}
          <div className="card-pop d-400 bg-white border border-[#e5e5e5] rounded-lg overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#f0f0f0]">
              <div>
                <h2 className="font-semibold text-sm tracking-tight">Recent Investigations</h2>
                <p className="text-xs text-[#0a0a0a]/40 mt-0.5">Latest cases across all analysts</p>
              </div>
              <button className="text-xs text-[#CC2200] font-medium hover:underline">
                View all →
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#f0f0f0]">
                    {["Case ID", "Description", "Type", "Status", "Confidence", "Updated"].map((h) => (
                      <th key={h} className="text-left text-[10px] font-semibold uppercase tracking-wider text-[#0a0a0a]/40 px-5 py-3 whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {recentCases.map((c, i) => {
                    const s = statusConfig[c.status];
                    return (
                      <tr
                        key={c.id}
                        className="border-b border-[#f9f9f9] hover:bg-[#fafafa] transition-colors cursor-pointer"
                        style={{ animationDelay: `${i * 50}ms` }}
                      >
                        <td className="px-5 py-3.5 font-mono text-xs text-[#0a0a0a]/50 whitespace-nowrap">{c.id}</td>
                        <td className="px-5 py-3.5 text-sm font-medium text-[#0a0a0a] max-w-[220px] truncate">{c.name}</td>
                        <td className="px-5 py-3.5">
                          <span className="text-xs px-2 py-0.5 rounded-full bg-[#f0f0f0] text-[#0a0a0a]/60 font-medium">{c.type}</span>
                        </td>
                        <td className="px-5 py-3.5">
                          <span
                            className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium"
                            style={{ backgroundColor: s.bg, color: s.text }}
                          >
                            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: s.dot }} />
                            {s.label}
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-1.5 bg-[#f0f0f0] rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full"
                                style={{
                                  width: `${c.confidence}%`,
                                  backgroundColor:
                                    c.confidence > 80 ? "#CC2200" :
                                    c.confidence > 50 ? "#d97706" : "#059669",
                                }}
                              />
                            </div>
                            <span className="text-xs font-medium text-[#0a0a0a]/60 whitespace-nowrap">{c.confidence}%</span>
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-xs text-[#0a0a0a]/40 whitespace-nowrap">{c.date}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
