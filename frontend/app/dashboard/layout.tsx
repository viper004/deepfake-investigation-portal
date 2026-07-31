"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { 
  LayoutDashboard, 
  FolderSearch, 
  FileVideo, 
  BrainCircuit, 
  FileText, 
  Settings, 
  LogOut,
  Menu,
  X,
  ShieldAlert,
  Bell
} from "lucide-react";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();
  const { data: session } = useSession();

  const navigation = [
    { name: "Overview", href: "/dashboard", icon: LayoutDashboard },
    { name: "Cases", href: "/dashboard/cases", icon: FolderSearch },
    { name: "Evidence", href: "/dashboard/evidence", icon: FileVideo },
    { name: "AI Analysis", href: "/dashboard/analysis", icon: BrainCircuit },
    { name: "Reports", href: "/dashboard/reports", icon: FileText },
    { name: "Settings", href: "/dashboard/settings", icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/80 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={`fixed inset-y-0 left-0 z-50 w-72 bg-slate-900 border-r border-slate-800 transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-auto lg:flex lg:w-72 lg:flex-col ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-16 shrink-0 items-center px-6 border-b border-slate-800">
          <ShieldAlert className="h-8 w-8 text-blue-500 mr-3" />
          <span className="text-xl font-bold text-white tracking-tight">DeepGuard</span>
          <button 
            className="ml-auto lg:hidden text-slate-400 hover:text-white"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-6 w-6" />
          </button>
        </div>
        
        <div className="flex flex-1 flex-col overflow-y-auto px-4 py-6">
          <nav className="flex-1 space-y-2">
            {navigation.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`group flex items-center rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
                    isActive
                      ? "bg-blue-600/10 text-blue-500"
                      : "text-slate-400 hover:bg-slate-800/50 hover:text-white"
                  }`}
                >
                  <item.icon
                    className={`mr-3 h-5 w-5 flex-shrink-0 transition-colors ${
                      isActive ? "text-blue-500" : "text-slate-500 group-hover:text-slate-300"
                    }`}
                  />
                  {item.name}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="border-t border-slate-800 p-4">
          <div className="flex items-center gap-x-3 mb-4 px-2">
            <div className="h-10 w-10 rounded-full bg-slate-800 flex items-center justify-center font-bold text-blue-500">
              {session?.user?.name?.[0] || "U"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">
                {session?.user?.name || "Investigator"}
              </p>
              <p className="text-xs text-slate-500 truncate">
                {session?.user?.email}
              </p>
            </div>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="w-full flex items-center rounded-lg px-3 py-2.5 text-sm font-medium text-slate-400 hover:bg-red-500/10 hover:text-red-500 transition-colors group"
          >
            <LogOut className="mr-3 h-5 w-5 text-slate-500 group-hover:text-red-500 transition-colors" />
            Sign Out
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top header */}
        <header className="flex h-16 items-center justify-between border-b border-slate-800 bg-slate-900/50 backdrop-blur-xl px-4 sm:px-6 lg:px-8">
          <button
            type="button"
            className="text-slate-400 hover:text-white lg:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-6 w-6" />
          </button>
          
          <div className="flex flex-1 justify-end gap-x-4 items-center">
            <button className="relative p-2 text-slate-400 hover:text-white transition-colors rounded-full hover:bg-slate-800">
              <Bell className="h-5 w-5" />
              <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-blue-500 ring-2 ring-slate-900"></span>
            </button>
          </div>
        </header>

        {/* Main page content */}
        <main className="flex-1 overflow-y-auto bg-slate-950 p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
