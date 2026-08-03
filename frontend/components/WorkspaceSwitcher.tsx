"use client";

import { useState, useRef, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter, usePathname } from "next/navigation";
import { ChevronDown, ShieldAlert, LayoutDashboard } from "lucide-react";

export default function WorkspaceSwitcher() {
  const { data: sessionData } = useSession();
  const session = sessionData as any;
  const router = useRouter();
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const roles = session?.user?.roles || [session?.user?.role];
  const hasAdmin = roles.includes(1);
  const hasInvestigator = roles.includes(2);
  const hasUser = roles.includes(3);

  // If user only has one role, don't show the switcher
  if (!roles || roles.length <= 1) {
    if (!roles || roles.length === 0) return null;
    // Edge case: single role, but it's an array of 1
    if (roles.length === 1 && (!hasAdmin || (!hasInvestigator && !hasUser))) return null;
  }

  // Determine current workspace based on pathname
  const isAdminWorkspace = pathname.startsWith("/admin");
  const isDashboardWorkspace = pathname.startsWith("/dashboard");

  const switchWorkspace = (path: string) => {
    setIsOpen(false);
    router.push(path);
  };

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 px-3 py-2 rounded-md transition-colors"
      >
        {isAdminWorkspace ? (
          <ShieldAlert className="w-4 h-4 text-red-500" />
        ) : (
          <LayoutDashboard className="w-4 h-4 text-blue-500" />
        )}
        <span className="text-sm font-medium">
          {isAdminWorkspace ? "Admin Workspace" : "Investigator Workspace"}
        </span>
        <ChevronDown className="w-4 h-4 text-neutral-400" />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg shadow-xl overflow-hidden z-50">
          <div className="px-3 py-2 border-b border-neutral-100 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900/50">
            <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Switch Workspace</p>
          </div>
          
          <div className="p-1">
            {hasAdmin && (
              <button
                onClick={() => switchWorkspace("/admin")}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
                  isAdminWorkspace 
                    ? "bg-red-50/50 dark:bg-red-500/10 text-red-600 dark:text-red-400" 
                    : "hover:bg-neutral-100 dark:hover:bg-neutral-700/50 text-neutral-700 dark:text-neutral-200"
                }`}
              >
                <ShieldAlert className="w-4 h-4" />
                Admin Workspace
                {isAdminWorkspace && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-red-500" />}
              </button>
            )}

            {(hasInvestigator || hasUser) && (
              <button
                onClick={() => switchWorkspace("/dashboard")}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
                  isDashboardWorkspace 
                    ? "bg-blue-50/50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400" 
                    : "hover:bg-neutral-100 dark:hover:bg-neutral-700/50 text-neutral-700 dark:text-neutral-200"
                }`}
              >
                <LayoutDashboard className="w-4 h-4" />
                {hasInvestigator ? "Investigator Workspace" : "User Workspace"}
                {isDashboardWorkspace && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-500" />}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
