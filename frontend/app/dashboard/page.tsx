"use client";

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
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
  Plus,
  Search,
  Trash2,
  Eye,
  Edit2,
  Download,
  Check,
  X,
  Lock,
  ShieldAlert,
  Clock,
  Sparkles,
  Activity,
  Menu,
  ChevronLeft,
  ChevronRight,
  Filter,
  Loader2,
  FileUp,
  ExternalLink,
  ChevronDown,
  Notebook,
  Play,
  RotateCcw,
  CheckCircle,
  Info,
  Send,
  ShieldCheck,
  History,
  Maximize2,
  AlertTriangle,
  MessageSquare,
  MessageCircle
} from "lucide-react";
import WorkspaceSwitcher from "@/components/WorkspaceSwitcher";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://127.0.0.1:8000";

interface ToastType {
  id: string;
  message: string;
  type: "success" | "error" | "info";
}

interface CaseType {
  id: number;
  case_number: string;
  title: string;
  description: string;
  status: string;
  incident_date: string | null;
  created_at: string | null;
  submitted_at?: string | null;
  opened_at?: string | null;
  assigned_expert?: string | null;
  assigned_expert_id?: number | null;
  assigned_expert_name?: string | null;
  created_by?: number;
  creator_name?: string | null;
  evidence?: EvidenceType[];
  forensic_reviews?: ForensicReviewType[];
  notes?: CaseNoteType[];
  reports?: ReportType[];
  audit_logs?: AuditLogType[];
}

interface EvidenceType {
  id: number;
  file_name: string;
  original_name: string;
  file_type: string;
  mime_type: string;
  file_size: number;
  sha256_hash: string;
  upload_time: string | null;
  metadata?: {
    width?: number;
    height?: number;
    duration?: number;
    fps?: number;
    codec?: string;
    sample_rate?: number;
    gps_location?: string;
    creation_date?: string;
  };
  analyses?: AIAnalysisType[];
}

interface AIAnalysisType {
  id: number;
  file_name?: string;
  model_name: string;
  version: string;
  result: string;
  confidence_score: number;
  processing_time: number;
  analyzed_at: string | null;
}

interface ForensicReviewType {
  id: number;
  reviewer_name: string;
  decision: string;
  observations: string;
  reviewed_at: string | null;
}

interface CaseNoteType {
  id: number;
  note: string;
  user_id: number;
  user_name: string;
  created_at: string | null;
}

interface ReportType {
  id: number;
  case_number: string;
  case_title?: string;
  report_type: string;
  report_file: string;
  generated_at: string | null;
}

interface AuditLogType {
  id: number;
  action: string;
  description: string;
  user_name: string;
  timestamp: string | null;
}

interface MessageType {
  id: number;
  case_id: number;
  sender_id: number;
  sender_name: string;
  sender_role: string;
  is_me: boolean;
  message: string;
  created_at: string | null;
  read_at?: string | null;
}

interface NotificationType {
  id: number;
  title: string;
  message: string;
  read: boolean;
  created_at: string | null;
}

interface AIModelType {
  id: number;
  model_name: string;
  version: string;
  media_type: string;
  accuracy: number;
  description: string;
}

function UserDashboardContent() {
  const { data: sessionData, status } = useSession();
  const session = sessionData as any;
  const router = useRouter();

  // Sidebar navigation and UI states
  const [activeTab, setActiveTab] = useState<
    "Dashboard" | "My Cases" | "All Cases" | "Assigned Cases" | "Open Cases" | "Upload Evidence" | "Evidence Library" | "AI Analysis" | "Case Notes" | "Reports" | "Profile" | "Settings"
  >("Dashboard");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastType[]>([]);
  const [isLimitModalOpen, setIsLimitModalOpen] = useState(false);
  
  // Notification States
  const [notifications, setNotifications] = useState<NotificationType[]>([]);
  const [notifDropdownOpen, setNotifDropdownOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  // Profile Menu Dropdown
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  // Global statistics state
  const [stats, setStats] = useState({
    availableCases: 0,
    assignedCases: 0,
    totalCases: 0,
    openCases: 0,
    underAnalysis: 0,
    closedCases: 0,
    evidenceUploaded: 0,
    aiAnalysesCompleted: 0,
    reportsGenerated: 0
  });
  const [statsLoading, setStatsLoading] = useState(true);

  // Overview Recent Activity Lists
  const [recentCases, setRecentCases] = useState<any[]>([]);
  const [recentUploads, setRecentUploads] = useState<any[]>([]);
  const [recentAIResults, setRecentAIResults] = useState<any[]>([]);
  const [recentReports, setRecentReports] = useState<any[]>([]);
  const [recentLoading, setRecentLoading] = useState(true);

  // Cases List View State (My Cases)
  const [cases, setCases] = useState<CaseType[]>([]);
  const [casesTotal, setCasesTotal] = useState(0);
  const [casesLoading, setCasesLoading] = useState(true);
  const [casesPage, setCasesPage] = useState(1);
  const [casesSearch, setCasesSearch] = useState("");
  const [casesStatusFilter, setCasesStatusFilter] = useState("");
  const [casesSortBy, setCasesSortBy] = useState("newest");

  // Open Cases View State (Unassigned cases for Investigators)
  const [openCases, setOpenCases] = useState<CaseType[]>([]);
  const [openCasesTotal, setOpenCasesTotal] = useState(0);
  const [openCasesLoading, setOpenCasesLoading] = useState(false);
  const [openCasesPage, setOpenCasesPage] = useState(1);
  const [openCasesSearch, setOpenCasesSearch] = useState("");
  const [isCreateCaseModalOpen, setIsCreateCaseModalOpen] = useState(false);
  const [createCaseForm, setCreateCaseForm] = useState({ title: "", description: "", incident_date: "" });

  // Case Details View State
  const [selectedCaseId, setSelectedCaseId] = useState<number | null>(null);
  const [caseDetail, setCaseDetail] = useState<any | null>(null);
  const [caseDetailLoading, setCaseDetailLoading] = useState(false);
  const [isEditCaseModalOpen, setIsEditCaseModalOpen] = useState(false);
  const [editCaseForm, setEditCaseForm] = useState({ title: "", description: "", status: "DRAFT", incident_date: "" });
  
  // Note creation/editing inside case detail
  const [newNoteText, setNewNoteText] = useState("");
  const [editingNoteId, setEditingNoteId] = useState<number | null>(null);
  const [editingNoteText, setEditingNoteText] = useState("");

  // Role & Workflow Immutability State
  const isInvestigator = 
    session?.user?.role === "INVESTIGATOR" || 
    session?.user?.role === "ADMIN" || 
    session?.user?.role === 1 || 
    session?.user?.role === 2 || 
    (session?.user as any)?.role_id === 1 || 
    (session?.user as any)?.role_id === 2 || 
    (Array.isArray(session?.user?.roles) && (session.user.roles.includes(1) || session.user.roles.includes(2)));

  const isAdmin = 
    session?.user?.role === "ADMIN" || 
    session?.user?.role === 1 || 
    (session?.user as any)?.role_id === 1 || 
    (Array.isArray(session?.user?.roles) && session.user.roles.includes(1)) ||
    session?.user?.email === "superuser@example.com";
  const [isSubmitConfirmModalOpen, setIsSubmitConfirmModalOpen] = useState(false);
  const [isOpenConfirmModalOpen, setIsOpenConfirmModalOpen] = useState(false);
  const [isClaimConfirmModalOpen, setIsClaimConfirmModalOpen] = useState(false);
  const [isAlreadyClaimedModalOpen, setIsAlreadyClaimedModalOpen] = useState(false);
  const [forensicModalOpen, setForensicModalOpen] = useState(false);
  const [selectedAnalysisIdForReview, setSelectedAnalysisIdForReview] = useState<number | null>(null);
  const [forensicForm, setForensicForm] = useState({ decision: "APPROVED", observations: "" });
  const [isUploadingSingle, setIsUploadingSingle] = useState(false);
  const [auditModalOpen, setAuditModalOpen] = useState(false);
  const [isChatModalOpen, setIsChatModalOpen] = useState(false);
  const [caseMessages, setCaseMessages] = useState<MessageType[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [newMessageText, setNewMessageText] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Citizen Submit Case for Review
  const handleSubmitCaseForReview = async () => {
    if (!selectedCaseId || !session?.accessToken) return;
    try {
      setSubmitting(true);
      const res = await fetch(`${BACKEND_URL}/api/v1/user/cases/${selectedCaseId}/submit`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${session.accessToken}` }
      });

      if (res.ok) {
        showToast("Case submitted successfully for investigation review!", "success");
        setIsSubmitConfirmModalOpen(false);
        fetchCaseDetail(selectedCaseId);
        refreshAll();
      } else {
        const data = await res.json();
        showToast(data.detail || "Failed to submit case", "error");
      }
    } catch (err) {
      showToast("An unexpected error occurred during submission", "error");
    } finally {
      setSubmitting(false);
    }
  };

  // Investigator Claim / Open Case
  const handleClaimCase = async () => {
    if (!selectedCaseId || !session?.accessToken) return;
    try {
      setSubmitting(true);
      const res = await fetch(`${BACKEND_URL}/api/v1/user/cases/${selectedCaseId}/open`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${session.accessToken}` }
      });
      const data = await res.json();

      if (res.ok) {
        showToast("Investigation claimed and assigned to your workload!", "success");
        setIsClaimConfirmModalOpen(false);
        setIsOpenConfirmModalOpen(false);
        await fetchCaseDetail(selectedCaseId);
        refreshAll();
        setActiveTab("Assigned Cases" as any);
      } else {
        setIsClaimConfirmModalOpen(false);
        setIsOpenConfirmModalOpen(false);
        const detailStr = typeof data.detail === "string" ? data.detail : (data.detail?.message || JSON.stringify(data.detail));
        if (res.status === 400 && detailStr.includes("LIMIT_REACHED")) {
          setIsLimitModalOpen(true);
        } else if (res.status === 409 || detailStr.includes("already been assigned")) {
          setIsAlreadyClaimedModalOpen(true);
        } else {
          showToast(detailStr || "Failed to claim case", "error");
        }
      }
    } catch (err) {
      setIsClaimConfirmModalOpen(false);
      setIsOpenConfirmModalOpen(false);
      showToast("An unexpected error occurred while claiming the case", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenCaseByInvestigator = handleClaimCase;

  // Investigator Forensic Review Submit
  const handleAddForensicReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAnalysisIdForReview || !session?.accessToken) return;
    try {
      setSubmitting(true);
      const formData = new FormData();
      formData.append("analysis_id", selectedAnalysisIdForReview.toString());
      formData.append("decision", forensicForm.decision);
      formData.append("observations", forensicForm.observations);

      const res = await fetch(`${BACKEND_URL}/api/v1/user/reviews`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${session.accessToken}` },
        body: formData
      });

      if (res.ok) {
        showToast("Forensic expert review submitted successfully!", "success");
        setForensicModalOpen(false);
        setForensicForm({ decision: "APPROVED", observations: "" });
        if (selectedCaseId) fetchCaseDetail(selectedCaseId);
        refreshAll();
      } else {
        const data = await res.json();
        showToast(data.detail || "Failed to submit review", "error");
      }
    } catch (err) {
      showToast("An unexpected error occurred", "error");
    } finally {
      setSubmitting(false);
    }
  };

  // Upload Evidence View State
  const [uploadTargetCaseId, setUploadTargetCaseId] = useState<string>("");
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [uploadProgress, setUploadProgress] = useState<{ [filename: string]: number }>({});
  const [uploadStatus, setUploadStatus] = useState<{ [filename: string]: "pending" | "uploading" | "success" | "error" }>({});
  const [isDragging, setIsDragging] = useState(false);

  // Evidence Library View State
  const [evidence, setEvidence] = useState<any[]>([]);
  const [evidenceTotal, setEvidenceTotal] = useState(0);
  const [evidenceLoading, setEvidenceLoading] = useState(true);
  const [evidenceSearch, setEvidenceSearch] = useState("");
  const [evidenceTypeFilter, setEvidenceTypeFilter] = useState("");
  const [evidencePage, setEvidencePage] = useState(1);
  
  // AI Analysis Wizard View State
  const [aiModels, setAiModels] = useState<AIModelType[]>([]);
  const [aiModelsLoading, setAiModelsLoading] = useState(true);
  const [selectedEvidenceForAI, setSelectedEvidenceForAI] = useState<string>("");
  const [selectedModelForAI, setSelectedModelForAI] = useState<number | null>(null);
  const [aiRunning, setAiRunning] = useState(false);
  const [aiResultOutput, setAiResultOutput] = useState<any | null>(null);
  const [analysesHistory, setAnalysesHistory] = useState<AIAnalysisType[]>([]);
  const [analysesHistoryLoading, setAnalysesHistoryLoading] = useState(true);

  // Standalone notes listing state
  const [standaloneNotes, setStandaloneNotes] = useState<any[]>([]);
  const [notesLoading, setNotesLoading] = useState(true);

  // Reports listing state
  const [reports, setReports] = useState<ReportType[]>([]);
  const [reportsLoading, setReportsLoading] = useState(true);
  const [reportsSearch, setReportsSearch] = useState("");
  const [reportsTypeFilter, setReportsTypeFilter] = useState("");

  // Profile Form state
  const [profileForm, setProfileForm] = useState({ full_name: "", phone: "", organization: "", password: "", confirm_password: "", date_of_birth: "", gender: "", address: "" });
  const [profilePicFile, setProfilePicFile] = useState<File | null>(null);
  const [digitalIdFile, setDigitalIdFile] = useState<File | null>(null);
  const [currentProfile, setCurrentProfile] = useState<any>(null);
  const [profileSubmitting, setProfileSubmitting] = useState(false);

  // Settings State
  const [settings, setSettings] = useState({ emailNotifications: true, compactMode: false, darkMode: false });

  // Preview Modal
  const [previewFile, setPreviewFile] = useState<EvidenceType | null>(null);

  // Submitting States
  const [submitting, setSubmitting] = useState(false);

  // ─── AI Scanning & Forensic Report Handlers ───
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [scanStage, setScanStage] = useState("");
  const [scanResult, setScanResult] = useState<any>(null);

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

  // Security Gate & Routing Detection
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    } else if (status === "authenticated" && session?.user) {
      // @ts-ignore
      if (session.user.role === 1 || session.user.email === "superuser@example.com") {
        router.push("/admin");
      }
    }
  }, [status, session, router]);

  // Click outside listener for dropdowns
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setNotifDropdownOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setProfileDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Fetch stats & notifications
  const fetchStats = useCallback(async () => {
    if (!session?.accessToken) return;
    try {
      setStatsLoading(true);
      const res = await fetch(`${BACKEND_URL}/api/v1/user/stats`, {
        headers: { "Authorization": `Bearer ${session.accessToken}` }
      });
      if (res.ok) {
        const data = await res.json();
        setStats({
          availableCases: data.availableCases || 0,
          assignedCases: data.assignedCases || 0,
          totalCases: data.totalCases,
          openCases: data.openCases,
          underAnalysis: data.underAnalysis,
          closedCases: data.closedCases,
          evidenceUploaded: data.evidenceUploaded,
          aiAnalysesCompleted: data.aiAnalysesCompleted,
          reportsGenerated: data.reportsGenerated
        });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setStatsLoading(false);
    }
  }, [session]);

  const fetchRecent = useCallback(async () => {
    if (!session?.accessToken) return;
    try {
      setRecentLoading(true);
      const res = await fetch(`${BACKEND_URL}/api/v1/user/recent`, {
        headers: { "Authorization": `Bearer ${session.accessToken}` }
      });
      if (res.ok) {
        const data = await res.json();
        setRecentCases(data.cases);
        setRecentUploads(data.uploads);
        setRecentAIResults(data.aiResults);
        setRecentReports(data.reports);
        setNotifications(data.notifications);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setRecentLoading(false);
    }
  }, [session]);

  const fetchNotifications = useCallback(async () => {
    if (!session?.accessToken) return;
    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/user/notifications`, {
        headers: { "Authorization": `Bearer ${session.accessToken}` }
      });
      if (res.ok) {
        const data = await res.json();
        setNotifications(data);
      }
    } catch (e) {
      console.error(e);
    }
  }, [session]);

  // Fetch full profile from backend
  const fetchProfile = useCallback(async () => {
    if (!session?.accessToken) return;
    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/user/profile`, {
        headers: { "Authorization": `Bearer ${session.accessToken}` }
      });
      if (res.ok) {
        const data = await res.json();
        setCurrentProfile(data);
        setProfileForm({
          full_name: data.full_name || "",
          phone: data.phone || "",
          organization: data.organization || "",
          password: "",
          confirm_password: "",
          date_of_birth: data.date_of_birth || "",
          gender: data.gender || "",
          address: data.address || ""
        });
      }
    } catch (e) {
      console.error("Error fetching profile", e);
    }
  }, [session?.accessToken]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  // Handle Notifications Reading
  const markNotificationRead = async (id: number) => {
    if (!session?.accessToken) return;
    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/user/notifications/${id}/read`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${session.accessToken}` }
      });
      if (res.ok) {
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
        fetchRecent();
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Switch Sub-tabs/Modules
  const navigateTo = (tabName: typeof activeTab) => {
    setActiveTab(tabName);
    setSelectedCaseId(null);
    setCaseDetail(null);
    setMobileMenuOpen(false);
  };

  // Refreshes all components affected by change
  const refreshAll = useCallback(() => {
    fetchStats();
    fetchRecent();
    fetchProfile();
  }, [fetchStats, fetchRecent, fetchProfile]);

  // Initial Fetch Setup
  useEffect(() => {
    if (session?.accessToken) {
      fetchStats();
      fetchRecent();
      fetchProfile();
    }
  }, [session?.accessToken, fetchStats, fetchRecent, fetchProfile]);

  // ─── Case Fetching ───
  const fetchCases = useCallback(async () => {
    if (!session?.accessToken) return;
    try {
      setCasesLoading(true);
      const queryParams = new URLSearchParams({
        page: casesPage.toString(),
        limit: "10",
        search: casesSearch,
        status_filter: casesStatusFilter,
        sort_by: casesSortBy
      });
      const res = await fetch(`${BACKEND_URL}/api/v1/user/cases?${queryParams}`, {
        headers: { "Authorization": `Bearer ${session.accessToken}` }
      });
      if (res.ok) {
        const data = await res.json();
        setCases(data.cases);
        setCasesTotal(data.total);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setCasesLoading(false);
    }
  }, [session, casesPage, casesSearch, casesStatusFilter, casesSortBy]);

  useEffect(() => {
    if ((activeTab === "My Cases" || activeTab === "Assigned Cases") && !selectedCaseId) {
      fetchCases();
    }
  }, [activeTab, selectedCaseId, fetchCases]);

  // ─── Open Cases Fetching ───
  const fetchOpenCases = useCallback(async () => {
    if (!session?.accessToken) return;
    try {
      setOpenCasesLoading(true);
      const queryParams = new URLSearchParams({
        page: openCasesPage.toString(),
        limit: "10",
        search: openCasesSearch,
        sort_by: "newest"
      });
      const res = await fetch(`${BACKEND_URL}/api/v1/user/cases/open-cases?${queryParams}`, {
        headers: { "Authorization": `Bearer ${session.accessToken}` }
      });
      if (res.ok) {
        const data = await res.json();
        setOpenCases(data.cases);
        setOpenCasesTotal(data.total);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setOpenCasesLoading(false);
    }
  }, [session, openCasesPage, openCasesSearch]);

  useEffect(() => {
    if ((activeTab === "Open Cases" || activeTab === "All Cases") && !selectedCaseId) {
      fetchOpenCases();
    }
  }, [activeTab, selectedCaseId, fetchOpenCases]);

  const handleOpenCase = async (caseId: number) => {
    if (!session?.accessToken) return;
    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/user/cases/${caseId}/open`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${session.accessToken}` }
      });
      if (res.ok) {
        showToast("Case opened successfully and assigned to your workload!", "success");
        fetchOpenCases();
        fetchStats();
      } else {
        const err = await res.json();
        const detailStr = typeof err.detail === "string" ? err.detail : (err.detail?.message || JSON.stringify(err.detail));
        if (res.status === 400 && detailStr.includes("LIMIT_REACHED")) {
          setIsLimitModalOpen(true);
        } else if (res.status === 409 || detailStr.includes("already been assigned")) {
          showToast("This case has already been assigned to another investigator.", "error");
          fetchOpenCases();
        } else {
          showToast(detailStr || "Failed to open case", "error");
        }
      }
    } catch (e) {
      console.error(e);
      showToast("Failed to open case", "error");
    }
  };

  // ─── Case Details Fetching ───
  const fetchCaseDetail = useCallback(async (caseId: number) => {
    if (!session?.accessToken) return;
    try {
      setCaseDetailLoading(true);
      const res = await fetch(`${BACKEND_URL}/api/v1/user/cases/${caseId}`, {
        headers: { "Authorization": `Bearer ${session.accessToken}` }
      });
      if (res.ok) {
        const data = await res.json();
        setCaseDetail(data);
        setEditCaseForm({
          title: data.title,
          description: data.description || "",
          status: data.status,
          incident_date: data.incident_date ? data.incident_date.substring(0, 10) : ""
        });
      } else {
        const err = await res.json();
        showToast(err.detail || "Access Denied: You do not have permission to view this case.", "error");
        setSelectedCaseId(null);
        setCaseDetail(null);
      }
    } catch (e) {
      console.error(e);
      showToast("Failed to fetch case details.", "error");
      setSelectedCaseId(null);
      setCaseDetail(null);
    } finally {
      setCaseDetailLoading(false);
    }
  }, [session, showToast]);

  const fetchScanResult = useCallback(async (caseId: number) => {
    if (!session?.accessToken) return;
    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/user/cases/${caseId}/scan`, {
        headers: { "Authorization": `Bearer ${session.accessToken}` }
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
      console.error(err);
    }
  }, [session]);

  const searchParams = useSearchParams();
  const caseIdParam = searchParams ? searchParams.get("caseId") : null;

  useEffect(() => {
    if (caseIdParam) {
      const idNum = parseInt(caseIdParam, 10);
      if (!isNaN(idNum) && idNum !== selectedCaseId) {
        setSelectedCaseId(idNum);
        fetchCaseDetail(idNum);
        fetchScanResult(idNum);
      }
    }
  }, [caseIdParam, fetchCaseDetail, fetchScanResult]);

  const viewCaseDetails = (id: number) => {
    if (isInvestigator) {
      window.open(`/dashboard/cases/${id}`, "_blank", "noopener,noreferrer");
    } else {
      setSelectedCaseId(id);
      fetchCaseDetail(id);
      fetchScanResult(id);
    }
  };

  const claimAndOpenCase = async (id: number) => {
    if (!session?.accessToken) return;
    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/user/cases/${id}/open`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${session.accessToken}` }
      });

      if (res.ok) {
        showToast("Case claimed successfully!", "success");
        fetchOpenCases();
        fetchCases();
        window.open(`/dashboard/cases/${id}`, "_blank", "noopener,noreferrer");
      } else {
        const data = await res.json();
        showToast(data.detail || "Failed to claim case", "error");
        fetchOpenCases();
      }
    } catch (err) {
      showToast("Error claiming case", "error");
    }
  };

  const handleScanEvidence = async () => {
    if (!selectedCaseId || !session?.accessToken) return;
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
      const res = await fetch(`${BACKEND_URL}/api/v1/user/cases/${selectedCaseId}/scan`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${session.accessToken}` }
      });

      if (res.ok) {
        const data = await res.json();
        setTimeout(() => {
          setIsScanning(false);
          setScanResult(data);
          showToast("AI Forensic Scan completed successfully!", "success");
          fetchCaseDetail(selectedCaseId);
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

  const handleDownloadPDF = async () => {
    if (!selectedCaseId || !session?.accessToken) return;
    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/user/cases/${selectedCaseId}/report/pdf`, {
        headers: { "Authorization": `Bearer ${session.accessToken}` }
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
        a.download = `Forensic_Report_Case_${caseDetail?.case_number || selectedCaseId}.pdf`;
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
    if (!selectedCaseId || !session?.accessToken) return;
    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/user/cases/${selectedCaseId}/report/pdf`, {
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

  // ─── Case Messaging / Chat Logic ───
  const formatMessageTimestamp = (dateStr: string | null): string => {
    if (!dateStr) return "";
    try {
      let parseable = dateStr;
      // If the string doesn't specify offset or 'Z', treat it as UTC
      if (!parseable.endsWith("Z") && !parseable.includes("+") && !parseable.includes("-", 10)) {
        parseable = parseable + "Z";
      }

      const d = new Date(parseable);
      if (isNaN(d.getTime())) return "";

      const now = new Date();
      const isSameDay = (d1: Date, d2: Date) =>
        d1.getFullYear() === d2.getFullYear() &&
        d1.getMonth() === d2.getMonth() &&
        d1.getDate() === d2.getDate();

      const yesterday = new Date(now);
      yesterday.setDate(now.getDate() - 1);

      const hoursNum = d.getHours();
      const minutesStr = d.getMinutes().toString().padStart(2, "0");
      const ampm = hoursNum >= 12 ? "PM" : "AM";
      const hours12 = hoursNum % 12 || 12;
      const timeFormatted = `${hours12}:${minutesStr} ${ampm}`;

      if (isSameDay(d, now)) {
        return timeFormatted;
      } else if (isSameDay(d, yesterday)) {
        return `Yesterday, ${timeFormatted}`;
      } else {
        const day = d.getDate().toString().padStart(2, "0");
        const month = (d.getMonth() + 1).toString().padStart(2, "0");
        const year = d.getFullYear();
        return `${day}/${month}/${year}, ${timeFormatted}`;
      }
    } catch (e) {
      return "";
    }
  };

  const fetchCaseMessages = useCallback(async (caseId: number, silent = false) => {
    if (!session?.accessToken) return;
    try {
      if (!silent) setMessagesLoading(true);
      const res = await fetch(`${BACKEND_URL}/api/v1/user/cases/${caseId}/messages`, {
        headers: { "Authorization": `Bearer ${session.accessToken}` }
      });
      if (res.ok) {
        const data = await res.json();
        const rawMsgs: MessageType[] = data.messages || [];
        // Sort chronologically: oldest at top (index 0) -> newest at bottom
        const sorted = [...rawMsgs].sort((a, b) => 
          (new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime()) || (a.id - b.id)
        );
        setCaseMessages(sorted);
      }
    } catch (e) {
      console.error("Error fetching case messages", e);
    } finally {
      if (!silent) setMessagesLoading(false);
    }
  }, [session]);

  // Auto scroll chat to newest message at the bottom
  const scrollToBottom = (smooth = true) => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: smooth ? "smooth" : "auto" });
    }
  };

  useEffect(() => {
    if (isChatModalOpen) {
      const timer = setTimeout(() => scrollToBottom(false), 80);
      return () => clearTimeout(timer);
    }
  }, [isChatModalOpen, caseMessages.length]);

  // Real-time polling for messages when Chat Modal is open
  useEffect(() => {
    if (!isChatModalOpen || !selectedCaseId) return;
    const interval = setInterval(() => {
      fetchCaseMessages(selectedCaseId, true);
    }, 3000);
    return () => clearInterval(interval);
  }, [isChatModalOpen, selectedCaseId, fetchCaseMessages]);

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newMessageText.trim() || !selectedCaseId || !session?.accessToken) return;

    const msgText = newMessageText.trim();
    setNewMessageText("");
    setSendingMessage(true);

    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/user/cases/${selectedCaseId}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.accessToken}`
        },
        body: JSON.stringify({ message: msgText })
      });

      if (res.ok) {
        const newMsg: MessageType = await res.json();
        setCaseMessages(prev => 
          [...prev, newMsg].sort((a, b) => 
            (new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime()) || (a.id - b.id)
          )
        );
        setTimeout(() => scrollToBottom(true), 50);
        fetchCaseDetail(selectedCaseId);
        fetchNotifications();
      } else {
        const err = await res.json();
        showToast(err.detail || "Failed to send message", "error");
        setNewMessageText(msgText);
      }
    } catch (err) {
      console.error(err);
      showToast("Failed to send message.", "error");
      setNewMessageText(msgText);
    } finally {
      setSendingMessage(false);
    }
  };

  const getTodayString = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = (d.getMonth() + 1).toString().padStart(2, "0");
    const day = d.getDate().toString().padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  // ─── Create Case ───
  const handleCreateCase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.accessToken) return;

    if (createCaseForm.incident_date && createCaseForm.incident_date > getTodayString()) {
      showToast("Incident date cannot be in the future.", "error");
      return;
    }

    try {
      setSubmitting(true);
      const formData = new FormData();
      formData.append("title", createCaseForm.title);
      formData.append("description", createCaseForm.description);
      if (createCaseForm.incident_date) {
        formData.append("incident_date", createCaseForm.incident_date);
      }

      const res = await fetch(`${BACKEND_URL}/api/v1/user/cases`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${session.accessToken}` },
        body: formData
      });

      if (res.ok) {
        showToast("Investigation case created successfully!", "success");
        setIsCreateCaseModalOpen(false);
        setCreateCaseForm({ title: "", description: "", incident_date: "" });
        refreshAll();
        fetchCases();
      } else {
        const data = await res.json();
        showToast(data.detail || "Failed to create case", "error");
      }
    } catch (err) {
      showToast("An unexpected error occurred", "error");
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Edit Case ───
  const handleEditCase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCaseId || !session?.accessToken) return;

    if (editCaseForm.incident_date && editCaseForm.incident_date > getTodayString()) {
      showToast("Incident date cannot be in the future.", "error");
      return;
    }

    try {
      setSubmitting(true);
      const formData = new FormData();
      formData.append("title", editCaseForm.title);
      formData.append("description", editCaseForm.description);
      formData.append("status", editCaseForm.status);
      if (editCaseForm.incident_date) {
        formData.append("incident_date", editCaseForm.incident_date);
      }

      const res = await fetch(`${BACKEND_URL}/api/v1/user/cases/${selectedCaseId}`, {
        method: "PUT",
        headers: { "Authorization": `Bearer ${session.accessToken}` },
        body: formData
      });

      if (res.ok) {
        showToast("Case updated successfully", "success");
        setIsEditCaseModalOpen(false);
        fetchCaseDetail(selectedCaseId);
        refreshAll();
      } else {
        const data = await res.json();
        showToast(data.detail || "Failed to update case", "error");
      }
    } catch (err) {
      showToast("An unexpected error occurred", "error");
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Notes inside Case ───
  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCaseId || !newNoteText.trim() || !session?.accessToken) return;
    try {
      const formData = new FormData();
      formData.append("note", newNoteText);

      const res = await fetch(`${BACKEND_URL}/api/v1/user/cases/${selectedCaseId}/notes`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${session.accessToken}` },
        body: formData
      });

      if (res.ok) {
        showToast("Note added successfully", "success");
        setNewNoteText("");
        fetchCaseDetail(selectedCaseId);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const startEditNote = (noteId: number, text: string) => {
    setEditingNoteId(noteId);
    setEditingNoteText(text);
  };

  const handleUpdateNote = async (noteId: number) => {
    if (!editingNoteText.trim() || !session?.accessToken) return;
    try {
      const formData = new FormData();
      formData.append("note", editingNoteText);
      const res = await fetch(`${BACKEND_URL}/api/v1/user/notes/${noteId}`, {
        method: "PUT",
        headers: { "Authorization": `Bearer ${session.accessToken}` },
        body: formData
      });
      if (res.ok) {
        showToast("Note updated successfully", "success");
        setEditingNoteId(null);
        if (selectedCaseId) fetchCaseDetail(selectedCaseId);
        if (activeTab === "Case Notes") fetchStandaloneNotes();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteNote = async (noteId: number) => {
    if (!session?.accessToken || !confirm("Are you sure you want to delete this note?")) return;
    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/user/notes/${noteId}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${session.accessToken}` }
      });
      if (res.ok) {
        showToast("Note deleted", "success");
        if (selectedCaseId) fetchCaseDetail(selectedCaseId);
        if (activeTab === "Case Notes") fetchStandaloneNotes();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // ─── File Upload Logic ───
  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = () => {
    setIsDragging(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files) {
      const filesArray = Array.from(e.dataTransfer.files);
      setUploadFiles(prev => [...prev, ...filesArray]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const filesArray = Array.from(e.target.files);
      setUploadFiles(prev => [...prev, ...filesArray]);
    }
  };

  const uploadSingleFileInternal = async (file: File, caseId: number): Promise<boolean> => {
    if (!session?.accessToken) return false;
    setUploadStatus(prev => ({ ...prev, [file.name]: "uploading" }));
    setUploadProgress(prev => ({ ...prev, [file.name]: 10 }));

    const formData = new FormData();
    formData.append("case_id", caseId.toString());
    formData.append("file", file);

    try {
      const interval = setInterval(() => {
        setUploadProgress(prev => {
          const current = prev[file.name] || 10;
          if (current >= 90) {
            clearInterval(interval);
            return prev;
          }
          return { ...prev, [file.name]: current + 20 };
        });
      }, 150);

      const res = await fetch(`${BACKEND_URL}/api/v1/user/evidence/upload`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${session.accessToken}` },
        body: formData
      });

      clearInterval(interval);

      if (res.ok) {
        setUploadProgress(prev => ({ ...prev, [file.name]: 100 }));
        setUploadStatus(prev => ({ ...prev, [file.name]: "success" }));
        showToast(`Uploaded ${file.name} successfully`, "success");

        // Immediately fetch updated case details & evidence list to update UI without page refresh
        await fetchCaseDetail(caseId);
        await fetchEvidence();
        refreshAll();
        return true;
      } else {
        const errorData = await res.json().catch(() => ({}));
        setUploadStatus(prev => ({ ...prev, [file.name]: "error" }));
        showToast(errorData.detail || `Failed to upload ${file.name}`, "error");
        return false;
      }
    } catch (err) {
      setUploadStatus(prev => ({ ...prev, [file.name]: "error" }));
      showToast(`Error uploading ${file.name}`, "error");
      return false;
    }
  };

  const uploadSingleFile = async (file: File, caseId: number) => {
    if (isUploadingSingle) return;
    setIsUploadingSingle(true);
    try {
      await uploadSingleFileInternal(file, caseId);
    } finally {
      setIsUploadingSingle(false);
    }
  };

  const startUploads = async (targetId: number) => {
    if (uploadFiles.length === 0 || isUploadingSingle) return;
    setIsUploadingSingle(true);
    try {
      for (const f of uploadFiles) {
        await uploadSingleFileInternal(f, targetId);
      }
      setUploadFiles([]);
    } finally {
      setIsUploadingSingle(false);
    }
  };

  // ─── Evidence Library Fetch ───
  const fetchEvidence = useCallback(async () => {
    if (!session?.accessToken) return;
    try {
      setEvidenceLoading(true);
      const queryParams = new URLSearchParams({
        page: evidencePage.toString(),
        limit: "10",
        search: evidenceSearch,
        type_filter: evidenceTypeFilter
      });
      const res = await fetch(`${BACKEND_URL}/api/v1/user/evidence?${queryParams}`, {
        headers: { "Authorization": `Bearer ${session.accessToken}` }
      });
      if (res.ok) {
        const data = await res.json();
        setEvidence(data.evidence);
        setEvidenceTotal(data.total);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setEvidenceLoading(false);
    }
  }, [session, evidencePage, evidenceSearch, evidenceTypeFilter]);

  useEffect(() => {
    if (activeTab === "Evidence Library") {
      fetchEvidence();
    }
  }, [activeTab, fetchEvidence]);

  const handleDeleteEvidence = async (evidenceId: number) => {
    if (!session?.accessToken || !confirm("Are you sure you want to delete this evidence? All analyses will be lost.")) return;
    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/user/evidence/${evidenceId}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${session.accessToken}` }
      });
      if (res.ok) {
        showToast("Evidence file deleted successfully", "success");
        if (selectedCaseId) fetchCaseDetail(selectedCaseId);
        fetchEvidence();
        refreshAll();
      } else {
        const data = await res.json().catch(() => ({}));
        showToast(data.detail || "Failed to delete evidence file", "error");
      }
    } catch (err) {
      console.error(err);
      showToast("Network error while deleting evidence", "error");
    }
  };

  // ─── AI Analysis Section ───
  const fetchAIModels = useCallback(async () => {
    if (!session?.accessToken) return;
    try {
      setAiModelsLoading(true);
      const res = await fetch(`${BACKEND_URL}/api/v1/user/ai-models`, {
        headers: { "Authorization": `Bearer ${session.accessToken}` }
      });
      if (res.ok) {
        const data = await res.json();
        setAiModels(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setAiModelsLoading(false);
    }
  }, [session]);

  const fetchAnalysesHistory = useCallback(async () => {
    if (!session?.accessToken) return;
    try {
      setAnalysesHistoryLoading(true);
      const res = await fetch(`${BACKEND_URL}/api/v1/user/analysis`, {
        headers: { "Authorization": `Bearer ${session.accessToken}` }
      });
      if (res.ok) {
        const data = await res.json();
        setAnalysesHistory(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setAnalysesHistoryLoading(false);
    }
  }, [session]);

  useEffect(() => {
    if (activeTab === "AI Analysis") {
      fetchAIModels();
      fetchAnalysesHistory();
      // Load user evidence files for select dropdown
      fetchEvidence();
    }
  }, [activeTab, fetchAIModels, fetchAnalysesHistory, fetchEvidence]);

  const runAnalysis = async () => {
    if (!selectedEvidenceForAI || !selectedModelForAI || !session?.accessToken) {
      showToast("Please choose evidence and a model first", "error");
      return;
    }
    try {
      setAiRunning(true);
      setAiResultOutput(null);
      
      const formData = new FormData();
      formData.append("evidence_id", selectedEvidenceForAI);
      formData.append("model_id", selectedModelForAI.toString());

      const res = await fetch(`${BACKEND_URL}/api/v1/user/analysis`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${session.accessToken}` },
        body: formData
      });

      if (res.ok) {
        const data = await res.json();
        setAiResultOutput(data.result);
        showToast("AI analysis complete!", "success");
        fetchAnalysesHistory();
        refreshAll();
      } else {
        showToast("Analysis pipeline failed", "error");
      }
    } catch (err) {
      showToast("Error executing model pipeline", "error");
    } finally {
      setAiRunning(false);
    }
  };

  // ─── Forensic Reviews ───
  // Note: Read-only for investigator, shown on Case Details

  // ─── Standalone Note Logging ───
  const fetchStandaloneNotes = useCallback(async () => {
    if (!session?.accessToken) return;
    try {
      setNotesLoading(true);
      // We can pull cases and list all notes inside them
      const res = await fetch(`${BACKEND_URL}/api/v1/user/cases?limit=100`, {
        headers: { "Authorization": `Bearer ${session.accessToken}` }
      });
      if (res.ok) {
        const data = await res.json();
        let allNotes: any[] = [];
        for (const c of data.cases) {
          const detailRes = await fetch(`${BACKEND_URL}/api/v1/user/cases/${c.id}`, {
            headers: { "Authorization": `Bearer ${session.accessToken}` }
          });
          if (detailRes.ok) {
            const detailData = await detailRes.json();
            const formatted = detailData.notes.map((n: any) => ({
              ...n,
              case_id: c.id,
              case_number: c.case_number,
              case_title: c.title,
              case_status: detailData.status
            }));
            allNotes = [...allNotes, ...formatted];
          }
        }
        // sort by date desc
        allNotes.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        setStandaloneNotes(allNotes);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setNotesLoading(false);
    }
  }, [session]);

  useEffect(() => {
    if (activeTab === "Case Notes") {
      fetchStandaloneNotes();
      fetchCases(); // To populate case selection dropdowns
    }
  }, [activeTab, fetchStandaloneNotes, fetchCases]);

  // ─── Reports Section ───
  const fetchReports = useCallback(async () => {
    if (!session?.accessToken) return;
    try {
      setReportsLoading(true);
      const queryParams = new URLSearchParams({
        search: reportsSearch,
        type_filter: reportsTypeFilter
      });
      const res = await fetch(`${BACKEND_URL}/api/v1/user/reports?${queryParams}`, {
        headers: { "Authorization": `Bearer ${session.accessToken}` }
      });
      if (res.ok) {
        const data = await res.json();
        setReports(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setReportsLoading(false);
    }
  }, [session, reportsSearch, reportsTypeFilter]);

  useEffect(() => {
    if (activeTab === "Reports") {
      fetchReports();
    }
  }, [activeTab, fetchReports]);

  // ─── Profile Update ───
  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.accessToken) return;
    try {
      setProfileSubmitting(true);
      if (profileForm.password && profileForm.password !== profileForm.confirm_password) {
        showToast("Passwords do not match", "error");
        setProfileSubmitting(false);
        return;
      }
      const formData = new FormData();
      formData.append("full_name", profileForm.full_name);
      formData.append("phone", profileForm.phone);
      formData.append("organization", profileForm.organization);
      formData.append("date_of_birth", profileForm.date_of_birth);
      formData.append("gender", profileForm.gender);
      formData.append("address", profileForm.address);
      if (profileForm.password.trim()) {
        formData.append("password", profileForm.password);
      }
      if (profilePicFile) formData.append("profile_picture_file", profilePicFile);
      if (digitalIdFile) formData.append("digital_id_file", digitalIdFile);

      const res = await fetch(`${BACKEND_URL}/api/v1/user/profile`, {
        method: "PUT",
        headers: { "Authorization": `Bearer ${session.accessToken}` },
        body: formData
      });

      if (res.ok) {
        showToast("Profile updated successfully.", "success");
        setProfileForm(prev => ({ ...prev, password: "", confirm_password: "" }));
        setProfilePicFile(null);
        setDigitalIdFile(null);
        fetchProfile();
      } else {
        showToast("Failed to update profile", "error");
      }
    } catch (err) {
      showToast("Error updating profile", "error");
    } finally {
      setProfileSubmitting(false);
    }
  };



  // Format date helper (DD/MM/YYYY)
  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return "N/A";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "N/A";
    return d.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    });
  };

  // Render status badges
  const renderStatusBadge = (status: string) => {
    const map: { [key: string]: string } = {
      DRAFT: "bg-slate-100 text-slate-700 border-slate-300",
      CASE_FILED: "bg-amber-50 text-amber-800 border-amber-300",
      CASE_UNDER_INVESTIGATION: "bg-blue-50 text-blue-800 border-blue-300",
      CLOSED: "bg-emerald-50 text-emerald-800 border-emerald-300",
      CASE_OPENED: "bg-blue-50 text-blue-800 border-blue-300",
      UNDER_ANALYSIS: "bg-blue-50 text-blue-800 border-blue-300",
      EXPERT_REVIEW: "bg-blue-50 text-blue-800 border-blue-300",
      OPEN: "bg-amber-50 text-amber-800 border-amber-300",
      REVIEW: "bg-blue-50 text-blue-800 border-blue-300"
    };
    const labels: { [key: string]: string } = {
      DRAFT: "Draft",
      CASE_FILED: "Case Filed",
      CASE_UNDER_INVESTIGATION: "Case Under Investigation",
      CLOSED: "Closed",
      CASE_OPENED: "Case Under Investigation",
      UNDER_ANALYSIS: "Case Under Investigation",
      EXPERT_REVIEW: "Case Under Investigation",
      OPEN: "Case Filed",
      REVIEW: "Case Under Investigation"
    };
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${map[status] || "bg-slate-50 text-slate-700 border-slate-200"}`}>
        {labels[status] || status.replace("_", " ")}
      </span>
    );
  };

  // Render AI Result Badge
  const renderAIResultBadge = (result: string) => {
    const map: { [key: string]: string } = {
      REAL: "bg-emerald-50 text-emerald-800 border-emerald-200",
      DEEPFAKE: "bg-rose-50 text-rose-800 border-rose-200",
      SUSPICIOUS: "bg-amber-50 text-amber-800 border-amber-200"
    };
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold border ${map[result] || "bg-slate-100 text-slate-700"}`}>
        {result}
      </span>
    );
  };

  // Check if session loading
  if (status === "loading") {
    return (
      <div className="min-h-screen bg-[#fafafa] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-10 w-10 text-[#CC2200] animate-spin" />
          <p className="text-sm font-semibold text-[#0a0a0a]/50">Initializing investigator session...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fafafa] text-[#0a0a0a] flex flex-col" style={{ fontFamily: "Inter, system-ui, sans-serif" }}>
      
      {/* ─── Toast Notifications ─── */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 max-w-md w-full pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto px-4 py-3 rounded-lg shadow-md border text-sm font-semibold flex items-center gap-3 transition-all duration-300 transform translate-y-0 ${
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
            <button 
              onClick={() => setToasts((prev) => prev.filter((item) => item.id !== t.id))}
              className="text-[#0a0a0a]/30 hover:text-[#0a0a0a]/60"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>

      {/* ─── Top Header/Navbar ─── */}
      <nav className="bg-white border-b border-[#e5e5e5] shadow-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            
            {/* Logo & Mobile trigger */}
            <div className="flex items-center gap-4">
              <button 
                onClick={() => setMobileMenuOpen(true)}
                className="p-2 text-[#0a0a0a]/60 hover:text-[#0a0a0a] md:hidden rounded"
              >
                <Menu className="h-6 w-6" />
              </button>
              
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 bg-[#CC2200] rounded flex items-center justify-center shadow-md">
                  <ShieldAlert className="h-5 w-5 text-white" />
                </div>
                <span className="font-bold text-lg tracking-tight">Sentinel AI Portal</span>
              </div>
            </div>

            {/* Profile Dropdown & Notification Bell */}
            <div className="flex items-center gap-4">
              
              {/* Notification Center */}
              <div className="relative" ref={notifRef}>
                <button
                  onClick={() => setNotifDropdownOpen(!notifDropdownOpen)}
                  className="relative p-2 text-[#0a0a0a]/60 hover:text-[#CC2200] rounded-full transition-colors hover:bg-slate-50"
                >
                  <Bell className="h-5 w-5" />
                  {notifications.filter(n => !n.read).length > 0 && (
                    <span className="absolute top-1 right-1 h-4 w-4 bg-[#CC2200] text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                      {notifications.filter(n => !n.read).length}
                    </span>
                  )}
                </button>

                {/* Notifications Dropdown */}
                {notifDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-80 bg-white border border-[#e5e5e5] rounded-lg shadow-lg z-50 overflow-hidden animate-slide-in">
                    <div className="px-4 py-3 bg-slate-50 border-b border-[#e5e5e5] flex justify-between items-center">
                      <span className="font-bold text-sm text-[#0a0a0a]">Notifications</span>
                      <button 
                        onClick={() => {
                          notifications.forEach(n => markNotificationRead(n.id));
                          setNotifDropdownOpen(false);
                        }}
                        className="text-xs font-semibold text-[#CC2200] hover:underline"
                      >
                        Clear unread
                      </button>
                    </div>
                    <div className="max-h-72 overflow-y-auto divide-y divide-[#e5e5e5]">
                      {notifications.length === 0 ? (
                        <div className="p-4 text-center text-xs text-[#0a0a0a]/50">No recent notifications</div>
                      ) : (
                        notifications.map((n) => (
                          <div 
                            key={n.id} 
                            onClick={() => markNotificationRead(n.id)}
                            className={`p-4 text-left hover:bg-slate-50 cursor-pointer transition-colors ${!n.read ? "bg-red-50/50" : ""}`}
                          >
                            <p className="text-xs font-bold text-[#0a0a0a] flex items-center gap-1.5">
                              {!n.read && <span className="w-1.5 h-1.5 rounded-full bg-[#CC2200]" />}
                              {n.title}
                            </p>
                            <p className="text-xs text-[#0a0a0a]/60 mt-1">{n.message}</p>
                            <span className="text-[10px] text-[#0a0a0a]/40 mt-1 block">
                              {new Date(n.created_at!).toLocaleString()}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Workspace Switcher */}
              <WorkspaceSwitcher />

              {/* Profile Menu Dropdown */}
              <div className="relative" ref={profileRef}>
                <button
                  onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                  className="flex items-center gap-2 p-1 rounded-full hover:bg-slate-100 transition-colors"
                >
                  {(currentProfile?.profile_picture || session?.user?.image || (session?.user as any)?.profile_picture) ? (
                    <img
                      src={currentProfile?.profile_picture || session?.user?.image || (session?.user as any)?.profile_picture}
                      alt={session?.user?.name || "Profile"}
                      className="w-8 h-8 rounded-full object-cover border border-[#e5e5e5] shadow-sm flex-shrink-0"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-[#CC2200] text-white flex items-center justify-center font-bold text-sm shadow-sm">
                      {session?.user?.name?.[0].toUpperCase() || "I"}
                    </div>
                  )}
                  <ChevronDown className="h-4 w-4 text-[#0a0a0a]/60" />
                </button>

                {profileDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-52 bg-white border border-[#e5e5e5] rounded-lg shadow-lg z-50 py-1 animate-slide-in">
                    <div className="px-4 py-2.5 border-b border-[#e5e5e5] flex items-center gap-3 text-left">
                      {(currentProfile?.profile_picture || session?.user?.image || (session?.user as any)?.profile_picture) ? (
                        <img
                          src={currentProfile?.profile_picture || session?.user?.image || (session?.user as any)?.profile_picture}
                          alt="Profile"
                          className="w-9 h-9 rounded-full object-cover border border-[#e5e5e5] shadow-xs flex-shrink-0"
                        />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-[#CC2200] text-white flex items-center justify-center font-bold text-sm shadow-xs flex-shrink-0">
                          {session?.user?.name?.[0].toUpperCase() || "I"}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-[#0a0a0a] truncate">{session?.user?.name || currentProfile?.full_name}</p>
                        <p className="text-xs text-[#0a0a0a]/50 truncate">{session?.user?.email || currentProfile?.email}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => navigateTo("Profile")}
                      className="w-full text-left px-4 py-2 text-sm text-[#0a0a0a]/70 hover:bg-slate-50 hover:text-[#0a0a0a] transition-colors flex items-center gap-2"
                    >
                      <User className="h-4 w-4" />
                      My Profile
                    </button>
                    <button
                      onClick={() => navigateTo("Settings")}
                      className="w-full text-left px-4 py-2 text-sm text-[#0a0a0a]/70 hover:bg-slate-50 hover:text-[#0a0a0a] transition-colors flex items-center gap-2"
                    >
                      <Settings className="h-4 w-4" />
                      Portal Settings
                    </button>
                    <button
                      onClick={() => signOut({ callbackUrl: "/" })}
                      className="w-full text-left px-4 py-2 text-sm text-rose-600 hover:bg-rose-50 transition-colors border-t border-[#e5e5e5] flex items-center gap-2"
                    >
                      <LogOut className="h-4 w-4" />
                      Sign Out
                    </button>
                  </div>
                )}
              </div>

            </div>
          </div>
        </div>
      </nav>

      {/* ─── Dashboard Content Grid ─── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col md:flex-row gap-8 flex-1 w-full">
        
        {/* ─── Desktop Sidebar ─── */}
        <aside className="hidden md:block w-64 flex-shrink-0">
          <div className="bg-white border border-[#e5e5e5] rounded-lg shadow-sm p-4 sticky top-24">
            <div className="px-3 py-2 mb-4">
              <span className="text-[10px] uppercase font-bold text-[#0a0a0a]/40 tracking-wider">Investigator Console</span>
            </div>
            <nav className="space-y-1">
              {(isInvestigator ? [
                { id: "Dashboard", label: "Dashboard", icon: <LayoutDashboard className="h-4 w-4" /> },
                { id: "All Cases", label: "All Cases", icon: <ShieldAlert className="h-4 w-4" /> },
                { id: "Assigned Cases", label: "Assigned Cases", icon: <FolderSearch className="h-4 w-4" /> },
                { id: "Reports", label: "Reports", icon: <FileText className="h-4 w-4" /> },
                { id: "Profile", label: "Profile", icon: <User className="h-4 w-4" /> },
                { id: "Settings", label: "Settings", icon: <Settings className="h-4 w-4" /> },
              ] : [
                { id: "Dashboard", label: "Dashboard", icon: <LayoutDashboard className="h-4 w-4" /> },
                { id: "My Cases", label: "My Cases", icon: <FolderSearch className="h-4 w-4" /> },
                { id: "Reports", label: "Reports", icon: <FileText className="h-4 w-4" /> },
                { id: "Profile", label: "Profile", icon: <User className="h-4 w-4" /> },
                { id: "Settings", label: "Settings", icon: <Settings className="h-4 w-4" /> },
              ]).map((item) => {
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => navigateTo(item.id as any)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-semibold transition-colors ${
                      isActive
                        ? "bg-[#CC2200]/10 text-[#CC2200]"
                        : "text-[#0a0a0a]/60 hover:bg-slate-50 hover:text-[#0a0a0a]"
                    }`}
                  >
                    {item.icon}
                    {item.label}
                  </button>
                );
              })}
              
              <button
                onClick={() => signOut({ callbackUrl: "/" })}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-semibold text-rose-600 hover:bg-rose-50 transition-colors border-t border-[#e5e5e5] mt-4"
              >
                <LogOut className="h-4 w-4" />
                Sign Out
              </button>
            </nav>
          </div>
        </aside>

        {/* ─── Mobile Sidebar Overlay ─── */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 flex md:hidden">
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)} />
            <div className="relative flex-1 flex flex-col max-w-xs w-full bg-white border-r border-[#e5e5e5] p-5 animate-slide-in">
              <div className="flex items-center justify-between mb-8">
                <span className="font-bold text-base">Portal Navigation</span>
                <button onClick={() => setMobileMenuOpen(false)}>
                  <X className="h-6 w-6" />
                </button>
              </div>
              <nav className="space-y-1">
                {(isInvestigator ? [
                  { id: "Dashboard", label: "Dashboard", icon: <LayoutDashboard className="h-4 w-4" /> },
                  { id: "All Cases", label: "All Cases", icon: <ShieldAlert className="h-4 w-4" /> },
                  { id: "Assigned Cases", label: "Assigned Cases", icon: <FolderSearch className="h-4 w-4" /> },
                  { id: "Reports", label: "Reports", icon: <FileText className="h-4 w-4" /> },
                  { id: "Profile", label: "Profile", icon: <User className="h-4 w-4" /> },
                  { id: "Settings", label: "Settings", icon: <Settings className="h-4 w-4" /> },
                ] : [
                  { id: "Dashboard", label: "Dashboard", icon: <LayoutDashboard className="h-4 w-4" /> },
                  { id: "My Cases", label: "My Cases", icon: <FolderSearch className="h-4 w-4" /> },
                  { id: "Reports", label: "Reports", icon: <FileText className="h-4 w-4" /> },
                  { id: "Profile", label: "Profile", icon: <User className="h-4 w-4" /> },
                  { id: "Settings", label: "Settings", icon: <Settings className="h-4 w-4" /> },
                ]).map((item) => {
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => navigateTo(item.id as any)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-semibold transition-colors ${
                        isActive
                          ? "bg-[#CC2200]/10 text-[#CC2200]"
                          : "text-[#0a0a0a]/60 hover:bg-slate-50 hover:text-[#0a0a0a]"
                      }`}
                    >
                      {item.icon}
                      {item.label}
                    </button>
                  );
                })}
              </nav>
            </div>
          </div>
        )}

        {/* ─── Main Content Canvas ─── */}
        <main className="flex-1 min-w-0 space-y-6">

          {/* ──────────────── 1. DASHBOARD OVERVIEW VIEW ──────────────── */}
          {activeTab === "Dashboard" && (
            <div className="space-y-6 animate-scale-up">
              <div>
                <h1 className="text-2xl font-bold tracking-tight">{isInvestigator ? "Investigator Dashboard" : "My Dashboard"}</h1>
                <p className="text-sm text-[#0a0a0a]/50">Real-time status of your investigation cases, uploads, and AI analysis reports.</p>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {(isInvestigator ? [
                  { label: "Available Cases", value: stats.availableCases, icon: <ShieldAlert className="h-4 w-4 text-amber-600" />, loading: statsLoading },
                  { label: "Assigned Cases", value: stats.assignedCases, icon: <FolderSearch className="h-4 w-4 text-[#CC2200]" />, loading: statsLoading },
                  { label: "Evidence Files Reviewed", value: stats.evidenceUploaded, icon: <FileVideo className="h-4 w-4 text-purple-600" />, loading: statsLoading },
                  { label: "AI Analyses Completed", value: stats.aiAnalysesCompleted, icon: <BrainCircuit className="h-4 w-4 text-emerald-600" />, loading: statsLoading },
                ] : [
                  { label: "Total Cases", value: stats.totalCases, icon: <FolderSearch className="h-4 w-4 text-[#CC2200]" />, loading: statsLoading },
                  { label: "Open Cases", value: stats.openCases, icon: <Activity className="h-4 w-4 text-sky-600" />, loading: statsLoading },
                  { label: "Evidence Uploaded", value: stats.evidenceUploaded, icon: <FileVideo className="h-4 w-4 text-purple-600" />, loading: statsLoading },
                  { label: "AI Scans", value: stats.aiAnalysesCompleted, icon: <BrainCircuit className="h-4 w-4 text-emerald-600" />, loading: statsLoading },
                ]).map((card, i) => (
                  <div key={i} className="bg-white border border-[#e5e5e5] rounded-lg p-5 shadow-sm hover:shadow-md transition-shadow text-left">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-[#0a0a0a]/50 uppercase tracking-wider">{card.label}</span>
                      {card.icon}
                    </div>
                    {card.loading ? (
                      <div className="h-8 w-16 bg-slate-200 animate-pulse rounded" />
                    ) : (
                      <div className="text-3xl font-bold text-[#0a0a0a]">{card.value}</div>
                    )}
                  </div>
                ))}
              </div>

              {/* Activity Lists Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* Recent Cases */}
                <div className="bg-white border border-[#e5e5e5] rounded-lg shadow-sm flex flex-col">
                  <div className="px-5 py-4 border-b border-[#e5e5e5] flex justify-between items-center">
                    <h2 className="font-bold text-sm">{isInvestigator ? "Recent Assigned Cases" : "Recent Investigation Cases"}</h2>
                    <button onClick={() => navigateTo(isInvestigator ? "Assigned Cases" : "My Cases")} className="text-xs font-bold text-[#CC2200] hover:underline">View All</button>
                  </div>
                  <div className="p-4 flex-1">
                    {recentLoading ? (
                      <div className="space-y-3">
                        {[1, 2, 3].map(i => <div key={i} className="h-10 bg-slate-100 animate-pulse rounded" />)}
                      </div>
                    ) : recentCases.length === 0 ? (
                      <div className="h-full flex items-center justify-center p-6 text-xs text-[#0a0a0a]/40">No cases found</div>
                    ) : (
                      <div className="space-y-3">
                        {recentCases.map((c) => (
                          <div 
                            key={c.id} 
                            onClick={() => viewCaseDetails(c.id)}
                            className="p-3 border border-[#e5e5e5] rounded hover:border-[#CC2200] transition-colors cursor-pointer flex justify-between items-center text-left"
                          >
                            <div>
                              <p className="text-xs font-bold text-[#0a0a0a]">{c.case_number}</p>
                              <p className="text-sm font-semibold text-[#0a0a0a]/80 mt-0.5">{c.title}</p>
                            </div>
                            <div className="flex gap-2">
                              {renderStatusBadge(c.status)}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Recent Uploads */}
                <div className="bg-white border border-[#e5e5e5] rounded-lg shadow-sm flex flex-col">
                  <div className="px-5 py-4 border-b border-[#e5e5e5] flex justify-between items-center">
                    <h2 className="font-bold text-sm">Recent Evidence Files</h2>
                    <button onClick={() => navigateTo("Evidence Library")} className="text-xs font-bold text-[#CC2200] hover:underline">View Library</button>
                  </div>
                  <div className="p-4 flex-1">
                    {recentLoading ? (
                      <div className="space-y-3">
                        {[1, 2, 3].map(i => <div key={i} className="h-10 bg-slate-100 animate-pulse rounded" />)}
                      </div>
                    ) : recentUploads.length === 0 ? (
                      <div className="h-full flex items-center justify-center p-6 text-xs text-[#0a0a0a]/40">No uploads found</div>
                    ) : (
                      <div className="space-y-3">
                        {recentUploads.map((u) => (
                          <div 
                            key={u.id}
                            className="p-3 border border-[#e5e5e5] rounded flex items-center justify-between text-left"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded bg-slate-100 flex items-center justify-center text-xs font-bold text-[#0a0a0a]/50">
                                {u.file_type[0]}
                              </div>
                              <div>
                                <p className="text-xs font-bold text-[#0a0a0a] truncate max-w-[200px]">{u.original_name}</p>
                                <p className="text-[10px] text-[#0a0a0a]/40 mt-0.5">{(u.file_size / 1024 / 1024).toFixed(2)} MB • {u.file_type}</p>
                              </div>
                            </div>
                            <span className="text-[10px] text-[#0a0a0a]/40">{new Date(u.upload_time).toLocaleDateString()}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Recent AI Results */}
                <div className="bg-white border border-[#e5e5e5] rounded-lg shadow-sm flex flex-col">
                  <div className="px-5 py-4 border-b border-[#e5e5e5] flex justify-between items-center">
                    <h2 className="font-bold text-sm">Latest AI Analysis Verdicts</h2>
                    <button onClick={() => navigateTo("AI Analysis")} className="text-xs font-bold text-[#CC2200] hover:underline">Run Pipeline</button>
                  </div>
                  <div className="p-4 flex-1">
                    {recentLoading ? (
                      <div className="space-y-3">
                        {[1, 2, 3].map(i => <div key={i} className="h-10 bg-slate-100 animate-pulse rounded" />)}
                      </div>
                    ) : recentAIResults.length === 0 ? (
                      <div className="h-full flex items-center justify-center p-6 text-xs text-[#0a0a0a]/40">No analyses run yet</div>
                    ) : (
                      <div className="space-y-3">
                        {recentAIResults.map((a) => (
                          <div 
                            key={a.id} 
                            className="p-3 border border-[#e5e5e5] rounded flex items-center justify-between text-left"
                          >
                            <div>
                              <p className="text-xs font-bold text-[#0a0a0a] truncate max-w-[200px]">{a.file_name}</p>
                              <p className="text-[10px] text-[#0a0a0a]/40 mt-0.5">{a.model_name} • {(a.confidence_score * 100).toFixed(1)}%</p>
                            </div>
                            {renderAIResultBadge(a.result)}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Recent Reports */}
                <div className="bg-white border border-[#e5e5e5] rounded-lg shadow-sm flex flex-col">
                  <div className="px-5 py-4 border-b border-[#e5e5e5] flex justify-between items-center">
                    <h2 className="font-bold text-sm">Recent Forensic Reports</h2>
                    <button onClick={() => navigateTo("Reports")} className="text-xs font-bold text-[#CC2200] hover:underline">View Reports</button>
                  </div>
                  <div className="p-4 flex-1">
                    {recentLoading ? (
                      <div className="space-y-3">
                        {[1, 2, 3].map(i => <div key={i} className="h-10 bg-slate-100 animate-pulse rounded" />)}
                      </div>
                    ) : recentReports.length === 0 ? (
                      <div className="h-full flex items-center justify-center p-6 text-xs text-[#0a0a0a]/40">No reports generated</div>
                    ) : (
                      <div className="space-y-3">
                        {recentReports.map((r) => (
                          <div 
                            key={r.id} 
                            className="p-3 border border-[#e5e5e5] rounded flex items-center justify-between text-left"
                          >
                            <div className="flex items-center gap-2">
                              <FileText className="h-5 w-5 text-[#CC2200]" />
                              <div>
                                <p className="text-xs font-bold text-[#0a0a0a]">{r.case_number}</p>
                                <p className="text-[10px] text-[#0a0a0a]/40 mt-0.5">{r.report_type} Report</p>
                              </div>
                            </div>
                            <span className="text-[10px] text-[#0a0a0a]/40">{new Date(r.generated_at).toLocaleDateString()}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* ──────────────── 2. ASSIGNED CASES / MY CASES VIEW ──────────────── */}
          {(activeTab === "My Cases" || activeTab === "Assigned Cases") && !selectedCaseId && (
            <div className="space-y-6 animate-scale-up">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-bold tracking-tight">
                    {isInvestigator ? "Assigned Cases" : "My Cases"}
                  </h1>
                  <p className="text-sm text-[#0a0a0a]/50">
                    {isInvestigator
                      ? "Cases assigned to your active digital investigation workload."
                      : "Manage your active, review, and closed investigation case records."}
                  </p>
                </div>
                {!isInvestigator && (
                  <button
                    onClick={() => setIsCreateCaseModalOpen(true)}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-md bg-[#CC2200] text-white text-sm font-bold shadow-md hover:opacity-90 transition-opacity"
                  >
                    <Plus className="h-4 w-4" />
                    New Case
                  </button>
                )}
              </div>

              {/* Filters toolbar */}
              <div className="flex flex-col sm:flex-row gap-3 bg-white p-4 border border-[#e5e5e5] rounded-lg shadow-sm">
                
                {/* Search */}
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#0a0a0a]/40" />
                  <input
                    type="text"
                    placeholder="Search by case # or title..."
                    value={casesSearch}
                    onChange={(e) => { setCasesSearch(e.target.value); setCasesPage(1); }}
                    className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-[#e5e5e5] rounded-md text-sm outline-none focus:ring-1 focus:ring-[#CC2200] focus:border-[#CC2200] transition-colors"
                  />
                </div>

                {/* Status Filter */}
                <div className="flex gap-2">
                  <select
                    value={casesStatusFilter}
                    onChange={(e) => { setCasesStatusFilter(e.target.value); setCasesPage(1); }}
                    className="bg-slate-50 border border-[#e5e5e5] rounded-md text-sm px-3 py-2 outline-none focus:ring-1 focus:ring-[#CC2200] text-[#0a0a0a]"
                  >
                    <option value="">All Statuses</option>
                    <option value="DRAFT">Draft</option>
                    <option value="CASE_FILED">Case Filed</option>
                    <option value="CASE_UNDER_INVESTIGATION">Case Under Investigation</option>
                    <option value="CLOSED">Closed</option>
                  </select>

                  {/* Sort */}
                  <select
                    value={casesSortBy}
                    onChange={(e) => { setCasesSortBy(e.target.value); setCasesPage(1); }}
                    className="bg-slate-50 border border-[#e5e5e5] rounded-md text-sm px-3 py-2 outline-none focus:ring-1 focus:ring-[#CC2200] text-[#0a0a0a]"
                  >
                    <option value="newest">Newest First</option>
                    <option value="oldest">Oldest First</option>
                  </select>
                </div>

              </div>

              {/* Cases Table */}
              <div className="bg-white border border-[#e5e5e5] rounded-lg shadow-sm overflow-hidden">
                {casesLoading ? (
                  <div className="p-8 space-y-4">
                    {[1, 2, 3, 4].map(i => (
                      <div key={i} className="animate-pulse flex items-center justify-between h-12 bg-slate-50 rounded px-4">
                        <div className="h-4 w-24 bg-slate-200 rounded" />
                        <div className="h-4 w-48 bg-slate-200 rounded" />
                        <div className="h-4 w-12 bg-slate-200 rounded" />
                      </div>
                    ))}
                  </div>
                ) : cases.length === 0 ? (
                  <div className="p-12 text-center text-sm text-[#0a0a0a]/50">
                    No investigation cases match your filters.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-sm min-w-[720px]">
                      <thead>
                        <tr className="bg-slate-50 border-b border-[#e5e5e5] text-xs font-bold text-[#0a0a0a]/60 uppercase">
                          <th className="px-6 py-4 w-44 whitespace-nowrap">Case Code</th>
                          <th className="px-6 py-4 min-w-[200px]">Title</th>
                          <th className="px-6 py-4 w-48 whitespace-nowrap">Status</th>
                          {isInvestigator ? (
                            <>
                              <th className="px-6 py-4 w-36 whitespace-nowrap">Last Updated</th>
                              <th className="px-6 py-4 text-right min-w-[170px] w-48 whitespace-nowrap">Action</th>
                            </>
                          ) : (
                            <>
                              <th className="px-6 py-4 w-36 whitespace-nowrap">Incident Date</th>
                              <th className="px-6 py-4 w-36 whitespace-nowrap">Created On</th>
                            </>
                          )}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#e5e5e5] text-sm">
                        {cases.map((c: any) => (
                          <tr key={c.id} className="hover:bg-slate-50/50">
                            <td className="px-6 py-4 font-bold whitespace-nowrap">
                              <button
                                type="button"
                                onClick={() => viewCaseDetails(c.id)}
                                className="text-[#CC2200] hover:underline cursor-pointer font-bold text-left font-mono"
                              >
                                {c.case_number}
                              </button>
                            </td>
                            <td className="px-6 py-4">
                              <p className="font-semibold text-[#0a0a0a] line-clamp-1">{c.title}</p>
                              <p className="text-xs text-[#0a0a0a]/50 truncate max-w-[280px]">{c.description}</p>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">{renderStatusBadge(c.status)}</td>
                            {isInvestigator ? (
                              <>
                                <td className="px-6 py-4 text-xs text-[#0a0a0a]/60 whitespace-nowrap">
                                  {formatDate(c.updated_at || c.created_at)}
                                </td>
                                <td className="px-6 py-4 text-right whitespace-nowrap min-w-[170px]">
                                  <button
                                    onClick={() => viewCaseDetails(c.id)}
                                    className="px-4 py-2 bg-[#CC2200] hover:bg-[#a81c00] text-white text-xs font-semibold rounded shadow-sm transition-colors whitespace-nowrap cursor-pointer"
                                  >
                                    View Investigation
                                  </button>
                                </td>
                              </>
                            ) : (
                              <>
                                <td className="px-6 py-4 text-xs text-[#0a0a0a]/60 whitespace-nowrap">
                                  {formatDate(c.incident_date)}
                                </td>
                                <td className="px-6 py-4 text-xs text-[#0a0a0a]/60 whitespace-nowrap">
                                  {formatDate(c.created_at)}
                                </td>
                              </>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Pagination */}
                {casesTotal > 10 && (
                  <div className="px-6 py-4 border-t border-[#e5e5e5] flex justify-between items-center bg-slate-50/50">
                    <span className="text-xs text-[#0a0a0a]/50">
                      Showing {(casesPage - 1) * 10 + 1} to {Math.min(casesPage * 10, casesTotal)} of {casesTotal} cases
                    </span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setCasesPage(prev => Math.max(prev - 1, 1))}
                        disabled={casesPage === 1}
                        className="p-1.5 border border-[#e5e5e5] rounded bg-white hover:bg-slate-50 disabled:opacity-50"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setCasesPage(prev => Math.min(prev + 1, Math.ceil(casesTotal / 10)))}
                        disabled={casesPage >= Math.ceil(casesTotal / 10)}
                        className="p-1.5 border border-[#e5e5e5] rounded bg-white hover:bg-slate-50 disabled:opacity-50"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ──────────────── 2b. CASE DETAILS VIEW ──────────────── */}
          {selectedCaseId && caseDetail && (
            <div className="space-y-6 animate-scale-up text-left">
              
              {/* Back breadcrumb */}
              <div className="flex items-center justify-between">
                <button
                  onClick={() => { setSelectedCaseId(null); setCaseDetail(null); }}
                  className="inline-flex items-center gap-1 text-sm font-semibold text-[#0a0a0a]/60 hover:text-[#CC2200]"
                >
                  &larr; Back to Cases
                </button>
                
                {/* Header Action Buttons */}
                <div className="flex items-center gap-2">
                  {isInvestigator ? (
                    <>
                      {caseDetail.status === "CASE_FILED" && !(caseDetail.assigned_expert_id || caseDetail.assigned_expert_name || caseDetail.assigned_expert) && (
                        <button
                          onClick={() => setIsClaimConfirmModalOpen(true)}
                          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded bg-[#CC2200] hover:bg-[#a81c00] text-white text-xs font-bold shadow-md transition-colors"
                        >
                          <ShieldCheck className="h-4 w-4" />
                          Investigate This Case
                        </button>
                      )}
                      {caseDetail.status === "CASE_UNDER_INVESTIGATION" && (caseDetail.assigned_expert_id || caseDetail.assigned_expert_name || caseDetail.assigned_expert) && (
                        <button
                          onClick={handleForwardToExpert}
                          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md transition-colors cursor-pointer"
                        >
                          <Send className="h-4 w-4" />
                          Forward to Expert
                        </button>
                      )}
                    </>
                  ) : (
                    /* Citizen / Reporter View */
                    (caseDetail.status === "DRAFT") && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setIsEditCaseModalOpen(true)}
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded border border-[#e5e5e5] text-xs font-semibold bg-white hover:bg-slate-50 transition-colors"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                          Edit Details
                        </button>
                        <div className="flex flex-col items-end gap-1">
                          {(() => {
                            const hasEv = caseDetail.evidence && caseDetail.evidence.length > 0;
                            const hasNt = caseDetail.notes && caseDetail.notes.length > 0;
                            const canSubmit = hasEv && hasNt;
                            
                            let warningMessage = "";
                            if (!hasEv && !hasNt) {
                              warningMessage = "Requires at least 1 evidence file and 1 case note before submission.";
                            } else if (hasEv && !hasNt) {
                              warningMessage = "Requires at least 1 case note before submission.";
                            } else if (!hasEv && hasNt) {
                              warningMessage = "Requires at least 1 evidence file before submission.";
                            }

                            return (
                              <>
                                <button
                                  onClick={() => setIsSubmitConfirmModalOpen(true)}
                                  disabled={!canSubmit}
                                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-md font-bold text-xs shadow transition-all ${
                                    canSubmit
                                      ? "bg-[#CC2200] text-white hover:opacity-90 cursor-pointer"
                                      : "bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-300"
                                  }`}
                                >
                                  <Send className="h-3.5 w-3.5" />
                                  Open Case
                                </button>
                                {!canSubmit && warningMessage && (
                                  <p className="text-[10px] text-amber-700 font-semibold bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                                    {warningMessage}
                                  </p>
                                )}
                              </>
                            );
                          })()}
                        </div>
                      </div>
                    )
                  )}
                </div>
              </div>

              {/* Citizen Submitted Banner */}
              {!isInvestigator && caseDetail.status !== "DRAFT" && (
                <div className="bg-amber-50/90 border border-amber-200 rounded-lg p-3.5 flex items-center gap-3 text-amber-900 text-xs font-semibold shadow-sm">
                  <Lock className="h-4 w-4 text-amber-600 flex-shrink-0" />
                  <div>
                    <span>This case has been officially submitted for investigation and is now read-only.</span>
                    {caseDetail.submitted_at && (
                      <span className="block text-[10px] text-amber-700 font-normal mt-0.5">
                        Submitted on: {new Date(caseDetail.submitted_at).toLocaleString()}
                      </span>
                    )}
                  </div>
                </div>
              )}





              {/* Case Header Card */}
              <div className="bg-white border border-[#e5e5e5] rounded-lg shadow-sm p-6 space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-xs font-bold text-[#CC2200] tracking-wider uppercase">{caseDetail.case_number}</span>
                    <h1 className="text-2xl font-bold mt-1 text-[#0a0a0a]">{caseDetail.title}</h1>
                  </div>
                  <div className="flex items-center gap-2">
                    {renderStatusBadge(caseDetail.status)}
                    <button
                      onClick={() => setAuditModalOpen(true)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-slate-100 hover:bg-slate-200 text-xs font-semibold border border-[#e5e5e5] text-[#0a0a0a] transition-colors shadow-xs"
                      title="View full case audit log"
                    >
                      <History className="h-3.5 w-3.5 text-[#CC2200]" />
                      Audit Trail
                    </button>
                    {(caseDetail.assigned_expert_id || caseDetail.assigned_expert_name || caseDetail.assigned_expert) ? (
                      <button
                        onClick={() => {
                          setIsChatModalOpen(true);
                          fetchCaseMessages(caseDetail.id);
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#CC2200] hover:bg-[#a81c00] text-xs font-bold text-white transition-colors shadow-xs cursor-pointer"
                        title="Message assigned investigator/client"
                      >
                        <MessageSquare className="h-3.5 w-3.5" />
                        Message
                      </button>
                    ) : (
                      <button
                        disabled
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-slate-100 text-xs font-semibold border border-[#e5e5e5] text-[#0a0a0a]/40 cursor-not-allowed opacity-60"
                        title="Messaging will be available after an investigator is assigned."
                      >
                        <MessageSquare className="h-3.5 w-3.5" />
                        Message
                      </button>
                    )}
                  </div>
                </div>
                <p className="text-sm text-[#0a0a0a]/75 leading-relaxed">{caseDetail.description || "No description provided."}</p>
                
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-4 border-t border-[#e5e5e5] text-xs font-semibold text-[#0a0a0a]/60">
                  <div className="bg-slate-50/70 p-3 rounded border border-[#e5e5e5]">
                    <span className="block text-[10px] text-[#0a0a0a]/50 uppercase font-bold mb-0.5">Case Owner</span>
                    <span className="text-[#0a0a0a] font-bold truncate block">{caseDetail.creator_name || caseDetail.creator || "System User"}</span>
                  </div>
                  <div className="bg-slate-50/70 p-3 rounded border border-[#e5e5e5]">
                    <span className="block text-[10px] text-[#0a0a0a]/50 uppercase font-bold mb-0.5">Investigator</span>
                    <span className="text-[#0a0a0a] font-bold truncate block">{caseDetail.assigned_expert_name || caseDetail.assigned_expert || "Unassigned"}</span>
                  </div>
                  <div className="bg-slate-50/70 p-3 rounded border border-[#e5e5e5]">
                    <span className="block text-[10px] text-[#0a0a0a]/50 uppercase font-bold mb-0.5">Incident Date</span>
                    <span className="text-[#0a0a0a] font-bold block">{formatDate(caseDetail.incident_date)}</span>
                  </div>
                  <div className="bg-slate-50/70 p-3 rounded border border-[#e5e5e5]">
                    <span className="block text-[10px] text-[#0a0a0a]/50 uppercase font-bold mb-0.5">Created On</span>
                    <span className="text-[#0a0a0a] font-bold block">{formatDate(caseDetail.created_at)}</span>
                  </div>
                  <div className="bg-slate-50/70 p-3 rounded border border-[#e5e5e5]">
                    <span className="block text-[10px] text-[#0a0a0a]/50 uppercase font-bold mb-0.5">Evidence Files</span>
                    <span className="text-[#0a0a0a] font-bold block">{caseDetail.evidence ? caseDetail.evidence.length : 0} Files</span>
                  </div>
                  <div className="bg-slate-50/70 p-3 rounded border border-[#e5e5e5]">
                    <span className="block text-[10px] text-[#0a0a0a]/50 uppercase font-bold mb-0.5">Case Status</span>
                    <span className="text-[#0a0a0a] font-bold block">{renderStatusBadge(caseDetail.status)}</span>
                  </div>
                </div>
              </div>

              {/* Case Content Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Left & Middle Column */}
                <div className="lg:col-span-2 space-y-6">
                  
                  {/* Evidence Table */}
                  {(() => {
                    const isAssignedInvestigator = isInvestigator && caseDetail.assigned_expert_id === Number(session?.user?.id);
                    const hasEvidenceAccess = isAdmin || isAssignedInvestigator || !isInvestigator;
                    
                    if (!hasEvidenceAccess) {
                      return (
                        <div className="bg-white border border-[#e5e5e5] rounded-lg shadow-sm overflow-hidden p-8 text-center space-y-3">
                          <Lock className="h-10 w-10 text-[#0a0a0a]/30 mx-auto" />
                          <h3 className="font-bold text-[#0a0a0a]">Evidence Restricted</h3>
                          <p className="text-sm text-[#0a0a0a]/60 max-w-sm mx-auto">
                            Evidence files are only accessible to the investigator assigned to this case.
                          </p>
                        </div>
                      );
                    }
                    
                    return (
                      <>
                        <div className="bg-white border border-[#e5e5e5] rounded-lg shadow-sm overflow-hidden">
                    <div className="px-5 py-4 border-b border-[#e5e5e5] flex justify-between items-center bg-slate-50/50">
                      <h3 className="font-bold text-sm">Uploaded Evidence</h3>
                      {(isInvestigator || caseDetail.status === "DRAFT") && (
                        <label className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold border border-[#e5e5e5] transition-all ${
                          isUploadingSingle ? "bg-slate-100 text-slate-400 cursor-not-allowed" : "bg-slate-100 hover:bg-slate-200 cursor-pointer text-[#0a0a0a]"
                        }`}>
                          {isUploadingSingle ? <Loader2 className="h-3.5 w-3.5 animate-spin text-[#CC2200]" /> : <Plus className="h-3.5 w-3.5" />}
                          {isUploadingSingle ? "Uploading..." : "Add Evidence"}
                          <input
                            type="file"
                            disabled={isUploadingSingle}
                            onChange={async (e) => {
                              if (e.target.files && e.target.files[0]) {
                                const fileToUpload = e.target.files[0];
                                e.target.value = "";
                                await uploadSingleFile(fileToUpload, caseDetail.id);
                              }
                            }}
                            className="hidden"
                          />
                        </label>
                      )}
                    </div>

                    {/* Inline Progress Banner while uploading single file */}
                    {isUploadingSingle && (
                      <div className="p-3.5 bg-red-50/40 border-b border-[#e5e5e5] flex items-center justify-between animate-pulse">
                        <div className="flex items-center gap-3">
                          <Loader2 className="h-4 w-4 text-[#CC2200] animate-spin flex-shrink-0" />
                          <span className="text-xs font-semibold text-[#0a0a0a]">Uploading evidence file to case...</span>
                        </div>
                        <span className="text-[10px] font-bold text-[#CC2200] uppercase tracking-wider">Processing</span>
                      </div>
                    )}

                    {caseDetail.evidence.length === 0 && !isUploadingSingle ? (
                      <div className="p-8 text-center text-xs text-[#0a0a0a]/40">No evidence uploaded yet.</div>
                    ) : (
                      <div className="divide-y divide-[#e5e5e5]">
                        {caseDetail.evidence.map((ev: EvidenceType) => (
                          <div key={ev.id} className="p-4 space-y-2.5 hover:bg-slate-50/30 transition-colors text-left">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded bg-slate-100 flex items-center justify-center text-xs font-bold text-[#CC2200]">
                                  {ev.file_type[0]}
                                </div>
                                <div className="text-left">
                                  <p className="text-xs font-bold text-[#0a0a0a] truncate max-w-[220px]">{ev.original_name}</p>
                                  <p className="text-[10px] text-[#0a0a0a]/40">
                                    {(ev.file_size / 1024 / 1024).toFixed(2)} MB • {ev.mime_type || ev.file_type}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                {/* View Preview */}
                                <button
                                  onClick={() => setPreviewFile(ev)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded border border-[#e5e5e5] bg-white hover:bg-slate-50 text-[11px] font-semibold text-[#0a0a0a]"
                                >
                                  <Eye className="h-3.5 w-3.5 text-blue-600" />
                                  View
                                </button>

                                {/* Download */}
                                <a
                                  href={`${BACKEND_URL}/api/v1/user/evidence/${ev.id}/download?token=${session?.accessToken}`}
                                  download={ev.original_name}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded border border-[#e5e5e5] bg-white hover:bg-slate-50 text-[11px] font-semibold text-[#0a0a0a]"
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  <Download className="h-3.5 w-3.5 text-emerald-600" />
                                  Download
                                </a>

                                {/* Delete - Only before submission for user */}
                                {(!isInvestigator && (caseDetail.status === "DRAFT")) && (
                                  <button
                                    onClick={() => handleDeleteEvidence(ev.id)}
                                    className="p-1.5 border border-rose-200 rounded text-rose-600 hover:bg-rose-50"
                                    title="Delete"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                )}
                              </div>
                            </div>
                            <div className="p-2 bg-slate-50 rounded border border-slate-100 flex items-center justify-between text-[10px] text-[#0a0a0a]/60 font-mono">
                              <span>SHA-256:</span>
                              <span className="truncate max-w-[280px]">{ev.sha256_hash || "Generating hash..."}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* AI Forensic Analysis Section - Investigator Workspace */}
                  {isInvestigator && (
                    <div className="bg-white border border-[#e5e5e5] rounded-lg shadow-sm overflow-hidden">
                      <div className="px-5 py-4 border-b border-[#e5e5e5] bg-slate-50/50 flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <BrainCircuit className="h-4 w-4 text-[#CC2200]" />
                          <h3 className="font-bold text-sm">AI Forensic Analysis</h3>
                        </div>
                        {scanResult && !isScanning && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Demonstration Scan
                          </span>
                        )}
                      </div>

                      <div className="p-6 space-y-6">
                        {/* Scanning Animation State */}
                        {isScanning ? (
                          <div className="bg-slate-900 text-white rounded-lg p-6 space-y-4 shadow-inner text-center animate-pulse">
                            <div className="flex items-center justify-center gap-2 text-xs font-bold tracking-widest text-[#CC2200] uppercase">
                              <Sparkles className="h-4 w-4 animate-spin" />
                              Sentinel AI Forensic Analysis
                            </div>
                            <p className="text-sm font-medium text-slate-300">Analyzing submitted evidence</p>

                            {/* Progress bar */}
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
                          /* Scan Completed Results View */
                          <div className="space-y-6">
                            {/* Summary Badge Banner */}
                            <div className="bg-emerald-50/80 border border-emerald-200 rounded-lg p-4 flex flex-wrap items-center justify-between gap-3">
                              <div className="flex items-center gap-3">
                                <CheckCircle className="h-5 w-5 text-emerald-600 flex-shrink-0" />
                                <div>
                                  <h4 className="text-xs font-bold text-emerald-900 uppercase tracking-wide">Analysis Complete</h4>
                                  <p className="text-[11px] text-emerald-700 font-medium">
                                    {scanResult.evidence_count} Evidence Files • {scanResult.scan_duration || 10.2} Seconds Scan Duration
                                  </p>
                                </div>
                              </div>
                              <span className="text-[10px] font-bold px-2.5 py-1 rounded bg-white text-slate-600 border border-slate-200">
                                Demonstration Scan
                              </span>
                            </div>

                            {/* Evidence Result Cards */}
                            <div className="space-y-4">
                              {scanResult.results?.map((res: any, idx: number) => {
                                const isManipulated = res.assessment_code === "DEEPFAKE" || res.deepfake_probability >= 50;
                                return (
                                  <div
                                    key={idx}
                                    className={`p-4 rounded-lg border text-left space-y-3 transition-all ${
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
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-white/80 p-3 rounded border border-slate-200 text-xs">
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

                            {/* Action Buttons */}
                            <div className="pt-3 border-t border-[#e5e5e5] flex flex-wrap items-center justify-between gap-3">
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={handleViewPDF}
                                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded bg-slate-100 hover:bg-slate-200 border border-[#e5e5e5] text-xs font-bold text-slate-800 transition-colors"
                                >
                                  <FileText className="h-3.5 w-3.5 text-[#CC2200]" />
                                  View Forensic Report
                                </button>

                                <button
                                  onClick={handleDownloadPDF}
                                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded bg-[#CC2200] hover:bg-[#a81c00] text-white text-xs font-bold transition-colors shadow-xs"
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
                          /* Empty State - Before Scanning */
                          <div className="text-center py-8 px-4 space-y-4 bg-slate-50/50 rounded-lg border border-dashed border-slate-200">
                            <BrainCircuit className="h-10 w-10 text-[#CC2200]/40 mx-auto" />
                            <div className="space-y-1">
                              <h4 className="text-sm font-bold text-slate-900">AI Forensic Analysis</h4>
                              <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                                No forensic scan has been performed for this case. Sentinel AI will analyze all submitted evidence and generate a structured forensic analysis report.
                              </p>
                            </div>

                            <button
                              onClick={handleScanEvidence}
                              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-md bg-[#CC2200] hover:bg-[#a81c00] text-white text-xs font-bold shadow-md transition-all cursor-pointer"
                            >
                              <Sparkles className="h-4 w-4" />
                              Scan Evidence
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  </>
                  );
                  })()}

                  {/* Forensic Expert Reviews - Investigator Only */}
                  {isInvestigator && (
                    <div className="bg-white border border-[#e5e5e5] rounded-lg shadow-sm">
                      <div className="px-5 py-4 border-b border-[#e5e5e5] bg-slate-50/50 flex justify-between items-center">
                        <h3 className="font-bold text-sm">Forensic Expert Reviews</h3>
                      </div>
                      <div className="p-5 space-y-4">
                        {caseDetail.forensic_reviews?.length === 0 ? (
                          <div className="text-center text-xs text-[#0a0a0a]/40 py-4">No expert reviews submitted yet.</div>
                        ) : (
                          caseDetail.forensic_reviews.map((rev: ForensicReviewType) => (
                            <div key={rev.id} className="p-4 border border-[#e5e5e5] rounded bg-slate-50/50 flex flex-col gap-2">
                              <div className="flex justify-between items-center">
                                <span className="font-bold text-xs text-[#0a0a0a]">{rev.reviewer_name}</span>
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                                  rev.decision === "APPROVED" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-rose-50 text-rose-700 border-rose-200"
                                }`}>{rev.decision}</span>
                              </div>
                              <p className="text-xs text-[#0a0a0a]/75 italic">"{rev.observations}"</p>
                              <span className="text-[10px] text-[#0a0a0a]/40 mt-1 block">Reviewed on {new Date(rev.reviewed_at!).toLocaleString()}</span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}

                </div>

                {/* Right Column - Sticky Sidebar */}
                <div className="space-y-6 lg:sticky lg:top-24 lg:self-start">
                  
                  {/* Case Notes (Compact) */}
                  <div className="bg-white border border-[#e5e5e5] rounded-lg shadow-sm flex flex-col h-[340px]">
                    <div className="px-5 py-3.5 border-b border-[#e5e5e5] bg-slate-50/50 flex justify-between items-center">
                      <h3 className="font-bold text-sm">Case Notes</h3>
                      {caseDetail.notes && caseDetail.notes.length > 0 && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-[#0a0a0a]/60 border border-[#e5e5e5]">
                          {caseDetail.notes.length} Case Notes
                        </span>
                      )}
                    </div>
                    
                    {/* Notes Feed */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-3">
                      {caseDetail.notes.length === 0 ? (
                        <div className="text-center text-xs text-[#0a0a0a]/40 py-8">No case notes added yet.</div>
                      ) : (
                        caseDetail.notes.map((note: CaseNoteType) => (
                          <div key={note.id} className="p-3 border border-[#e5e5e5] rounded bg-slate-50/30 flex flex-col gap-1 text-left relative group">
                            <div className="flex justify-between items-center">
                              <span className="font-bold text-[10px] text-[#0a0a0a]/70">{note.user_name}</span>
                              <span className="text-[9px] text-[#0a0a0a]/40">{new Date(note.created_at!).toLocaleString()}</span>
                            </div>
                            {editingNoteId === note.id ? (
                              <div className="mt-2 space-y-2">
                                <textarea
                                  value={editingNoteText}
                                  onChange={(e) => setEditingNoteText(e.target.value)}
                                  className="w-full text-xs p-2 border border-[#e5e5e5] rounded focus:ring-1 focus:ring-[#CC2200] outline-none"
                                />
                                <div className="flex gap-1.5 justify-end">
                                  <button onClick={() => setEditingNoteId(null)} className="px-2 py-1 border border-[#e5e5e5] rounded text-[10px] font-semibold bg-white hover:bg-slate-50">Cancel</button>
                                  <button onClick={() => handleUpdateNote(note.id)} className="px-2 py-1 rounded text-white text-[10px] font-bold bg-[#CC2200] hover:opacity-90">Save</button>
                                </div>
                              </div>
                            ) : (
                              <>
                                <p className="text-xs text-[#0a0a0a]/80 mt-1 whitespace-pre-wrap">{note.note}</p>
                                {!isInvestigator && caseDetail.status === "DRAFT" && (
                                  <div className="opacity-0 group-hover:opacity-100 absolute bottom-1 right-2 flex gap-1.5 transition-opacity bg-white/95 px-1 py-0.5 rounded shadow-sm">
                                    <button onClick={() => startEditNote(note.id, note.note)} className="text-[10px] font-bold text-blue-600 hover:underline">Edit</button>
                                    <button onClick={() => handleDeleteNote(note.id)} className="text-[10px] font-bold text-rose-600 hover:underline">Delete</button>
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        ))
                      )}
                    </div>

                    {/* Note submit form - Allowed in Draft or for Assigned Investigator */}
                    {!isInvestigator && caseDetail.status === "DRAFT" && (
                      <form onSubmit={handleAddNote} className="p-3 border-t border-[#e5e5e5] bg-slate-50 flex gap-2">
                        <input
                          type="text"
                          placeholder="Add a case note..."
                          value={newNoteText}
                          onChange={(e) => setNewNoteText(e.target.value)}
                          className="flex-1 text-xs px-3 py-2 bg-white border border-[#e5e5e5] rounded outline-none focus:ring-1 focus:ring-[#CC2200]"
                        />
                        <button
                          type="submit"
                          className="px-3 py-2 bg-[#CC2200] text-white rounded text-xs font-bold hover:opacity-95"
                        >
                          Add
                        </button>
                      </form>
                    )}
                  </div>

                </div>

              </div>

            </div>
          )}

          {/* ──────────────── ALL CASES VIEW (UNASSIGNED FOR INVESTIGATORS) ──────────────── */}
          {(activeTab === "Open Cases" || activeTab === "All Cases") && !selectedCaseId && (
            <div className="space-y-6 animate-scale-up">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-bold tracking-tight">All Cases</h1>
                  <p className="text-sm text-[#0a0a0a]/50">View all cases in the system. You may only claim unassigned cases.</p>
                </div>
              </div>

              {/* Search toolbar */}
              <div className="flex flex-col sm:flex-row gap-3 bg-white p-4 border border-[#e5e5e5] rounded-lg shadow-sm">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#0a0a0a]/40" />
                  <input
                    type="text"
                    placeholder="Search open cases by case #, title, or reporter..."
                    value={openCasesSearch}
                    onChange={(e) => { setOpenCasesSearch(e.target.value); setOpenCasesPage(1); }}
                    className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-[#e5e5e5] rounded-md text-sm outline-none focus:ring-1 focus:ring-[#CC2200] focus:border-[#CC2200] transition-colors"
                  />
                </div>
              </div>

              {/* All Cases Table */}
              <div className="bg-white border border-[#e5e5e5] rounded-lg shadow-sm overflow-hidden">
                {openCasesLoading ? (
                  <div className="p-8 space-y-4">
                    {[1, 2, 3, 4].map(i => (
                      <div key={i} className="animate-pulse flex items-center justify-between h-12 bg-slate-50 rounded px-4">
                        <div className="h-4 w-24 bg-slate-200 rounded" />
                        <div className="h-4 w-48 bg-slate-200 rounded" />
                        <div className="h-4 w-12 bg-slate-200 rounded" />
                      </div>
                    ))}
                  </div>
                ) : openCases.length === 0 ? (
                  <div className="p-12 text-center space-y-3">
                    <ShieldAlert className="h-12 w-12 text-[#0a0a0a]/20 mx-auto" />
                    <p className="text-base font-bold text-[#0a0a0a]/70">No cases available</p>
                    <p className="text-xs text-[#0a0a0a]/40 max-w-sm mx-auto">
                      There are currently no cases available in the system.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm border-collapse">
                      <thead>
                        <tr className="bg-slate-50/80 border-b border-[#e5e5e5] text-[#0a0a0a]/60 font-bold uppercase text-[11px] tracking-wider">
                          <th className="py-3.5 px-4">CASE CODE</th>
                          <th className="py-3.5 px-4">TITLE</th>
                          <th className="py-3.5 px-4">REPORTED BY</th>
                          <th className="py-3.5 px-4">INCIDENT DATE</th>
                          <th className="py-3.5 px-4">SUBMITTED DATE</th>
                          <th className="py-3.5 px-4 text-center">ACTION</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#e5e5e5]">
                        {openCases.map((c: any) => (
                          <tr key={c.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="py-3.5 px-4 font-mono font-bold text-[#CC2200]">{c.case_number}</td>
                            <td className="py-3.5 px-4 font-bold text-[#0a0a0a]">{c.title}</td>
                            <td className="py-3.5 px-4 text-[#0a0a0a]/80 font-medium">{c.creator_name || "Citizen"}</td>
                            <td className="py-3.5 px-4 text-[#0a0a0a]/60">
                              {c.incident_date ? new Date(c.incident_date).toLocaleDateString("en-GB") : "N/A"}
                            </td>
                            <td className="py-3.5 px-4 text-[#0a0a0a]/60">
                              {c.submitted_at ? new Date(c.submitted_at).toLocaleDateString("en-GB") : (c.created_at ? new Date(c.created_at).toLocaleDateString("en-GB") : "N/A")}
                            </td>
                            <td className="py-3.5 px-4 text-center">
                              <button
                                onClick={() => claimAndOpenCase(c.id)}
                                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded bg-slate-800 hover:bg-[#CC2200] text-white text-xs font-bold transition-colors shadow-xs cursor-pointer"
                              >
                                <ShieldCheck className="h-3.5 w-3.5" />
                                Claim & View Case
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ──────────────── 3. UPLOAD EVIDENCE VIEW ──────────────── */}
          {activeTab === "Upload Evidence" && (
            <div className="space-y-6 animate-scale-up text-left">
              <div>
                <h1 className="text-2xl font-bold tracking-tight">Upload Evidence</h1>
                <p className="text-sm text-[#0a0a0a]/50">Securely submit audio, video, image, or document evidence to your case records.</p>
              </div>

              <div className="bg-white border border-[#e5e5e5] rounded-lg shadow-sm p-6 space-y-6">
                
                {/* Select Case Target */}
                <div>
                  <label className="block text-sm font-semibold text-[#0a0a0a]/80 mb-2">Select Target Case</label>
                  <select
                    value={uploadTargetCaseId}
                    onChange={(e) => setUploadTargetCaseId(e.target.value)}
                    className="w-full bg-slate-50 border border-[#e5e5e5] rounded-md text-sm px-3 py-2.5 outline-none focus:ring-1 focus:ring-[#CC2200] text-[#0a0a0a]"
                  >
                    <option value="">-- Choose case file --</option>
                    {cases.map((c) => (
                      <option key={c.id} value={c.id}>{c.case_number} - {c.title}</option>
                    ))}
                  </select>
                </div>

                {/* Drag and Drop Zone */}
                <div
                  onDragOver={onDragOver}
                  onDragLeave={onDragLeave}
                  onDrop={onDrop}
                  className={`border-2 border-dashed rounded-lg p-10 flex flex-col items-center justify-center cursor-pointer transition-all ${
                    isDragging ? "border-[#CC2200] bg-red-50/10" : "border-[#e5e5e5] hover:bg-slate-50/50"
                  }`}
                >
                  <FileUp className="h-10 w-10 text-[#0a0a0a]/40 mb-3" />
                  <p className="text-sm font-bold text-[#0a0a0a]/80">Drag and drop evidence files here</p>
                  <p className="text-xs text-[#0a0a0a]/50 mt-1">Images, Videos, Audios, or Documents up to 100MB</p>
                  
                  <label className="mt-4 px-4 py-2 bg-slate-100 hover:bg-slate-200 border border-[#e5e5e5] text-xs font-semibold rounded cursor-pointer transition-colors">
                    Browse Files
                    <input type="file" multiple onChange={handleFileSelect} className="hidden" />
                  </label>
                </div>

                {/* Files Queue */}
                {uploadFiles.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-xs font-bold text-[#0a0a0a]/60 uppercase tracking-wider">Upload Queue</h3>
                    <div className="border border-[#e5e5e5] rounded divide-y divide-[#e5e5e5] bg-slate-50/30">
                      {uploadFiles.map((file, idx) => {
                        const progress = uploadProgress[file.name] || 0;
                        const status = uploadStatus[file.name] || "pending";
                        return (
                          <div key={idx} className="p-3 flex items-center justify-between text-xs">
                            <div className="flex-1 pr-4 min-w-0">
                              <div className="flex justify-between items-center mb-1">
                                <span className="font-bold text-[#0a0a0a] truncate">{file.name}</span>
                                <span className="text-[#0a0a0a]/40">{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                              </div>
                              {status === "uploading" && (
                                <div className="w-full bg-slate-200 rounded-full h-1.5">
                                  <div className="bg-[#CC2200] h-1.5 rounded-full" style={{ width: `${progress}%` }}></div>
                                </div>
                              )}
                            </div>
                            <div>
                              {status === "pending" && <span className="text-slate-500 font-semibold">Queued</span>}
                              {status === "uploading" && <span className="text-[#CC2200] font-semibold animate-pulse">Uploading...</span>}
                              {status === "success" && <span className="text-emerald-600 font-bold">Completed</span>}
                              {status === "error" && <span className="text-rose-600 font-bold">Failed</span>}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="flex justify-end gap-2.5 pt-2">
                      <button
                        onClick={() => setUploadFiles([])}
                        className="px-4 py-2 border border-[#e5e5e5] rounded text-xs font-semibold hover:bg-slate-100"
                      >
                        Clear Queue
                      </button>
                      <button
                        onClick={() => startUploads(parseInt(uploadTargetCaseId))}
                        disabled={!uploadTargetCaseId || isUploadingSingle}
                        className="px-5 py-2 rounded bg-[#CC2200] text-white text-xs font-bold shadow hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                      >
                        {isUploadingSingle && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                        {isUploadingSingle ? "Uploading..." : "Submit Evidence"}
                      </button>
                    </div>
                  </div>
                )}

              </div>
            </div>
          )}

          {/* ──────────────── 4. EVIDENCE LIBRARY VIEW ──────────────── */}
          {activeTab === "Evidence Library" && (
            <div className="space-y-6 animate-scale-up text-left">
              <div>
                <h1 className="text-2xl font-bold tracking-tight">Evidence Library</h1>
                <p className="text-sm text-[#0a0a0a]/50">Central repository of files uploaded across all your active investigation cases.</p>
              </div>

              {/* Filters toolbar */}
              <div className="flex flex-col sm:flex-row gap-3 bg-white p-4 border border-[#e5e5e5] rounded-lg shadow-sm">
                
                {/* Search */}
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#0a0a0a]/40" />
                  <input
                    type="text"
                    placeholder="Search files by name..."
                    value={evidenceSearch}
                    onChange={(e) => { setEvidenceSearch(e.target.value); setEvidencePage(1); }}
                    className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-[#e5e5e5] rounded-md text-sm outline-none focus:ring-1 focus:ring-[#CC2200] focus:border-[#CC2200]"
                  />
                </div>

                {/* File Type Filter */}
                <select
                  value={evidenceTypeFilter}
                  onChange={(e) => { setEvidenceTypeFilter(e.target.value); setEvidencePage(1); }}
                  className="bg-slate-50 border border-[#e5e5e5] rounded-md text-sm px-3 py-2 outline-none focus:ring-1 focus:ring-[#CC2200]"
                >
                  <option value="">All Formats</option>
                  <option value="IMAGE">Image</option>
                  <option value="VIDEO">Video</option>
                  <option value="AUDIO">Audio</option>
                  <option value="DOCUMENT">Document</option>
                </select>

              </div>

              {/* Evidence grid / list */}
              <div className="bg-white border border-[#e5e5e5] rounded-lg shadow-sm overflow-hidden">
                {evidenceLoading ? (
                  <div className="p-8 space-y-4">
                    {[1, 2, 3].map(i => <div key={i} className="h-12 bg-slate-50 animate-pulse rounded" />)}
                  </div>
                ) : evidence.length === 0 ? (
                  <div className="p-12 text-center text-sm text-[#0a0a0a]/50">No evidence found in your library.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-slate-50 border-b border-[#e5e5e5] text-xs font-bold text-[#0a0a0a]/60 uppercase">
                          <th className="px-6 py-4">Filename</th>
                          <th className="px-6 py-4">Type</th>
                          <th className="px-6 py-4">Case #</th>
                          <th className="px-6 py-4">Upload Date</th>
                          <th className="px-6 py-4">Size</th>
                          <th className="px-6 py-4">AI Scan</th>
                          <th className="px-6 py-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#e5e5e5] text-sm">
                        {evidence.map((ev) => (
                          <tr key={ev.id} className="hover:bg-slate-50/50">
                            <td className="px-6 py-4 font-bold text-[#0a0a0a] truncate max-w-[200px]">{ev.original_name}</td>
                            <td className="px-6 py-4 text-xs font-semibold">{ev.file_type}</td>
                            <td className="px-6 py-4 font-semibold text-[#CC2200]">{ev.case_number}</td>
                            <td className="px-6 py-4 text-xs text-[#0a0a0a]/60">
                              {new Date(ev.upload_time).toLocaleDateString()}
                            </td>
                            <td className="px-6 py-4 text-xs">{(ev.file_size / 1024 / 1024).toFixed(2)} MB</td>
                            <td className="px-6 py-4">
                              {ev.status === "Analysis Ready" ? (
                                <span className="text-xs text-slate-500 font-medium">Ready</span>
                              ) : (
                                renderAIResultBadge(ev.status)
                              )}
                            </td>
                            <td className="px-6 py-4 text-right flex justify-end gap-2">
                              <button
                                onClick={() => setPreviewFile(ev)}
                                className="p-1.5 border border-[#e5e5e5] rounded text-[#0a0a0a]/60 hover:bg-slate-100"
                              >
                                <Eye className="h-3.5 w-3.5" />
                              </button>
                              <a
                                href={`${BACKEND_URL}/api/v1/user/evidence/${ev.id}/download?token=${session?.accessToken}`}
                                download={ev.original_name}
                                className="p-1.5 border border-[#e5e5e5] rounded text-[#0a0a0a]/60 hover:bg-slate-100 flex items-center justify-center"
                                target="_blank"
                                rel="noreferrer"
                              >
                                <Download className="h-3.5 w-3.5" />
                              </a>
                              {!isInvestigator && (
                                <button
                                  onClick={() => handleDeleteEvidence(ev.id)}
                                  className="p-1.5 border border-rose-200 rounded text-rose-600 hover:bg-rose-50"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ──────────────── 5. AI ANALYSIS VIEW ──────────────── */}
          {activeTab === "AI Analysis" && (
            <div className="space-y-6 animate-scale-up text-left">
              <div>
                <h1 className="text-2xl font-bold tracking-tight">AI Forensic Analysis</h1>
                <p className="text-sm text-[#0a0a0a]/50">Choose evidence files and apply deep learning neural networks to detect face swaps, manipulations, and voice synthesis.</p>
              </div>

              {/* Analysis configuration card */}
              <div className="bg-white border border-[#e5e5e5] rounded-lg shadow-sm p-6 space-y-6">
                
                {/* Steps Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  
                  {/* Select Evidence Dropdown */}
                  <div>
                    <label className="block text-sm font-semibold text-[#0a0a0a]/80 mb-2">1. Choose Target Evidence</label>
                    <select
                      value={selectedEvidenceForAI}
                      onChange={(e) => setSelectedEvidenceForAI(e.target.value)}
                      className="w-full bg-slate-50 border border-[#e5e5e5] rounded-md text-sm px-3 py-2.5 outline-none focus:ring-1 focus:ring-[#CC2200]"
                    >
                      <option value="">-- Choose uploaded file --</option>
                      {evidence.map((ev) => (
                        <option key={ev.id} value={ev.id}>
                          [{ev.case_number}] {ev.original_name} ({ev.file_type})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Choose Model Selection */}
                  <div>
                    <label className="block text-sm font-semibold text-[#0a0a0a]/80 mb-2">2. Select AI Neural Network</label>
                    {aiModelsLoading ? (
                      <div className="h-10 bg-slate-100 animate-pulse rounded" />
                    ) : (
                      <select
                        value={selectedModelForAI || ""}
                        onChange={(e) => setSelectedModelForAI(parseInt(e.target.value))}
                        className="w-full bg-slate-50 border border-[#e5e5e5] rounded-md text-sm px-3 py-2.5 outline-none focus:ring-1 focus:ring-[#CC2200]"
                      >
                        <option value="">-- Select detection model --</option>
                        {aiModels.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.model_name} (Acc: {m.accuracy}% • {m.media_type})
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                </div>

                {/* Model Details if selected */}
                {selectedModelForAI && (
                  <div className="p-4 border border-blue-200 bg-blue-50/30 rounded-lg text-xs space-y-1">
                    {(() => {
                      const m = aiModels.find(item => item.id === selectedModelForAI);
                      if (!m) return null;
                      return (
                        <>
                          <p className="font-bold text-[#0a0a0a] flex items-center gap-1.5">
                            <Info className="h-3.5 w-3.5 text-blue-500" />
                            {m.model_name} V{m.version}
                          </p>
                          <p className="text-[#0a0a0a]/70 mt-1">{m.description}</p>
                          <p className="text-[#0a0a0a]/50 mt-1">Accuracy: {m.accuracy}% | Pipeline target: {m.media_type}</p>
                        </>
                      );
                    })()}
                  </div>
                )}

                {/* Action button */}
                <div className="flex justify-end pt-4 border-t border-[#e5e5e5]">
                  <button
                    onClick={runAnalysis}
                    disabled={aiRunning || !selectedEvidenceForAI || !selectedModelForAI}
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-md bg-[#CC2200] text-white text-sm font-bold shadow-md hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {aiRunning ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Running Detection Pipelines...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4" />
                        Execute AI Detection
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Real-time output container */}
              {aiResultOutput && (
                <div className="bg-white border border-[#e5e5e5] rounded-lg shadow-sm p-6 animate-slide-in text-center space-y-4">
                  <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center mx-auto">
                    <Check className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">AI Analysis Success</h3>
                    <p className="text-xs text-[#0a0a0a]/50 mt-0.5">Execution completed successfully inside the cloud sandbox.</p>
                  </div>

                  <div className="grid grid-cols-3 gap-4 max-w-md mx-auto pt-2 text-xs font-semibold">
                    <div className="p-3 border border-[#e5e5e5] rounded bg-slate-50">
                      <span className="block text-[10px] text-[#0a0a0a]/40 uppercase mb-1">Verdict</span>
                      {renderAIResultBadge(aiResultOutput.result)}
                    </div>
                    <div className="p-3 border border-[#e5e5e5] rounded bg-slate-50">
                      <span className="block text-[10px] text-[#0a0a0a]/40 uppercase mb-1">Confidence</span>
                      <span className="text-sm font-bold">{(aiResultOutput.confidence_score * 100).toFixed(1)}%</span>
                    </div>
                    <div className="p-3 border border-[#e5e5e5] rounded bg-slate-50">
                      <span className="block text-[10px] text-[#0a0a0a]/40 uppercase mb-1">Processing</span>
                      <span className="text-sm font-bold text-[#0a0a0a]/75">{aiResultOutput.processing_time}s</span>
                    </div>
                  </div>
                </div>
              )}

              {/* History / Previous Analyses list */}
              <div className="bg-white border border-[#e5e5e5] rounded-lg shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-[#e5e5e5] bg-slate-50/50">
                  <h3 className="font-bold text-sm">Previous Analyses History</h3>
                </div>
                
                {analysesHistoryLoading ? (
                  <div className="p-6 space-y-3">
                    {[1, 2].map(i => <div key={i} className="h-10 bg-slate-50 animate-pulse rounded" />)}
                  </div>
                ) : analysesHistory.length === 0 ? (
                  <div className="p-8 text-center text-xs text-[#0a0a0a]/40">No analyses history found.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-slate-50 border-b border-[#e5e5e5] text-xs font-bold text-[#0a0a0a]/60 uppercase">
                          <th className="px-6 py-4">Evidence File</th>
                          <th className="px-6 py-4">Model Used</th>
                          <th className="px-6 py-4">Confidence</th>
                          <th className="px-6 py-4">Verdict</th>
                          <th className="px-6 py-4">Proc. Time</th>
                          <th className="px-6 py-4 text-right">Date</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#e5e5e5] text-sm">
                        {analysesHistory.map((an) => (
                          <tr key={an.id} className="hover:bg-slate-50/50">
                            <td className="px-6 py-4 font-bold text-[#0a0a0a] truncate max-w-[200px]">{an.file_name}</td>
                            <td className="px-6 py-4 text-xs font-semibold text-[#0a0a0a]/75">
                              {an.model_name} <span className="text-[10px] text-[#0a0a0a]/40">V{an.version}</span>
                            </td>
                            <td className="px-6 py-4 font-bold">{(an.confidence_score * 100).toFixed(1)}%</td>
                            <td className="px-6 py-4">{renderAIResultBadge(an.result)}</td>
                            <td className="px-6 py-4 text-xs text-[#0a0a0a]/60">{an.processing_time}s</td>
                            <td className="px-6 py-4 text-right text-xs text-[#0a0a0a]/40">
                              {new Date(an.analyzed_at!).toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ──────────────── 6. CASE NOTES STANDALONE VIEW ──────────────── */}
          {activeTab === "Case Notes" && (
            <div className="space-y-6 animate-scale-up text-left">
              <div>
                <h1 className="text-2xl font-bold tracking-tight">Case Notes Log</h1>
                <p className="text-sm text-[#0a0a0a]/50">Chronological feed of case journal logs and internal case notes created across cases.</p>
              </div>

              {/* Notes grid */}
              {notesLoading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[1, 2, 3, 4].map(i => <div key={i} className="h-28 bg-white border border-[#e5e5e5] rounded animate-pulse" />)}
                </div>
              ) : standaloneNotes.length === 0 ? (
                <div className="bg-white border border-[#e5e5e5] rounded-lg shadow-sm p-12 text-center text-sm text-[#0a0a0a]/50">
                  No case notes created yet.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {standaloneNotes.map((note) => (
                    <div key={note.id} className="bg-white border border-[#e5e5e5] rounded-lg p-5 shadow-sm space-y-3 flex flex-col justify-between hover:shadow-md transition-shadow relative group">
                      
                      <div className="space-y-2">
                        <div className="flex justify-between items-start">
                          <span 
                            onClick={() => viewCaseDetails(note.case_id)}
                            className="text-xs font-bold text-[#CC2200] hover:underline cursor-pointer"
                          >
                            {note.case_number}
                          </span>
                          <span className="text-[10px] text-[#0a0a0a]/40">{new Date(note.created_at).toLocaleDateString()}</span>
                        </div>
                        
                        {editingNoteId === note.id ? (
                          <div className="space-y-2">
                            <textarea
                              value={editingNoteText}
                              onChange={(e) => setEditingNoteText(e.target.value)}
                              className="w-full text-xs p-2 border border-[#e5e5e5] rounded focus:ring-1 focus:ring-[#CC2200] outline-none"
                            />
                            <div className="flex gap-1.5 justify-end">
                              <button onClick={() => setEditingNoteId(null)} className="px-2 py-1 border border-[#e5e5e5] rounded text-[10px] font-semibold bg-white hover:bg-slate-50">Cancel</button>
                              <button onClick={() => handleUpdateNote(note.id)} className="px-2 py-1 rounded text-white text-[10px] font-bold bg-[#CC2200] hover:opacity-90">Save</button>
                            </div>
                          </div>
                        ) : (
                          <p className="text-sm text-[#0a0a0a]/80 leading-relaxed font-medium">"{note.note}"</p>
                        )}
                      </div>

                      <div className="pt-2 border-t border-[#e5e5e5] flex justify-between items-center text-[10px] text-[#0a0a0a]/50">
                        <span>Case: {note.case_title}</span>
                        {editingNoteId !== note.id && note.case_status === "DRAFT" && (
                          <div className="flex gap-2">
                            <button onClick={() => startEditNote(note.id, note.note)} className="font-bold text-blue-600 hover:underline">Edit</button>
                            <button onClick={() => handleDeleteNote(note.id)} className="font-bold text-rose-600 hover:underline">Delete</button>
                          </div>
                        )}
                      </div>

                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ──────────────── 7. REPORTS VIEW ──────────────── */}
          {activeTab === "Reports" && (
            <div className="space-y-6 animate-scale-up text-left">
              <div>
                <h1 className="text-2xl font-bold tracking-tight">Forensic Reports</h1>
                <p className="text-sm text-[#0a0a0a]/50">Manage signed court-ready PDF documents generated for your case investigations.</p>
              </div>

              {/* Filters toolbar */}
              <div className="flex flex-col sm:flex-row gap-3 bg-white p-4 border border-[#e5e5e5] rounded-lg shadow-sm">
                
                {/* Search */}
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#0a0a0a]/40" />
                  <input
                    type="text"
                    placeholder="Search by case code or title..."
                    value={reportsSearch}
                    onChange={(e) => { setReportsSearch(e.target.value); }}
                    className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-[#e5e5e5] rounded-md text-sm outline-none focus:ring-1 focus:ring-[#CC2200]"
                  />
                </div>

                {/* Report Type Filter */}
                <select
                  value={reportsTypeFilter}
                  onChange={(e) => { setReportsTypeFilter(e.target.value); }}
                  className="bg-slate-50 border border-[#e5e5e5] rounded-md text-sm px-3 py-2 outline-none focus:ring-1 focus:ring-[#CC2200]"
                >
                  <option value="">All Types</option>
                  <option value="AI">AI Scan Summary</option>
                  <option value="FORENSIC">Forensic Report</option>
                  <option value="FINAL">Final Investigation Report</option>
                </select>

              </div>

              {/* Reports Table */}
              <div className="bg-white border border-[#e5e5e5] rounded-lg shadow-sm overflow-hidden">
                {reportsLoading ? (
                  <div className="p-8 space-y-4">
                    {[1, 2, 3].map(i => <div key={i} className="h-12 bg-slate-50 animate-pulse rounded" />)}
                  </div>
                ) : reports.length === 0 ? (
                  <div className="p-12 text-center text-sm text-[#0a0a0a]/50">No reports found matching criteria.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-slate-50 border-b border-[#e5e5e5] text-xs font-bold text-[#0a0a0a]/60 uppercase">
                          <th className="px-6 py-4">Report Name / File</th>
                          <th className="px-6 py-4">Case #</th>
                          <th className="px-6 py-4">Case Title</th>
                          <th className="px-6 py-4">Report Type</th>
                          <th className="px-6 py-4 text-right">Generated At</th>
                          <th className="px-6 py-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#e5e5e5] text-sm">
                        {reports.map((rep) => (
                          <tr key={rep.id} className="hover:bg-slate-50/50">
                            <td className="px-6 py-4 font-bold text-[#CC2200] truncate max-w-[200px]">
                              {rep.report_file.substring(rep.report_file.lastIndexOf("/") + 1)}
                            </td>
                            <td className="px-6 py-4 font-semibold text-[#0a0a0a]/80">{rep.case_number}</td>
                            <td className="px-6 py-4 truncate max-w-[150px]">{rep.case_title || "Investigation"}</td>
                            <td className="px-6 py-4">
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 border border-slate-200">
                                {rep.report_type}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-right text-xs text-[#0a0a0a]/60">
                              {new Date(rep.generated_at!).toLocaleDateString()}
                            </td>
                            <td className="px-6 py-4 text-right flex justify-end gap-2">
                              <a
                                href={`${BACKEND_URL}${rep.report_file}`}
                                download
                                className="p-1.5 border border-[#e5e5e5] rounded hover:bg-slate-100 text-[#0a0a0a]/60 flex items-center justify-center"
                              >
                                <Download className="h-3.5 w-3.5" />
                              </a>
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(`${BACKEND_URL}${rep.report_file}`);
                                  showToast("PDF report link copied to clipboard!", "success");
                                }}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-[#e5e5e5] text-xs font-semibold hover:bg-slate-100 transition-colors"
                              >
                                <ExternalLink className="h-3 w-3" />
                                Share
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ──────────────── 8. USER PROFILE VIEW ──────────────── */}
          {activeTab === "Profile" && (
            <div className="space-y-6 animate-scale-up text-left">
              <div>
                <h1 className="text-2xl font-bold tracking-tight">
                  {isInvestigator ? "My Profile Settings" : "My Profile"}
                </h1>
                <p className="text-sm text-[#0a0a0a]/50">
                  {isInvestigator 
                    ? "Manage your investigator credentials, organization, contact info and login password." 
                    : "Manage your personal information and account settings."}
                </p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Profile Card left */}
                <div className="bg-white border border-[#e5e5e5] rounded-lg shadow-sm p-6 text-center space-y-4 flex flex-col items-center justify-center">
                  <div className="relative w-24 h-24 rounded-full bg-[#CC2200]/10 border border-[#CC2200]/20 flex items-center justify-center font-bold text-3xl text-[#CC2200] shadow-sm overflow-hidden">
                    {currentProfile?.profile_picture ? (
                      <img src={currentProfile.profile_picture} alt="Profile" className="object-cover w-full h-full" />
                    ) : (
                      session?.user?.name?.[0].toUpperCase()
                    )}
                  </div>
                  <div>
                    <h2 className="font-bold text-lg text-[#0a0a0a]">{session?.user?.name}</h2>
                    <p className="text-xs text-[#0a0a0a]/50 mt-0.5">{session?.user?.email}</p>
                  </div>
                  <div className="px-3 py-1 rounded bg-[#CC2200]/10 text-[#CC2200] text-xs font-bold border border-[#CC2200]/20">
                    {isInvestigator ? "Investigator" : "End User"}
                  </div>
                  
                  <div className="w-full text-xs space-y-2 pt-4 border-t border-[#e5e5e5] text-left text-[#0a0a0a]/60 font-semibold">
                    <div className="flex justify-between">
                      <span>Status</span>
                      <span className="text-green-600">Active Approved</span>
                    </div>
                    {isInvestigator && (
                      <div className="flex justify-between">
                        <span>Agency</span>
                        <span>{session?.user?.organization || currentProfile?.organization || "N/A"}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Profile Form right */}
                <div className="bg-white border border-[#e5e5e5] rounded-lg shadow-sm p-6 lg:col-span-2">
                  <form onSubmit={handleUpdateProfile} className="space-y-5">
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold uppercase text-[#0a0a0a]/60 mb-1.5">Full Name</label>
                        <input
                          type="text"
                          required
                          value={profileForm.full_name}
                          onChange={(e) => setProfileForm(prev => ({ ...prev, full_name: e.target.value }))}
                          className="w-full text-sm px-3.5 py-2.5 border border-[#e5e5e5] bg-slate-50/50 rounded focus:ring-1 focus:ring-[#CC2200] outline-none"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-xs font-bold uppercase text-[#0a0a0a]/60 mb-1.5">Phone Number</label>
                        <input
                          type="text"
                          value={profileForm.phone}
                          onChange={(e) => setProfileForm(prev => ({ ...prev, phone: e.target.value }))}
                          placeholder="+1 (555) 000-0000"
                          className="w-full text-sm px-3.5 py-2.5 border border-[#e5e5e5] bg-slate-50/50 rounded focus:ring-1 focus:ring-[#CC2200] outline-none"
                        />
                      </div>
                    </div>

                    {isInvestigator ? (
                      <div>
                        <label className="block text-xs font-bold uppercase text-[#0a0a0a]/60 mb-1.5">Organization / Agency</label>
                        <input
                          type="text"
                          value={profileForm.organization}
                          onChange={(e) => setProfileForm(prev => ({ ...prev, organization: e.target.value }))}
                          placeholder="e.g. Department of Homeland Security"
                          className="w-full text-sm px-3.5 py-2.5 border border-[#e5e5e5] bg-slate-50/50 rounded focus:ring-1 focus:ring-[#CC2200] outline-none"
                        />
                      </div>
                    ) : (
                      <>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-bold uppercase text-[#0a0a0a]/60 mb-1.5">Date of Birth</label>
                            <input
                              type="date"
                              value={profileForm.date_of_birth}
                              onChange={(e) => setProfileForm(prev => ({ ...prev, date_of_birth: e.target.value }))}
                              className="w-full text-sm px-3.5 py-2.5 border border-[#e5e5e5] bg-slate-50/50 rounded focus:ring-1 focus:ring-[#CC2200] outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-bold uppercase text-[#0a0a0a]/60 mb-1.5">Gender (Optional)</label>
                            <select
                              value={profileForm.gender}
                              onChange={(e) => setProfileForm(prev => ({ ...prev, gender: e.target.value }))}
                              className="w-full text-sm px-3.5 py-2.5 border border-[#e5e5e5] bg-slate-50/50 rounded focus:ring-1 focus:ring-[#CC2200] outline-none"
                            >
                              <option value="">Select</option>
                              <option value="Male">Male</option>
                              <option value="Female">Female</option>
                              <option value="Other">Other</option>
                            </select>
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-bold uppercase text-[#0a0a0a]/60 mb-1.5">Address</label>
                          <textarea
                            value={profileForm.address}
                            onChange={(e) => setProfileForm(prev => ({ ...prev, address: e.target.value }))}
                            placeholder="House Name&#10;Street&#10;City&#10;District&#10;State&#10;PIN Code"
                            rows={4}
                            className="w-full text-sm px-3.5 py-2.5 border border-[#e5e5e5] bg-slate-50/50 rounded focus:ring-1 focus:ring-[#CC2200] outline-none resize-none"
                          />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-bold uppercase text-[#0a0a0a]/60 mb-1.5">Profile Picture</label>
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(e) => setProfilePicFile(e.target.files?.[0] || null)}
                              className="w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-[#CC2200]/10 file:text-[#CC2200] hover:file:bg-[#CC2200]/20"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-bold uppercase text-[#0a0a0a]/60 mb-1.5">Digital ID Card</label>
                            <input
                              type="file"
                              accept=".jpg,.jpeg,.png,.pdf"
                              onChange={(e) => setDigitalIdFile(e.target.files?.[0] || null)}
                              className="w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-[#CC2200]/10 file:text-[#CC2200] hover:file:bg-[#CC2200]/20"
                            />
                            {currentProfile?.digital_id_path && (
                              <div className="mt-2 text-xs">
                                <a href={currentProfile.digital_id_path} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
                                  View Current Digital ID
                                </a>
                              </div>
                            )}
                          </div>
                        </div>
                      </>
                    )}

                    <div className="pt-4 border-t border-[#e5e5e5]">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-bold uppercase text-[#0a0a0a]/60 mb-1.5">Change Password</label>
                          <input
                            type="password"
                            placeholder="•••••••• (leave blank to keep current)"
                            value={profileForm.password}
                            onChange={(e) => setProfileForm(prev => ({ ...prev, password: e.target.value }))}
                            className="w-full text-sm px-3.5 py-2.5 border border-[#e5e5e5] bg-slate-50/50 rounded focus:ring-1 focus:ring-[#CC2200] outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold uppercase text-[#0a0a0a]/60 mb-1.5">Confirm Password</label>
                          <input
                            type="password"
                            placeholder="••••••••"
                            value={profileForm.confirm_password}
                            onChange={(e) => setProfileForm(prev => ({ ...prev, confirm_password: e.target.value }))}
                            className="w-full text-sm px-3.5 py-2.5 border border-[#e5e5e5] bg-slate-50/50 rounded focus:ring-1 focus:ring-[#CC2200] outline-none"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-end pt-4">
                      <button
                        type="submit"
                        disabled={profileSubmitting}
                        className="px-6 py-2.5 rounded bg-[#CC2200] text-white text-sm font-bold shadow hover:opacity-95 disabled:opacity-50 transition-colors"
                      >
                        {profileSubmitting ? "Saving changes..." : "Save Settings"}
                      </button>
                    </div>

                  </form>
                </div>

              </div>
            </div>
          )}

          {/* ──────────────── 9. SETTINGS VIEW ──────────────── */}
          {activeTab === "Settings" && (
            <div className="space-y-6 animate-scale-up text-left">
              <div>
                <h1 className="text-2xl font-bold tracking-tight">Portal Configuration</h1>
                <p className="text-sm text-[#0a0a0a]/50">Configure application system parameters, notifications, and visual styling preferences.</p>
              </div>

              <div className="bg-white border border-[#e5e5e5] rounded-lg shadow-sm p-6 space-y-6">
                
                <div className="space-y-4">
                  <h3 className="font-bold text-sm pb-2 border-b border-[#e5e5e5]">Investigation Preferences</h3>
                  
                  <div className="flex items-center justify-between text-sm">
                    <div>
                      <p className="font-semibold text-[#0a0a0a]/90">Email Reports automatically</p>
                      <p className="text-xs text-[#0a0a0a]/50">Receive notification summaries to email upon AI manipulation findings.</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.emailNotifications}
                      onChange={(e) => setSettings(prev => ({ ...prev, emailNotifications: e.target.checked }))}
                      className="h-4.5 w-4.5 border-[#e5e5e5] text-[#CC2200] focus:ring-[#CC2200] rounded"
                    />
                  </div>

                  <div className="flex items-center justify-between text-sm pt-2">
                    <div>
                      <p className="font-semibold text-[#0a0a0a]/90">Compact mode</p>
                      <p className="text-xs text-[#0a0a0a]/50">Reduce grid padding for denser metadata data listings.</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.compactMode}
                      onChange={(e) => setSettings(prev => ({ ...prev, compactMode: e.target.checked }))}
                      className="h-4.5 w-4.5 border-[#e5e5e5] text-[#CC2200] focus:ring-[#CC2200] rounded"
                    />
                  </div>

                  <div className="flex items-center justify-between text-sm pt-2">
                    <div>
                      <p className="font-semibold text-[#0a0a0a]/90">Dark mode theme (Beta)</p>
                      <p className="text-xs text-[#0a0a0a]/50">Apply a dark slate palette style design layout.</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.darkMode}
                      onChange={(e) => setSettings(prev => ({ ...prev, darkMode: e.target.checked }))}
                      className="h-4.5 w-4.5 border-[#e5e5e5] text-[#CC2200] focus:ring-[#CC2200] rounded"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-4 border-t border-[#e5e5e5]">
                  <button
                    onClick={() => showToast("Portal preferences saved!", "success")}
                    className="px-5 py-2.5 rounded bg-[#CC2200] text-white text-sm font-bold shadow hover:opacity-90"
                  >
                    Save Preferences
                  </button>
                </div>

              </div>
            </div>
          )}

        </main>
      </div>

      {/* ─── Footer ─── */}
      <footer className="border-t border-[#e5e5e5] bg-white py-6 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-xs text-[#0a0a0a]/40">
          © {new Date().getFullYear()} Sentinel AI. Confident deepfake detection forensic workflows.
        </div>
      </footer>

      {/* ──────────────── CREATE CASE MODAL ──────────────── */}
      {isCreateCaseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white border border-[#e5e5e5] rounded-lg shadow-xl max-w-md w-full p-6 animate-scale-up text-left">
            <div className="flex justify-between items-center pb-4 border-b border-[#e5e5e5] mb-4">
              <h3 className="font-bold text-base text-[#0a0a0a]">Create Case File</h3>
              <button onClick={() => setIsCreateCaseModalOpen(false)}>
                <X className="h-5 w-5 text-[#0a0a0a]/60 hover:text-[#CC2200]" />
              </button>
            </div>

            <form onSubmit={handleCreateCase} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-[#0a0a0a]/60 mb-1">Case Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Presidential campaign audio swap leak"
                  value={createCaseForm.title}
                  onChange={(e) => setCreateCaseForm(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full text-sm px-3.5 py-2 bg-[#fafafa] border border-[#e5e5e5] rounded outline-none focus:ring-1 focus:ring-[#CC2200] focus:border-[#CC2200]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-[#0a0a0a]/60 mb-1">Description / Summary</label>
                <textarea
                  required
                  rows={3}
                  placeholder="Specify brief case description for forensic context..."
                  value={createCaseForm.description}
                  onChange={(e) => setCreateCaseForm(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full text-sm px-3.5 py-2 bg-[#fafafa] border border-[#e5e5e5] rounded outline-none focus:ring-1 focus:ring-[#CC2200] focus:border-[#CC2200]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-[#0a0a0a]/60 mb-1">Incident Date</label>
                <input
                  type="date"
                  max={getTodayString()}
                  value={createCaseForm.incident_date}
                  onChange={(e) => setCreateCaseForm(prev => ({ ...prev, incident_date: e.target.value }))}
                  className={`w-full text-sm px-3.5 py-2 bg-[#fafafa] border rounded outline-none focus:ring-1 ${
                    createCaseForm.incident_date && createCaseForm.incident_date > getTodayString()
                      ? "border-[#CC2200] focus:ring-[#CC2200] focus:border-[#CC2200]"
                      : "border-[#e5e5e5] focus:ring-[#CC2200] focus:border-[#CC2200]"
                  }`}
                />
                {createCaseForm.incident_date && createCaseForm.incident_date > getTodayString() && (
                  <p className="text-xs text-[#CC2200] font-medium mt-1">
                    Incident date cannot be in the future.
                  </p>
                )}
              </div>

              <div className="flex justify-end gap-2.5 pt-4 border-t border-[#e5e5e5]">
                <button
                  type="button"
                  onClick={() => setIsCreateCaseModalOpen(false)}
                  className="px-4 py-2 border border-[#e5e5e5] rounded text-xs font-semibold hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || (!!createCaseForm.incident_date && createCaseForm.incident_date > getTodayString())}
                  className="px-5 py-2 bg-[#CC2200] text-white rounded text-xs font-bold hover:opacity-90 shadow disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? "Creating..." : "Create Case"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ──────────────── EDIT CASE MODAL ──────────────── */}
      {isEditCaseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white border border-[#e5e5e5] rounded-lg shadow-xl max-w-md w-full p-6 animate-scale-up text-left">
            <div className="flex justify-between items-center pb-4 border-b border-[#e5e5e5] mb-4">
              <h3 className="font-bold text-base text-[#0a0a0a]">Edit Case Details</h3>
              <button onClick={() => setIsEditCaseModalOpen(false)}>
                <X className="h-5 w-5 text-[#0a0a0a]/60 hover:text-[#CC2200]" />
              </button>
            </div>

            <form onSubmit={handleEditCase} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-[#0a0a0a]/60 mb-1">Case Title</label>
                <input
                  type="text"
                  required
                  value={editCaseForm.title}
                  onChange={(e) => setEditCaseForm(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full text-sm px-3.5 py-2 bg-[#fafafa] border border-[#e5e5e5] rounded outline-none focus:ring-1 focus:ring-[#CC2200] focus:border-[#CC2200]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-[#0a0a0a]/60 mb-1">Description / Summary</label>
                <textarea
                  required
                  rows={3}
                  value={editCaseForm.description}
                  onChange={(e) => setEditCaseForm(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full text-sm px-3.5 py-2 bg-[#fafafa] border border-[#e5e5e5] rounded outline-none focus:ring-1 focus:ring-[#CC2200] focus:border-[#CC2200]"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase text-[#0a0a0a]/60 mb-1">Status</label>
                  <select
                    value={editCaseForm.status}
                    onChange={(e) => setEditCaseForm(prev => ({ ...prev, status: e.target.value }))}
                    className="w-full text-sm px-3 py-2 bg-[#fafafa] border border-[#e5e5e5] rounded outline-none text-[#0a0a0a]"
                  >
                    <option value="DRAFT">Draft</option>
                    <option value="CASE_FILED">Case Filed</option>
                    <option value="CASE_UNDER_INVESTIGATION">Case Under Investigation</option>
                    <option value="CLOSED">Closed</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-xs font-bold uppercase text-[#0a0a0a]/60 mb-1">Incident Date</label>
                  <input
                    type="date"
                    max={getTodayString()}
                    value={editCaseForm.incident_date}
                    onChange={(e) => setEditCaseForm(prev => ({ ...prev, incident_date: e.target.value }))}
                    className="w-full text-sm px-3 py-1.5 bg-[#fafafa] border border-[#e5e5e5] rounded outline-none text-[#0a0a0a]"
                  />
                  {editCaseForm.incident_date && editCaseForm.incident_date > getTodayString() && (
                    <p className="text-xs text-[#CC2200] font-medium mt-1">
                      Incident date cannot be in the future.
                    </p>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-2.5 pt-4 border-t border-[#e5e5e5]">
                <button
                  type="button"
                  onClick={() => setIsEditCaseModalOpen(false)}
                  className="px-4 py-2 border border-[#e5e5e5] rounded text-xs font-semibold hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-[#CC2200] text-white rounded text-xs font-bold hover:opacity-90 shadow disabled:opacity-50"
                >
                  {submitting ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ──────────────── PREVIEW MEDIA MODAL ──────────────── */}
      {previewFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white border border-[#e5e5e5] rounded-lg shadow-2xl max-w-4xl w-full max-h-[85vh] flex flex-col animate-scale-up text-left overflow-hidden">
            <div className="px-5 py-4 border-b border-[#e5e5e5] flex justify-between items-center bg-slate-50">
              <div>
                <h3 className="font-bold text-sm text-[#0a0a0a] truncate max-w-[400px]">{previewFile.original_name}</h3>
                <p className="text-[10px] text-[#0a0a0a]/40 mt-0.5">{previewFile.mime_type} • {(previewFile.file_size / 1024 / 1024).toFixed(2)} MB</p>
              </div>
              <button onClick={() => setPreviewFile(null)}>
                <X className="h-6 w-6 text-[#0a0a0a]/60 hover:text-[#CC2200]" />
              </button>
            </div>

            {/* Media Content Preview area */}
            <div className="flex-1 overflow-y-auto p-6 bg-slate-950 flex items-center justify-center min-h-[300px]">
              {(previewFile.file_type?.toUpperCase() === "IMAGE" || previewFile.mime_type?.startsWith("image/")) ? (
                <img
                  src={previewFile.file_name.startsWith("http") ? previewFile.file_name : `${BACKEND_URL}/api/v1/user/evidence/${previewFile.id}/view?token=${session?.accessToken}`}
                  alt={previewFile.original_name}
                  className="max-h-[55vh] max-w-full object-contain rounded shadow-lg"
                />
              ) : (previewFile.file_type?.toUpperCase() === "VIDEO" || previewFile.mime_type?.startsWith("video/")) ? (
                <video
                  src={previewFile.file_name.startsWith("http") ? previewFile.file_name : `${BACKEND_URL}/api/v1/user/evidence/${previewFile.id}/view?token=${session?.accessToken}`}
                  controls
                  className="max-h-[55vh] max-w-full rounded shadow-lg"
                />
              ) : (previewFile.file_type?.toUpperCase() === "AUDIO" || previewFile.mime_type?.startsWith("audio/")) ? (
                <audio
                  src={previewFile.file_name.startsWith("http") ? previewFile.file_name : `${BACKEND_URL}/api/v1/user/evidence/${previewFile.id}/view?token=${session?.accessToken}`}
                  controls
                  className="w-full max-w-md"
                />
              ) : (
                <div className="text-center text-white space-y-3">
                  <FileText className="h-16 w-16 text-[#CC2200] mx-auto" />
                  <p className="text-sm font-semibold">Document File Preview</p>
                  <a
                    href={previewFile.file_name.startsWith("http") ? previewFile.file_name : `${BACKEND_URL}/api/v1/user/evidence/${previewFile.id}/view?token=${session?.accessToken}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#CC2200] rounded text-xs font-bold text-white hover:opacity-90"
                  >
                    Open in New Tab
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>
              )}
            </div>

            {/* Metadata Info Footer */}
            {previewFile.metadata && (
              <div className="bg-slate-50 border-t border-[#e5e5e5] p-5">
                <h4 className="text-xs font-bold text-[#0a0a0a]/60 uppercase tracking-wider mb-2">Media Forensic Metadata</h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-semibold text-[#0a0a0a]/70">
                  {previewFile.metadata.width && (
                    <div>
                      <span className="block text-[10px] text-[#0a0a0a]/40 uppercase mb-0.5">Dimensions</span>
                      {previewFile.metadata.width} x {previewFile.metadata.height}
                    </div>
                  )}
                  {previewFile.metadata.duration && (
                    <div>
                      <span className="block text-[10px] text-[#0a0a0a]/40 uppercase mb-0.5">Duration</span>
                      {previewFile.metadata.duration}s
                    </div>
                  )}
                  {previewFile.metadata.codec && (
                    <div>
                      <span className="block text-[10px] text-[#0a0a0a]/40 uppercase mb-0.5">Codec</span>
                      {previewFile.metadata.codec}
                    </div>
                  )}
                  {previewFile.metadata.fps && (
                    <div>
                      <span className="block text-[10px] text-[#0a0a0a]/40 uppercase mb-0.5">Framerate</span>
                      {previewFile.metadata.fps} FPS
                    </div>
                  )}
                  {previewFile.metadata.sample_rate && (
                    <div>
                      <span className="block text-[10px] text-[#0a0a0a]/40 uppercase mb-0.5">Sample Rate</span>
                      {previewFile.metadata.sample_rate} Hz
                    </div>
                  )}
                  <div>
                    <span className="block text-[10px] text-[#0a0a0a]/40 uppercase mb-0.5">SHA256 Hash</span>
                    <span className="font-mono text-[10px] select-all break-all">{previewFile.sha256_hash}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      {/* ──────────────── SUBMIT CASE CONFIRMATION MODAL ──────────────── */}
      {isSubmitConfirmModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white border border-[#e5e5e5] rounded-xl shadow-2xl max-w-md w-full p-6 animate-scale-up text-left space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="h-5 w-5 text-rose-600" />
              </div>
              <div>
                <h3 className="font-bold text-base text-[#0a0a0a]">Submit Case for Investigation?</h3>
                <p className="text-xs text-[#0a0a0a]/50">Case #{caseDetail?.case_number}</p>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 text-xs text-[#0a0a0a]/80 space-y-2">
              <p className="font-bold text-slate-900">After submission, this case will be locked & immutable:</p>
              <ul className="list-disc pl-4 space-y-1 text-slate-600">
                <li>No new evidence files can be uploaded</li>
                <li>Uploaded evidence cannot be removed or deleted</li>
                <li>Case notes cannot be edited or deleted</li>
                <li>Case details cannot be modified</li>
              </ul>
              <p className="font-semibold text-rose-700 pt-1">This action cannot be undone.</p>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsSubmitConfirmModalOpen(false)}
                className="px-4 py-2 border border-[#e5e5e5] rounded-md text-xs font-semibold hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmitCaseForReview}
                disabled={submitting}
                className="px-5 py-2 bg-[#CC2200] text-white rounded-md text-xs font-bold shadow hover:opacity-90 disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
              >
                {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                Confirm Submission
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ──────────────── CLAIM CONFIRMATION MODAL ──────────────── */}
      {(isClaimConfirmModalOpen || isOpenConfirmModalOpen) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in text-left">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-2xl border border-[#e5e5e5] space-y-4 animate-scale-up">
            <div className="flex items-center gap-3 text-[#CC2200]">
              <div className="p-2 bg-[#CC2200]/10 rounded-full">
                <ShieldCheck className="h-6 w-6 text-[#CC2200]" />
              </div>
              <div>
                <h3 className="font-bold text-lg text-[#0a0a0a]">Take Ownership of Investigation</h3>
                {caseDetail?.case_number && (
                  <p className="text-xs text-[#0a0a0a]/50">Case #{caseDetail.case_number}</p>
                )}
              </div>
            </div>
            
            <div className="space-y-3 text-xs text-[#0a0a0a]/80 bg-slate-50 p-4 rounded-lg border border-[#e5e5e5]">
              <p className="font-semibold text-sm text-[#0a0a0a]">You are about to take ownership of this investigation.</p>
              <p className="text-[#0a0a0a]/60 font-semibold">After accepting:</p>
              <ul className="space-y-1.5 list-disc pl-5 text-[#0a0a0a]/75 leading-relaxed">
                <li>The case will be assigned to you.</li>
                <li>Other investigators will no longer be able to investigate this case.</li>
                <li>The case will move to your Assigned Cases.</li>
                <li>This action cannot be undone without administrator intervention.</li>
              </ul>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#e5e5e5]">
              <button
                type="button"
                onClick={() => {
                  setIsClaimConfirmModalOpen(false);
                  setIsOpenConfirmModalOpen(false);
                }}
                disabled={submitting}
                className="px-4 py-2 border border-[#e5e5e5] rounded-md text-xs font-bold text-[#0a0a0a]/70 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleClaimCase}
                disabled={submitting}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#CC2200] hover:bg-[#a81c00] text-white rounded-md text-xs font-bold transition-colors shadow-xs"
              >
                {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
                {submitting ? "Claiming..." : "Start Investigation"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ──────────────── CASE ALREADY CLAIMED MODAL ──────────────── */}
      {isAlreadyClaimedModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in text-left">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-2xl border border-[#e5e5e5] space-y-4 animate-scale-up">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="p-2 bg-rose-50 rounded-full">
                <AlertTriangle className="h-6 w-6 text-rose-600" />
              </div>
              <h3 className="font-bold text-lg text-[#0a0a0a]">Case Already Claimed</h3>
            </div>
            <p className="text-xs text-[#0a0a0a]/80 leading-relaxed bg-rose-50/50 p-3.5 rounded border border-rose-100 font-medium">
              This case has already been assigned to another investigator.
            </p>
            <div className="flex items-center justify-end pt-3 border-t border-[#e5e5e5]">
              <button
                type="button"
                onClick={() => {
                  setIsAlreadyClaimedModalOpen(false);
                  setSelectedCaseId(null);
                  setCaseDetail(null);
                  navigateTo("All Cases" as any);
                }}
                className="px-4 py-2 bg-[#CC2200] hover:bg-[#a81c00] text-white rounded-md text-xs font-bold transition-colors shadow-xs"
              >
                Return to All Cases
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ──────────────── MAXIMUM CASE LIMIT REACHED MODAL ──────────────── */}
      {isLimitModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in text-left">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-2xl border border-[#e5e5e5] space-y-4 animate-scale-up">
            <div className="flex items-center gap-3 text-amber-600">
              <div className="p-2 bg-amber-50 rounded-full">
                <ShieldAlert className="h-6 w-6" />
              </div>
              <h3 className="font-bold text-lg text-[#0a0a0a]">Maximum Active Investigations Reached</h3>
            </div>
            <p className="text-xs text-[#0a0a0a]/80 leading-relaxed bg-amber-50/50 p-3.5 rounded border border-amber-100 font-medium">
              You already have two active investigations assigned. Complete or close one before accepting another investigation.
            </p>
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#e5e5e5]">
              <button
                type="button"
                onClick={() => setIsLimitModalOpen(false)}
                className="px-4 py-2 border border-[#e5e5e5] rounded-md text-xs font-bold text-[#0a0a0a]/70 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsLimitModalOpen(false);
                  setSelectedCaseId(null);
                  setCaseDetail(null);
                  navigateTo("Assigned Cases" as any);
                }}
                className="px-4 py-2 bg-[#CC2200] hover:bg-[#a81c00] text-white rounded-md text-xs font-bold transition-colors shadow-xs"
              >
                View Assigned Cases
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ──────────────── CASE AUDIT TRAIL MODAL ──────────────── */}
      {auditModalOpen && caseDetail && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in text-left"
          onClick={() => setAuditModalOpen(false)}
        >
          <div
            className="bg-white rounded-xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl border border-[#e5e5e5] animate-scale-up overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-[#e5e5e5] flex justify-between items-center bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-[#CC2200]/10 rounded-full text-[#CC2200]">
                  <History className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-[#0a0a0a]">Case Audit Trail</h3>
                  <p className="text-xs text-[#0a0a0a]/50">
                    Official investigation event history for Case #{caseDetail.case_number}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setAuditModalOpen(false)}
                className="p-1 rounded-md hover:bg-slate-200 transition-colors text-[#0a0a0a]/60 hover:text-[#CC2200]"
                title="Close Modal"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Content / Timeline */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50/50">
              {(!caseDetail.audit_logs || caseDetail.audit_logs.length === 0) ? (
                <div className="py-12 text-center text-xs text-[#0a0a0a]/40 font-medium">
                  No audit log records available for this case yet.
                </div>
              ) : (
                <div className="relative border-l-2 border-slate-200 ml-4 space-y-6">
                  {caseDetail.audit_logs.map((log: AuditLogType) => (
                    <div key={log.id} className="relative pl-6">
                      {/* Timeline Node */}
                      <div className="absolute -left-[9px] top-1.5 w-4 h-4 rounded-full border-2 border-white bg-[#CC2200] shadow-xs" />
                      
                      <div className="bg-white p-4 rounded-lg border border-[#e5e5e5] shadow-xs space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-bold bg-slate-100 text-[#0a0a0a] border border-slate-200">
                            {log.action}
                          </span>
                          <span className="text-[11px] text-[#0a0a0a]/50 flex items-center gap-1 font-medium">
                            <Clock className="h-3 w-3" />
                            {log.timestamp ? new Date(log.timestamp).toLocaleString() : "N/A"}
                          </span>
                        </div>

                        <p className="text-xs text-[#0a0a0a]/80 font-medium leading-relaxed">
                          {log.description}
                        </p>

                        <div className="pt-1 flex items-center gap-1.5 text-[11px] text-[#0a0a0a]/50 border-t border-slate-100">
                          <User className="h-3 w-3 text-slate-400" />
                          <span>Performed by: <strong className="text-[#0a0a0a]/80 font-semibold">{log.user_name || "System"}</strong></span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3.5 border-t border-[#e5e5e5] bg-white flex justify-between items-center text-xs text-[#0a0a0a]/60">
              <span className="font-semibold">Total Event Entries: <strong>{caseDetail.audit_logs?.length || 0}</strong></span>
              <button
                type="button"
                onClick={() => setAuditModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-[#0a0a0a] rounded-md text-xs font-bold transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ──────────────── CASE MESSAGING / CHAT MODAL ──────────────── */}
      {isChatModalOpen && caseDetail && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in text-left"
          onClick={() => setIsChatModalOpen(false)}
        >
          <div
            className="bg-white rounded-xl max-w-lg w-full h-[650px] max-h-[90vh] flex flex-col shadow-2xl border border-[#e5e5e5] animate-scale-up overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-5 py-4 border-b border-[#e5e5e5] flex justify-between items-center bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-[#CC2200]/10 rounded-full text-[#CC2200]">
                  <MessageSquare className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-[#0a0a0a] flex items-center gap-2">
                    Case Messages
                  </h3>
                  <p className="text-xs text-[#0a0a0a]/50">
                    Case: <span className="font-semibold text-[#CC2200]">{caseDetail.case_number}</span>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsChatModalOpen(false)}
                className="p-1 rounded-md hover:bg-slate-200 transition-colors text-[#0a0a0a]/60 hover:text-[#CC2200]"
                title="Close Messages"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Sub-header with Participant Names */}
            <div className="px-5 py-2.5 bg-slate-100/70 border-b border-slate-200 text-xs flex justify-between items-center text-[#0a0a0a]/70 font-medium">
              <div>
                <span className="text-[#0a0a0a]/40 text-[10px] block uppercase font-bold">Investigator</span>
                <span className="font-bold text-[#0a0a0a]">{caseDetail.assigned_expert_name || caseDetail.assigned_expert || "Assigned Expert"}</span>
              </div>
              <div className="text-right">
                <span className="text-[#0a0a0a]/40 text-[10px] block uppercase font-bold">Case Owner</span>
                <span className="font-bold text-[#0a0a0a]">{caseDetail.creator_name || "Reporter"}</span>
              </div>
            </div>

            {/* Scrollable Message History Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/60 min-h-0">
              {messagesLoading ? (
                <div className="py-20 flex flex-col items-center justify-center gap-2 text-xs text-[#0a0a0a]/50">
                  <Loader2 className="h-6 w-6 animate-spin text-[#CC2200]" />
                  <span>Loading conversation...</span>
                </div>
              ) : caseMessages.length === 0 ? (
                <div className="py-20 flex flex-col items-center justify-center text-center p-6 space-y-2 text-[#0a0a0a]/50">
                  <MessageSquare className="h-10 w-10 text-slate-300 stroke-[1.5]" />
                  <p className="font-semibold text-sm text-[#0a0a0a]">No messages yet.</p>
                  <p className="text-xs text-[#0a0a0a]/60 max-w-xs">
                    {isInvestigator 
                      ? "Send a message to the case owner." 
                      : "Start a conversation with the investigator."}
                  </p>
                </div>
              ) : (
                caseMessages.map((msg) => {
                  const isMe = msg.is_me;
                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}
                    >
                      {/* Sender Name & Role */}
                      <div className={`flex items-center gap-1.5 mb-1 px-1 text-[10px] font-bold tracking-wider uppercase text-[#0a0a0a]/60 ${isMe ? "flex-row-reverse" : "flex-row"}`}>
                        <span>{msg.sender_name}</span>
                        <span className={`px-1.5 py-0.2 rounded text-[9px] font-extrabold uppercase ${
                          msg.sender_role === "Assigned Investigator" || msg.sender_role === "Lead Investigator"
                            ? "bg-amber-100 text-amber-800 border border-amber-200"
                            : "bg-blue-100 text-blue-800 border border-blue-200"
                        }`}>
                          {msg.sender_role === "Assigned Investigator" || msg.sender_role === "Lead Investigator" ? "ASSIGNED INVESTIGATOR" : "CASE OWNER"}
                        </span>
                      </div>

                      {/* Message Bubble */}
                      <div
                        className={`max-w-[82%] rounded-2xl px-4 py-2.5 text-xs shadow-xs space-y-1 ${
                          isMe
                            ? "bg-[#CC2200] text-white rounded-tr-xs"
                            : "bg-white text-[#0a0a0a] border border-[#e5e5e5] rounded-tl-xs"
                        }`}
                      >
                        <p className="whitespace-pre-wrap break-words leading-relaxed font-normal">
                          {msg.message}
                        </p>
                        <div
                          className={`text-[9px] text-right font-semibold ${
                            isMe ? "text-white/80" : "text-[#0a0a0a]/40"
                          }`}
                        >
                          {formatMessageTimestamp(msg.created_at)}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Message Input Form */}
            <form onSubmit={handleSendMessage} className="p-3 bg-white border-t border-[#e5e5e5] flex gap-2 items-end shrink-0">
              <textarea
                rows={2}
                placeholder="Type your message... (Shift + Enter for new line)"
                value={newMessageText}
                onChange={(e) => setNewMessageText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                className="flex-1 text-xs p-2.5 bg-slate-50 border border-[#e5e5e5] rounded-lg outline-none focus:ring-1 focus:ring-[#CC2200] focus:bg-white resize-none text-[#0a0a0a]"
              />
              <button
                type="submit"
                disabled={sendingMessage || !newMessageText.trim()}
                className="px-4 py-3 bg-[#CC2200] hover:bg-[#a81c00] disabled:opacity-50 text-white rounded-lg font-bold text-xs shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer h-[42px]"
                title="Send Message"
              >
                {sendingMessage ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <span>Send</span>
                    <Send className="h-3.5 w-3.5" />
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

export default function UserDashboard() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-900 flex items-center justify-center text-white text-xs">Loading dashboard...</div>}>
      <UserDashboardContent />
    </Suspense>
  );
}
