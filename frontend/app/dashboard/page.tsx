"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
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
  FileDown,
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
  Info,
  Notebook
} from "lucide-react";

const BACKEND_URL = "http://127.0.0.1:8000";

interface ToastType {
  id: string;
  message: string;
  type: "success" | "error";
}

interface CaseType {
  id: number;
  case_number: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  incident_date: string | null;
  created_at: string | null;
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

export default function UserDashboard() {
  const { data: sessionData, status } = useSession();
  const session = sessionData as any;
  const router = useRouter();

  // Sidebar navigation and UI states
  const [activeTab, setActiveTab] = useState<
    "Dashboard" | "My Cases" | "Upload Evidence" | "Evidence Library" | "AI Analysis" | "Investigation Notes" | "Reports" | "Profile" | "Settings"
  >("Dashboard");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastType[]>([]);
  
  // Notification States
  const [notifications, setNotifications] = useState<NotificationType[]>([]);
  const [notifDropdownOpen, setNotifDropdownOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  // Profile Menu Dropdown
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  // Global statistics state
  const [stats, setStats] = useState({
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

  // Cases List View State
  const [cases, setCases] = useState<CaseType[]>([]);
  const [casesTotal, setCasesTotal] = useState(0);
  const [casesLoading, setCasesLoading] = useState(true);
  const [casesPage, setCasesPage] = useState(1);
  const [casesSearch, setCasesSearch] = useState("");
  const [casesStatusFilter, setCasesStatusFilter] = useState("");
  const [casesPriorityFilter, setCasesPriorityFilter] = useState("");
  const [casesSortBy, setCasesSortBy] = useState("newest");
  const [isCreateCaseModalOpen, setIsCreateCaseModalOpen] = useState(false);
  const [createCaseForm, setCreateCaseForm] = useState({ title: "", description: "", priority: "MEDIUM", incident_date: "" });

  // Case Details View State
  const [selectedCaseId, setSelectedCaseId] = useState<number | null>(null);
  const [caseDetail, setCaseDetail] = useState<any | null>(null);
  const [caseDetailLoading, setCaseDetailLoading] = useState(false);
  const [isEditCaseModalOpen, setIsEditCaseModalOpen] = useState(false);
  const [editCaseForm, setEditCaseForm] = useState({ title: "", description: "", priority: "MEDIUM", status: "OPEN", incident_date: "" });
  
  // Note creation/editing inside case detail
  const [newNoteText, setNewNoteText] = useState("");
  const [editingNoteId, setEditingNoteId] = useState<number | null>(null);
  const [editingNoteText, setEditingNoteText] = useState("");

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

  // Helper to show toasts
  const showToast = useCallback((message: string, type: "success" | "error" = "success") => {
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
        priority_filter: casesPriorityFilter,
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
  }, [session, casesPage, casesSearch, casesStatusFilter, casesPriorityFilter, casesSortBy]);

  useEffect(() => {
    if (activeTab === "My Cases" && !selectedCaseId) {
      fetchCases();
    }
  }, [activeTab, selectedCaseId, fetchCases]);

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
          priority: data.priority,
          status: data.status,
          incident_date: data.incident_date ? data.incident_date.substring(0, 10) : ""
        });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setCaseDetailLoading(false);
    }
  }, [session]);

  const viewCaseDetails = (id: number) => {
    setSelectedCaseId(id);
    fetchCaseDetail(id);
  };

  // ─── Create Case ───
  const handleCreateCase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.accessToken) return;
    try {
      setSubmitting(true);
      const formData = new FormData();
      formData.append("title", createCaseForm.title);
      formData.append("description", createCaseForm.description);
      formData.append("priority", createCaseForm.priority);
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
        setCreateCaseForm({ title: "", description: "", priority: "MEDIUM", incident_date: "" });
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
    try {
      setSubmitting(true);
      const formData = new FormData();
      formData.append("title", editCaseForm.title);
      formData.append("description", editCaseForm.description);
      formData.append("priority", editCaseForm.priority);
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
        if (activeTab === "Investigation Notes") fetchStandaloneNotes();
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
        if (activeTab === "Investigation Notes") fetchStandaloneNotes();
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

  const uploadSingleFile = async (file: File, caseId: number) => {
    if (!session?.accessToken) return;
    setUploadStatus(prev => ({ ...prev, [file.name]: "uploading" }));
    setUploadProgress(prev => ({ ...prev, [file.name]: 10 }));

    const formData = new FormData();
    formData.append("case_id", caseId.toString());
    formData.append("file", file);

    try {
      // Simulate progressive upload
      const interval = setInterval(() => {
        setUploadProgress(prev => {
          const current = prev[file.name] || 10;
          if (current >= 90) {
            clearInterval(interval);
            return prev;
          }
          return { ...prev, [file.name]: current + 20 };
        });
      }, 200);

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
      } else {
        setUploadStatus(prev => ({ ...prev, [file.name]: "error" }));
        showToast(`Failed to upload ${file.name}`, "error");
      }
    } catch (err) {
      setUploadStatus(prev => ({ ...prev, [file.name]: "error" }));
      showToast(`Error uploading ${file.name}`, "error");
    }
  };

  const startUploads = async (targetId: number) => {
    if (uploadFiles.length === 0) return;
    for (const f of uploadFiles) {
      await uploadSingleFile(f, targetId);
    }
    // Clear files lists
    setUploadFiles([]);
    refreshAll();
    if (selectedCaseId) {
      fetchCaseDetail(selectedCaseId);
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
      }
    } catch (err) {
      console.error(err);
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
              case_title: c.title
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
    if (activeTab === "Investigation Notes") {
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

  const handleGenerateReport = async (caseId: number, type: string) => {
    if (!session?.accessToken) return;
    try {
      const formData = new FormData();
      formData.append("report_type", type);
      const res = await fetch(`${BACKEND_URL}/api/v1/user/cases/${caseId}/reports`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${session.accessToken}` },
        body: formData
      });
      if (res.ok) {
        showToast("Court-ready Forensic Report generated", "success");
        if (selectedCaseId) fetchCaseDetail(selectedCaseId);
        fetchReports();
        refreshAll();
      }
    } catch (err) {
      console.error(err);
    }
  };

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

  // Render priority badges
  const renderPriorityBadge = (priority: string) => {
    const map: { [key: string]: string } = {
      LOW: "bg-slate-100 text-slate-700 border-slate-200",
      MEDIUM: "bg-blue-50 text-blue-700 border-blue-200",
      HIGH: "bg-amber-50 text-amber-700 border-amber-200",
      CRITICAL: "bg-rose-50 text-rose-700 border-rose-200"
    };
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border ${map[priority] || "bg-slate-100 text-slate-700 border-slate-200"}`}>
        {priority}
      </span>
    );
  };

  // Render status badges
  const renderStatusBadge = (status: string) => {
    const map: { [key: string]: string } = {
      OPEN: "bg-sky-50 text-sky-700 border-sky-200",
      UNDER_ANALYSIS: "bg-purple-50 text-purple-700 border-purple-200",
      REVIEW: "bg-amber-50 text-amber-700 border-amber-200",
      CLOSED: "bg-emerald-50 text-emerald-700 border-emerald-200"
    };
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${map[status] || "bg-slate-50 text-slate-700 border-slate-200"}`}>
        {status.replace("_", " ")}
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
                : "bg-rose-50 text-rose-800 border-rose-200"
            }`}
          >
            {t.type === "success" ? (
              <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center text-white">
                <Check className="h-3 w-3" />
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
                <span className="font-bold text-lg tracking-tight">DeepGuard Portal</span>
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

              {/* Profile Menu Dropdown */}
              <div className="relative" ref={profileRef}>
                <button
                  onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                  className="flex items-center gap-2 p-1 rounded-full hover:bg-slate-100 transition-colors"
                >
                  <div className="w-8 h-8 rounded-full bg-[#CC2200] text-white flex items-center justify-center font-bold text-sm shadow-sm">
                    {session?.user?.name?.[0].toUpperCase() || "I"}
                  </div>
                  <ChevronDown className="h-4 w-4 text-[#0a0a0a]/60" />
                </button>

                {profileDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-white border border-[#e5e5e5] rounded-lg shadow-lg z-50 py-1 animate-slide-in">
                    <div className="px-4 py-2 border-b border-[#e5e5e5] text-left">
                      <p className="text-sm font-bold text-[#0a0a0a] truncate">{session?.user?.name}</p>
                      <p className="text-xs text-[#0a0a0a]/50 truncate">{session?.user?.email}</p>
                    </div>
                    <button
                      onClick={() => navigateTo("Profile")}
                      className="w-full text-left px-4 py-2 text-sm text-[#0a0a0a]/70 hover:bg-slate-50 hover:text-[#0a0a0a] transition-colors"
                    >
                      My Profile
                    </button>
                    <button
                      onClick={() => navigateTo("Settings")}
                      className="w-full text-left px-4 py-2 text-sm text-[#0a0a0a]/70 hover:bg-slate-50 hover:text-[#0a0a0a] transition-colors"
                    >
                      Portal Settings
                    </button>
                    <button
                      onClick={() => signOut({ callbackUrl: "/" })}
                      className="w-full text-left px-4 py-2 text-sm text-rose-600 hover:bg-rose-50 transition-colors border-t border-[#e5e5e5]"
                    >
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
              {(session?.user?.role === "INVESTIGATOR" ? [
                { id: "Dashboard", label: "Dashboard", icon: <LayoutDashboard className="h-4 w-4" /> },
                { id: "My Cases", label: "Assigned Cases", icon: <FolderSearch className="h-4 w-4" /> },
                { id: "Evidence Library", label: "Evidence Review", icon: <FileVideo className="h-4 w-4" /> },
                { id: "AI Analysis", label: "AI Analysis", icon: <BrainCircuit className="h-4 w-4" /> },
                { id: "Investigation Notes", label: "Investigation Notes", icon: <Notebook className="h-4 w-4" /> },
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
                {(session?.user?.role === "INVESTIGATOR" ? [
                  { id: "Dashboard", label: "Dashboard", icon: <LayoutDashboard className="h-4 w-4" /> },
                  { id: "My Cases", label: "Assigned Cases", icon: <FolderSearch className="h-4 w-4" /> },
                  { id: "Evidence Library", label: "Evidence Review", icon: <FileVideo className="h-4 w-4" /> },
                  { id: "AI Analysis", label: "AI Analysis", icon: <BrainCircuit className="h-4 w-4" /> },
                  { id: "Investigation Notes", label: "Investigation Notes", icon: <Notebook className="h-4 w-4" /> },
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
                <h1 className="text-2xl font-bold tracking-tight">{session?.user?.role === "INVESTIGATOR" ? "Investigator Dashboard" : "My Dashboard"}</h1>
                <p className="text-sm text-[#0a0a0a]/50">Real-time status of your investigation cases, uploads, and AI analysis reports.</p>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { label: "Total Cases", value: stats.totalCases, icon: <FolderSearch className="h-4 w-4 text-[#CC2200]" />, loading: statsLoading },
                  { label: "Open Cases", value: stats.openCases, icon: <Activity className="h-4 w-4 text-sky-600" />, loading: statsLoading },
                  { label: "Evidence Uploaded", value: stats.evidenceUploaded, icon: <FileVideo className="h-4 w-4 text-purple-600" />, loading: statsLoading },
                  { label: "AI Scans", value: stats.aiAnalysesCompleted, icon: <BrainCircuit className="h-4 w-4 text-emerald-600" />, loading: statsLoading },
                ].map((card, i) => (
                  <div key={i} className="bg-white border border-[#e5e5e5] rounded-lg p-5 shadow-sm hover:shadow-md transition-shadow">
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
                    <h2 className="font-bold text-sm">Recent Investigation Cases</h2>
                    <button onClick={() => navigateTo("My Cases")} className="text-xs font-bold text-[#CC2200] hover:underline">View All</button>
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
                              {renderPriorityBadge(c.priority)}
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

          {/* ──────────────── 2. MY CASES VIEW ──────────────── */}
          {activeTab === "My Cases" && !selectedCaseId && (
            <div className="space-y-6 animate-scale-up">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-bold tracking-tight">My Cases</h1>
                  <p className="text-sm text-[#0a0a0a]/50">Manage your active, review, and closed investigation case records.</p>
                </div>
                <button
                  onClick={() => setIsCreateCaseModalOpen(true)}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-md bg-[#CC2200] text-white text-sm font-bold shadow-md hover:opacity-90 transition-opacity"
                >
                  <Plus className="h-4 w-4" />
                  New Case
                </button>
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
                    <option value="OPEN">Open</option>
                    <option value="UNDER_ANALYSIS">Under Analysis</option>
                    <option value="REVIEW">Review</option>
                    <option value="CLOSED">Closed</option>
                  </select>

                  {/* Priority Filter */}
                  <select
                    value={casesPriorityFilter}
                    onChange={(e) => { setCasesPriorityFilter(e.target.value); setCasesPage(1); }}
                    className="bg-slate-50 border border-[#e5e5e5] rounded-md text-sm px-3 py-2 outline-none focus:ring-1 focus:ring-[#CC2200] text-[#0a0a0a]"
                  >
                    <option value="">All Priorities</option>
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="CRITICAL">Critical</option>
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
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-[#e5e5e5] text-xs font-bold text-[#0a0a0a]/60 uppercase">
                          <th className="px-6 py-4">Case Code</th>
                          <th className="px-6 py-4">Title</th>
                          <th className="px-6 py-4">Priority</th>
                          <th className="px-6 py-4">Status</th>
                          <th className="px-6 py-4">Incident Date</th>
                          <th className="px-6 py-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#e5e5e5] text-sm">
                        {cases.map((c) => (
                          <tr key={c.id} className="hover:bg-slate-50/50">
                            <td className="px-6 py-4 font-bold text-[#CC2200]">{c.case_number}</td>
                            <td className="px-6 py-4">
                              <p className="font-semibold text-[#0a0a0a]">{c.title}</p>
                              <p className="text-xs text-[#0a0a0a]/50 truncate max-w-[240px]">{c.description}</p>
                            </td>
                            <td className="px-6 py-4">{renderPriorityBadge(c.priority)}</td>
                            <td className="px-6 py-4">{renderStatusBadge(c.status)}</td>
                            <td className="px-6 py-4 text-xs text-[#0a0a0a]/60">
                              {c.incident_date ? new Date(c.incident_date).toLocaleDateString() : "N/A"}
                            </td>
                            <td className="px-6 py-4 text-right">
                              <button
                                onClick={() => viewCaseDetails(c.id)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-[#e5e5e5] text-xs font-semibold hover:bg-slate-100 hover:text-[#0a0a0a] transition-all"
                              >
                                <Eye className="h-3.5 w-3.5" />
                                Open Case
                              </button>
                            </td>
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
                <div className="flex gap-2">
                  <button
                    onClick={() => setIsEditCaseModalOpen(true)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded border border-[#e5e5e5] text-xs font-semibold bg-white hover:bg-slate-50 transition-colors"
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                    Edit Details
                  </button>
                  <button
                    onClick={() => handleGenerateReport(caseDetail.id, "FINAL")}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded bg-[#CC2200] text-white text-xs font-semibold shadow hover:opacity-90 transition-opacity"
                  >
                    <FileText className="h-3.5 w-3.5" />
                    Generate Report
                  </button>
                </div>
              </div>

              {/* Case Header Card */}
              <div className="bg-white border border-[#e5e5e5] rounded-lg shadow-sm p-6 space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-xs font-bold text-[#CC2200] tracking-wider uppercase">{caseDetail.case_number}</span>
                    <h1 className="text-2xl font-bold mt-1 text-[#0a0a0a]">{caseDetail.title}</h1>
                  </div>
                  <div className="flex gap-2">
                    {renderPriorityBadge(caseDetail.priority)}
                    {renderStatusBadge(caseDetail.status)}
                  </div>
                </div>
                <p className="text-sm text-[#0a0a0a]/75 leading-relaxed">{caseDetail.description || "No description provided."}</p>
                
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-[#e5e5e5] text-xs font-semibold text-[#0a0a0a]/60">
                  <div>
                    <span className="block text-[10px] text-[#0a0a0a]/40 uppercase mb-0.5">Incident Date</span>
                    {caseDetail.incident_date ? new Date(caseDetail.incident_date).toLocaleDateString() : "N/A"}
                  </div>
                  <div>
                    <span className="block text-[10px] text-[#0a0a0a]/40 uppercase mb-0.5">Created On</span>
                    {new Date(caseDetail.created_at).toLocaleDateString()}
                  </div>
                  <div>
                    <span className="block text-[10px] text-[#0a0a0a]/40 uppercase mb-0.5">Assigned Expert</span>
                    {caseDetail.assigned_expert || "Awaiting Assignment"}
                  </div>
                  <div>
                    <span className="block text-[10px] text-[#0a0a0a]/40 uppercase mb-0.5">Evidence Files</span>
                    {caseDetail.evidence ? caseDetail.evidence.length : 0}
                  </div>
                </div>
              </div>

              {/* Nested Tabs within Case Details */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Left & Middle Column (Evidence & AI analysis & Reports) */}
                <div className="lg:col-span-2 space-y-6">
                  
                  {/* Evidence Table */}
                  <div className="bg-white border border-[#e5e5e5] rounded-lg shadow-sm overflow-hidden">
                    <div className="px-5 py-4 border-b border-[#e5e5e5] flex justify-between items-center bg-slate-50/50">
                      <h3 className="font-bold text-sm">Uploaded Evidence</h3>
                      <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-slate-100 hover:bg-slate-200 text-xs font-semibold cursor-pointer border border-[#e5e5e5]">
                        <Plus className="h-3.5 w-3.5" />
                        Add Evidence
                        <input type="file" onChange={(e) => {
                          if (e.target.files && e.target.files[0]) {
                            uploadSingleFile(e.target.files[0], caseDetail.id);
                          }
                        }} className="hidden" />
                      </label>
                    </div>

                    {caseDetail.evidence.length === 0 ? (
                      <div className="p-8 text-center text-xs text-[#0a0a0a]/40">No evidence uploaded yet.</div>
                    ) : (
                      <div className="divide-y divide-[#e5e5e5]">
                        {caseDetail.evidence.map((ev: EvidenceType) => (
                          <div key={ev.id} className="p-4 flex items-center justify-between hover:bg-slate-50/30 transition-colors">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded bg-slate-100 flex items-center justify-center text-xs font-bold text-[#0a0a0a]/60">
                                {ev.file_type[0]}
                              </div>
                              <div className="text-left">
                                <p className="text-xs font-bold text-[#0a0a0a] truncate max-w-[200px]">{ev.original_name}</p>
                                <p className="text-[10px] text-[#0a0a0a]/40">
                                  {(ev.file_size / 1024 / 1024).toFixed(2)} MB • {ev.file_type}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              
                              {/* Preview */}
                              <button
                                onClick={() => setPreviewFile(ev)}
                                className="p-1.5 border border-[#e5e5e5] rounded text-[#0a0a0a]/60 hover:bg-slate-100"
                                title="Preview file"
                              >
                                <Eye className="h-3.5 w-3.5" />
                              </button>

                              {/* Download */}
                              <a
                                href={`${BACKEND_URL}/uploads/${ev.file_name}`}
                                download={ev.original_name}
                                className="p-1.5 border border-[#e5e5e5] rounded text-[#0a0a0a]/60 hover:bg-slate-100 flex items-center justify-center"
                                title="Download"
                                target="_blank"
                                rel="noreferrer"
                              >
                                <Download className="h-3.5 w-3.5" />
                              </a>

                              {/* Delete */}
                              <button
                                onClick={() => handleDeleteEvidence(ev.id)}
                                className="p-1.5 border border-rose-200 rounded text-rose-600 hover:bg-rose-50"
                                title="Delete"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>

                              {/* Run AI Analysis shortcut */}
                              <button
                                onClick={() => {
                                  setSelectedEvidenceForAI(ev.id.toString());
                                  navigateTo("AI Analysis");
                                }}
                                className="px-2.5 py-1.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-bold hover:bg-emerald-100 transition-colors"
                              >
                                Run AI
                              </button>

                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* AI Analyses Results */}
                  <div className="bg-white border border-[#e5e5e5] rounded-lg shadow-sm overflow-hidden">
                    <div className="px-5 py-4 border-b border-[#e5e5e5] bg-slate-50/50">
                      <h3 className="font-bold text-sm">AI Manipulation Scans</h3>
                    </div>
                    
                    {caseDetail.evidence.every((ev: any) => !ev.analyses || ev.analyses.length === 0) ? (
                      <div className="p-8 text-center text-xs text-[#0a0a0a]/40">No scans performed. Select evidence to run AI models.</div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left">
                          <thead>
                            <tr className="bg-slate-50 border-b border-[#e5e5e5] text-[10px] font-bold text-[#0a0a0a]/60 uppercase">
                              <th className="px-4 py-3">File Name</th>
                              <th className="px-4 py-3">Model</th>
                              <th className="px-4 py-3">Confidence</th>
                              <th className="px-4 py-3">Result</th>
                              <th className="px-4 py-3 text-right">Date</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#e5e5e5] text-xs">
                            {caseDetail.evidence.map((ev: any) => 
                              ev.analyses?.map((an: any) => (
                                <tr key={an.id} className="hover:bg-slate-50/30">
                                  <td className="px-4 py-3 font-semibold truncate max-w-[120px]">{ev.original_name}</td>
                                  <td className="px-4 py-3 font-medium text-[#0a0a0a]/80">{an.model_name}</td>
                                  <td className="px-4 py-3 font-bold">{(an.confidence_score * 100).toFixed(1)}%</td>
                                  <td className="px-4 py-3">{renderAIResultBadge(an.result)}</td>
                                  <td className="px-4 py-3 text-right text-[#0a0a0a]/50">
                                    {new Date(an.analyzed_at).toLocaleDateString()}
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* Forensic Reviews (Expert Decisions) */}
                  <div className="bg-white border border-[#e5e5e5] rounded-lg shadow-sm">
                    <div className="px-5 py-4 border-b border-[#e5e5e5] bg-slate-50/50">
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

                </div>

                {/* Right Column (Notes & Reports) */}
                <div className="space-y-6">
                  
                  {/* Case Notes */}
                  <div className="bg-white border border-[#e5e5e5] rounded-lg shadow-sm flex flex-col h-[400px]">
                    <div className="px-5 py-4 border-b border-[#e5e5e5] bg-slate-50/50">
                      <h3 className="font-bold text-sm">Investigation Notes</h3>
                    </div>
                    
                    {/* Notes Feed */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-3">
                      {caseDetail.notes.length === 0 ? (
                        <div className="text-center text-xs text-[#0a0a0a]/40 py-8">No notes created yet.</div>
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
                                <div className="opacity-0 group-hover:opacity-100 absolute bottom-1 right-2 flex gap-1.5 transition-opacity bg-white/95 px-1 py-0.5 rounded shadow-sm">
                                  <button onClick={() => startEditNote(note.id, note.note)} className="text-[10px] font-bold text-blue-600 hover:underline">Edit</button>
                                  <button onClick={() => handleDeleteNote(note.id)} className="text-[10px] font-bold text-rose-600 hover:underline">Delete</button>
                                </div>
                              </>
                            )}
                          </div>
                        ))
                      )}
                    </div>

                    {/* Note submit form */}
                    <form onSubmit={handleAddNote} className="p-3 border-t border-[#e5e5e5] bg-slate-50 flex gap-2">
                      <input
                        type="text"
                        placeholder="Write a case note..."
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
                  </div>

                  {/* Reports generated for case */}
                  <div className="bg-white border border-[#e5e5e5] rounded-lg shadow-sm">
                    <div className="px-5 py-4 border-b border-[#e5e5e5] bg-slate-50/50">
                      <h3 className="font-bold text-sm">Generated Case Reports</h3>
                    </div>
                    <div className="p-4 space-y-2">
                      {caseDetail.reports.length === 0 ? (
                        <div className="text-center text-xs text-[#0a0a0a]/40 py-4">No reports generated.</div>
                      ) : (
                        caseDetail.reports.map((rep: ReportType) => (
                          <div key={rep.id} className="p-3 border border-[#e5e5e5] rounded flex items-center justify-between hover:bg-slate-50/30">
                            <div className="flex items-center gap-2">
                              <FileText className="h-4 w-4 text-[#CC2200]" />
                              <div className="text-left">
                                <span className="text-xs font-bold text-[#0a0a0a]">{rep.report_type} Report</span>
                                <span className="block text-[9px] text-[#0a0a0a]/40">{new Date(rep.generated_at!).toLocaleDateString()}</span>
                              </div>
                            </div>
                            <a
                              href={`${BACKEND_URL}${rep.report_file}`}
                              download
                              className="p-1 border border-[#e5e5e5] rounded hover:bg-slate-100 text-[#0a0a0a]/60 flex items-center justify-center"
                              title="Download PDF"
                            >
                              <FileDown className="h-3.5 w-3.5" />
                            </a>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                </div>

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
                        disabled={!uploadTargetCaseId}
                        className="px-5 py-2 rounded bg-[#CC2200] text-white text-xs font-bold shadow hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Submit Evidence
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
                                href={`${BACKEND_URL}/uploads/${ev.file_name}`}
                                download={ev.original_name}
                                className="p-1.5 border border-[#e5e5e5] rounded text-[#0a0a0a]/60 hover:bg-slate-100 flex items-center justify-center"
                                target="_blank"
                                rel="noreferrer"
                              >
                                <Download className="h-3.5 w-3.5" />
                              </a>
                              <button
                                onClick={() => handleDeleteEvidence(ev.id)}
                                className="p-1.5 border border-rose-200 rounded text-rose-600 hover:bg-rose-50"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
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

          {/* ──────────────── 6. INVESTIGATION NOTES STANDALONE VIEW ──────────────── */}
          {activeTab === "Investigation Notes" && (
            <div className="space-y-6 animate-scale-up text-left">
              <div>
                <h1 className="text-2xl font-bold tracking-tight">Case Notes Log</h1>
                <p className="text-sm text-[#0a0a0a]/50">Chronological feed of case journal logs and internal investigation notes created across cases.</p>
              </div>

              {/* Notes grid */}
              {notesLoading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[1, 2, 3, 4].map(i => <div key={i} className="h-28 bg-white border border-[#e5e5e5] rounded animate-pulse" />)}
                </div>
              ) : standaloneNotes.length === 0 ? (
                <div className="bg-white border border-[#e5e5e5] rounded-lg shadow-sm p-12 text-center text-sm text-[#0a0a0a]/50">
                  No investigation notes created yet.
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
                        {editingNoteId !== note.id && (
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
                  {session?.user?.role === "INVESTIGATOR" ? "My Profile Settings" : "My Profile"}
                </h1>
                <p className="text-sm text-[#0a0a0a]/50">
                  {session?.user?.role === "INVESTIGATOR" 
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
                    {session?.user?.role === "INVESTIGATOR" ? "Investigator" : "End User"}
                  </div>
                  
                  <div className="w-full text-xs space-y-2 pt-4 border-t border-[#e5e5e5] text-left text-[#0a0a0a]/60 font-semibold">
                    <div className="flex justify-between">
                      <span>Status</span>
                      <span className="text-green-600">Active Approved</span>
                    </div>
                    {session?.user?.role === "INVESTIGATOR" && (
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

                    {session?.user?.role === "INVESTIGATOR" ? (
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
          © {new Date().getFullYear()} DeepGuard. Confident deepfake detection forensic workflows.
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

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase text-[#0a0a0a]/60 mb-1">Priority</label>
                  <select
                    value={createCaseForm.priority}
                    onChange={(e) => setCreateCaseForm(prev => ({ ...prev, priority: e.target.value }))}
                    className="w-full text-sm px-3 py-2 bg-[#fafafa] border border-[#e5e5e5] rounded outline-none text-[#0a0a0a]"
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="CRITICAL">Critical</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-xs font-bold uppercase text-[#0a0a0a]/60 mb-1">Incident Date</label>
                  <input
                    type="date"
                    value={createCaseForm.incident_date}
                    onChange={(e) => setCreateCaseForm(prev => ({ ...prev, incident_date: e.target.value }))}
                    className="w-full text-sm px-3 py-1.5 bg-[#fafafa] border border-[#e5e5e5] rounded outline-none text-[#0a0a0a]"
                  />
                </div>
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
                  disabled={submitting}
                  className="px-5 py-2 bg-[#CC2200] text-white rounded text-xs font-bold hover:opacity-90 shadow disabled:opacity-50"
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

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase text-[#0a0a0a]/60 mb-1">Priority</label>
                  <select
                    value={editCaseForm.priority}
                    onChange={(e) => setEditCaseForm(prev => ({ ...prev, priority: e.target.value }))}
                    className="w-full text-sm px-2 py-2 bg-[#fafafa] border border-[#e5e5e5] rounded outline-none text-[#0a0a0a]"
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="CRITICAL">Critical</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-[#0a0a0a]/60 mb-1">Status</label>
                  <select
                    value={editCaseForm.status}
                    onChange={(e) => setEditCaseForm(prev => ({ ...prev, status: e.target.value }))}
                    className="w-full text-sm px-2 py-2 bg-[#fafafa] border border-[#e5e5e5] rounded outline-none text-[#0a0a0a]"
                  >
                    <option value="OPEN">Open</option>
                    <option value="UNDER_ANALYSIS">Under Analysis</option>
                    <option value="REVIEW">Review</option>
                    <option value="CLOSED">Closed</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-xs font-bold uppercase text-[#0a0a0a]/60 mb-1">Incident Date</label>
                  <input
                    type="date"
                    value={editCaseForm.incident_date}
                    onChange={(e) => setEditCaseForm(prev => ({ ...prev, incident_date: e.target.value }))}
                    className="w-full text-[11px] px-1 py-2 bg-[#fafafa] border border-[#e5e5e5] rounded outline-none text-[#0a0a0a]"
                  />
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
              {previewFile.file_type === "IMAGE" && (
                <img
                  src={`${BACKEND_URL}/uploads/${previewFile.file_name}`}
                  alt={previewFile.original_name}
                  className="max-h-[50vh] object-contain rounded"
                />
              )}
              {previewFile.file_type === "VIDEO" && (
                <video
                  src={`${BACKEND_URL}/uploads/${previewFile.file_name}`}
                  controls
                  className="max-h-[50vh] max-w-full rounded"
                />
              )}
              {previewFile.file_type === "AUDIO" && (
                <audio
                  src={`${BACKEND_URL}/uploads/${previewFile.file_name}`}
                  controls
                  className="w-full max-w-md"
                />
              )}
              {previewFile.file_type === "DOCUMENT" && (
                <div className="text-center text-white space-y-3">
                  <FileText className="h-16 w-16 text-[#CC2200] mx-auto" />
                  <p className="text-sm font-semibold">Document File Preview not supported in sandbox browser</p>
                  <a
                    href={`${BACKEND_URL}/uploads/${previewFile.file_name}`}
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

    </div>
  );
}
