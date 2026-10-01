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
  ChevronDown,
  ChevronUp,
  Loader2,
  CheckCircle,
  Send,
  ShieldCheck,
  History,
  AlertTriangle,
  MessageSquare,
  RotateCcw,
  Info,
  Notebook,
  Plus,
  Upload,
  Trash2,
  Paperclip,
  Image as ImageIcon,
  Film
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
  uploaded_by?: number;
  uploaded_by_name?: string;
  uploader_role?: string;
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

interface AttachmentType {
  id: number;
  message_id?: number | null;
  case_id: number;
  uploaded_by: number;
  uploaded_by_name: string;
  uploaded_by_role: string;
  original_filename: string;
  mime_type: string;
  file_size: number;
  sha256_hash: string;
  status: string;
  scan_status: string;
  evidence_id?: number | null;
  is_evidence?: boolean;
  created_at: string;
  download_url: string;
}

interface MessageType {
  id: number;
  case_id: number;
  sender_id: number;
  sender_name: string;
  sender_role: string;
  is_me: boolean;
  message: string;
  attachments?: AttachmentType[];
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
  const [isAnalysisExpanded, setIsAnalysisExpanded] = useState(true);

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
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [selectedUploadFile, setSelectedUploadFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const [imageLoadErrors, setImageLoadErrors] = useState<Record<string, boolean>>({});
  const handleImageError = (urlKey: string) => {
    setImageLoadErrors((prev) => ({ ...prev, [urlKey]: true }));
  };

  // Authorization checks for Evidence Upload
  const currentUserId = (session?.user as any)?.id ? Number((session?.user as any)?.id) : null;
  const userRoleId = (session?.user as any)?.role_id || (session?.user as any)?.role;

  const assignedInvestigatorId =
    caseDetail?.assigned_expert_id !== undefined && caseDetail?.assigned_expert_id !== null
      ? Number(caseDetail.assigned_expert_id)
      : (typeof caseDetail?.assigned_expert === "number" ? caseDetail.assigned_expert : null);

  const isCaseOwner = currentUserId !== null && Number(caseDetail?.created_by) === currentUserId;
  const isClaimedInvestigator = currentUserId !== null && isInvestigator && assignedInvestigatorId === currentUserId;
  const isUnclaimedInvestigator = isInvestigator && !assignedInvestigatorId && !isCaseOwner;
  const isOtherInvestigator = isInvestigator && Boolean(assignedInvestigatorId) && assignedInvestigatorId !== currentUserId && !isCaseOwner;
  const isAdminUser = userRoleId === 1 || userRoleId === "ADMIN";

  const [deleteConfirmEvidence, setDeleteConfirmEvidence] = useState<EvidenceType | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const canUploadEvidence = isCaseOwner || isClaimedInvestigator || isAdminUser;

  const canDeleteEvidence = (ev: EvidenceType) => {
    if (isAdminUser) return true;
    if (isInvestigator) {
      return ev.uploaded_by !== undefined && Number(ev.uploaded_by) === currentUserId;
    }
    return (
      ev.uploaded_by !== undefined &&
      Number(ev.uploaded_by) === currentUserId &&
      caseDetail?.status === "DRAFT"
    );
  };

  const confirmDeleteEvidence = async () => {
    if (!deleteConfirmEvidence || !session?.accessToken) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/user/evidence/${deleteConfirmEvidence.id}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${session.accessToken}`
        }
      });
      if (res.ok) {
        showToast("Evidence deleted successfully.", "success");
        setCaseDetail((prev: any) => {
          if (!prev) return prev;
          const updatedEvidence = (prev.evidence || []).filter((item: EvidenceType) => item.id !== deleteConfirmEvidence.id);
          return { ...prev, evidence: updatedEvidence };
        });
        setScanResult((prev: any) => {
          if (!prev || !prev.results) return prev;
          const filteredResults = prev.results.filter((r: any) => r.evidence_id !== deleteConfirmEvidence.id);
          return {
            ...prev,
            evidence_count: filteredResults.length,
            results: filteredResults
          };
        });
        setDeleteConfirmEvidence(null);
        fetchCaseDetail();
        fetchScanResult(caseId);
      } else {
        const errorData = await res.json().catch(() => ({}));
        showToast(errorData.detail || "Unable to delete evidence.", "error");
      }
    } catch (err) {
      console.error(err);
      showToast("Unable to delete evidence.", "error");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleUploadEvidence = async () => {
    if (!selectedUploadFile || !session?.accessToken) return;
    setIsUploading(true);
    setUploadProgress(20);

    try {
      const formData = new FormData();
      formData.append("case_id", caseId);
      formData.append("file", selectedUploadFile);

      setUploadProgress(50);
      const res = await fetch(`${BACKEND_URL}/api/v1/user/evidence/upload`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${session.accessToken}`
        },
        body: formData
      });

      setUploadProgress(90);

      if (res.ok) {
        showToast(`Uploaded ${selectedUploadFile.name} successfully`, "success");
        setUploadModalOpen(false);
        setSelectedUploadFile(null);
        fetchCaseDetail();
      } else {
        const errorData = await res.json().catch(() => ({}));
        showToast(errorData.detail || "Failed to upload evidence", "error");
      }
    } catch (err) {
      showToast("Error uploading evidence file", "error");
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  // Chat State
  const [messages, setMessages] = useState<MessageType[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [inputMessage, setInputMessage] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);
  const [pendingAttachment, setPendingAttachment] = useState<File | null>(null);
  const [promotingAttachmentId, setPromotingAttachmentId] = useState<number | null>(null);
  const chatFileInputRef = useRef<HTMLInputElement>(null);
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
    const raw = statusStr || "";
    const normalized = raw.toUpperCase().replace(/\s+/g, "_");

    if (normalized === "DRAFT") {
      return (
        <span className="inline-flex items-center justify-center px-2.5 py-1 rounded text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200 whitespace-nowrap">
          Draft
        </span>
      );
    }
    if (normalized === "CASE_FILED" || normalized === "FILED") {
      return (
        <span className="inline-flex items-center justify-center px-2.5 py-1 rounded text-xs font-bold bg-blue-50 text-blue-800 border border-blue-200 whitespace-nowrap">
          Case Filed
        </span>
      );
    }
    if (
      normalized === "CASE_UNDER_INVESTIGATION" ||
      normalized === "UNDER_INVESTIGATION" ||
      normalized === "CASE_OPENED" ||
      normalized === "UNDER_ANALYSIS" ||
      normalized === "EXPERT_REVIEW" ||
      normalized === "REVIEW"
    ) {
      return (
        <span className="inline-flex items-center justify-center px-2.5 py-1 rounded text-xs font-bold bg-purple-50 text-purple-800 border border-purple-200 whitespace-nowrap">
          Under Investigation
        </span>
      );
    }
    if (normalized === "CLOSED" || normalized === "CASE_CLOSED") {
      return (
        <span className="inline-flex items-center justify-center px-2.5 py-1 rounded text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 whitespace-nowrap">
          Closed
        </span>
      );
    }
    if (normalized === "RESOLVED" || normalized === "CASE_RESOLVED") {
      return (
        <span className="inline-flex items-center justify-center px-2.5 py-1 rounded text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 whitespace-nowrap">
          Resolved
        </span>
      );
    }
    if (normalized === "PENDING" || normalized === "CASE_PENDING") {
      return (
        <span className="inline-flex items-center justify-center px-2.5 py-1 rounded text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200 whitespace-nowrap">
          Pending
        </span>
      );
    }

    let displayLabel = raw.replace(/^Case\s+/i, "").replace(/_/g, " ");
    displayLabel = displayLabel.replace(/\b\w/g, (c) => c.toUpperCase());

    return (
      <span className="inline-flex items-center justify-center px-2.5 py-1 rounded text-xs font-bold bg-purple-50 text-purple-800 border border-purple-200 whitespace-nowrap">
        {displayLabel}
      </span>
    );
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

  const handleSelectAttachment = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isVideo = file.type.startsWith("video/") || file.name.endsWith(".mp4") || file.name.endsWith(".mov");
    const maxSize = isVideo ? 100 * 1024 * 1024 : 50 * 1024 * 1024;
    if (file.size > maxSize) {
      showToast(`File too large. Maximum size is ${isVideo ? "100 MB" : "50 MB"}.`, "error");
      return;
    }
    setPendingAttachment(file);
    if (chatFileInputRef.current) chatFileInputRef.current.value = "";
  };

  const handleSendMessage = async () => {
    if ((!inputMessage.trim() && !pendingAttachment) || !caseId || !session?.accessToken || sendingMessage) return;
    setSendingMessage(true);
    try {
      let attachmentIds: number[] = [];
      if (pendingAttachment) {
        const formData = new FormData();
        formData.append("file", pendingAttachment);
        const upRes = await fetch(`${BACKEND_URL}/api/v1/user/cases/${caseId}/attachments/upload`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.accessToken}`
          },
          body: formData
        });
        if (!upRes.ok) {
          const errData = await upRes.json().catch(() => ({}));
          showToast(errData.detail || "Failed to upload attachment", "error");
          setSendingMessage(false);
          return;
        }
        const attData = await upRes.json();
        attachmentIds.push(attData.id);
      }

      const res = await fetch(`${BACKEND_URL}/api/v1/user/cases/${caseId}/messages`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.accessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          message: inputMessage.trim(),
          attachment_ids: attachmentIds
        })
      });

      if (res.ok) {
        const newMsg = await res.json();
        setMessages((prev) => [...prev, newMsg]);
        setInputMessage("");
        setPendingAttachment(null);
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

  const handlePromoteAttachment = async (attachmentId: number) => {
    if (!caseId || !session?.accessToken) return;
    setPromotingAttachmentId(attachmentId);
    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/user/cases/${caseId}/attachments/${attachmentId}/promote-to-evidence`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.accessToken}`
        }
      });
      if (res.ok) {
        showToast("Attachment promoted to formal investigation evidence!", "success");
        setMessages((prev) =>
          prev.map((m) => ({
            ...m,
            attachments: m.attachments?.map((a) =>
              a.id === attachmentId ? { ...a, is_evidence: true, status: "PROMOTED_TO_EVIDENCE" } : a
            )
          }))
        );
        fetchCaseDetail();
      } else {
        const err = await res.json().catch(() => ({}));
        showToast(err.detail || "Failed to promote attachment", "error");
      }
    } catch (e) {
      showToast("Error promoting attachment", "error");
    } finally {
      setPromotingAttachmentId(null);
    }
  };

  const handleDeleteAttachment = async (attachmentId: number) => {
    if (!confirm("Are you sure you want to permanently delete this attachment?")) return;
    if (!caseId || !session?.accessToken) return;
    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/user/cases/${caseId}/attachments/${attachmentId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${session.accessToken}`
        }
      });
      if (res.ok) {
        showToast("Attachment deleted successfully", "success");
        setMessages((prev) =>
          prev.map((m) => ({
            ...m,
            attachments: m.attachments?.filter((a) => a.id !== attachmentId)
          }))
        );
        fetchCaseDetail();
      } else {
        const err = await res.json().catch(() => ({}));
        showToast(err.detail || "Unable to delete attachment", "error");
      }
    } catch (e) {
      showToast("Error deleting attachment", "error");
    }
  };

  const canDeleteAttachment = (att: AttachmentType) => {
    const currentUserId = session?.user?.id ? Number(session.user.id) : null;
    if (isAdminUser) return true;
    if (currentUserId && att.uploaded_by === currentUserId) return true;
    return false;
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
        clearInterval(interval);
        setScanProgress(100);
        setIsScanning(false);
        setScanResult(data);
        showToast("Sentinel AI Forensic Scan completed successfully!", "success");
        fetchCaseDetail();
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
      if (res.status === 401) {
        showToast("Your session has expired. Please sign in again.", "error");
        return;
      }
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

  const handleViewPDF = async () => {
    if (!caseId || !session?.accessToken) return;
    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/user/cases/${caseId}/report/pdf`, {
        headers: { Authorization: `Bearer ${session.accessToken}` }
      });

      if (res.status === 401) {
        showToast("Your session has expired. Please sign in again.", "error");
        return;
      }

      if (!res.ok) {
        showToast("Unable to open the forensic report. Please try again.", "error");
        return;
      }

      const blob = await res.blob();
      const pdfUrl = URL.createObjectURL(blob);
      window.open(pdfUrl, "_blank", "noopener,noreferrer");

      setTimeout(() => {
        URL.revokeObjectURL(pdfUrl);
      }, 60000);
    } catch (err) {
      console.error("Error viewing PDF report:", err);
      showToast("Unable to open the forensic report. Please try again.", "error");
    }
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
            
            {/* Uploaded Evidence Workspace */}
            <div className="bg-white border border-[#e5e5e5] rounded-xl shadow-xs overflow-hidden">
              <div className="px-5 py-4 border-b border-[#e5e5e5] bg-slate-50/50 flex flex-wrap justify-between items-center gap-3">
                <div className="flex items-center gap-2">
                  <FolderSearch className="h-4 w-4 text-[#CC2200]" />
                  <h3 className="font-bold text-sm text-slate-900">Uploaded Evidence Workspace</h3>
                  <span className="text-xs font-semibold text-slate-500">
                    ({caseDetail.evidence?.length || 0} Submitted Items)
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {canUploadEvidence ? (
                    <button
                      onClick={() => setUploadModalOpen(true)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#CC2200] hover:bg-[#a81c00] text-xs font-bold text-white transition-colors cursor-pointer shadow-xs"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      {isClaimedInvestigator ? "Add Investigation Evidence" : "Upload Evidence"}
                    </button>
                  ) : isOtherInvestigator ? (
                    <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-50 border border-amber-200 text-amber-800 rounded text-[11px] font-semibold">
                      <Lock className="h-3.5 w-3.5 text-amber-600" />
                      <span>Case assigned to another investigator.</span>
                    </div>
                  ) : isUnclaimedInvestigator ? (
                    <div className="flex items-center gap-1.5 px-3 py-1 bg-blue-50 border border-blue-200 text-blue-800 rounded text-[11px] font-semibold">
                      <Info className="h-3.5 w-3.5 text-blue-600" />
                      <span>Claim case to upload evidence.</span>
                    </div>
                  ) : null}
                </div>
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
                            <p className="text-[10px] text-slate-500 mt-0.5 flex flex-wrap items-center gap-2">
                              <span>{(ev.file_size / 1024 / 1024).toFixed(2)} MB • {ev.mime_type || ev.file_type}</span>
                              <span>•</span>
                              <span>Uploaded: {formatDate(ev.upload_time || ev.created_at)}</span>
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-[10px] text-slate-600 font-medium">
                                Uploaded by: <strong className="text-slate-900">{ev.uploaded_by_name || "Case Owner"}</strong>
                              </span>
                              <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border ${
                                ev.uploader_role === "Investigator"
                                  ? "bg-blue-50 text-blue-700 border-blue-200"
                                  : ev.uploader_role === "Admin"
                                  ? "bg-purple-50 text-purple-700 border-purple-200"
                                  : "bg-slate-100 text-slate-700 border-slate-200"
                              }`}>
                                {ev.uploader_role || "Case Owner"}
                              </span>
                            </div>
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

                          {canDeleteEvidence(ev) && (
                            <button
                              onClick={() => setDeleteConfirmEvidence(ev)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded border border-rose-200 bg-white hover:bg-rose-50 text-[11px] font-semibold text-rose-600 transition-colors cursor-pointer shadow-xs"
                              title="Delete Evidence"
                            >
                              <Trash2 className="h-3.5 w-3.5 text-rose-600" />
                              Delete
                            </button>
                          )}
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
              <button
                type="button"
                onClick={() => setIsAnalysisExpanded((prev) => !prev)}
                aria-expanded={isAnalysisExpanded}
                aria-controls="ai-forensic-analysis-content"
                className={`w-full px-5 py-4 bg-slate-50/50 hover:bg-slate-100/80 transition-colors flex justify-between items-center text-left cursor-pointer focus:outline-hidden focus-visible:ring-2 focus-visible:ring-[#CC2200] ${
                  isAnalysisExpanded ? "border-b border-[#e5e5e5]" : ""
                }`}
              >
                <div className="flex items-center gap-2">
                  <BrainCircuit className="h-4 w-4 text-[#CC2200]" />
                  <h3 className="font-bold text-sm text-slate-900">AI Forensic Analysis</h3>
                </div>
                <div className="text-slate-500 hover:text-slate-700 transition-colors">
                  {isAnalysisExpanded ? (
                    <ChevronUp className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <ChevronDown className="h-4 w-4" aria-hidden="true" />
                  )}
                </div>
              </button>

              {isAnalysisExpanded && (
                <div id="ai-forensic-analysis-content" className="p-6 space-y-6">
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
                      <span className="text-[10px] font-bold px-2.5 py-1 rounded bg-purple-100 text-purple-800 border border-purple-200">
                        Sentinel AI V1.7-A Dual-Head
                      </span>
                    </div>

                    {/* Evidence Results Grid */}
                    <div className="space-y-4">
                      {scanResult.results?.map((res: any, idx: number) => {
                        const isManipulated = res.classification === "tampered" || res.assessment_code === "DEEPFAKE" || (res.tampered_probability !== undefined ? res.tampered_probability >= 0.40 : res.deepfake_probability >= 50);
                        const tamperedPct = res.tampered_probability !== undefined 
                          ? (res.tampered_probability * 100).toFixed(1) 
                          : (res.deepfake_probability !== undefined ? res.deepfake_probability : 0);
                        const authenticPct = res.authentic_probability !== undefined
                          ? (res.authentic_probability * 100).toFixed(1)
                          : (100 - parseFloat(tamperedPct as string)).toFixed(1);

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
                                <h4 className="text-xs font-bold text-slate-900">{res.file_name || res.original_name}</h4>
                              </div>
                              <span
                                className={`px-3 py-1 rounded text-xs font-extrabold border ${
                                  isManipulated
                                    ? "bg-rose-100 text-rose-800 border-rose-300"
                                    : "bg-emerald-100 text-emerald-800 border-emerald-300"
                                }`}
                              >
                                {isManipulated ? "TAMPERED / MANIPULATED" : "AUTHENTIC MEDIA"}
                              </span>
                            </div>

                            {/* Metrics Grid */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-white/80 p-3 rounded-lg border border-slate-200 text-xs">
                              <div>
                                <div className="flex justify-between text-[11px] font-bold mb-1">
                                  <span className="text-slate-600">Tampered Probability:</span>
                                  <span className={isManipulated ? "text-rose-600 font-extrabold" : "text-slate-600"}>{tamperedPct}%</span>
                                </div>
                                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full rounded-full ${isManipulated ? "bg-rose-500" : "bg-slate-400"}`}
                                    style={{ width: `${tamperedPct}%` }}
                                  />
                                </div>
                              </div>

                              <div>
                                <div className="flex justify-between text-[11px] font-bold mb-1">
                                  <span className="text-slate-600">Authentic Probability:</span>
                                  <span className={!isManipulated ? "text-emerald-600 font-extrabold" : "text-slate-600"}>{authenticPct}%</span>
                                </div>
                                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full rounded-full ${!isManipulated ? "bg-emerald-500" : "bg-slate-400"}`}
                                    style={{ width: `${authenticPct}%` }}
                                  />
                                </div>
                              </div>
                            </div>

                            {/* Localization Artifact Display */}
                            {(res.overlay_artifact_path || res.overlay_path) && (
                              <div className="mt-3 pt-3 border-t border-slate-200 text-left">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-[11px] font-bold text-slate-700">
                                    Localization Map (Activation Threshold: {res.localization_threshold || 0.35})
                                  </span>
                                  <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                    Artifact Generated
                                  </span>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-1">
                                  {/* 1. Original Evidence Comparison */}
                                  {caseDetail?.evidence?.find((e: EvidenceType) => e.id === res.evidence_id) && (
                                    <div className="space-y-1">
                                      <span className="text-[10px] text-slate-600 font-bold block">1. Original Evidence</span>
                                      <img
                                        src={`${BACKEND_URL}/api/v1/user/evidence/${res.evidence_id}/download?token=${session?.accessToken}`}
                                        alt="Original Evidence"
                                        className="w-full h-40 object-contain rounded border border-slate-200 bg-slate-50"
                                      />
                                    </div>
                                  )}

                                  {/* 2. Heatmap Overlay */}
                                  {res.overlay_artifact_path && (
                                    <div className="space-y-1">
                                      <span className="text-[10px] text-slate-600 font-bold block">2. Heatmap Overlay</span>
                                      {imageLoadErrors[res.overlay_artifact_path] ? (
                                        <div className="w-full h-40 flex flex-col items-center justify-center bg-slate-50 rounded border border-slate-200 p-3 text-center text-slate-400">
                                          <AlertTriangle className="h-5 w-5 text-amber-500 mb-1" />
                                          <span className="text-[10px] font-semibold text-slate-600">Localization artifact unavailable</span>
                                        </div>
                                      ) : (
                                        <img 
                                          src={`${BACKEND_URL}${res.overlay_artifact_path.startsWith('/') ? '' : '/'}${res.overlay_artifact_path}`}
                                          alt="Localization Overlay"
                                          onError={() => handleImageError(res.overlay_artifact_path)}
                                          className="w-full h-40 object-contain rounded border border-slate-200 bg-slate-50"
                                        />
                                      )}
                                    </div>
                                  )}

                                  {/* 3. Binary Detection Mask */}
                                  {res.mask_artifact_path && (
                                    <div className="space-y-1">
                                      <span className="text-[10px] text-slate-600 font-bold block">3. Binary Detection Mask</span>
                                      {imageLoadErrors[res.mask_artifact_path] ? (
                                        <div className="w-full h-40 flex flex-col items-center justify-center bg-slate-50 rounded border border-slate-200 p-3 text-center text-slate-400">
                                          <AlertTriangle className="h-5 w-5 text-amber-500 mb-1" />
                                          <span className="text-[10px] font-semibold text-slate-600">Localization mask unavailable</span>
                                        </div>
                                      ) : (
                                        <img 
                                          src={`${BACKEND_URL}${res.mask_artifact_path.startsWith('/') ? '' : '/'}${res.mask_artifact_path}`}
                                          alt="Localization Mask"
                                          onError={() => handleImageError(res.mask_artifact_path)}
                                          className="w-full h-40 object-contain rounded border border-slate-200 bg-slate-50"
                                        />
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}

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
              )}
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
                      className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-xs shadow-xs space-y-1.5 ${
                        m.is_me
                          ? "bg-[#CC2200] text-white rounded-tr-none"
                          : "bg-white text-slate-900 border border-slate-200 rounded-tl-none"
                      }`}
                    >
                      <div className={`flex justify-between items-center gap-3 text-[9px] font-bold ${m.is_me ? "text-red-100" : "text-slate-400"}`}>
                        <span>{m.sender_name} ({m.sender_role})</span>
                        <span>{m.created_at}</span>
                      </div>
                      {m.message && (
                        <p className="leading-relaxed font-medium whitespace-pre-wrap">{m.message}</p>
                      )}

                      {/* Attachments inside message bubble */}
                      {m.attachments && m.attachments.length > 0 && (
                        <div className="space-y-2 pt-1">
                          {m.attachments.map((att) => (
                            <div
                              key={att.id}
                              className={`p-2.5 rounded-lg border text-left space-y-1.5 ${
                                m.is_me
                                  ? "bg-red-950/40 border-red-300/30 text-white"
                                  : "bg-slate-50 border-slate-200 text-slate-900"
                              }`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2 truncate">
                                  {att.mime_type.startsWith("image") ? (
                                    <ImageIcon className="h-4 w-4 text-emerald-400 shrink-0" />
                                  ) : att.mime_type.startsWith("video") ? (
                                    <Film className="h-4 w-4 text-blue-400 shrink-0" />
                                  ) : (
                                    <FileText className="h-4 w-4 text-amber-400 shrink-0" />
                                  )}
                                  <span className="font-semibold text-xs truncate max-w-[200px]" title={att.original_filename}>
                                    {att.original_filename}
                                  </span>
                                </div>
                                <span className={`text-[10px] font-mono shrink-0 ${m.is_me ? "text-red-200" : "text-slate-500"}`}>
                                  {(att.file_size / (1024 * 1024)).toFixed(2)} MB
                                </span>
                              </div>

                              {/* Forensic SHA-256 Hash */}
                              <div className={`text-[9px] font-mono truncate ${m.is_me ? "text-red-200/80" : "text-slate-500"}`} title={`SHA-256: ${att.sha256_hash}`}>
                                SHA-256: {att.sha256_hash.slice(0, 16)}...
                              </div>

                              {/* Action Buttons: View, Download, Add to Evidence, Delete */}
                              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                                <a
                                  href={`${BACKEND_URL}${att.download_url}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold transition-colors cursor-pointer ${
                                    m.is_me
                                      ? "bg-white/20 hover:bg-white/30 text-white"
                                      : "bg-slate-200 hover:bg-slate-300 text-slate-800"
                                  }`}
                                >
                                  <Eye className="h-3 w-3" />
                                  View
                                </a>

                                <a
                                  href={`${BACKEND_URL}${att.download_url}`}
                                  download={att.original_filename}
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold transition-colors cursor-pointer ${
                                    m.is_me
                                      ? "bg-white/20 hover:bg-white/30 text-white"
                                      : "bg-slate-200 hover:bg-slate-300 text-slate-800"
                                  }`}
                                >
                                  <Download className="h-3 w-3" />
                                  Download
                                </a>

                                {/* Promote to Formal Evidence button (for Investigator or Admin) */}
                                {(isInvestigator || isAdminUser) && (
                                  att.is_evidence ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-600/30 text-emerald-300 border border-emerald-500/40">
                                      <CheckCircle className="h-3 w-3" />
                                      Formal Evidence
                                    </span>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => handlePromoteAttachment(att.id)}
                                      disabled={promotingAttachmentId === att.id}
                                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-[#CC2200] hover:bg-[#a81c00] text-white transition-colors cursor-pointer shadow-xs"
                                      title="Promote attachment to formal investigation evidence"
                                    >
                                      {promotingAttachmentId === att.id ? (
                                        <Loader2 className="h-3 w-3 animate-spin" />
                                      ) : (
                                        <ShieldCheck className="h-3 w-3" />
                                      )}
                                      Add to Investigation Evidence
                                    </button>
                                  )
                                )}

                                {/* Delete button (if user is uploader or admin) */}
                                {canDeleteAttachment(att) && (
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteAttachment(att.id)}
                                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] text-rose-300 hover:text-white hover:bg-rose-600/40 transition-colors cursor-pointer ml-auto"
                                    title="Delete attachment"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
              <div ref={chatBottomRef} />
            </div>

            {/* Pending Attachment Card */}
            {pendingAttachment && (
              <div className="px-4 py-2 bg-slate-50 border-t border-slate-200 flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-2 text-xs text-slate-800">
                  <Paperclip className="h-4 w-4 text-[#CC2200]" />
                  <span className="font-semibold truncate max-w-[240px]">{pendingAttachment.name}</span>
                  <span className="text-slate-500 font-mono text-[10px]">
                    ({(pendingAttachment.size / (1024 * 1024)).toFixed(2)} MB)
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setPendingAttachment(null)}
                  disabled={sendingMessage}
                  className="text-slate-400 hover:text-rose-600 transition-colors cursor-pointer p-1"
                  title="Remove attachment"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}

            {/* Input Bar */}
            <div className="p-4 bg-white border-t border-[#e5e5e5] flex gap-2 items-center flex-shrink-0">
              <input
                type="file"
                ref={chatFileInputRef}
                onChange={handleSelectAttachment}
                accept=".jpg,.jpeg,.png,.webp,.pdf,.mp4,.mov"
                className="hidden"
              />
              <button
                type="button"
                onClick={() => chatFileInputRef.current?.click()}
                disabled={sendingMessage}
                className="p-2 text-slate-500 hover:text-[#CC2200] hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                title="Attach File (.jpg, .png, .pdf, .mp4)"
              >
                <Paperclip className="h-4 w-4" />
              </button>
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSendMessage();
                }}
                placeholder={pendingAttachment ? "Add a message with attachment..." : "Type a message..."}
                className="flex-1 px-4 py-2.5 text-xs border border-slate-200 rounded-lg focus:outline-hidden focus:border-[#CC2200]"
              />
              <button
                onClick={handleSendMessage}
                disabled={(!inputMessage.trim() && !pendingAttachment) || sendingMessage}
                className="px-4 py-2.5 bg-[#CC2200] hover:bg-[#a81c00] disabled:bg-slate-200 text-white disabled:text-slate-400 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                {sendingMessage ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Send
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Upload Evidence Modal */}
      {uploadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white border border-slate-200 rounded-xl shadow-xl max-w-md w-full p-6 space-y-4 text-left">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="text-base font-extrabold text-slate-900">
                {isClaimedInvestigator ? "Add Investigation Evidence" : "Upload Evidence"}
              </h3>
              <button onClick={() => setUploadModalOpen(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3">
              <label className="block text-xs font-semibold text-slate-700">Select Evidence File (Image / Video / Audio / Document)</label>
              <input
                type="file"
                accept="image/*,video/*,audio/*,.pdf,.doc,.docx"
                onChange={(e) => setSelectedUploadFile(e.target.files?.[0] || null)}
                className="w-full text-xs text-slate-700 border border-slate-200 rounded-lg p-2.5 bg-slate-50 cursor-pointer"
              />
              {selectedUploadFile && (
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs flex justify-between items-center">
                  <span className="font-bold text-slate-900 truncate max-w-[200px]">{selectedUploadFile.name}</span>
                  <span className="text-slate-500 font-mono">{(selectedUploadFile.size / 1024 / 1024).toFixed(2)} MB</span>
                </div>
              )}
            </div>

            {isUploading && (
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs text-slate-600 font-semibold">
                  <span>Uploading evidence...</span>
                  <span>{uploadProgress}%</span>
                </div>
                <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                  <div className="bg-[#CC2200] h-full transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                disabled={isUploading}
                onClick={() => setUploadModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                disabled={!selectedUploadFile || isUploading}
                onClick={handleUploadEvidence}
                className="px-4 py-2 text-xs font-bold text-white bg-[#CC2200] hover:bg-[#a81c00] rounded-lg disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
              >
                {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                <span>Upload Evidence</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Delete Evidence Confirmation Modal (Part 7) ─── */}
      {deleteConfirmEvidence && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full overflow-hidden shadow-2xl space-y-0 text-left">
            <div className="px-6 py-4 bg-slate-900 text-white flex justify-between items-center">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-rose-500" />
                <h3 className="text-sm font-bold">Delete Evidence?</h3>
              </div>
              <button
                onClick={() => setDeleteConfirmEvidence(null)}
                disabled={isDeleting}
                className="text-slate-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-xs text-slate-600">
                Are you sure you want to permanently delete:
              </p>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                <p className="text-xs font-bold text-slate-900 truncate">
                  &ldquo;{deleteConfirmEvidence.original_name}&rdquo;
                </p>
                <p className="text-[10px] text-slate-500 mt-1">
                  Evidence ID: EV-{deleteConfirmEvidence.id} • {(deleteConfirmEvidence.file_size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
              <p className="text-xs text-slate-700 font-medium">
                This evidence was uploaded by you.
              </p>
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-xs">
                This action will remove the evidence file and its associated AI analysis.
              </div>
            </div>

            <div className="px-6 py-3 bg-slate-50 border-t border-[#e5e5e5] flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmEvidence(null)}
                disabled={isDeleting}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold rounded-lg transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteEvidence}
                disabled={isDeleting}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:bg-rose-300 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer shadow-xs"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete Evidence
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
