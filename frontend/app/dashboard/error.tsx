"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

export default function DashboardErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Dashboard render error caught by boundary:", error);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6 text-center">
      <div className="max-w-md w-full bg-white border border-[#e5e5e5] rounded-xl p-8 shadow-sm space-y-4">
        <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
          <AlertTriangle className="h-6 w-6" />
        </div>
        <h3 className="text-lg font-bold text-[#0a0a0a]">Something went wrong</h3>
        <p className="text-xs text-[#0a0a0a]/60">
          An unexpected error occurred while rendering this view. Your session and case records are intact.
        </p>
        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            onClick={() => reset()}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#CC2200] text-white rounded-md text-xs font-bold hover:bg-[#a81c00] transition-colors cursor-pointer"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Try again
          </button>
          <button
            onClick={() => { window.location.href = "/dashboard"; }}
            className="px-4 py-2 border border-[#e5e5e5] text-[#0a0a0a]/70 rounded-md text-xs font-bold hover:bg-slate-50 transition-colors cursor-pointer"
          >
            Reload Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
