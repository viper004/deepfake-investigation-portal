"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import {
  LayoutDashboard,
  FolderSearch,
  FileVideo,
  BrainCircuit,
  FileText,
  Settings,
  LogOut,
  Bell,
  User,
  Search,
  Eye,
  Download,
  Check,
  X,
  Lock,
  Clock,
  Sparkles,
  Activity,
  ChevronLeft,
  Loader2,
  CheckCircle,
  Send,
  ShieldCheck,
  History,
  AlertTriangle,
  MessageSquare,
  RotateCcw,
  Info,
  Notebook
} from "lucide-react";
import WorkspaceSwitcher from "@/components/WorkspaceSwitcher";
import InvestigatorNotesEditor from "@/components/InvestigatorNotesEditor";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://127.0.0.1:8000";

interface ToastType {
  id: string;
  message: string;
  type: "success" | "error" | "info";
}

interface EvidenceType {
  id: number;
  original_name: string;
  file_type: string;
  mime_type: string;
  file_size: number;
  sha256_hash: string;
  upload_time?: string;
  created_at?: string;
}

interface CaseNoteType {
  id: number;
  note: string;
  user_name: string;
  created_at: string;
}

interface AuditLogType {
  id: number;
  action: string;
  description: string;
  user_name: string;
  timestamp: string;
}

interface MessageType {
  id: number;
  case_id: number;
  sender_id: number;
  sender_name: string;
  sender_role: string;
  is_me: boolean;
  message: string;
  created_at: string;
}

export default function InvestigatorCaseWorkspacePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const caseId = params?.caseId as string;

  // Primary Case State
  const [caseDetail, setCaseDetail] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Toasts State
  const [toasts, setToasts] = useState<ToastType[]>([]);

  // AI Scanning State
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [scanStage, setScanStage] = useState("");
  const [scanResult, setScanResult] = useState<any>(null);

  const isInvestigator =
    (session?.user?.role as any) === "INVESTIGATOR" ||
    (session?.user?.role as any) === "ADMIN" ||
    session?.user?.role === 1 ||
    session?.user?.role === 2 ||
    (session?.user as any)?.role_id === 1 ||
    (session?.user as any)?.role_id === 2;

  // Modals & Preview State
  const [previewFile, setPreviewFile] = useState<EvidenceType | null>(null);
  const [auditModalOpen, setAuditModalOpen] = useState(false);
  const [chatModalOpen, setChatModalOpen] = useState(false);

  // Chat State
  const [messages, setMessages] = useState<MessageType[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [inputMessage, setInputMessage] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  const scanStages = [
    "Initializing forensic analysis",
    "Reading evidence metadata",
    "Calculating cryptographic hash",
    "Extracting media characteristics",
    "Analyzing frame-level artifacts",
    "Checking manipulation indicators",
    "Calculating manipulation confidence",
    "Generating forensic report",
    "Analysis complete"
  ];

  // Helper to show toasts
  const showToast = useCallback((message: string, type: "success" | "error" | "info" = "success") => {
    const id = Date.now().toString();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  // Formatters
  const formatDate = (dateStr: string | null | undefined): string => {
    if (!dateStr) return "N/A";
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      const day = String(d.getDate()).padStart(2, "0");
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const year = d.getFullYear();
      return `${day}/${month}/${year}`;
    } catch (e) {
      return dateStr;
    }
  };

  const renderStatusBadge = (statusStr: string) => {
    switch (statusStr) {
      case "DRAFT":
        return (
          <span className="px-2.5 py-1 rounded text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
            Draft
          </span>
        );
      case "CASE_FILED":
        return (
          <span className="px-2.5 py-1 rounded text-xs font-bold bg-blue-50 text-blue-800 border border-blue-200">
            Case Filed
          </span>
        );
      case "CASE_UNDER_INVESTIGATION":
        return (
          <span className="px-2.5 py-1 rounded text-xs font-bold bg-purple-50 text-purple-800 border border-purple-200">
            Case Under Investigation
          </span>
        );
      case "CLOSED":
        return (
          <span className="px-2.5 py-1 rounded text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
            Closed
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-1 rounded text-xs font-bold bg-slate-100 text-slate-700 border border-slate-300">
            {statusStr}
          </span>
        );
    }
  };

  // Fetch Existing AI Scan
  const fetchScanResult = useCallback(async (idStr: string) => {
    if (!session?.accessToken) return;
    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/user/cases/${idStr}/scan`, {
        headers: { Authorization: `Bearer ${session.accessToken}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.scan) {
          setScanResult(data.scan);
        } else {
          setScanResult(null);
        }
      }
    } catch (err) {
      console.error("Error fetching scan result:", err);
    }
  }, [session?.accessToken]);

  // Fetch Case Details
  const fetchCaseDetail = useCallback(async () => {
    if (!caseId || !session?.accessToken) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/user/cases/${caseId}`, {
        headers: { Authorization: `Bearer ${session.accessToken}` }
      });

      if (res.ok) {
        const data = await res.json();
        setCaseDetail(data);
        fetchScanResult(caseId);
      } else {
        const errData = await res.json();
        setError(errData.detail || "Failed to load case details.");
      }
    } catch (err) {
      console.error(err);
      setError("Error connecting to server.");
    } finally {
      setLoading(false);
    }
  }, [caseId, session?.accessToken, fetchScanResult]);

  // Security gate
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    } else if (status === "authenticated") {
      fetchCaseDetail();
    }
  }, [status, fetchCaseDetail, router]);

  // Messaging Functions
  const fetchCaseMessages = useCallback(async () => {
    if (!caseId || !session?.accessToken) return;
    setMessagesLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/user/cases/${caseId}/messages`, {
        headers: { Authorization: `Bearer ${session.accessToken}` }
      });
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
        setTimeout(() => {
          chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
        }, 100);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setMessagesLoading(false);
    }
  }, [caseId, session?.accessToken]);

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || !caseId || !session?.accessToken || sendingMessage) return;
    setSendingMessage(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/user/cases/${caseId}/messages`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.accessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ message: inputMessage.trim() })
      });

      if (res.ok) {
        const newMsg = await res.json();
        setMessages((prev) => [...prev, newMsg]);
        setInputMessage("");
        setTimeout(() => {
          chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
        }, 100);
      } else {
        const data = await res.json();
        showToast(data.detail || "Failed to send message", "error");
      }
    } catch (err) {
      showToast("Error sending message", "error");
    } finally {
      setSendingMessage(false);
    }
  };

  // AI Scanning Handler
  const handleScanEvidence = async () => {
    if (!caseId || !session?.accessToken) return;
    setIsScanning(true);
    setScanProgress(0);
    setScanStage(scanStages[0]);

    let currentProgress = 0;
    const interval = setInterval(() => {
      currentProgress += 1;
      setScanProgress(currentProgress);
      
      const stageIdx = Math.min(
        Math.floor((currentProgress / 100) * scanStages.length),
        scanStages.length - 1
      );
      setScanStage(scanStages[stageIdx]);

      if (currentProgress >= 100) {
        clearInterval(interval);
      }
    }, 100);

    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/user/cases/${caseId}/scan`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.accessToken}` }
      });

      if (res.ok) {
        const data = await res.json();
        setTimeout(() => {
          setIsScanning(false);
          setScanResult(data);
          showToast("AI Forensic Scan completed successfully!", "success");
          fetchCaseDetail();
        }, 10000);
      } else {
        setIsScanning(false);
        clearInterval(interval);
        showToast("Failed to run forensic scan.", "error");
      }
    } catch (err) {
      console.error(err);
      setIsScanning(false);
      clearInterval(interval);
      showToast("Error executing AI scan.", "error");
    }
  };

  // Report Download Handlers
  const handleDownloadPDF = async () => {
    if (!caseId || !session?.accessToken) return;
    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/user/cases/${caseId}/report/pdf`, {
        headers: { Authorization: `Bearer ${session.accessToken}` }
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `Forensic_Report_Case_${caseDetail?.case_number || caseId}.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
        showToast("Forensic Report PDF downloaded successfully.", "success");
      } else {
        showToast("Failed to download PDF report.", "error");
      }
    } catch (err) {
      console.error(err);
      showToast("Error downloading PDF report.", "error");
    }
  };

  const handleViewPDF = () => {
    if (!caseId) return;
    window.open(`${BACKEND_URL}/api/v1/user/cases/${caseId}/report/pdf`, "_blank");
  };

  const handleForwardToExpert = () => {
    showToast("Expert review workflow will be available soon.", "info");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#fafafa] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 text-[#CC2200] animate-spin" />
          <p className="text-xs font-semibold text-slate-600">Loading Case Workspace...</p>
        </div>
      </div>
    );
  }

  if (error || !caseDetail) {
    return (
      <div className="min-h-screen bg-[#fafafa] flex items-center justify-center p-4">
        <div className="bg-white border border-[#e5e5e5] rounded-xl p-8 max-w-md w-full text-center space-y-4 shadow-sm">
          <AlertTriangle className="h-10 w-10 text-rose-500 mx-auto" />
          <h2 className="text-lg font-bold text-slate-900">Case Access Error</h2>
          <p className="text-xs text-slate-600">{error || "Unable to access the requested case workspace."}</p>
          <button
            onClick={() => router.push("/dashboard")}
            className="px-4 py-2 bg-[#CC2200] text-white text-xs font-bold rounded-lg hover:bg-[#a81c00] transition-colors"
          >
            Back to Investigator Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fafafa] text-[#0a0a0a] flex flex-col font-sans" style={{ fontFamily: "Inter, system-ui, sans-serif" }}>
      
      {/* ─── Toast Notifications ─── */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 max-w-md w-full pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto px-4 py-3 rounded-lg shadow-md border text-sm font-semibold flex items-center gap-3 transition-all ${
              t.type === "success"
                ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                : t.type === "info"
                ? "bg-indigo-50 text-indigo-800 border-indigo-200"
                : "bg-rose-50 text-rose-800 border-rose-200"
            }`}
          >
            {t.type === "success" ? (
              <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center text-white">
                <Check className="h-3 w-3" />
              </div>
            ) : t.type === "info" ? (
              <div className="w-5 h-5 rounded-full bg-indigo-500 flex items-center justify-center text-white">
                <Info className="h-3 w-3" />
              </div>
            ) : (
              <div className="w-5 h-5 rounded-full bg-rose-500 flex items-center justify-center text-white">
                <X className="h-3 w-3" />
              </div>
            )}
            <span className="flex-1">{t.message}</span>
          </div>
        ))}
      </div>

      {/* ─── Global Top Navigation Bar ─── */}
      <header className="h-16 bg-[#0a0a0a] border-b border-[#e5e5e5]/10 flex items-center justify-between px-6 sticky top-0 z-40 text-white">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => router.push("/dashboard")}>
            <div className="w-8 h-8 rounded bg-[#CC2200] flex items-center justify-center font-bold text-white tracking-widest text-sm">
              S
            </div>
            <div>
              <span className="font-extrabold text-sm tracking-wider text-white">SENTINEL AI</span>
              <span className="block text-[9px] font-bold text-[#CC2200] uppercase tracking-widest -mt-1">
                Forensic Workspace
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <WorkspaceSwitcher />
          
          <div className="flex items-center gap-3 pl-4 border-l border-white/10">
            <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-white text-xs font-bold">
              {session?.user?.name ? session.user.name[0] : "I"}
            </div>
            <div className="hidden sm:block text-left">
              <span className="block text-xs font-bold text-white">{session?.user?.name || "Investigator"}</span>
              <span className="block text-[10px] text-slate-400">Assigned Investigator</span>
            </div>
          </div>
        </div>
      </header>

      {/* ─── Main Content Container ─── */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 space-y-6">
        
        {/* Back Navigation & Case Header Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <button
            onClick={() => router.push("/dashboard")}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-[#CC2200] transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
            Back to Cases
          </button>


        </div>

        {/* Case Main Header Title Card */}
        <div className="bg-white border border-[#e5e5e5] rounded-xl shadow-xs p-6 space-y-4 text-left">
          <div className="flex flex-wrap justify-between items-start gap-4">
            <div>
              <span className="text-xs font-mono font-bold text-[#CC2200] tracking-wider uppercase">{caseDetail.case_number}</span>
              <h1 className="text-2xl font-extrabold mt-1 text-[#0a0a0a]">{caseDetail.title}</h1>
            </div>
            
            <div className="flex items-center gap-2">
              {renderStatusBadge(caseDetail.status)}
              
              <button
                onClick={() => setAuditModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-slate-100 hover:bg-slate-200 text-xs font-semibold border border-[#e5e5e5] text-[#0a0a0a] transition-colors"
              >
                <History className="h-3.5 w-3.5 text-[#CC2200]" />
                Audit Trail
              </button>

              <button
                onClick={() => {
                  setChatModalOpen(true);
                  fetchCaseMessages();
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#CC2200] hover:bg-[#a81c00] text-xs font-bold text-white transition-colors cursor-pointer shadow-xs"
              >
                <MessageSquare className="h-3.5 w-3.5" />
                Message
              </button>
            </div>
          </div>

          <p className="text-sm text-[#0a0a0a]/75 leading-relaxed">{caseDetail.description || "No case description provided."}</p>

          {/* ─── Case Overview Grid (Requirement 4) ─── */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-4 border-t border-[#e5e5e5] text-xs">
            <div className="bg-slate-50/70 p-3 rounded-lg border border-[#e5e5e5]">
              <span className="block text-[10px] text-slate-400 uppercase font-bold mb-0.5">Case Owner</span>
              <span className="text-slate-900 font-bold truncate block">{caseDetail.creator_name || "Citizen Reporter"}</span>
            </div>
            
            <div className="bg-slate-50/70 p-3 rounded-lg border border-[#e5e5e5]">
              <span className="block text-[10px] text-slate-400 uppercase font-bold mb-0.5">Assigned Investigator</span>
              <span className="text-slate-900 font-bold truncate block">{caseDetail.assigned_expert_name || "Awaiting Assignment"}</span>
            </div>

            <div className="bg-slate-50/70 p-3 rounded-lg border border-[#e5e5e5]">
              <span className="block text-[10px] text-slate-400 uppercase font-bold mb-0.5">Incident Date</span>
              <span className="text-slate-900 font-bold block">{formatDate(caseDetail.incident_date)}</span>
            </div>

            <div className="bg-slate-50/70 p-3 rounded-lg border border-[#e5e5e5]">
              <span className="block text-[10px] text-slate-400 uppercase font-bold mb-0.5">Created On</span>
              <span className="text-slate-900 font-bold block">{formatDate(caseDetail.created_at)}</span>
            </div>

            <div className="bg-slate-50/70 p-3 rounded-lg border border-[#e5e5e5]">
              <span className="block text-[10px] text-slate-400 uppercase font-bold mb-0.5">Evidence Files</span>
              <span className="text-slate-900 font-bold block">{caseDetail.evidence ? caseDetail.evidence.length : 0} Files</span>
            </div>

            <div className="bg-slate-50/70 p-3 rounded-lg border border-[#e5e5e5]">
              <span className="block text-[10px] text-slate-400 uppercase font-bold mb-0.5">Status</span>
              <span className="text-slate-900 font-bold block">{renderStatusBadge(caseDetail.status)}</span>
            </div>
          </div>
        </div>

        {/* Two-Column Case Content Workspace Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 text-left">
          
          {/* Left Column: Evidence Workspace & AI Forensic Analysis */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Uploaded Evidence Workspace (Requirement 5) */}
            <div className="bg-white border border-[#e5e5e5] rounded-xl shadow-xs overflow-hidden">
              <div className="px-5 py-4 border-b border-[#e5e5e5] bg-slate-50/50 flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <FolderSearch className="h-4 w-4 text-[#CC2200]" />
                  <h3 className="font-bold text-sm text-slate-900">Uploaded Evidence Workspace</h3>
                </div>
                <span className="text-xs font-semibold text-slate-500">
                  {caseDetail.evidence?.length || 0} Submitted Items
                </span>
              </div>

              {caseDetail.evidence?.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400">No evidence files submitted for this case.</div>
              ) : (
                <div className="divide-y divide-[#e5e5e5]">
                  {caseDetail.evidence?.map((ev: EvidenceType) => (
                    <div key={ev.id} className="p-4 space-y-3 hover:bg-slate-50/40 transition-colors">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-xs font-bold text-[#CC2200]">
                            {ev.file_type === "IMAGE" ? <FileText className="h-5 w-5" /> : <FileVideo className="h-5 w-5" />}
                          </div>
                          <div>
                            <h4 className="text-xs font-bold text-slate-900 truncate max-w-[260px]">{ev.original_name}</h4>
                            <p className="text-[10px] text-slate-400 mt-0.5">
                              {(ev.file_size / 1024 / 1024).toFixed(2)} MB • {ev.mime_type || ev.file_type} • Uploaded: {formatDate(ev.upload_time || ev.created_at)}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setPreviewFile(ev)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded border border-[#e5e5e5] bg-white hover:bg-slate-50 text-[11px] font-semibold text-slate-800"
                          >
                            <Eye className="h-3.5 w-3.5 text-blue-600" />
                            View
                          </button>

                          <a
                            href={`${BACKEND_URL}/api/v1/user/evidence/${ev.id}/download?token=${session?.accessToken}`}
                            download={ev.original_name}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded border border-[#e5e5e5] bg-white hover:bg-slate-50 text-[11px] font-semibold text-slate-800"
                          >
                            <Download className="h-3.5 w-3.5 text-emerald-600" />
                            Download
                          </a>
                        </div>
                      </div>

                      <div className="p-2 bg-slate-50 rounded border border-slate-100 flex items-center justify-between text-[10px] text-slate-500 font-mono">
                        <span className="font-semibold">SHA-256 Hash:</span>
                        <span className="truncate max-w-[340px] text-slate-700">{ev.sha256_hash || "Calculating hash..."}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Centralized AI Forensic Analysis (Requirement 6 & 7) */}
            <div className="bg-white border border-[#e5e5e5] rounded-xl shadow-xs overflow-hidden">
              <div className="px-5 py-4 border-b border-[#e5e5e5] bg-slate-50/50 flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <BrainCircuit className="h-4 w-4 text-[#CC2200]" />
                  <h3 className="font-bold text-sm text-slate-900">AI Forensic Analysis</h3>
                </div>
                {scanResult && !isScanning && (
                  <span className="text-[10px] font-bold px-2.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                    Demonstration Scan
                  </span>
                )}
              </div>

              <div className="p-6 space-y-6">
                {/* 1. Scanning In Progress State */}
                {isScanning ? (
                  <div className="bg-slate-900 text-white rounded-xl p-6 space-y-4 shadow-inner text-center animate-pulse">
                    <div className="flex items-center justify-center gap-2 text-xs font-bold tracking-widest text-[#CC2200] uppercase">
                      <Sparkles className="h-4 w-4 animate-spin" />
                      Sentinel AI Forensic Analysis
                    </div>
                    <p className="text-sm font-medium text-slate-300">Analyzing submitted evidence</p>

                    {/* Progress Bar */}
                    <div className="w-full bg-slate-800 rounded-full h-3.5 p-0.5 overflow-hidden border border-slate-700">
                      <div
                        className="bg-gradient-to-r from-[#CC2200] to-amber-500 h-full rounded-full transition-all duration-100 ease-out"
                        style={{ width: `${scanProgress}%` }}
                      />
                    </div>

                    <div className="flex justify-between items-center text-xs font-mono text-slate-400">
                      <span className="text-amber-400 font-semibold">{scanStage}</span>
                      <span className="text-white font-bold text-sm">{scanProgress}%</span>
                    </div>
                  </div>
                ) : scanResult ? (
                  /* 2. Scan Completed Results Dashboard */
                  <div className="space-y-6">
                    {/* Summary Banner */}
                    <div className="bg-emerald-50/80 border border-emerald-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <CheckCircle className="h-5 w-5 text-emerald-600 flex-shrink-0" />
                        <div>
                          <h4 className="text-xs font-bold text-emerald-900 uppercase tracking-wide">Analysis Complete</h4>
                          <p className="text-[11px] text-emerald-700 font-medium mt-0.5">
                            {scanResult.evidence_count} Evidence Files • {scanResult.scan_duration || 10.2} Seconds Duration
                          </p>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold px-2.5 py-1 rounded bg-white text-slate-600 border border-slate-200">
                        Demonstration Scan
                      </span>
                    </div>

                    {/* Evidence Results Grid */}
                    <div className="space-y-4">
                      {scanResult.results?.map((res: any, idx: number) => {
                        const isManipulated = res.assessment_code === "DEEPFAKE" || res.deepfake_probability >= 50;
                        return (
                          <div
                            key={idx}
                            className={`p-4 rounded-xl border text-left space-y-3 transition-all ${
                              isManipulated
                                ? "bg-rose-50/40 border-rose-200"
                                : "bg-emerald-50/40 border-emerald-200"
                            }`}
                          >
                            <div className="flex justify-between items-start flex-wrap gap-2">
                              <div>
                                <span className="text-[10px] font-bold uppercase text-slate-400">Evidence 0{idx + 1}</span>
                                <h4 className="text-xs font-bold text-slate-900">{res.file_name}</h4>
                              </div>
                              <span
                                className={`px-3 py-1 rounded text-xs font-extrabold border ${
                                  isManipulated
                                    ? "bg-rose-100 text-rose-800 border-rose-300"
                                    : "bg-emerald-100 text-emerald-800 border-emerald-300"
                                }`}
                              >
                                {res.assessment}
                              </span>
                            </div>

                            {/* Metrics Grid */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-white/80 p-3 rounded-lg border border-slate-200 text-xs">
                              <div>
                                <div className="flex justify-between text-[11px] font-bold mb-1">
                                  <span className="text-slate-600">Deepfake Probability:</span>
                                  <span className={isManipulated ? "text-rose-600" : "text-emerald-600"}>{res.deepfake_probability}%</span>
                                </div>
                                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full rounded-full ${isManipulated ? "bg-rose-500" : "bg-emerald-500"}`}
                                    style={{ width: `${res.deepfake_probability}%` }}
                                  />
                                </div>
                              </div>

                              <div>
                                <div className="flex justify-between text-[11px] font-bold mb-1">
                                  <span className="text-slate-600">Manipulation Confidence:</span>
                                  <span className="text-slate-900">{res.manipulation_confidence}%</span>
                                </div>
                                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                                  <div
                                    className="h-full rounded-full bg-indigo-500"
                                    style={{ width: `${res.manipulation_confidence}%` }}
                                  />
                                </div>
                              </div>
                            </div>

                            {res.artifacts_summary && (
                              <p className="text-[11px] text-slate-600 italic font-medium">
                                Note: {res.artifacts_summary}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* PDF Actions Toolbar */}
                    <div className="pt-3 border-t border-[#e5e5e5] flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={handleViewPDF}
                          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 border border-[#e5e5e5] text-xs font-bold text-slate-800 transition-colors"
                        >
                          <FileText className="h-3.5 w-3.5 text-[#CC2200]" />
                          View Forensic Report
                        </button>

                        <button
                          onClick={handleDownloadPDF}
                          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#CC2200] hover:bg-[#a81c00] text-white text-xs font-bold transition-colors shadow-xs"
                        >
                          <Download className="h-3.5 w-3.5" />
                          Download PDF
                        </button>
                      </div>

                      <button
                        onClick={handleScanEvidence}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-slate-800"
                      >
                        <RotateCcw className="h-3 w-3" />
                        Rescan Evidence
                      </button>
                    </div>
                  </div>
                ) : (
                  /* 3. Initial Empty State */
                  <div className="text-center py-8 px-4 space-y-4 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                    <BrainCircuit className="h-10 w-10 text-[#CC2200]/40 mx-auto" />
                    <div className="space-y-1">
                      <h4 className="text-sm font-bold text-slate-900">AI Forensic Analysis</h4>
                      <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                        No forensic scan has been performed for this case. Sentinel AI will analyze all submitted evidence and generate a structured forensic analysis report.
                      </p>
                    </div>

                    <button
                      onClick={handleScanEvidence}
                      className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-[#CC2200] hover:bg-[#a81c00] text-white text-xs font-bold shadow-md transition-all cursor-pointer"
                    >
                      <Sparkles className="h-4 w-4" />
                      Scan Evidence
                    </button>
                  </div>
                )}
              </div>
            </div>

          </div>

          {/* Right Column: Case Notes (Read-Only) */}
          <div className="space-y-6">
            <div className="bg-white border border-[#e5e5e5] rounded-xl shadow-xs overflow-hidden">
              <div className="px-5 py-4 border-b border-[#e5e5e5] bg-slate-50/50 flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Notebook className="h-4 w-4 text-[#CC2200]" />
                  <h3 className="font-bold text-sm text-slate-900">Case Notes</h3>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                  Read Only
                </span>
              </div>

              <div className="p-5">
                {caseDetail.notes?.length === 0 ? (
                  <div className="text-center text-xs text-slate-400 py-6">No case notes added yet.</div>
                ) : (
                  <div className="space-y-3">
                    {caseDetail.notes?.map((n: CaseNoteType) => (
                      <div key={n.id} className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1 text-left">
                        <div className="flex justify-between items-center text-[10px] font-bold text-slate-500">
                          <span>{n.user_name}</span>
                          <span>{formatDate(n.created_at)}</span>
                        </div>
                        <p className="text-xs text-slate-800 leading-relaxed font-medium">{n.note}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Dedicated Investigation Notes Section (Tiptap Rich-Text Editor) */}
            <InvestigatorNotesEditor
              caseId={caseDetail.id}
              accessToken={session?.accessToken || ""}
              assignedExpertId={caseDetail.assigned_expert_id ?? caseDetail.assigned_expert}
              caseStatus={caseDetail.status}
              currentUserId={session?.user?.id}
              isInvestigatorRole={isInvestigator}
              userFullName={session?.user?.name || "Investigator"}
            />
          </div>

        </div>

        {/* ─── Investigator Final Workflow Completion Section ─── */}
        <div className="mt-12 pt-8 border-t border-[#e5e5e5]">
          <div className="bg-white border border-[#e5e5e5] rounded-xl p-6 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 text-left">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 flex-shrink-0 mt-0.5">
                <Send className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-indigo-600 block">
                  Final Investigation Step
                </span>
                <h3 className="text-sm font-bold text-slate-900">
                  Forward Case File to Subject Matter Expert
                </h3>
                <p className="text-xs text-slate-500 max-w-2xl leading-relaxed">
                  After thoroughly reviewing submitted evidence, AI forensic scan metrics, case notes, and audit logs, submit this case file for secondary expert verification and formal forensic endorsement.
                </p>
              </div>
            </div>

            {caseDetail.status === "CASE_UNDER_INVESTIGATION" && (
              <button
                onClick={handleForwardToExpert}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md transition-colors cursor-pointer flex-shrink-0"
              >
                <Send className="h-4 w-4" />
                Forward to Expert
              </button>
            )}
          </div>
        </div>

      </main>

      {/* ─── Evidence Preview Lightbox Modal ─── */}
      {previewFile && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-3xl w-full overflow-hidden shadow-2xl space-y-0">
            <div className="px-6 py-4 bg-slate-900 text-white flex justify-between items-center">
              <h3 className="text-sm font-bold truncate max-w-md">{previewFile.original_name}</h3>
              <button onClick={() => setPreviewFile(null)} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="p-6 max-h-[70vh] overflow-y-auto flex items-center justify-center bg-slate-100">
              {previewFile.file_type === "IMAGE" || previewFile.mime_type?.startsWith("image/") ? (
                <img
                  src={`${BACKEND_URL}/api/v1/user/evidence/${previewFile.id}/download?token=${session?.accessToken}`}
                  alt={previewFile.original_name}
                  className="max-h-[60vh] object-contain rounded shadow"
                />
              ) : previewFile.file_type === "VIDEO" || previewFile.mime_type?.startsWith("video/") ? (
                <video controls className="max-h-[60vh] rounded shadow">
                  <source src={`${BACKEND_URL}/api/v1/user/evidence/${previewFile.id}/download?token=${session?.accessToken}`} type={previewFile.mime_type || "video/mp4"} />
                  Your browser does not support HTML5 video.
                </video>
              ) : (
                <div className="text-center p-8 space-y-3">
                  <FileText className="h-16 w-16 text-slate-400 mx-auto" />
                  <p className="text-xs font-semibold text-slate-600">Document File Preview Available via Download</p>
                </div>
              )}
            </div>

            <div className="px-6 py-3 bg-slate-50 border-t border-[#e5e5e5] flex justify-end">
              <button
                onClick={() => setPreviewFile(null)}
                className="px-4 py-2 bg-slate-200 text-slate-800 text-xs font-bold rounded-lg hover:bg-slate-300"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Audit Trail Modal (Requirement 12) ─── */}
      {auditModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full overflow-hidden shadow-2xl space-y-0 text-left">
            <div className="px-6 py-4 bg-slate-900 text-white flex justify-between items-center">
              <div className="flex items-center gap-2">
                <History className="h-4 w-4 text-[#CC2200]" />
                <h3 className="text-sm font-bold">Case Audit Trail — {caseDetail.case_number}</h3>
              </div>
              <button onClick={() => setAuditModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 max-h-[60vh] overflow-y-auto space-y-3">
              {caseDetail.audit_logs?.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-4">No audit logs recorded for this case.</p>
              ) : (
                caseDetail.audit_logs?.map((log: AuditLogType) => (
                  <div key={log.id} className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
                    <div className="flex justify-between items-center text-[10px] font-bold text-slate-500">
                      <span className="text-[#CC2200]">{log.action}</span>
                      <span>{formatDate(log.timestamp)}</span>
                    </div>
                    <p className="text-xs font-semibold text-slate-800">{log.description}</p>
                    <p className="text-[10px] text-slate-400">By: {log.user_name}</p>
                  </div>
                ))
              )}
            </div>

            <div className="px-6 py-3 bg-slate-50 border-t border-[#e5e5e5] flex justify-end">
              <button
                onClick={() => setAuditModalOpen(false)}
                className="px-4 py-2 bg-slate-200 text-slate-800 text-xs font-bold rounded-lg hover:bg-slate-300"
              >
                Close Audit Log
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Case Messaging Modal (Requirement 11) ─── */}
      {chatModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-xl w-full overflow-hidden shadow-2xl flex flex-col h-[600px] text-left">
            
            {/* Modal Header */}
            <div className="px-6 py-4 bg-slate-900 text-white flex justify-between items-center flex-shrink-0">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-[#CC2200]" />
                <div>
                  <h3 className="text-xs font-bold">Case Messenger — {caseDetail.case_number}</h3>
                  <p className="text-[10px] text-slate-400">Case Owner ↔ Assigned Investigator</p>
                </div>
              </div>
              <button onClick={() => setChatModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Message History Feed */}
            <div className="flex-1 p-6 overflow-y-auto space-y-3 bg-slate-50">
              {messagesLoading ? (
                <div className="flex justify-center items-center py-8">
                  <Loader2 className="h-6 w-6 text-[#CC2200] animate-spin" />
                </div>
              ) : messages.length === 0 ? (
                <div className="text-center py-12 text-xs text-slate-400 space-y-1">
                  <MessageSquare className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                  <p className="font-semibold text-slate-600">No messages sent yet.</p>
                  <p>Type a message below to start communication.</p>
                </div>
              ) : (
                messages.map((m) => (
                  <div
                    key={m.id}
                    className={`flex flex-col ${m.is_me ? "items-end" : "items-start"}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-xs shadow-xs space-y-1 ${
                        m.is_me
                          ? "bg-[#CC2200] text-white rounded-tr-none"
                          : "bg-white text-slate-900 border border-slate-200 rounded-tl-none"
                      }`}
                    >
                      <div className={`flex justify-between items-center gap-3 text-[9px] font-bold ${m.is_me ? "text-red-100" : "text-slate-400"}`}>
                        <span>{m.sender_name} ({m.sender_role})</span>
                        <span>{m.created_at}</span>
                      </div>
                      <p className="leading-relaxed font-medium">{m.message}</p>
                    </div>
                  </div>
                ))
              )}
              <div ref={chatBottomRef} />
            </div>

            {/* Input Bar */}
            <div className="p-4 bg-white border-t border-[#e5e5e5] flex gap-2 items-center flex-shrink-0">
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSendMessage();
                }}
                placeholder="Type a message..."
                className="flex-1 px-4 py-2.5 text-xs border border-slate-200 rounded-lg focus:outline-hidden focus:border-[#CC2200]"
              />
              <button
                onClick={handleSendMessage}
                disabled={!inputMessage.trim() || sendingMessage}
                className="px-4 py-2.5 bg-[#CC2200] hover:bg-[#a81c00] disabled:bg-slate-200 text-white disabled:text-slate-400 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                {sendingMessage ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Send
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
