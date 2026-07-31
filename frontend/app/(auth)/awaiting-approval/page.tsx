"use client";

import Link from "next/link";
import { Clock, ShieldAlert } from "lucide-react";

export default function AwaitingApprovalPage() {
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 text-slate-100">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <div className="h-16 w-16 bg-amber-600 rounded-2xl flex items-center justify-center shadow-lg shadow-amber-500/20">
            <Clock className="h-8 w-8 text-white animate-pulse" />
          </div>
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-white tracking-tight">
          Account Pending Approval
        </h2>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-slate-900/50 backdrop-blur-xl py-8 px-4 shadow-2xl shadow-black/50 sm:rounded-3xl sm:px-10 border border-slate-800 text-center">
          
          <div className="mb-6 flex justify-center">
            <ShieldAlert className="h-12 w-12 text-amber-500/80" />
          </div>
          
          <p className="text-slate-300 text-base leading-relaxed mb-6">
            Your application for DeepGuard Portal access has been submitted successfully and is currently under review by our administrators.
          </p>
          
          <p className="text-slate-400 text-sm leading-relaxed mb-8">
            Due to the sensitive nature of forensic investigations, all accounts require manual verification. You will be notified via email once your access is granted.
          </p>

          <Link
            href="/login"
            className="w-full flex justify-center py-3 px-4 border border-slate-700 rounded-lg shadow-sm text-sm font-medium text-slate-300 bg-slate-900 hover:bg-slate-800 hover:text-white transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500 focus:ring-offset-slate-900"
          >
            Return to Login
          </Link>
        </div>
      </div>
    </div>
  );
}
