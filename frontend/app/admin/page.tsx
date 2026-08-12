"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { 
  Users, 
  ShieldAlert, 
  Activity, 
  FileText, 
  Settings, 
  Search, 
  LogOut,
  Check,
  X,
  Eye,
  Edit2,
  Trash2,
  Filter,
  ChevronLeft,
  ChevronRight,
  Loader2,
  UserCheck,
  UserX,
  Plus,
  Download,
  MoreVertical,
  Key,
  Send,
  CheckCircle,
  AlertCircle,
  ChevronDown,
  Briefcase,
  ArrowRight,
  ArrowLeft
} from "lucide-react";
import Link from "next/link";
import WorkspaceSwitcher from "@/components/WorkspaceSwitcher";

const BACKEND_URL = "http://127.0.0.1:8000";

interface UserType {
  id: number;
  full_name: string;
  email: string;
  phone: string | null;
  organization: string | null;
  role_id: number | null;
  role_name: string;
  status: string;
  profile_picture: string | null;
  government_id: string | null;
  date_of_birth?: string | null;
  gender?: string | null;
  address?: string | null;
  digital_id_path?: string | null;
  last_login: string | null;
  created_at: string | null;
}

interface ToastType {
  id: string;
  message: string;
  type: "success" | "error";
}

const createEmptyRow = () => ({
  id: crypto.randomUUID(),
  full_name: "",
  email: "",
  phone: ""
});

export default function AdminDashboard() {
  const { data: sessionData, status } = useSession();
  const session = sessionData as any;
  const router = useRouter();

  // Sidebar Tab State (Overview vs User Management vs Investigators vs Cases)
  const [activeSidebarTab, setActiveSidebarTab] = useState<"Overview" | "User Management" | "Investigators" | "Cases" | "System Alerts" | "Audit Logs" | "Configuration">("Overview");


  // Investigators Management State
  const [investigators, setInvestigators] = useState<any[]>([]);
  const [investigatorsTotal, setInvestigatorsTotal] = useState(0);
  const [investigatorsLoading, setInvestigatorsLoading] = useState(true);
  const [investigatorsLoaded, setInvestigatorsLoaded] = useState(false);
  const [investigatorsPage, setInvestigatorsPage] = useState(1);
  const [investigatorsSearch, setInvestigatorsSearch] = useState("");
  const [investigatorsOrgFilter, setInvestigatorsOrgFilter] = useState("");
  const [investigatorsDeptFilter, setInvestigatorsDeptFilter] = useState("");
  const [investigatorsStatusFilter, setInvestigatorsStatusFilter] = useState("");
  const [investigatorsSort, setInvestigatorsSort] = useState("name");
  

  const [investigatorsTab, setInvestigatorsTab] = useState<"Active Investigators" | "Pending Invitations" | "Pending Verification" | "Invitation Logs">("Active Investigators");
  const [invitationLogs, setInvitationLogs] = useState<any[]>([]);
  const [invitationLogsLoading, setInvitationLogsLoading] = useState(false);
  const [invitationLogsLoaded, setInvitationLogsLoaded] = useState(false);
  const [selectedLogs, setSelectedLogs] = useState<number[]>([]);
  const [isLogDrawerOpen, setIsLogDrawerOpen] = useState(false);
  const [selectedLog, setSelectedLog] = useState<any | null>(null);

  // All Cases Management State
  const [adminCases, setAdminCases] = useState<any[]>([]);
  const [adminCasesTotal, setAdminCasesTotal] = useState(0);
  const [adminCasesLoading, setAdminCasesLoading] = useState(false);
  const [adminCasesLoaded, setAdminCasesLoaded] = useState(false);
  const [adminCasesError, setAdminCasesError] = useState(false);
  const [adminCasesPage, setAdminCasesPage] = useState(1);
  const [adminCasesSearch, setAdminCasesSearch] = useState("");
  const [adminCasesStatusFilter, setAdminCasesStatusFilter] = useState("All");

  const [selectedAdminCaseId, setSelectedAdminCaseId] = useState<number | null>(null);
  const [adminCaseDetail, setAdminCaseDetail] = useState<any | null>(null);
  const [adminCaseDetailLoading, setAdminCaseDetailLoading] = useState(false);
  
  const handleSelectLog = (id: number) => {
    setSelectedLogs(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };
  
  const handleSelectAllLogs = () => {
    if (selectedLogs.length === invitationLogs.length) {
      setSelectedLogs([]);
    } else {
      setSelectedLogs(invitationLogs.map(l => l.id));
    }
  };
  
  const handleExportCSV = () => {
    const csvHeader = "ID,Event Type,Status,Recipient,Performed By,IP Address,Created At\n";
    const csvContent = invitationLogs.map(l => `${l.id},${l.event_type},${l.status},${l.recipient_email},${l.performed_by || "System"},${l.ip_address || "N/A"},${l.created_at}`).join("\n");
    const blob = new Blob([csvHeader + csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "invitation_logs.csv";
    a.click();
  };
  
  const handleResendSelected = async () => {
    if (selectedLogs.length === 0) return;
    try {
      const selectedInvitationIds = Array.from(new Set(
        invitationLogs.filter(l => selectedLogs.includes(l.id)).map(l => l.invitation_id)
      ));
      for (const id of selectedInvitationIds) {
        await fetch(`http://127.0.0.1:8000/api/admin/invitations/${id}/resend`, {
          method: "POST",
          headers: { Authorization: `Bearer ${session.accessToken}` }
        });
      }
      showToast("Selected invitations resent successfully.", "success");
      fetchInvitationLogs(true);
      fetchInvitations(true);
      setSelectedLogs([]);
    } catch(err) {
      showToast("Failed to resend some invitations.", "error");
    }
  };

  const handleCancelSelected = async () => {
    if (selectedLogs.length === 0) return;
    try {
      const selectedInvitationIds = Array.from(new Set(
        invitationLogs.filter(l => selectedLogs.includes(l.id)).map(l => l.invitation_id)
      ));
      for (const id of selectedInvitationIds) {
        await fetch(`http://127.0.0.1:8000/api/admin/invitations/${id}/cancel`, {
          method: "POST",
          headers: { Authorization: `Bearer ${session.accessToken}` }
        });
      }
      showToast("Selected invitations cancelled successfully.", "success");
      fetchInvitationLogs(true);
      fetchInvitations(true);
      setSelectedLogs([]);
    } catch(err) {
      showToast("Failed to cancel some invitations.", "error");
    }
  };

  const [bulkRows, setBulkRows] = useState(Array.from({ length: 5 }, createEmptyRow));
  const [isBulkInviteModalOpen, setIsBulkInviteModalOpen] = useState(false);
  const [bulkInviteResult, setBulkInviteResult] = useState<any>(null);
  


  // User Management Sub-Tabs (Active Users vs Pending Requests)
  const [adminTab, setAdminTab] = useState<"active" | "pending" | "invitations">("active");

  // Toasts State
  const [toasts, setToasts] = useState<ToastType[]>([]);

  // Stats State
  const [stats, setStats] = useState({
    totalUsers: 0,
    pendingApprovals: 0,
    activeUsersCount: 0,
    activeInvestigations: 486,
    systemLoad: "42%"
  });
  const [statsLoading, setStatsLoading] = useState(true);

  // Active Users Tab Data & Filters State
  const [users, setUsers] = useState<UserType[]>([]);
  const [usersTotal, setUsersTotal] = useState(0);
  const [usersLoading, setUsersLoading] = useState(true);
  const [activeUsersLoaded, setActiveUsersLoaded] = useState(false);
  const [usersPage, setUsersPage] = useState(1);
  const [usersLimit] = useState(10);
  const [usersSearch, setUsersSearch] = useState("");
  const [usersRoleFilter, setUsersRoleFilter] = useState<string>("");
  const [usersStatusFilter, setUsersStatusFilter] = useState<string>("");
  const [usersSortBy, setUsersSortBy] = useState("newest");

  // Pending Requests Tab Data State
  const [pendingUsers, setPendingUsers] = useState<UserType[]>([]);
  const [pendingLoading, setPendingLoading] = useState(true);
  const [pendingUsersLoaded, setPendingUsersLoaded] = useState(false);

  // Invitations State
  const [invitations, setInvitations] = useState<any[]>([]);
  const [invitationsLoading, setInvitationsLoading] = useState(true);
  const [invitationsLoaded, setInvitationsLoaded] = useState(false);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [inviteForm, setInviteForm] = useState({ full_name: "", email: "", phone: "" });

  // Modal States
  const [selectedUser, setSelectedUser] = useState<UserType | null>(null);
  const [isViewDrawerOpen, setIsViewDrawerOpen] = useState(false);
  
  const [userToEdit, setUserToEdit] = useState<UserType | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    full_name: "",
    email: "",
    phone: "",
    organization: "",
    role_id: 2,
    status: "ACTIVE",
    government_id: ""
  });

  const [userToApprove, setUserToApprove] = useState<UserType | null>(null);
  const [isApproveModalOpen, setIsApproveModalOpen] = useState(false);

  const [userToReject, setUserToReject] = useState<UserType | null>(null);
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  const [userToDelete, setUserToDelete] = useState<UserType | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Helper to show toasts
  const showToast = useCallback((message: string, type: "success" | "error" = "success") => {
    const id = Date.now().toString();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  // Security Gate
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    } else if (status === "authenticated") {
      // @ts-ignore
      const isSuper = session?.user?.email === "superuser@example.com";
      // @ts-ignore
      const isAdminRole = session?.user?.role === 1;
      if (!isSuper && !isAdminRole) {
        router.push("/login");
      }
    }
  }, [status, session, router]);

  // Fetch Dashboard Stats
  const fetchStats = useCallback(async () => {
    if (!session?.accessToken) return;
    try {
      setStatsLoading(true);
      const res = await fetch(`${BACKEND_URL}/api/v1/auth/admin/stats`, {
        headers: {
          Authorization: `Bearer ${session.accessToken}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setStats((prev) => ({
          ...prev,
          totalUsers: data.total_users,
          pendingApprovals: data.pending_approvals,
          activeUsersCount: data.active_users_count
        }));
      }
    } catch (err) {
      console.error("Failed to fetch stats:", err);
    } finally {
      setStatsLoading(false);
    }
  }, [session?.accessToken]);

  // Fetch Registered/Active Users
  const fetchUsers = useCallback(async (force = false) => {
    if (!session?.accessToken) return;
    if (activeUsersLoaded && !force) return; // Use cached data
    try {
      setUsersLoading(true);
      const queryParams = new URLSearchParams({
        page: usersPage.toString(),
        limit: usersLimit.toString(),
        sort_by: usersSortBy
      });
      if (usersSearch) queryParams.append("search", usersSearch);
      if (usersRoleFilter) queryParams.append("role_id", usersRoleFilter);
      if (usersStatusFilter) queryParams.append("status_filter", usersStatusFilter);

      const res = await fetch(`${BACKEND_URL}/api/admin/users?${queryParams.toString()}`, {
        headers: {
          Authorization: `Bearer ${session.accessToken}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users);
        setUsersTotal(data.total);
        setActiveUsersLoaded(true);
      }
    } catch (err) {
      console.error("Failed to fetch users:", err);
      showToast("Error fetching users list.", "error");
    } finally {
      setUsersLoading(false);
    }
  }, [session?.accessToken, usersPage, usersLimit, usersSearch, usersRoleFilter, usersStatusFilter, usersSortBy, activeUsersLoaded, showToast]);

  // Fetch Pending Users
  const fetchPendingUsers = useCallback(async (force = false) => {
    if (!session?.accessToken) return;
    if (pendingUsersLoaded && !force) return; // Use cached data
    try {
      setPendingLoading(true);
      const res = await fetch(`${BACKEND_URL}/api/admin/pending-users`, {
        headers: {
          Authorization: `Bearer ${session.accessToken}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setPendingUsers(data);
        setPendingUsersLoaded(true);
      }
    } catch (err) {
      console.error("Failed to fetch pending users:", err);
      showToast("Error fetching pending requests.", "error");
    } finally {
      setPendingLoading(false);
    }
  }, [session?.accessToken, pendingUsersLoaded, showToast]);
  // Fetch Investigators
  const fetchInvestigators = useCallback(async (force = false) => {
    if (!session?.accessToken) return;
    if (investigatorsLoaded && !force) return;
    try {
      setInvestigatorsLoading(true);
      const queryParams = new URLSearchParams({
        page: investigatorsPage.toString(),
        limit: "10",
        role_id: "2"
      });
      if (investigatorsSearch) queryParams.append("search", investigatorsSearch);
      if (investigatorsStatusFilter) queryParams.append("status_filter", investigatorsStatusFilter);
      // the backend user API might not support org/dept directly but we'll include sorting
      queryParams.append("sort_by", investigatorsSort);

      const res = await fetch(`${BACKEND_URL}/api/admin/users?${queryParams.toString()}`, {
        headers: {
          Authorization: `Bearer ${session.accessToken}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setInvestigators(data.users);
        setInvestigatorsTotal(data.total);
        setInvestigatorsLoaded(true);
      }
    } catch (err) {
      showToast("Error fetching active investigators.", "error");
    } finally {
      setInvestigatorsLoading(false);
    }
  }, [session?.accessToken, investigatorsPage, investigatorsSearch, investigatorsStatusFilter, investigatorsSort, investigatorsLoaded, showToast]);


  const fetchInvitationLogs = useCallback(async (force = false) => {
    if (!session?.accessToken) return;
    if (invitationLogsLoaded && !force) return;
    try {
      setInvitationLogsLoading(true);
      const res = await fetch(`http://127.0.0.1:8000/api/admin/invitation-logs`, {
        headers: { Authorization: `Bearer ${session.accessToken}` }
      });
      if (res.ok) {
        const data = await res.json();
        setInvitationLogs(data);
        setInvitationLogsLoaded(true);
      }
    } catch (err) {
      console.error(err);
      showToast("Error fetching invitation logs.", "error");
    } finally {
      setInvitationLogsLoading(false);
    }
  }, [session?.accessToken, invitationLogsLoaded, showToast]);

  // Fetch Invitations
  const fetchInvitations = useCallback(async (force = false) => {
    if (!session?.accessToken) return;
    if (invitationsLoaded && !force) return;
    try {
      setInvitationsLoading(true);
      const res = await fetch(`${BACKEND_URL}/api/v1/admin/invitations`, {
        headers: { Authorization: `Bearer ${session.accessToken}` }
      });
      if (res.ok) {
        const data = await res.json();
        setInvitations(data);
        setInvitationsLoaded(true);
      }
    } catch (err) {
      console.error(err);
      showToast("Error fetching invitations.", "error");
    } finally {
      setInvitationsLoading(false);
    }
  }, [session?.accessToken, invitationsLoaded, showToast]);

  // Combined Refresh (Clears Cache / Forces Refetch)
  const refreshAllData = useCallback(() => {
    fetchStats();
    fetchUsers(true);
    fetchPendingUsers(true);
        fetchInvitations(true);
  }, [fetchStats, fetchUsers, fetchPendingUsers, fetchInvitations]);

  const fetchAdminCases = useCallback(async (force = false) => {
    if (!session?.accessToken) return;
    if (adminCasesLoaded && !force) return;
    try {
      setAdminCasesLoading(true);
      setAdminCasesError(false);
      const queryParams = new URLSearchParams({
        page: adminCasesPage.toString(),
        limit: "20",
      });
      if (adminCasesSearch) queryParams.append("search", adminCasesSearch);
      if (adminCasesStatusFilter && adminCasesStatusFilter !== "All") {
        queryParams.append("status_filter", adminCasesStatusFilter);
      }

      const res = await fetch(`${BACKEND_URL}/api/v1/user/cases?${queryParams.toString()}`, {
        headers: { Authorization: `Bearer ${session.accessToken}` }
      });
      if (res.ok) {
        const data = await res.json();
        setAdminCases(data.cases || []);
        setAdminCasesTotal(data.total || 0);
        setAdminCasesLoaded(true);
        setAdminCasesError(false);
      } else {
        setAdminCasesError(true);
        showToast("Unable to load cases. Please try again.", "error");
      }
    } catch (err) {
      console.error("Error fetching admin cases:", err);
      setAdminCasesError(true);
      showToast("Unable to load cases. Please try again.", "error");
    } finally {
      setAdminCasesLoading(false);
    }
  }, [session?.accessToken, adminCasesPage, adminCasesSearch, adminCasesStatusFilter, adminCasesLoaded, showToast]);

  const fetchAdminCaseDetail = useCallback(async (caseId: number) => {
    if (!session?.accessToken) return;
    try {
      setAdminCaseDetailLoading(true);
      const res = await fetch(`${BACKEND_URL}/api/v1/user/cases/${caseId}`, {
        headers: { Authorization: `Bearer ${session.accessToken}` }
      });
      if (res.ok) {
        const data = await res.json();
        setAdminCaseDetail(data);
      } else {
        showToast("Error fetching case details.", "error");
      }
    } catch (err) {
      showToast("Error fetching case details.", "error");
    } finally {
      setAdminCaseDetailLoading(false);
    }
  }, [session?.accessToken, showToast]);

  const getCaseStatusBadge = (statusStr: string) => {
    const s = (statusStr || "").toUpperCase();
    if (s === "CASE_FILED" || s === "DRAFT" || s === "PENDING") {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200/50">
          Pending
        </span>
      );
    }
    if (s === "CASE_OPENED" || s === "OPEN" || s === "ASSIGNED") {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200/50">
          Assigned
        </span>
      );
    }
    if (s === "UNDER_ANALYSIS" || s === "EXPERT_REVIEW" || s === "REVIEW" || s === "UNDER INVESTIGATION") {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200/50">
          Under Investigation
        </span>
      );
    }
    if (s === "CLOSED" || s === "COMPLETED") {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/50">
          Completed
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200/50">
        {statusStr}
      </span>
    );
  };

  // Initial Fetches (Always load stats and active users initially)
  useEffect(() => {
    if (session?.accessToken) {
      fetchStats();
      fetchUsers();
    }
  }, [session?.accessToken, fetchStats, fetchUsers]);

  // Tab switching load logic (lazy load tabs, use cache if available)
  useEffect(() => {
    if (!session?.accessToken) return;
    
    if (activeSidebarTab === "User Management") {
      if (adminTab === "active" && !activeUsersLoaded) {
        fetchUsers();
      } else if (adminTab === "pending" && !pendingUsersLoaded) {
        fetchPendingUsers();
      } else if (adminTab === "invitations" && !invitationsLoaded) {
        fetchInvitations();
        fetchInvitationLogs();
      }
    } else if (activeSidebarTab === "Investigators" && !investigatorsLoaded) {
      fetchInvestigators();
    } else if (activeSidebarTab === "Cases" && !adminCasesLoaded) {
      fetchAdminCases();
    }
  }, [adminTab, activeSidebarTab, activeUsersLoaded, pendingUsersLoaded, invitationsLoaded, investigatorsLoaded, adminCasesLoaded, session?.accessToken, fetchUsers, fetchPendingUsers, fetchInvitations, fetchInvestigators, fetchAdminCases]);

  // Refetch cases when search or status filter parameters change
  useEffect(() => {
    if (session?.accessToken && activeSidebarTab === "Cases") {
      fetchAdminCases(true);
    }
  }, [adminCasesSearch, adminCasesStatusFilter, adminCasesPage, session?.accessToken, activeSidebarTab]);

  // Refetch active users when active tab filters/pagination parameters change
  useEffect(() => {
    if (session?.accessToken && activeSidebarTab === "User Management" && adminTab === "active") {
      fetchUsers(true);
    }
  }, [usersPage, usersSearch, usersRoleFilter, usersStatusFilter, usersSortBy, session?.accessToken, activeSidebarTab, adminTab]);

  const handleInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.accessToken) return;
    try {
      setIsSubmitting(true);
      const res = await fetch(`${BACKEND_URL}/api/v1/admin/invitations`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.accessToken}`
        },
        body: JSON.stringify({ invitations: [inviteForm] })
      });
      if (res.ok) {
        showToast("Invitation sent successfully");
        setIsInviteModalOpen(false);
        setInviteForm({ full_name: "", email: "", phone: "" });
        fetchInvitations(true);
      } else {
        const data = await res.json();
        showToast(data.detail || "Failed to send invitation", "error");
      }
    } catch (err) {
      showToast("Error sending invitation", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpgradeUser = async (userId: number) => {
    if (!session?.accessToken) return;
    try {
      setIsSubmitting(true);
      const res = await fetch(`${BACKEND_URL}/api/v1/admin/users/${userId}/upgrade-investigator`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.accessToken}`
        }
      });
      if (res.ok) {
        showToast("Upgrade invitation sent successfully");
        fetchInvitations(true);
      } else {
        const data = await res.json();
        showToast(data.detail || "Failed to send upgrade invitation", "error");
      }
    } catch (err) {
      showToast("Error sending upgrade invitation", "error");
    } finally {
      setIsSubmitting(false);
    }
  };



  // Action - Approve User
  const handleApproveConfirm = async () => {
    if (!userToApprove || !session?.accessToken) return;
    try {
      setIsSubmitting(true);
      const res = await fetch(`${BACKEND_URL}/api/admin/users/${userToApprove.id}/approve`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.accessToken}`
        }
      });
      if (res.ok) {
        showToast("User approved successfully.", "success");
        setIsApproveModalOpen(false);
        setUserToApprove(null);
        refreshAllData();
      } else {
        const data = await res.json();
        showToast(data.detail || "Failed to approve user.", "error");
      }
    } catch (err) {
      showToast("Network error. Failed to approve user.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Action - Reject User
  const handleRejectConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userToReject || !rejectReason.trim() || !session?.accessToken) return;
    try {
      setIsSubmitting(true);
      const res = await fetch(`${BACKEND_URL}/api/admin/users/${userToReject.id}/reject`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.accessToken}`
        },
        body: JSON.stringify({ reason: rejectReason })
      });
      if (res.ok) {
        showToast("User request rejected successfully.", "success");
        setIsRejectModalOpen(false);
        setUserToReject(null);
        setRejectReason("");
        refreshAllData();
      } else {
        const data = await res.json();
        showToast(data.detail || "Failed to reject user.", "error");
      }
    } catch (err) {
      showToast("Network error. Failed to reject user.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Action - Bulk Invite Investigators
  const handleBulkInvite = async () => {
    if (!session?.accessToken) return;
    
    const validRows = bulkRows.filter(r => r.full_name.trim() !== "" && r.email.trim() !== "");
    if (validRows.length === 0) {
      showToast("Please enter at least one valid investigator to invite.", "error");
      return;
    }

    try {
      setIsSubmitting(true);
      setBulkInviteResult(null);
      const res = await fetch(`${BACKEND_URL}/api/admin/invitations`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.accessToken}`
        },
        body: JSON.stringify({ invitations: validRows })
      });
      if (res.ok) {
        const data = await res.json();
        setBulkInviteResult(data);
        showToast("Bulk invitations processed.", "success");
        setBulkRows(Array.from({ length: 5 }, createEmptyRow));
        fetchInvitations(true);
      } else {
        const data = await res.json();
        showToast(data.detail || "Failed to send invitations.", "error");
      }
    } catch (err) {
      showToast("Network error. Failed to send invitations.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Action - Edit User Modal Trigger
  const openEditModal = (user: UserType) => {
    setUserToEdit(user);
    setEditForm({
      full_name: user.full_name,
      email: user.email,
      phone: user.phone || "",
      organization: user.organization || "",
      role_id: user.role_id || 2,
      status: user.status,
      government_id: user.government_id || ""
    });
    setIsEditModalOpen(true);
  };

  // Action - Edit User Submit
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userToEdit || !session?.accessToken) return;
    try {
      setIsSubmitting(true);
      const res = await fetch(`${BACKEND_URL}/api/admin/users/${userToEdit.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.accessToken}`
        },
        body: JSON.stringify(editForm)
      });
      if (res.ok) {
        showToast("User updated successfully.", "success");
        setIsEditModalOpen(false);
        setUserToEdit(null);
        refreshAllData();
      } else {
        const data = await res.json();
        showToast(data.detail || "Failed to update user.", "error");
      }
    } catch (err) {
      showToast("Network error. Failed to update user.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Action - Quick Disable User
  const handleDisableUser = async (user: UserType) => {
    if (!session?.accessToken) return;
    try {
      const newStatus = user.status === "DISABLED" || user.status === "BLOCKED" ? "ACTIVE" : "DISABLED";
      const res = await fetch(`${BACKEND_URL}/api/admin/users/${user.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.accessToken}`
        },
        body: JSON.stringify({
          full_name: user.full_name,
          email: user.email,
          phone: user.phone,
          organization: user.organization,
          role_id: user.role_id,
          status: newStatus,
          government_id: user.government_id
        })
      });
      if (res.ok) {
        showToast(
          newStatus === "DISABLED" ? "User disabled successfully." : "User enabled successfully.",
          "success"
        );
        refreshAllData();
      } else {
        showToast("Failed to change user status.", "error");
      }
    } catch (err) {
      showToast("Network error.", "error");
    }
  };

  // Action - Delete User Confirm
  const handleDeleteConfirm = async () => {
    if (!userToDelete || !session?.accessToken) return;
    try {
      setIsSubmitting(true);
      const res = await fetch(`${BACKEND_URL}/api/admin/users/${userToDelete.id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${session.accessToken}`
        }
      });
      if (res.ok) {
        showToast("User deleted successfully.", "success");
        setIsDeleteModalOpen(false);
        setUserToDelete(null);
        refreshAllData();
      } else {
        const data = await res.json();
        showToast(data.detail || "Failed to delete user.", "error");
      }
    } catch (err) {
      showToast("Network error. Failed to delete user.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Formatting helpers
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "N/A";
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  const formatDateTime = (dateStr: string | null) => {
    if (!dateStr) return "Never";
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString(undefined, { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateStr;
    }
  };

  const formatActivityTime = (dateStr: string | null) => {
    if (!dateStr) return "Never";
    try {
      const date = new Date(dateStr);
      const isToday = new Date().toDateString() === date.toDateString();
      const datePart = isToday ? 'Today' : date.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
      const timePart = date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
      return `${datePart} • ${timePart}`;
    } catch {
      return dateStr;
    }
  };

  const getStatusBadge = (statusStr: string) => {
    const s = statusStr.toUpperCase();
    if (s === "APPROVED") {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/50">
          Approved
        </span>
      );
    }
    if (s === "ACTIVE") {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200/50">
          Active
        </span>
      );
    }
    if (s === "DISABLED" || s === "INACTIVE") {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200/50">
          Inactive
        </span>
      );
    }
    if (s === "BLOCKED") {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200/50">
          Blocked
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200/50">
        {statusStr}
      </span>
    );
  };

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-[#fafafa] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-[#CC2200]" />
          <p className="text-sm font-medium text-[#0a0a0a]/50">Loading Sentinel AI Admin portal...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fafafa] text-[#0a0a0a]" style={{ fontFamily: "Inter, system-ui, sans-serif" }}>
      
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

      {/* ─── Navbar ─── */}
      <nav className="bg-white border-b border-[#e5e5e5] shadow-sm sticky top-0 z-45">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-[#CC2200] rounded flex items-center justify-center shadow-md">
                <ShieldAlert className="h-5 w-5 text-white" />
              </div>
              <span className="font-bold text-lg tracking-tight">Sentinel AI Admin</span>
            </div>
            
            <div className="flex items-center gap-4">
              <WorkspaceSwitcher />
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

      {/* ─── Dashboard Body ─── */}
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col md:flex-row gap-8">
        
        {/* ─── Sidebar ─── */}
        <aside className="w-full md:w-64 flex-shrink-0">
          <div className="bg-white border border-[#e5e5e5] rounded-lg shadow-sm p-4 sticky top-24">
            <nav className="space-y-1">
              {[
                { icon: <Activity className="h-5 w-5" />, label: "Overview" },
                { icon: <Users className="h-5 w-5" />, label: "User Management" },
                { icon: <UserCheck className="h-5 w-5" />, label: "Investigators" },
                { icon: <Briefcase className="h-5 w-5" />, label: "Cases" },
                { icon: <ShieldAlert className="h-5 w-5" />, label: "System Alerts" },
                { icon: <FileText className="h-5 w-5" />, label: "Audit Logs" },
                { icon: <Settings className="h-5 w-5" />, label: "Configuration" },
              ].map((item) => {
                const isActive = activeSidebarTab === item.label;
                return (
                  <button
                    key={item.label}
                    onClick={() => setActiveSidebarTab(item.label as any)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-[#CC2200]/10 text-[#CC2200]"
                        : "text-[#0a0a0a]/60 hover:bg-[#fafafa] hover:text-[#0a0a0a]"
                    }`}
                  >
                    {item.icon}
                    {item.label}
                  </button>
                );
              })}
            </nav>
          </div>
        </aside>

        {/* ─── Main Content ─── */}
        <main className="flex-1 space-y-6 min-w-0 transition-opacity duration-300">
          
          {/* Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                {activeSidebarTab === "Overview" ? "System Overview" : activeSidebarTab === "Cases" ? "All Cases" : activeSidebarTab}
              </h1>
              <p className="text-sm text-[#0a0a0a]/50">
                {activeSidebarTab === "Overview" 
                  ? "Real-time portal activity and platform metrics."
                  : activeSidebarTab === "Cases"
                  ? "View and manage every investigation case in the system."
                  : activeSidebarTab === "User Management"
                  ? "Manage approved security personnel, roles, and registrations."
                  : activeSidebarTab === "Investigators"
                  ? "Review, approve, or reject new forensic investigator registration requests."
                  : `View and manage system ${activeSidebarTab.toLowerCase()}.`
                }
              </p>
            </div>
            
            {/* Search Input on Top Header (only active for Search on Active Users when Active tab is selected) */}
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#0a0a0a]/40" />
              <input 
                type="text" 
                placeholder={
                  activeSidebarTab === "User Management" && adminTab === "active"
                    ? "Search registered users..."
                    : "Search logs, users..."
                }
                value={activeSidebarTab === "User Management" && adminTab === "active" ? usersSearch : ""}
                onChange={(e) => {
                  if (activeSidebarTab === "User Management" && adminTab === "active") {
                    setUsersSearch(e.target.value);
                    setUsersPage(1);
                  }
                }}
                disabled={activeSidebarTab === "User Management" && adminTab !== "active"}
                className="pl-9 pr-4 py-2 bg-white border border-[#e5e5e5] rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#CC2200] focus:border-transparent w-full shadow-sm disabled:opacity-50"
              />
            </div>
          </div>

          {/* Tab switching content */}
          {activeSidebarTab === "Overview" && (
            <div className="space-y-6">
              {/* Stats Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: "Total Users", value: stats.totalUsers, change: "+12%", trend: "up", loading: statsLoading },
              { label: "Pending Approvals", value: stats.pendingApprovals, change: stats.pendingApprovals > 0 ? `+${stats.pendingApprovals}` : "0", trend: stats.pendingApprovals > 0 ? "neutral" : "down", loading: statsLoading },
              { label: "Active Investigations", value: stats.activeInvestigations, change: "+18%", trend: "up", loading: false },
              { label: "System Load", value: stats.systemLoad, change: "-5%", trend: "down", loading: false },
            ].map((stat, i) => (
              <div key={i} className="bg-white border border-[#e5e5e5] rounded-lg p-5 shadow-sm hover:shadow-md transition-shadow">
                <div className="text-xs font-semibold text-[#0a0a0a]/50 uppercase tracking-wider mb-2">
                  {stat.label}
                </div>
                {stat.loading ? (
                  <div className="animate-pulse flex items-end justify-between h-9">
                    <div className="h-8 w-16 bg-slate-200 rounded"></div>
                    <div className="h-4 w-8 bg-slate-200 rounded"></div>
                  </div>
                ) : (
                  <div className="flex items-end justify-between">
                    <div className="text-3xl font-bold text-[#0a0a0a]">{stat.value.toLocaleString()}</div>
                    <div className={`text-sm font-medium ${
                      stat.trend === "up" ? "text-green-600" : stat.trend === "down" ? "text-blue-600" : "text-amber-600"
                    }`}>
                      {stat.change}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
          {/* ──────────────── OVERVIEW VIEW ──────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Activity Chart */}
              <div className="bg-white border border-[#e5e5e5] rounded-lg shadow-sm col-span-2 flex flex-col justify-between">
                <div className="px-5 py-4 border-b border-[#e5e5e5] flex justify-between items-center">
                  <h2 className="font-semibold text-lg">System Activity</h2>
                  <button className="text-xs font-medium text-[#CC2200] hover:underline" onClick={() => showToast("Activity logs panel coming soon.")}>View All</button>
                </div>
                <div className="p-5 flex-1 flex items-end justify-center min-h-[200px]">
                  <div className="flex items-end gap-2 w-full h-40">
                    {[30, 45, 25, 60, 80, 50, 40, 75, 90, 65, 85, 55, 70, 95].map((h, i) => (
                      <div
                        key={i}
                        className="flex-1 rounded-t-sm bg-[#CC2200]/20 hover:bg-[#CC2200] transition-colors cursor-pointer group relative"
                        style={{ height: `${h}%` }}
                      >
                        <div className="opacity-0 group-hover:opacity-100 absolute -top-8 left-1/2 -translate-x-1/2 bg-[#0a0a0a] text-white text-[10px] py-1 px-2 rounded whitespace-nowrap z-10 pointer-events-none transition-opacity shadow">
                          {h} Events
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Quick Pending Approvals Sidebar Preview */}
              <div className="bg-white border border-[#e5e5e5] rounded-lg shadow-sm flex flex-col justify-between">
                <div>
                  <div className="px-5 py-4 border-b border-[#e5e5e5]">
                    <h2 className="font-semibold text-lg">Pending Approvals</h2>
                  </div>
                  <div className="p-0 divide-y divide-[#f0f0f0]">
                    {pendingLoading && !pendingUsersLoaded ? (
                      [1, 2, 3].map((i) => (
                        <div key={i} className="animate-pulse p-4 flex items-center justify-between">
                          <div className="space-y-2">
                            <div className="h-4 w-24 bg-slate-200 rounded"></div>
                            <div className="h-3 w-32 bg-slate-200 rounded"></div>
                          </div>
                          <div className="h-6 w-16 bg-slate-200 rounded"></div>
                        </div>
                      ))
                    ) : pendingUsers.length === 0 ? (
                      <div className="p-6 text-center text-sm text-[#0a0a0a]/40">
                        No pending approvals.
                      </div>
                    ) : (
                      pendingUsers.slice(0, 3).map((user) => (
                        <div key={user.id} className="flex items-center justify-between px-5 py-3.5 hover:bg-[#fafafa] transition-colors">
                          <div className="min-w-0 flex-1 pr-2">
                            <div className="text-sm font-semibold text-[#0a0a0a] truncate">{user.full_name}</div>
                            <div className="text-xs text-[#0a0a0a]/50 truncate">{user.organization || "No Org"} • {user.role_name}</div>
                          </div>
                          <div className="flex gap-1.5 flex-shrink-0">
                            <button 
                              onClick={() => {
                                setUserToApprove(user);
                                setIsApproveModalOpen(true);
                              }}
                              className="text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 px-2 py-1 rounded shadow-sm animate-scale-up"
                            >
                              Approve
                            </button>
                            <button 
                              onClick={() => {
                                setUserToReject(user);
                                setIsRejectModalOpen(true);
                              }}
                              className="text-xs font-semibold text-white bg-slate-500 hover:bg-slate-600 px-2 py-1 rounded shadow-sm animate-scale-up"
                            >
                              Reject
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
                <div className="px-5 py-3 border-t border-[#e5e5e5] bg-[#fafafa] text-center rounded-b-lg">
                  <button 
                    onClick={() => {
                      setActiveSidebarTab("User Management");
                      setAdminTab("pending");
                    }}
                    className="text-sm font-semibold text-[#CC2200] hover:underline"
                  >
                    View all {stats.pendingApprovals} requests
                  </button>
                </div>
              </div>
            </div>
            </div>
          )}

          {activeSidebarTab === "User Management" && (
            /* ──────────────── USER MANAGEMENT PANEL (TABBED) ──────────────── */
            <div className="space-y-6">
              
              {/* Segmented Sub-Tab Switcher directly below Title */}
              <div className="flex border-b border-[#e5e5e5]">
                <button
                  onClick={() => setAdminTab("active")}
                  className={`px-5 py-3.5 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${
                    adminTab === "active"
                      ? "border-[#CC2200] text-[#CC2200]"
                      : "border-transparent text-[#0a0a0a]/55 hover:text-[#0a0a0a] hover:border-slate-300"
                  }`}
                >
                  <Users className="h-4.5 w-4.5" />
                  Active Users ({statsLoading ? "..." : stats.activeUsersCount})
                </button>
                <button
                  onClick={() => setAdminTab("pending")}
                  className={`px-5 py-3.5 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${
                    adminTab === "pending"
                      ? "border-[#CC2200] text-[#CC2200]"
                      : "border-transparent text-[#0a0a0a]/55 hover:text-[#0a0a0a] hover:border-slate-300"
                  }`}
                >
                  <UserCheck className="h-4.5 w-4.5" />
                  Pending Requests ({statsLoading ? "..." : stats.pendingApprovals})
                </button>
              </div>

              {/* Sub-Tab Contents */}
              {adminTab === "active" ? (
                /* Tab 1: Active Users */
                <div className="bg-white border border-[#e5e5e5] rounded-lg shadow-sm animate-slide-in">
                  
                  {/* Table Controls */}
                  <div className="px-6 py-4 border-b border-[#e5e5e5] flex flex-col lg:flex-row gap-4 items-stretch lg:items-center justify-between bg-slate-50/50 rounded-t-lg">
                    <h2 className="font-bold text-lg text-[#0a0a0a]/80">Active Accounts</h2>
                    
                    {/* Filters & Sorting */}
                    <div className="flex flex-wrap items-center gap-2">
                      {/* Role Filter */}
                      <div className="flex items-center gap-1.5">
                        <Filter className="h-3.5 w-3.5 text-[#0a0a0a]/40" />
                        <select
                          value={usersRoleFilter}
                          onChange={(e) => {
                            setUsersRoleFilter(e.target.value);
                            setUsersPage(1);
                          }}
                          className="bg-white border border-[#e5e5e5] text-xs rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#CC2200]"
                        >
                          <option value="">All Roles</option>
                          <option value="1">Admin</option>
                          <option value="2">Investigator</option>
                          <option value="3">Analyst</option>
                        </select>
                      </div>

                      {/* Status Filter (Only status Approved or Active are in this tab, but they can select either) */}
                      <select
                        value={usersStatusFilter}
                        onChange={(e) => {
                          setUsersStatusFilter(e.target.value);
                          setUsersPage(1);
                        }}
                        className="bg-white border border-[#e5e5e5] text-xs rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#CC2200]"
                      >
                        <option value="">Approved & Active</option>
                        <option value="ACTIVE">Active Only</option>
                        <option value="APPROVED">Approved Only</option>
                      </select>

                      {/* Sort Order */}
                      <select
                        value={usersSortBy}
                        onChange={(e) => {
                          setUsersSortBy(e.target.value);
                          setUsersPage(1);
                        }}
                        className="bg-white border border-[#e5e5e5] text-xs rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#CC2200]"
                      >
                        <option value="newest">Sort: Newest</option>
                        <option value="oldest">Sort: ID</option>
                      </select>

                      {/* Refresh */}
                      <button
                        onClick={() => fetchUsers(true)}
                        className="p-1.5 hover:bg-slate-200 border border-[#e5e5e5] rounded-md transition-colors"
                        title="Refresh Users"
                      >
                        <Loader2 className={`h-4.5 w-4.5 text-[#0a0a0a]/60 ${usersLoading ? 'animate-spin' : ''}`} />
                      </button>
                    </div>
                  </div>

                  {/* Active Users Table */}
                  <div className="overflow-visible min-h-[300px] pb-24">
                    <table className="min-w-full divide-y divide-[#e5e5e5] text-left text-sm">
                      <thead className="bg-[#fafafa] font-semibold text-[#0a0a0a]/60 text-xs border-b border-[#e5e5e5]">
                        <tr>
                          <th className="py-2 px-4 w-14 text-center">Avatar</th>
                          <th className="py-2 px-4">Full Name</th>
                          <th className="py-2 px-4">Email Address</th>
                          <th className="py-2 px-4">Role</th>
                          <th className="py-2 px-4">Organization / Dept</th>
                          <th className="py-2 px-4 text-center">Status</th>
                          <th className="py-2 px-4">Activity</th>
                          <th className="py-2 px-4 text-center">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#f0f0f0] bg-white">
                        {usersLoading ? (
                          Array.from({ length: 5 }).map((_, i) => (
                            <tr key={i} className="animate-pulse">
                              <td className="py-2 px-4"><div className="h-12 w-12 bg-slate-200 rounded-full mx-auto"></div></td>
                              <td className="py-2 px-4"><div className="h-4 w-28 bg-slate-200 rounded"></div></td>
                              <td className="py-2 px-4"><div className="h-4 w-40 bg-slate-200 rounded"></div></td>
                              <td className="py-2 px-4"><div className="h-5 w-20 bg-slate-200 rounded-full"></div></td>
                              <td className="py-2 px-4"><div className="h-4 w-32 bg-slate-200 rounded"></div></td>
                              <td className="py-2 px-4"><div className="h-5 w-16 bg-slate-200 rounded-full mx-auto"></div></td>
                              <td className="py-2 px-4">
                                <div className="space-y-1.5">
                                  <div className="h-3 w-20 bg-slate-200 rounded"></div>
                                  <div className="h-3 w-24 bg-slate-200 rounded"></div>
                                </div>
                              </td>
                              <td className="py-2 px-4"><div className="h-6 w-6 bg-slate-200 rounded mx-auto"></div></td>
                            </tr>
                          ))
                        ) : users.length === 0 ? (
                          <tr>
                            <td colSpan={9} className="py-12 text-center text-sm text-[#0a0a0a]/40 bg-white">
                              No active or approved users found matching the query.
                            </td>
                          </tr>
                        ) : (
                          users.map((user) => (
                            <tr key={user.id} className="hover:bg-[#fafafa]/50 transition-colors">
                              <td className="py-2 px-4 text-center">
                                {user.profile_picture ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img 
                                    src={user.profile_picture} 
                                    alt={user.full_name} 
                                    className="h-12 w-12 rounded-full object-cover border border-[#e5e5e5] mx-auto shadow-xs"
                                  />
                                ) : (
                                  <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center font-bold text-sm text-blue-600 border border-slate-200 mx-auto shadow-xs">
                                    {user.full_name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                                  </div>
                                )}
                              </td>
                              <td className="py-2 px-4 font-semibold text-[#0a0a0a] whitespace-nowrap">
                                {user.full_name}
                              </td>
                              <td className="py-2 px-4 text-[#0a0a0a]/75 whitespace-nowrap group relative">
                                <span className="cursor-default">{user.email.length > 20 ? user.email.slice(0, 20) + "..." : user.email}</span>
                                {user.email.length > 20 && (
                                  <div className="absolute left-0 -top-8 hidden group-hover:block bg-gray-900 text-white text-xs px-2 py-1 rounded shadow-lg z-50 whitespace-nowrap">
                                    {user.email}
                                  </div>
                                )}
                              </td>
                              <td className="py-2 px-4 whitespace-nowrap">
                                {user.role_name.toUpperCase() === "ADMIN" ? (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700">ADMIN</span>
                                ) : user.role_name.toUpperCase() === "INVESTIGATOR" ? (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700">INVESTIGATOR</span>
                                ) : (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">USER</span>
                                )}
                              </td>
                              <td className="py-2 px-4 text-xs">
                                <div className="font-medium text-[#0a0a0a]/80 truncate max-w-[150px]">{user.organization || "—"}</div>
                                {(user as any).department && (
                                  <div className="text-[10px] text-[#0a0a0a]/50 truncate max-w-[150px]">{(user as any).department}</div>
                                )}
                              </td>
                              <td className="py-2 px-4 text-center whitespace-nowrap">
                                {getStatusBadge(user.status)}
                              </td>
                              <td className="py-2 px-4 whitespace-nowrap">
                                <div className="text-xs text-[#0a0a0a]/60">
                                  <span className="font-semibold block text-[#0a0a0a]/40 uppercase text-[10px] tracking-wider mb-0.5">Registered</span>
                                  {formatDate(user.created_at)}
                                </div>
                                <div className="text-xs text-[#0a0a0a]/60 mt-1.5">
                                  <span className="font-semibold block text-[#0a0a0a]/40 uppercase text-[10px] tracking-wider mb-0.5">Last Login</span>
                                  {formatActivityTime(user.last_login)}
                                </div>
                              </td>
                              <td className="py-2 px-4 text-right whitespace-nowrap">
                                <div className="relative group inline-block text-left">
                                  <button className="h-8 w-8 flex items-center justify-center text-slate-500 hover:text-slate-700 hover:bg-gray-100 active:bg-gray-200 rounded-full focus:outline-none transition-colors">
                                    <MoreVertical className="h-4 w-4" />
                                  </button>
                                  <div className="absolute right-0 top-full mt-1 w-[220px] bg-white rounded-xl shadow-lg border border-[#e5e5e5] p-2 opacity-0 invisible origin-top-right transform scale-95 transition-all duration-150 ease-out group-hover:opacity-100 group-hover:visible group-hover:scale-100 z-[99] flex flex-col">
                                    <button 
                                      onClick={() => { setSelectedUser(user); setIsViewDrawerOpen(true); }}
                                      className="flex items-center gap-3 px-3 h-10 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg w-full text-left transition-colors"
                                    >
                                      <Eye className="h-4 w-4 text-slate-500" /> View Profile
                                    </button>
                                    <button 
                                      onClick={() => openEditModal(user)}
                                      className="flex items-center gap-3 px-3 h-10 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg w-full text-left transition-colors"
                                    >
                                      <Edit2 className="h-4 w-4 text-slate-500" /> Edit User
                                    </button>
                                    <button 
                                      onClick={() => showToast("Password reset link sent to user.", "success")}
                                      className="flex items-center gap-3 px-3 h-10 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg w-full text-left transition-colors"
                                    >
                                      <Key className="h-4 w-4 text-slate-500" /> Reset Password
                                    </button>
                                    <button 
                                      onClick={() => handleDisableUser(user)}
                                      className="flex items-center gap-3 px-3 h-10 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg w-full text-left transition-colors"
                                    >
                                      <UserX className="h-4 w-4 text-slate-500" /> Suspend Account
                                    </button>
                                    
                                    {user.role_name === "USER" && (
                                      <button 
                                        onClick={() => handleUpgradeUser(user.id)}
                                        className="flex items-center gap-3 px-3 h-10 text-sm font-medium text-blue-700 hover:bg-blue-50 rounded-lg w-full text-left transition-colors"
                                      >
                                        <Plus className="h-4 w-4 text-blue-500" /> Upgrade to Investigator
                                      </button>
                                    )}
                                    
                                    <div className="h-px bg-slate-200 my-1 mx-1" />
                                    
                                    <button 
                                      onClick={() => { setUserToDelete(user); setIsDeleteModalOpen(true); }}
                                      className="flex items-center gap-3 px-3 h-10 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg w-full text-left transition-colors group/delete"
                                    >
                                      <Trash2 className="h-4 w-4 text-red-500 group-hover/delete:text-red-600" /> Delete User
                                    </button>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Table Pagination */}
                  <div className="px-6 py-4 border-t border-[#e5e5e5] flex items-center justify-between bg-slate-50/50 rounded-b-lg">
                    <div className="text-xs text-[#0a0a0a]/50">
                      Showing <span className="font-semibold text-[#0a0a0a]">{users.length > 0 ? (usersPage - 1) * usersLimit + 1 : 0}</span> to{" "}
                      <span className="font-semibold text-[#0a0a0a]">
                        {Math.min(usersPage * usersLimit, usersTotal)}
                      </span>{" "}
                      of <span className="font-semibold text-[#0a0a0a]">{usersTotal}</span> active users.
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setUsersPage(p => Math.max(p - 1, 1))}
                        disabled={usersPage === 1 || usersLoading}
                        className="p-1.5 border border-[#e5e5e5] rounded-md bg-white hover:bg-slate-100 disabled:opacity-50 disabled:hover:bg-white text-slate-600 transition-colors"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      <span className="text-xs font-semibold px-2 text-[#0a0a0a]/80">
                        Page {usersPage} of {Math.max(Math.ceil(usersTotal / usersLimit), 1)}
                      </span>
                      <button
                        onClick={() => setUsersPage(p => Math.min(p + 1, Math.ceil(usersTotal / usersLimit)))}
                        disabled={usersPage >= Math.ceil(usersTotal / usersLimit) || usersLoading}
                        className="p-1.5 border border-[#e5e5e5] rounded-md bg-white hover:bg-slate-100 disabled:opacity-50 disabled:hover:bg-white text-slate-600 transition-colors"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                </div>
              ) : adminTab === "pending" ? (
                /* Tab 2: Pending Approval Requests */
                <div className="bg-white border border-[#e5e5e5] rounded-lg shadow-sm animate-slide-in">
                  
                  <div className="px-6 py-4 border-b border-[#e5e5e5] bg-slate-50/50 rounded-t-lg flex justify-between items-center">
                    <h2 className="font-bold text-lg text-[#0a0a0a]/80">Applications Awaiting Approval</h2>
                    <button 
                      onClick={() => fetchPendingUsers(true)}
                      className="p-1.5 hover:bg-slate-200 border border-[#e5e5e5] rounded-md transition-colors"
                      title="Refresh Pending Requests"
                    >
                      <Loader2 className={`h-4.5 w-4.5 text-[#0a0a0a]/60 ${pendingLoading ? 'animate-spin' : ''}`} />
                    </button>
                  </div>

                  <div className="overflow-x-auto min-h-[300px]">
                    <table className="min-w-full divide-y divide-[#e5e5e5] text-left text-sm">
                      <thead className="bg-[#fafafa] font-semibold text-[#0a0a0a]/60 text-xs border-b border-[#e5e5e5]">
                        <tr>
                          <th className="py-3 px-6">Name</th>
                          <th className="py-3 px-6">Email Address</th>
                          <th className="py-3 px-6">Organization</th>
                          <th className="py-3 px-6">Requested Role</th>
                          <th className="py-3 px-6">Submitted</th>
                          <th className="py-3 px-6 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#f0f0f0] bg-white">
                        {pendingLoading ? (
                          Array.from({ length: 3 }).map((_, i) => (
                            <tr key={i} className="animate-pulse">
                              <td className="py-4 px-6"><div className="h-4 w-28 bg-slate-200 rounded"></div></td>
                              <td className="py-4 px-6"><div className="h-4 w-40 bg-slate-200 rounded"></div></td>
                              <td className="py-4 px-6"><div className="h-4 w-32 bg-slate-200 rounded"></div></td>
                              <td className="py-4 px-6"><div className="h-4 w-20 bg-slate-200 rounded"></div></td>
                              <td className="py-4 px-6"><div className="h-4 w-20 bg-slate-200 rounded"></div></td>
                              <td className="py-4 px-6 text-right"><div className="h-6 w-36 bg-slate-200 rounded ml-auto"></div></td>
                            </tr>
                          ))
                        ) : pendingUsers.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="py-12 text-center text-sm text-[#0a0a0a]/40 bg-white">
                              No pending registration requests found.
                            </td>
                          </tr>
                        ) : (
                          pendingUsers.map((user) => (
                            <tr key={user.id} className="hover:bg-[#fafafa]/50 transition-colors">
                              <td className="py-3.5 px-6 font-semibold text-[#0a0a0a]">
                                {user.full_name}
                              </td>
                              <td className="py-3.5 px-6 text-[#0a0a0a]/75">
                                {user.email}
                              </td>
                              <td className="py-3.5 px-6 text-[#0a0a0a]/75">
                                {user.organization || "—"}
                              </td>
                              <td className="py-3.5 px-6 text-xs text-[#0a0a0a]/80">
                                {user.role_name}
                              </td>
                              <td className="py-3.5 px-6 text-xs text-[#0a0a0a]/60">
                                {formatDate(user.created_at)}
                              </td>
                              <td className="py-3.5 px-6 text-right whitespace-nowrap">
                                <div className="flex items-center justify-end gap-2">
                                  <button 
                                    onClick={() => {
                                      setSelectedUser(user);
                                      setIsViewDrawerOpen(true);
                                    }}
                                    className="text-xs font-semibold px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded transition-colors shadow-xs"
                                  >
                                    View Details
                                  </button>
                                  <button 
                                    onClick={() => {
                                      setUserToApprove(user);
                                      setIsApproveModalOpen(true);
                                    }}
                                    className="text-xs font-semibold px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors shadow-xs"
                                  >
                                    Approve
                                  </button>
                                  <button 
                                    onClick={() => {
                                      setUserToReject(user);
                                      setIsRejectModalOpen(true);
                                    }}
                                    className="text-xs font-semibold px-3 py-1.5 bg-[#CC2200] hover:bg-[#CC2200]/90 text-white rounded transition-colors shadow-xs"
                                  >
                                    Reject
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                </div>
              ) : null}

            </div>
          )}

          {activeSidebarTab === "Investigators" && (
            <div className="flex flex-col gap-6 animate-slide-in">

              {/* Header */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-lg border border-[#e5e5e5] shadow-sm">
                <div>
                  <h2 className="text-2xl font-bold text-[#0a0a0a]">Investigator Management</h2>
                  <p className="text-sm text-[#0a0a0a]/60 mt-1">Manage active investigators, invite new investigators, and review pending verification requests.</p>
                </div>
                <button
                  onClick={() => setIsBulkInviteModalOpen(true)}
                  className="px-5 py-2.5 bg-[#CC2200] hover:bg-red-700 text-white font-semibold rounded-md shadow-sm transition-colors flex items-center gap-2 whitespace-nowrap"
                >
                  <Plus className="w-5 h-5" />
                  Invite Investigators
                </button>
              </div>

              {/* Tabs */}
              <div className="flex border-b border-[#e5e5e5] overflow-x-auto no-scrollbar">
                {["Active Investigators", "Pending Invitations", "Invitation Logs"].map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setInvestigatorsTab(tab as any)}
                    className={`whitespace-nowrap px-6 py-3.5 font-semibold text-sm border-b-2 transition-colors ${
                      investigatorsTab === tab
                        ? "border-[#CC2200] text-[#CC2200]"
                        : "border-transparent text-[#0a0a0a]/50 hover:text-[#0a0a0a] hover:bg-black/5"
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>
              
              {investigatorsTab === "Active Investigators" && (
                <div className="flex flex-col gap-4 animate-slide-in">

              <div className="flex flex-wrap items-center gap-3">
                <div className="relative flex-1 min-w-[250px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#0a0a0a]/40" />
                  <input
                    type="text"
                    placeholder="Search Investigator..."
                    value={investigatorsSearch}
                    onChange={(e) => setInvestigatorsSearch(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 border border-[#e5e5e5] rounded-md text-sm outline-none focus:border-[#CC2200] focus:ring-1 focus:ring-[#CC2200] transition-colors"
                  />
                </div>
                <select
                  value={investigatorsOrgFilter}
                  onChange={(e) => setInvestigatorsOrgFilter(e.target.value)}
                  className="px-3 py-2 border border-[#e5e5e5] rounded-md text-sm outline-none bg-white"
                >
                  <option value="">All Organizations</option>
                  <option value="FBI">FBI</option>
                  <option value="CIA">CIA</option>
                </select>
                <select
                  value={investigatorsDeptFilter}
                  onChange={(e) => setInvestigatorsDeptFilter(e.target.value)}
                  className="px-3 py-2 border border-[#e5e5e5] rounded-md text-sm outline-none bg-white"
                >
                  <option value="">All Departments</option>
                  <option value="Cyber">Cyber</option>
                  <option value="Forensics">Forensics</option>
                </select>
                <select
                  value={investigatorsStatusFilter}
                  onChange={(e) => setInvestigatorsStatusFilter(e.target.value)}
                  className="px-3 py-2 border border-[#e5e5e5] rounded-md text-sm outline-none bg-white"
                >
                  <option value="">All Statuses</option>
                  <option value="ACTIVE">Active</option>
                  <option value="SUSPENDED">Suspended</option>
                </select>
                <select
                  value={investigatorsSort}
                  onChange={(e) => setInvestigatorsSort(e.target.value)}
                  className="px-3 py-2 border border-[#e5e5e5] rounded-md text-sm outline-none bg-white font-medium"
                >
                  <option value="name">Sort: Name</option>
                  <option value="newest">Sort: Recently Joined</option>
                  <option value="login">Sort: Last Login</option>
                </select>
              </div>

              {/* Active Investigators Table */}
              <div className="bg-white border border-[#e5e5e5] rounded-lg shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse whitespace-nowrap">
                    <thead>
                      <tr className="border-b border-[#e5e5e5] text-xs font-bold text-[#0a0a0a]/50 uppercase tracking-wider bg-[#fafafa]/80">
                        <th className="py-3 px-6 w-12">Avatar</th>
                        <th className="py-3 px-6">Full Name</th>
                        <th className="py-3 px-6">Contact Info</th>
                        <th className="py-3 px-6">Role & Status</th>
                        <th className="py-3 px-6">Organization</th>
                        <th className="py-3 px-6 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#e5e5e5]/80 text-sm">
                      {investigatorsLoading && !investigatorsLoaded ? (
                        [1, 2, 3].map((i) => (
                          <tr key={i} className="animate-pulse">
                            <td className="py-4 px-6"><div className="w-10 h-10 rounded-full bg-slate-200" /></td>
                            <td className="py-4 px-6"><div className="h-4 w-32 bg-slate-200 rounded" /></td>
                            <td className="py-4 px-6"><div className="h-4 w-40 bg-slate-200 rounded mb-1" /><div className="h-3 w-24 bg-slate-200 rounded" /></td>
                            <td className="py-4 px-6"><div className="h-4 w-20 bg-slate-200 rounded" /></td>
                            <td className="py-4 px-6"><div className="h-4 w-28 bg-slate-200 rounded" /></td>
                            <td className="py-4 px-6 text-right"><div className="h-6 w-8 bg-slate-200 rounded ml-auto" /></td>
                          </tr>
                        ))
                      ) : investigators.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-16 text-center bg-white">
                            <div className="flex flex-col items-center justify-center max-w-sm mx-auto">
                              <Users className="h-12 w-12 text-[#0a0a0a]/20 mb-4" />
                              <h3 className="text-lg font-semibold text-[#0a0a0a]/80 mb-1">No active investigators</h3>
                              <p className="text-sm text-[#0a0a0a]/50 mb-6 text-center">No investigators have been added yet. Invite investigators to start assigning cases.</p>
                              <button
                                onClick={() => setIsBulkInviteModalOpen(true)}
                                className="px-4 py-2 bg-[#CC2200] hover:bg-red-700 text-white font-semibold rounded-md shadow-sm transition-colors flex items-center gap-2"
                              >
                                <Plus className="w-4 h-4" />
                                Invite Investigators
                              </button>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        investigators.map((inv) => (
                          <tr key={inv.id} className="hover:bg-[#fafafa]/50 transition-colors">
                            <td className="py-3 px-6">
                              {inv.profile_picture ? (
                                <img src={inv.profile_picture} alt={inv.full_name} className="w-10 h-10 rounded-full object-cover border border-[#e5e5e5]" />
                              ) : (
                                <div className="w-10 h-10 rounded-full bg-[#CC2200]/10 text-[#CC2200] flex items-center justify-center font-bold text-sm">
                                  {inv.full_name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)}
                                </div>
                              )}
                            </td>
                            <td className="py-3 px-6 font-semibold text-[#0a0a0a]">{inv.full_name}</td>
                            <td className="py-3 px-6">
                              <div className="text-[#0a0a0a]/80">{inv.email}</div>
                              {inv.phone && <div className="text-xs text-[#0a0a0a]/50 mt-0.5">{inv.phone}</div>}
                            </td>
                            <td className="py-3 px-6">
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-blue-50 text-blue-700 mb-1">Investigator</span>
                              <br />
                              <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${inv.status === "ACTIVE" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
                                {inv.status}
                              </span>
                            </td>
                            <td className="py-3 px-6">
                              <div className="text-sm font-medium">{inv.organization || "-"}</div>
                              <div className="text-xs text-[#0a0a0a]/50 mt-0.5">{inv.department || "-"}</div>
                            </td>
                            <td className="py-3 px-6 text-right relative">
                              <button onClick={() => openEditModal(inv)} className="text-xs font-semibold px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded transition-colors shadow-xs">
                                Edit Investigator
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}


              {investigatorsTab === "Pending Invitations" && (
                <div className="bg-white border border-[#e5e5e5] rounded-lg shadow-sm animate-slide-in">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                      <thead className="bg-[#fafafa] text-[#0a0a0a]/50 uppercase text-[11px] font-bold tracking-wider border-b border-[#e5e5e5]">
                        <tr>
                          <th className="py-3 px-6">Name</th>
                          <th className="py-3 px-6">Email</th>
                          <th className="py-3 px-6">Status</th>
                          <th className="py-3 px-6">Sent On</th>
                          <th className="py-3 px-6">Expires On</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#f0f0f0] bg-white">
                        {invitationsLoading ? (
                          Array.from({ length: 3 }).map((_, i) => (
                            <tr key={i} className="animate-pulse">
                              <td className="py-4 px-6"><div className="h-4 w-32 bg-slate-200 rounded"></div></td>
                              <td className="py-4 px-6"><div className="h-4 w-40 bg-slate-200 rounded"></div></td>
                              <td className="py-4 px-6"><div className="h-4 w-20 bg-slate-200 rounded"></div></td>
                              <td className="py-4 px-6"><div className="h-4 w-24 bg-slate-200 rounded"></div></td>
                              <td className="py-4 px-6"><div className="h-4 w-24 bg-slate-200 rounded"></div></td>
                            </tr>
                          ))
                        ) : invitations.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="py-12 text-center text-sm text-[#0a0a0a]/40 bg-white">
                              No pending invitations found.
                            </td>
                          </tr>
                        ) : (
                          invitations.map((inv) => (
                            <tr key={inv.id} className="hover:bg-[#fafafa]/50 transition-colors">
                              <td className="py-3.5 px-6 font-semibold text-[#0a0a0a]">{inv.full_name}</td>
                              <td className="py-3.5 px-6 text-[#0a0a0a]/75">{inv.email}</td>
                              <td className="py-3.5 px-6">
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${inv.status === "Cancelled" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"} border border-black/5`}>
                                  {inv.status}
                                </span>
                              </td>
                              <td className="py-3.5 px-6 text-xs text-[#0a0a0a]/60">{formatDate(inv.created_at)}</td>
                              <td className="py-3.5 px-6 text-xs text-[#0a0a0a]/60">{formatDate(inv.expires_at)}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}


              {investigatorsTab === "Invitation Logs" && (
                <div className="flex flex-col gap-4 animate-slide-in">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex gap-2">
                      <button onClick={handleResendSelected} disabled={selectedLogs.length === 0} className={`px-4 py-2 text-sm font-semibold rounded shadow-sm transition-colors flex items-center gap-2 ${selectedLogs.length > 0 ? "bg-[#CC2200] hover:bg-red-700 text-white" : "bg-slate-100 text-slate-400 cursor-not-allowed"}`}>
                        <Send className="w-4 h-4" /> Resend Selected
                      </button>
                      <button onClick={handleCancelSelected} disabled={selectedLogs.length === 0} className={`px-4 py-2 text-sm font-semibold rounded shadow-sm transition-colors flex items-center gap-2 ${selectedLogs.length > 0 ? "bg-slate-200 hover:bg-slate-300 text-slate-800" : "bg-slate-100 text-slate-400 cursor-not-allowed"}`}>
                        <Trash2 className="w-4 h-4" /> Cancel Selected
                      </button>
                      <button onClick={handleExportCSV} className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-sm font-semibold rounded shadow-sm transition-colors flex items-center gap-2">
                        <Download className="w-4 h-4" /> Export CSV
                      </button>
                    </div>
                  </div>
                  <div className="bg-white border border-[#e5e5e5] rounded-lg shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead className="bg-[#fafafa] text-[#0a0a0a]/50 uppercase text-[11px] font-bold tracking-wider border-b border-[#e5e5e5]">
                          <tr>
                            <th className="py-3 px-6"><input type="checkbox" checked={selectedLogs.length > 0 && selectedLogs.length === invitationLogs.length} onChange={handleSelectAllLogs} className="rounded text-[#CC2200] focus:ring-[#CC2200]"/></th>
                            <th className="py-3 px-6">ID</th>
                            <th className="py-3 px-6">Recipient</th>
                            <th className="py-3 px-6">Event Type</th>
                            <th className="py-3 px-6">Status</th>
                            <th className="py-3 px-6">Sent At</th>
                            <th className="py-3 px-6 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#f0f0f0] bg-white">
                          {invitationLogsLoading ? (
                            Array.from({ length: 5 }).map((_, i) => (
                              <tr key={i} className="animate-pulse">
                                <td className="py-4 px-6"><div className="h-4 w-4 bg-slate-200 rounded"></div></td>
                                <td className="py-4 px-6"><div className="h-4 w-8 bg-slate-200 rounded"></div></td>
                                <td className="py-4 px-6"><div className="h-4 w-32 bg-slate-200 rounded"></div></td>
                                <td className="py-4 px-6"><div className="h-4 w-24 bg-slate-200 rounded"></div></td>
                                <td className="py-4 px-6"><div className="h-4 w-16 bg-slate-200 rounded"></div></td>
                                <td className="py-4 px-6"><div className="h-4 w-24 bg-slate-200 rounded"></div></td>
                                <td className="py-4 px-6"><div className="h-4 w-8 bg-slate-200 rounded ml-auto"></div></td>
                              </tr>
                            ))
                          ) : invitationLogs.length === 0 ? (
                            <tr>
                              <td colSpan={7} className="py-12 text-center text-sm text-[#0a0a0a]/40">
                                No invitation logs found.
                              </td>
                            </tr>
                          ) : (
                            invitationLogs.map((log) => (
                              <tr key={log.id} className="hover:bg-[#fafafa]/50 transition-colors">
                                <td className="py-3.5 px-6">
                                  <input type="checkbox" checked={selectedLogs.includes(log.id)} onChange={() => handleSelectLog(log.id)} className="rounded text-[#CC2200] focus:ring-[#CC2200]"/>
                                </td>
                                <td className="py-3.5 px-6 font-mono text-xs text-[#0a0a0a]/60">#{log.id}</td>
                                <td className="py-3.5 px-6 font-semibold text-[#0a0a0a]">{log.recipient_email}</td>
                                <td className="py-3.5 px-6 text-[#0a0a0a]/80">{log.event_type}</td>
                                <td className="py-3.5 px-6">
                                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${log.status === "SUCCESS" ? "bg-emerald-50 text-emerald-700 border border-emerald-200/50" : "bg-red-50 text-red-700 border border-red-200/50"}`}>
                                    {log.status}
                                  </span>
                                </td>
                                <td className="py-3.5 px-6 text-xs text-[#0a0a0a]/60">{formatDate(log.created_at)}</td>
                                <td className="py-3.5 px-6 text-right">
                                  <button onClick={() => { setSelectedLog(log); setIsLogDrawerOpen(true); }} className="text-[#0a0a0a]/40 hover:text-[#0a0a0a] transition-colors p-1">
                                    <Eye className="w-4 h-4" />
                                  </button>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

            </div>
          )}

          {activeSidebarTab === "Cases" && (
            <div className="space-y-6">
              {selectedAdminCaseId && adminCaseDetail ? (
                /* ──────────────── INDIVIDUAL CASE DETAILS VIEW ──────────────── */
                <div className="space-y-6">
                  {/* Top Bar / Navigation */}
                  <div className="flex items-center justify-between pb-2 border-b border-[#e5e5e5]">
                    <button
                      onClick={() => {
                        setSelectedAdminCaseId(null);
                        setAdminCaseDetail(null);
                      }}
                      className="inline-flex items-center gap-2 text-sm font-semibold text-[#0a0a0a]/60 hover:text-[#CC2200] transition-colors"
                    >
                      <ArrowLeft className="h-4 w-4" />
                      Back to All Cases
                    </button>
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-xs font-bold text-[#CC2200] bg-[#CC2200]/10 px-2.5 py-1 rounded">
                        {adminCaseDetail.case_number}
                      </span>
                      {getCaseStatusBadge(adminCaseDetail.status)}
                    </div>
                  </div>

                  {/* Main Header Information */}
                  <div className="bg-white border border-[#e5e5e5] rounded-lg p-6 shadow-sm">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-[#f0f0f0] pb-5">
                      <div>
                        <div className="text-xs font-semibold text-[#0a0a0a]/40 uppercase tracking-wider mb-1">
                          Case ID: {adminCaseDetail.case_number}
                        </div>
                        <h2 className="text-2xl font-bold text-[#0a0a0a]">
                          {adminCaseDetail.title}
                        </h2>
                      </div>
                      <div className="flex items-center gap-2">
                        {getCaseStatusBadge(adminCaseDetail.status)}
                      </div>
                    </div>

                    <div className="mt-5">
                      <h3 className="text-xs font-bold uppercase text-[#0a0a0a]/40 mb-2 tracking-wider">
                        Full Case Description
                      </h3>
                      <p className="text-sm text-[#0a0a0a]/80 leading-relaxed bg-[#fafafa] p-4 rounded-md border border-[#e5e5e5]/60">
                        {adminCaseDetail.description || "No detailed description provided for this investigation case."}
                      </p>
                    </div>

                    {/* Quick Specs Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-5 border-t border-[#f0f0f0]">
                      <div>
                        <span className="block text-xs font-semibold text-[#0a0a0a]/40 uppercase tracking-wider mb-1">
                          Case Filed Date
                        </span>
                        <span className="text-sm font-bold text-[#0a0a0a]">
                          {formatDate(adminCaseDetail.submitted_at || adminCaseDetail.created_at)}
                        </span>
                      </div>
                      <div>
                        <span className="block text-xs font-semibold text-[#0a0a0a]/40 uppercase tracking-wider mb-1">
                          Assigned Investigator
                        </span>
                        <span className="text-sm font-bold text-[#0a0a0a]">
                          {adminCaseDetail.assigned_expert_name || "Unassigned"}
                        </span>
                      </div>
                      <div>
                        <span className="block text-xs font-semibold text-[#0a0a0a]/40 uppercase tracking-wider mb-1">
                          Filed By
                        </span>
                        <span className="text-sm font-bold text-[#0a0a0a]">
                          {adminCaseDetail.creator_name || "Anonymous Reporter"}
                        </span>
                      </div>
                      <div>
                        <span className="block text-xs font-semibold text-[#0a0a0a]/40 uppercase tracking-wider mb-1">
                          Evidence Count
                        </span>
                        <span className="text-sm font-bold text-[#0a0a0a]">
                          {adminCaseDetail.evidence ? adminCaseDetail.evidence.length : 0} Files
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Evidence Files Section */}
                  <div className="bg-white border border-[#e5e5e5] rounded-lg shadow-sm">
                    <div className="px-6 py-4 border-b border-[#e5e5e5] flex justify-between items-center bg-[#fafafa]/50">
                      <h3 className="font-bold text-base text-[#0a0a0a]">
                        Case Evidence ({adminCaseDetail.evidence ? adminCaseDetail.evidence.length : 0})
                      </h3>
                    </div>
                    <div className="p-6">
                      {!adminCaseDetail.evidence || adminCaseDetail.evidence.length === 0 ? (
                        <p className="text-sm text-[#0a0a0a]/50 text-center py-6">
                          No evidence files have been attached to this case.
                        </p>
                      ) : (
                        <div className="space-y-3">
                          {adminCaseDetail.evidence.map((file: any) => (
                            <div key={file.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 bg-[#fafafa] border border-[#e5e5e5] rounded-lg gap-4">
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="w-10 h-10 rounded bg-[#CC2200]/10 text-[#CC2200] flex items-center justify-center flex-shrink-0 font-bold text-xs uppercase">
                                  {file.file_type || "FILE"}
                                </div>
                                <div className="min-w-0">
                                  <div className="text-sm font-bold text-[#0a0a0a] truncate">{file.original_name || file.file_name}</div>
                                  <div className="text-xs text-[#0a0a0a]/50 flex items-center gap-3 mt-0.5">
                                    <span>SHA-256: {file.sha256_hash ? `${file.sha256_hash.substring(0, 16)}...` : "N/A"}</span>
                                    <span>Uploaded: {formatDate(file.upload_time)}</span>
                                  </div>
                                </div>
                              </div>
                              <span className="text-xs font-medium px-2.5 py-1 bg-white border border-[#e5e5e5] rounded text-[#0a0a0a]/70">
                                {file.file_size ? (file.file_size / (1024 * 1024)).toFixed(2) : "0.00"} MB
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Case Activity & History */}
                  <div className="bg-white border border-[#e5e5e5] rounded-lg shadow-sm">
                    <div className="px-6 py-4 border-b border-[#e5e5e5] bg-[#fafafa]/50">
                      <h3 className="font-bold text-base text-[#0a0a0a]">Case Activity & Audit History</h3>
                    </div>
                    <div className="p-6">
                      {!adminCaseDetail.audit_logs || adminCaseDetail.audit_logs.length === 0 ? (
                        <p className="text-sm text-[#0a0a0a]/50 text-center py-6">
                          No activity records logged for this case yet.
                        </p>
                      ) : (
                        <div className="relative border-l-2 border-[#e5e5e5] ml-3 space-y-6 pl-6">
                          {adminCaseDetail.audit_logs.map((log: any) => (
                            <div key={log.id} className="relative group">
                              <div className="absolute -left-[31px] top-1 w-3 h-3 rounded-full bg-[#CC2200] border-2 border-white ring-2 ring-[#e5e5e5]" />
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-bold text-[#0a0a0a]">{log.action}</span>
                                  <span className="text-xs text-[#0a0a0a]/40">• {formatActivityTime(log.timestamp)}</span>
                                </div>
                                <p className="text-xs text-[#0a0a0a]/60 mt-1">{log.description}</p>
                                <div className="text-[11px] text-[#0a0a0a]/40 mt-1">Performed by: {log.user_name || "System"}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : adminCaseDetailLoading ? (
                <div className="p-16 flex flex-col items-center justify-center bg-white border border-[#e5e5e5] rounded-lg shadow-sm">
                  <Loader2 className="h-8 w-8 animate-spin text-[#CC2200] mb-3" />
                  <p className="text-sm text-[#0a0a0a]/50 font-medium">Loading case details...</p>
                </div>
              ) : (
                /* ──────────────── ALL CASES LIST VIEW ──────────────── */
                <div className="space-y-6">
                  {/* Search and Status Filter Bar */}
                  <div className="bg-white border border-[#e5e5e5] rounded-lg p-4 shadow-sm flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
                    {/* Search Field */}
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#0a0a0a]/40" />
                      <input
                        type="text"
                        placeholder="Search cases..."
                        value={adminCasesSearch}
                        onChange={(e) => {
                          setAdminCasesSearch(e.target.value);
                          setAdminCasesPage(1);
                        }}
                        className="pl-9 pr-4 py-2.5 bg-white border border-[#e5e5e5] rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#CC2200] focus:border-transparent w-full shadow-sm"
                      />
                    </div>

                    {/* Status Filter */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-xs font-bold text-[#0a0a0a]/50 uppercase tracking-wider hidden sm:inline">Status:</span>
                      <div className="flex items-center gap-1 bg-[#fafafa] border border-[#e5e5e5] p-1 rounded-md">
                        {["All", "Pending", "Assigned", "Under Investigation", "Completed"].map((statusOption) => {
                          const isActive = adminCasesStatusFilter === statusOption;
                          return (
                            <button
                              key={statusOption}
                              onClick={() => {
                                setAdminCasesStatusFilter(statusOption);
                                setAdminCasesPage(1);
                              }}
                              className={`px-3 py-1.5 rounded text-xs font-semibold transition-all ${
                                isActive
                                  ? "bg-[#CC2200] text-white shadow-sm"
                                  : "text-[#0a0a0a]/60 hover:text-[#0a0a0a] hover:bg-white"
                              }`}
                            >
                              {statusOption}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Horizontal Case Cards List */}
                  {adminCasesLoading ? (
                    <div className="space-y-4">
                      {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="bg-white border border-[#e5e5e5] rounded-lg p-5 shadow-sm animate-pulse space-y-3">
                          <div className="flex justify-between items-center">
                            <div className="h-4 w-28 bg-slate-200 rounded" />
                            <div className="h-5 w-24 bg-slate-200 rounded-full" />
                          </div>
                          <div className="h-6 w-3/4 bg-slate-200 rounded" />
                          <div className="h-4 w-full bg-slate-200 rounded" />
                          <div className="flex justify-between items-center pt-3 border-t border-[#f0f0f0]">
                            <div className="h-4 w-40 bg-slate-200 rounded" />
                            <div className="h-8 w-24 bg-slate-200 rounded" />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : adminCasesError ? (
                    <div className="bg-white border border-[#e5e5e5] rounded-lg p-12 text-center text-[#0a0a0a]/50 shadow-sm">
                      <AlertCircle className="h-12 w-12 mx-auto mb-3 text-amber-500" />
                      <h3 className="text-base font-bold text-[#0a0a0a]/80">Unable to load cases. Please try again.</h3>
                      <p className="text-xs text-[#0a0a0a]/50 mt-1 mb-4">An error occurred while fetching investigation cases from the server.</p>
                      <button
                        onClick={() => fetchAdminCases(true)}
                        className="px-4 py-2 bg-[#CC2200] text-white rounded text-xs font-bold hover:bg-[#b31e00] transition-colors shadow-sm"
                      >
                        Retry
                      </button>
                    </div>
                  ) : adminCases.length === 0 ? (
                    <div className="bg-white border border-[#e5e5e5] rounded-lg p-12 text-center text-[#0a0a0a]/50 shadow-sm">
                      <Briefcase className="h-12 w-12 mx-auto mb-3 text-[#0a0a0a]/30" />
                      <h3 className="text-base font-bold text-[#0a0a0a]/80">No investigation cases found</h3>
                      <p className="text-xs text-[#0a0a0a]/50 mt-1">
                        {adminCasesSearch || adminCasesStatusFilter !== "All"
                          ? "Try adjusting your search criteria or status filter."
                          : "No cases have been submitted to the platform yet."}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {adminCases.map((c) => (
                        <div
                          key={c.id}
                          className="bg-white border border-[#e5e5e5] rounded-lg p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between group"
                        >
                          <div>
                            {/* Card Top Row: Case ID & Status Badge */}
                            <div className="flex items-center justify-between gap-3 mb-2">
                              <span className="font-mono text-xs font-bold text-[#CC2200] bg-[#CC2200]/10 px-2.5 py-0.5 rounded tracking-wider">
                                {c.case_number}
                              </span>
                              {getCaseStatusBadge(c.status)}
                            </div>

                            {/* Case Title */}
                            <h3 className="text-lg font-bold text-[#0a0a0a] group-hover:text-[#CC2200] transition-colors line-clamp-1">
                              {c.title}
                            </h3>

                            {/* Short Case Description */}
                            <p className="text-sm text-[#0a0a0a]/60 mt-1 line-clamp-2 leading-relaxed">
                              {c.description || "No description provided."}
                            </p>
                          </div>

                          {/* Card Footer Metadata & View Case Button */}
                          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-4 mt-4 border-t border-[#f0f0f0] text-xs text-[#0a0a0a]/60">
                            <div className="flex flex-wrap items-center gap-4">
                              <span>
                                <strong className="font-semibold text-[#0a0a0a]/80">Filed:</strong> {formatDate(c.submitted_at || c.created_at)}
                              </span>
                              <span>
                                <strong className="font-semibold text-[#0a0a0a]/80">Investigator:</strong> {c.assigned_expert_name || "Unassigned"}
                              </span>
                            </div>

                            <button
                              onClick={() => {
                                setSelectedAdminCaseId(c.id);
                                fetchAdminCaseDetail(c.id);
                              }}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-bold bg-[#CC2200] text-white hover:bg-[#b31e00] transition-all shadow-sm flex-shrink-0"
                            >
                              View Case <ArrowRight className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {activeSidebarTab === "System Alerts" && (
            <div className="bg-white border border-[#e5e5e5] rounded-lg shadow-sm p-12 text-center text-[#0a0a0a]/50">
              <ShieldAlert className="h-12 w-12 mx-auto mb-4 text-[#0a0a0a]/30" />
              <h2 className="text-lg font-semibold text-[#0a0a0a]/70">System Alerts</h2>
              <p className="mt-1 text-sm">Alerts interface is currently under construction.</p>
            </div>
          )}

          {activeSidebarTab === "Audit Logs" && (
            <div className="bg-white border border-[#e5e5e5] rounded-lg shadow-sm p-12 text-center text-[#0a0a0a]/50">
              <FileText className="h-12 w-12 mx-auto mb-4 text-[#0a0a0a]/30" />
              <h2 className="text-lg font-semibold text-[#0a0a0a]/70">Audit Logs</h2>
              <p className="mt-1 text-sm">Audit logs table is currently under construction.</p>
            </div>
          )}

          {activeSidebarTab === "Configuration" && (
            <div className="bg-white border border-[#e5e5e5] rounded-lg shadow-sm p-12 text-center text-[#0a0a0a]/50">
              <Settings className="h-12 w-12 mx-auto mb-4 text-[#0a0a0a]/30" />
              <h2 className="text-lg font-semibold text-[#0a0a0a]/70">Configuration</h2>
              <p className="mt-1 text-sm">Settings interface is currently under construction.</p>
            </div>
          )}

        </main>
      </div>

      {/* ──────────────── MODALS & DRAWERS ──────────────── */}


      {/* Invitation Log Details Drawer */}
      <div className={`fixed inset-y-0 right-0 w-full max-w-md bg-white shadow-2xl z-[150] transform transition-transform duration-300 ease-in-out ${isLogDrawerOpen ? "translate-x-0" : "translate-x-full"} flex flex-col border-l border-[#e5e5e5]`}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#e5e5e5] bg-slate-50">
          <h2 className="text-lg font-bold text-[#0a0a0a]">Log Details</h2>
          <button onClick={() => setIsLogDrawerOpen(false)} className="p-2 hover:bg-[#e5e5e5] rounded-full transition-colors text-[#0a0a0a]/50">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {selectedLog && (
            <>
              <div>
                <h3 className="text-xs font-bold uppercase text-[#0a0a0a]/40 mb-3 tracking-wider">Invitation Information</h3>
                <div className="space-y-3 bg-[#fafafa] p-4 rounded-lg border border-[#e5e5e5]">
                  <div className="flex justify-between items-center"><span className="text-sm font-medium text-[#0a0a0a]/60">Log ID</span><span className="text-sm font-mono text-[#0a0a0a]">#{selectedLog.id}</span></div>
                  <div className="flex justify-between items-center"><span className="text-sm font-medium text-[#0a0a0a]/60">Invitation ID</span><span className="text-sm font-mono text-[#0a0a0a]">#{selectedLog.invitation_id}</span></div>
                  <div className="flex justify-between items-center"><span className="text-sm font-medium text-[#0a0a0a]/60">Event Type</span><span className="text-sm font-medium text-[#0a0a0a]">{selectedLog.event_type}</span></div>
                  <div className="flex justify-between items-center"><span className="text-sm font-medium text-[#0a0a0a]/60">Status</span>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${selectedLog.status === "SUCCESS" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                      {selectedLog.status}
                    </span>
                  </div>
                </div>
              </div>
              
              <div>
                <h3 className="text-xs font-bold uppercase text-[#0a0a0a]/40 mb-3 tracking-wider">Recipient Details</h3>
                <div className="space-y-3 bg-[#fafafa] p-4 rounded-lg border border-[#e5e5e5]">
                  <div className="flex justify-between items-center"><span className="text-sm font-medium text-[#0a0a0a]/60">Email</span><span className="text-sm font-medium text-[#0a0a0a]">{selectedLog.recipient_email}</span></div>
                </div>
              </div>

              <div>
                <h3 className="text-xs font-bold uppercase text-[#0a0a0a]/40 mb-3 tracking-wider">Audit Trail</h3>
                <div className="space-y-3 bg-[#fafafa] p-4 rounded-lg border border-[#e5e5e5]">
                  <div className="flex justify-between items-center"><span className="text-sm font-medium text-[#0a0a0a]/60">Performed By (ID)</span><span className="text-sm font-medium text-[#0a0a0a]">{selectedLog.performed_by || "System"}</span></div>
                  <div className="flex justify-between items-center"><span className="text-sm font-medium text-[#0a0a0a]/60">Created At</span><span className="text-sm font-medium text-[#0a0a0a]">{formatDate(selectedLog.created_at)}</span></div>
                  <div className="flex justify-between items-center"><span className="text-sm font-medium text-[#0a0a0a]/60">IP Address</span><span className="text-sm font-medium text-[#0a0a0a]">{selectedLog.ip_address || "N/A"}</span></div>
                  <div className="flex flex-col gap-1 mt-2">
                    <span className="text-sm font-medium text-[#0a0a0a]/60">Message</span>
                    <p className="text-xs text-[#0a0a0a] bg-white p-2 rounded border border-[#e5e5e5]">{selectedLog.message}</p>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Bulk Invite Modal */}
      {isBulkInviteModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setIsBulkInviteModalOpen(false)} />
          <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl overflow-hidden relative animate-scale-up max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-[#e5e5e5] flex justify-between items-center bg-slate-50/50">
              <div>
                <h3 className="text-lg font-bold">Invite Investigators</h3>
                <p className="text-xs text-[#0a0a0a]/60 mt-1">Enter details for one or more investigators to send bulk invitations.</p>
              </div>
              <button onClick={() => { setIsBulkInviteModalOpen(false); setBulkInviteResult(null); }} className="text-[#0a0a0a]/40 hover:text-[#0a0a0a]">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-1 bg-[#fafafa]">
              {bulkInviteResult ? (
                <div className="bg-white p-6 rounded-lg border border-[#e5e5e5] text-center max-w-sm mx-auto">
                  <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle className="w-6 h-6" />
                  </div>
                  <h4 className="font-bold text-lg mb-2">Invitations Processed</h4>
                  <div className="space-y-2 text-sm text-[#0a0a0a]/80 mb-6">
                    <div className="flex justify-between"><span>Sent:</span><span className="font-bold text-emerald-600">{bulkInviteResult.sent}</span></div>
                    {bulkInviteResult.skipped_existing > 0 && <div className="flex justify-between"><span>Skipped (Existing Users):</span><span className="font-bold text-amber-600">{bulkInviteResult.skipped_existing}</span></div>}
                    {bulkInviteResult.skipped_pending > 0 && <div className="flex justify-between"><span>Skipped (Already Pending):</span><span className="font-bold text-amber-600">{bulkInviteResult.skipped_pending}</span></div>}
                    {bulkInviteResult.skipped_duplicate > 0 && <div className="flex justify-between"><span>Skipped (Duplicates in List):</span><span className="font-bold text-amber-600">{bulkInviteResult.skipped_duplicate}</span></div>}
                  </div>
                  <button onClick={() => { setIsBulkInviteModalOpen(false); setBulkInviteResult(null); }} className="w-full px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded font-medium transition-colors">
                    Close
                  </button>
                </div>
              ) : (
                <div className="bg-white border border-[#e5e5e5] rounded-lg shadow-sm overflow-hidden">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-[#e5e5e5] bg-slate-50 text-xs font-bold text-[#0a0a0a]/60 uppercase tracking-wider">
                        <th className="py-3 px-4">Full Name</th>
                        <th className="py-3 px-4">Official Email</th>
                        <th className="py-3 px-4">Phone Number (Optional)</th>
                        <th className="py-3 px-4 w-12 text-center"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#e5e5e5]">
                      {bulkRows.map((row) => (
                        <tr key={row.id}>
                          <td className="p-2">
                            <input
                              type="text"
                              placeholder="Jane Doe"
                              value={row.full_name}
                              onChange={(e) => {
                                setBulkRows(prev => prev.map(r => r.id === row.id ? { ...r, full_name: e.target.value } : r));
                              }}
                              className="w-full px-3 py-2 border border-transparent hover:border-[#e5e5e5] focus:border-[#CC2200] focus:ring-1 focus:ring-[#CC2200] rounded-md text-sm outline-none bg-transparent transition-all"
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="email"
                              placeholder="jane@agency.gov"
                              value={row.email}
                              onChange={(e) => {
                                setBulkRows(prev => prev.map(r => r.id === row.id ? { ...r, email: e.target.value } : r));
                              }}
                              className={`w-full px-3 py-2 border border-transparent hover:border-[#e5e5e5] focus:border-[#CC2200] focus:ring-1 focus:ring-[#CC2200] rounded-md text-sm outline-none bg-transparent transition-all ${row.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email) ? 'border-red-300 bg-red-50 text-red-900 focus:border-red-500 focus:ring-red-500' : ''}`}
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="text"
                              placeholder="+1 234 567 8900"
                              value={row.phone}
                              onChange={(e) => {
                                setBulkRows(prev => prev.map(r => r.id === row.id ? { ...r, phone: e.target.value } : r));
                              }}
                              className="w-full px-3 py-2 border border-transparent hover:border-[#e5e5e5] focus:border-[#CC2200] focus:ring-1 focus:ring-[#CC2200] rounded-md text-sm outline-none bg-transparent transition-all"
                            />
                          </td>
                          <td className="p-2 text-center">
                            <button
                              onClick={() => {
                                setBulkRows(prev => {
                                  const filtered = prev.filter(r => r.id !== row.id);
                                  return filtered.length ? filtered : [createEmptyRow()];
                                });
                              }}
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                              title="Remove Row"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="p-3 border-t border-[#e5e5e5] bg-slate-50">
                    <button
                      onClick={() => setBulkRows(prev => [...prev, createEmptyRow()])}
                      className="text-sm font-semibold text-[#CC2200] hover:text-red-700 flex items-center gap-1.5 px-3 py-1.5 rounded hover:bg-red-50 transition-colors"
                    >
                      <Plus className="w-4 h-4" /> Add Another Row
                    </button>
                  </div>
                </div>
              )}
            </div>
            {!bulkInviteResult && (
              <div className="px-6 py-4 border-t border-[#e5e5e5] bg-white flex justify-end items-center gap-3">
                <button
                  type="button"
                  onClick={() => setIsBulkInviteModalOpen(false)}
                  className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-md transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleBulkInvite}
                  disabled={isSubmitting || bulkRows.filter(r => r.full_name.trim() && r.email.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r.email)).length === 0}
                  className="px-6 py-2 bg-[#CC2200] hover:bg-red-700 text-white font-semibold rounded-md shadow-sm transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Send Invitations ({bulkRows.filter(r => r.full_name.trim() && r.email.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r.email)).length})
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Invite Modal */}
      {isInviteModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setIsInviteModalOpen(false)} />
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden relative animate-scale-up">
            <div className="px-6 py-4 border-b border-[#e5e5e5] flex justify-between items-center bg-slate-50/50">
              <h3 className="text-lg font-bold">Invite Investigator</h3>
              <button onClick={() => setIsInviteModalOpen(false)} className="text-[#0a0a0a]/40 hover:text-[#0a0a0a]">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleInviteSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-[#0a0a0a]/80 mb-1.5">Full Name</label>
                <input
                  type="text"
                  required
                  className="w-full px-3 py-2 bg-white border border-[#e5e5e5] rounded-md focus:outline-none focus:ring-2 focus:ring-[#CC2200]/20 focus:border-[#CC2200] transition-colors"
                  value={inviteForm.full_name}
                  onChange={e => setInviteForm({ ...inviteForm, full_name: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-[#0a0a0a]/80 mb-1.5">Email Address</label>
                <input
                  type="email"
                  required
                  className="w-full px-3 py-2 bg-white border border-[#e5e5e5] rounded-md focus:outline-none focus:ring-2 focus:ring-[#CC2200]/20 focus:border-[#CC2200] transition-colors"
                  value={inviteForm.email}
                  onChange={e => setInviteForm({ ...inviteForm, email: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-[#0a0a0a]/80 mb-1.5">Phone Number (Optional)</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 bg-white border border-[#e5e5e5] rounded-md focus:outline-none focus:ring-2 focus:ring-[#CC2200]/20 focus:border-[#CC2200] transition-colors"
                  value={inviteForm.phone}
                  onChange={e => setInviteForm({ ...inviteForm, phone: e.target.value })}
                />
              </div>
              <div className="pt-4 flex justify-end gap-3 border-t border-[#e5e5e5]">
                <button type="button" onClick={() => setIsInviteModalOpen(false)} className="px-4 py-2 text-sm font-semibold text-[#0a0a0a]/60 hover:bg-slate-100 rounded transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={isSubmitting} className="px-4 py-2 bg-[#CC2200] hover:bg-red-700 text-white text-sm font-semibold rounded shadow-sm transition-colors flex items-center gap-2">
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Send Invitation"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 1. View User details side drawer */}
      {isViewDrawerOpen && selectedUser && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
            onClick={() => setIsViewDrawerOpen(false)}
          />
          {/* Drawer Box */}
          <div className="relative w-full max-w-lg bg-white h-full shadow-2xl flex flex-col animate-slide-left z-10 border-l border-[#e5e5e5]">
            
            {/* Header */}
            <div className="px-6 py-5 border-b border-[#e5e5e5] flex justify-between items-center bg-slate-50">
              <div>
                <h3 className="text-lg font-bold text-[#0a0a0a]">Account Profile Detail</h3>
                <p className="text-xs text-[#0a0a0a]/50">Unique ID: USR-{selectedUser.id}</p>
              </div>
              <button 
                onClick={() => setIsViewDrawerOpen(false)}
                className="p-1.5 rounded-full hover:bg-slate-200 text-[#0a0a0a]/60"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Profile Content */}
            <div className="p-6 overflow-y-auto flex-1 space-y-6 text-sm">
              
              {/* Photo & Basic Details */}
              <div className="flex items-center gap-4.5 pb-6 border-b border-[#f0f0f0]">
                {selectedUser.profile_picture ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img 
                    src={selectedUser.profile_picture} 
                    alt={selectedUser.full_name} 
                    className="h-20 w-20 rounded-full object-cover border border-[#e5e5e5] shadow"
                  />
                ) : (
                  <div className="h-20 w-20 rounded-full bg-slate-100 flex items-center justify-center font-bold text-2xl text-blue-600 border border-slate-200 shadow">
                    {selectedUser.full_name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <h4 className="text-xl font-bold text-[#0a0a0a] truncate">{selectedUser.full_name}</h4>
                  <p className="text-sm text-[#0a0a0a]/50 truncate">{selectedUser.email}</p>
                  <div className="mt-2.5 flex items-center gap-2">
                    {getStatusBadge(selectedUser.status)}
                    <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200/50">
                      {selectedUser.role_name}
                    </span>
                  </div>
                </div>
              </div>

              {/* Personal Information */}
              <div className="space-y-4">
                <h5 className="font-bold text-[#0a0a0a]/80 border-b border-[#e5e5e5] pb-2">Personal Information</h5>
                <div className="grid grid-cols-2 gap-y-4 gap-x-4">
                  <div>
                    <span className="block text-xs font-semibold text-[#0a0a0a]/50 uppercase tracking-wider">Phone</span>
                    <span className="text-[#0a0a0a] font-medium">{selectedUser.phone || "—"}</span>
                  </div>
                  <div>
                    <span className="block text-xs font-semibold text-[#0a0a0a]/50 uppercase tracking-wider">Date of Birth</span>
                    <span className="text-[#0a0a0a] font-medium">{selectedUser.date_of_birth || "—"}</span>
                  </div>
                  <div>
                    <span className="block text-xs font-semibold text-[#0a0a0a]/50 uppercase tracking-wider">Gender</span>
                    <span className="text-[#0a0a0a] font-medium">{selectedUser.gender || "—"}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="block text-xs font-semibold text-[#0a0a0a]/50 uppercase tracking-wider">Residential Address</span>
                    <p className="text-[#0a0a0a] font-medium whitespace-pre-wrap">{selectedUser.address || "—"}</p>
                  </div>
                </div>
              </div>

              {/* Verification Section */}
              <div className="space-y-4 pt-2">
                <h5 className="font-bold text-[#0a0a0a]/80 border-b border-[#e5e5e5] pb-2">Verification</h5>
                <div className="grid grid-cols-2 gap-y-4 gap-x-4">
                  <div>
                    <span className="block text-xs font-semibold text-[#0a0a0a]/50 uppercase tracking-wider">Government ID (Investigator)</span>
                    <span className="text-[#0a0a0a] font-mono font-semibold">
                      {selectedUser.government_id ? (
                        <span className="bg-blue-50 text-blue-800 border border-blue-200/50 px-2 py-0.5 rounded text-xs">
                          {selectedUser.government_id}
                        </span>
                      ) : (
                        "—"
                      )}
                    </span>
                  </div>
                  <div>
                    <span className="block text-xs font-semibold text-[#0a0a0a]/50 uppercase tracking-wider">Digital ID Card (End User)</span>
                    {selectedUser.digital_id_path ? (
                      <div className="mt-1 flex flex-col gap-1.5">
                        <a href={selectedUser.digital_id_path} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline text-xs font-semibold flex items-center gap-1">
                          <Eye className="h-3 w-3" /> Preview ID
                        </a>
                        <a href={selectedUser.digital_id_path} download target="_blank" rel="noreferrer" className="text-blue-600 hover:underline text-xs font-semibold flex items-center gap-1">
                          <Download className="h-3 w-3" /> Download ID
                        </a>
                      </div>
                    ) : (
                      <span className="text-[#0a0a0a]/50 italic">Not uploaded</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Account Section */}
              <div className="space-y-4 pt-2">
                <h5 className="font-bold text-[#0a0a0a]/80 border-b border-[#e5e5e5] pb-2 flex items-center gap-1.5">
                  <Activity className="h-4 w-4 text-[#CC2200]" /> Account Activity
                </h5>
                <div className="grid grid-cols-2 gap-y-4 gap-x-4">
                  <div>
                    <span className="block text-xs font-semibold text-[#0a0a0a]/50 uppercase tracking-wider">Registered On</span>
                    <span className="text-[#0a0a0a] font-medium">{formatDate(selectedUser.created_at)}</span>
                  </div>
                  <div>
                    <span className="block text-xs font-semibold text-[#0a0a0a]/50 uppercase tracking-wider">Last Login</span>
                    <span className="text-[#0a0a0a] font-medium">{formatDateTime(selectedUser.last_login) || "Never"}</span>
                  </div>
                </div>
              </div>

            </div>

            {/* Footer Buttons */}
            <div className="px-6 py-4 border-t border-[#e5e5e5] bg-slate-50 flex gap-3">
              {selectedUser.status === "PENDING" ? (
                <>
                  <button 
                    onClick={() => {
                      setIsViewDrawerOpen(false);
                      setUserToApprove(selectedUser);
                      setIsApproveModalOpen(true);
                    }}
                    className="flex-1 text-center py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-semibold text-sm transition-colors shadow-sm"
                  >
                    Approve Request
                  </button>
                  <button 
                    onClick={() => {
                      setIsViewDrawerOpen(false);
                      setUserToReject(selectedUser);
                      setIsRejectModalOpen(true);
                    }}
                    className="flex-1 text-center py-2 bg-[#CC2200] hover:bg-[#CC2200]/90 text-white rounded font-semibold text-sm transition-colors shadow-sm"
                  >
                    Reject Request
                  </button>
                </>
              ) : (
                <>
                  <button 
                    onClick={() => {
                      setIsViewDrawerOpen(false);
                      openEditModal(selectedUser);
                    }}
                    className="flex-1 text-center py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded font-semibold text-sm border border-slate-300/50 transition-colors"
                  >
                    Edit Profile
                  </button>
                  <button 
                    onClick={() => setIsViewDrawerOpen(false)}
                    className="flex-1 text-center py-2 bg-slate-800 hover:bg-slate-900 text-white rounded font-semibold text-sm transition-colors"
                  >
                    Close Drawer
                  </button>
                </>
              )}
            </div>

          </div>
        </div>
      )}

      {/* 2. Approve Confirmation Modal */}
      {isApproveModalOpen && userToApprove && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs" onClick={() => setIsApproveModalOpen(false)} />
          <div className="bg-white border border-[#e5e5e5] rounded-lg shadow-xl max-w-md w-full z-10 overflow-hidden relative p-6 animate-scale-up">
            <h3 className="text-lg font-bold text-[#0a0a0a]">Approve User</h3>
            <p className="mt-2 text-sm text-[#0a0a0a]/60">
              Are you sure you want to approve this account? Approving this account will grant the user immediate access to the investigation dashboard with the assigned security role.
            </p>
            <div className="mt-3.5 bg-slate-50 border border-[#e5e5e5] p-3 rounded text-sm space-y-1">
              <p><strong>Name:</strong> {userToApprove.full_name}</p>
              <p><strong>Email:</strong> {userToApprove.email}</p>
              <p><strong>Organization:</strong> {userToApprove.organization || "No Org"}</p>
              <p><strong>Requested Role:</strong> {userToApprove.role_name}</p>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button 
                onClick={() => setIsApproveModalOpen(false)}
                disabled={isSubmitting}
                className="px-4 py-2 border border-[#e5e5e5] hover:bg-slate-100 rounded text-sm font-semibold transition-colors disabled:opacity-55"
              >
                Cancel
              </button>
              <button 
                onClick={handleApproveConfirm}
                disabled={isSubmitting}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded text-sm font-semibold flex items-center gap-1.5 shadow-sm transition-colors"
              >
                {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                Approve
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Reject Confirmation Modal */}
      {isRejectModalOpen && userToReject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs" onClick={() => setIsRejectModalOpen(false)} />
          <form 
            onSubmit={handleRejectConfirm}
            className="bg-white border border-[#e5e5e5] rounded-lg shadow-xl max-w-md w-full z-10 overflow-hidden relative p-6 animate-scale-up"
          >
            <h3 className="text-lg font-bold text-[#0a0a0a] text-rose-700">Reject User Request</h3>
            <p className="mt-2 text-sm text-[#0a0a0a]/60">
              Are you sure you want to reject the application request from <strong>{userToReject.full_name}</strong>? Please provide a valid justification.
            </p>
            
            <div className="mt-4 space-y-1">
              <label className="block text-xs font-bold text-[#0a0a0a]/70 uppercase tracking-wide">
                Rejection Reason <span className="text-[#CC2200]">*</span>
              </label>
              <textarea
                required
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Example: ID verification failed or invalid organization credentials..."
                rows={4}
                className="w-full border border-[#e5e5e5] rounded p-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#CC2200] focus:border-transparent bg-white shadow-xs"
              />
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button 
                type="button"
                onClick={() => {
                  setIsRejectModalOpen(false);
                  setRejectReason("");
                }}
                disabled={isSubmitting}
                className="px-4 py-2 border border-[#e5e5e5] hover:bg-slate-100 rounded text-sm font-semibold transition-colors disabled:opacity-55"
              >
                Cancel
              </button>
              <button 
                type="submit"
                disabled={isSubmitting || !rejectReason.trim()}
                className="px-4 py-2 bg-[#CC2200] hover:bg-[#CC2200]/95 text-white rounded text-sm font-semibold flex items-center gap-1.5 shadow-sm transition-colors disabled:bg-[#CC2200]/50"
              >
                {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                Reject Account
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 4. Edit User Modal */}
      {isEditModalOpen && userToEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs" onClick={() => setIsEditModalOpen(false)} />
          <form 
            onSubmit={handleEditSubmit}
            className="bg-white border border-[#e5e5e5] rounded-lg shadow-xl max-w-lg w-full z-10 overflow-hidden relative p-6 animate-scale-up"
          >
            <h3 className="text-lg font-bold text-[#0a0a0a]">Edit User Settings</h3>
            <p className="text-xs text-[#0a0a0a]/50">Modify registration fields and role authority.</p>

            <div className="mt-4 grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-1">
                <label className="block text-xs font-bold text-[#0a0a0a]/70 uppercase">Full Name</label>
                <input 
                  type="text" 
                  required
                  value={editForm.full_name}
                  onChange={(e) => setEditForm(prev => ({ ...prev, full_name: e.target.value }))}
                  className="w-full border border-[#e5e5e5] rounded p-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#CC2200]"
                />
              </div>

              <div className="col-span-2 space-y-1">
                <label className="block text-xs font-bold text-[#0a0a0a]/70 uppercase">Email Address</label>
                <input 
                  type="email" 
                  required
                  value={editForm.email}
                  onChange={(e) => setEditForm(prev => ({ ...prev, email: e.target.value }))}
                  className="w-full border border-[#e5e5e5] rounded p-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#CC2200]"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-[#0a0a0a]/70 uppercase">Phone</label>
                <input 
                  type="text" 
                  value={editForm.phone}
                  onChange={(e) => setEditForm(prev => ({ ...prev, phone: e.target.value }))}
                  className="w-full border border-[#e5e5e5] rounded p-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#CC2200]"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-[#0a0a0a]/70 uppercase">Organization / Dept</label>
                <input 
                  type="text" 
                  value={editForm.organization}
                  onChange={(e) => setEditForm(prev => ({ ...prev, organization: e.target.value }))}
                  className="w-full border border-[#e5e5e5] rounded p-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#CC2200]"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-[#0a0a0a]/70 uppercase">Government ID</label>
                <input 
                  type="text" 
                  value={editForm.government_id}
                  onChange={(e) => setEditForm(prev => ({ ...prev, government_id: e.target.value }))}
                  className="w-full border border-[#e5e5e5] rounded p-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#CC2200]"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-[#0a0a0a]/70 uppercase">Assigned Role</label>
                <select
                  value={editForm.role_id}
                  onChange={(e) => setEditForm(prev => ({ ...prev, role_id: Number(e.target.value) }))}
                  className="w-full border border-[#e5e5e5] bg-white rounded p-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#CC2200]"
                >
                  <option value={1}>Admin</option>
                  <option value={2}>Investigator</option>
                  <option value={3}>Analyst</option>
                </select>
              </div>

              <div className="col-span-2 space-y-1">
                <label className="block text-xs font-bold text-[#0a0a0a]/70 uppercase">Account Status</label>
                <select
                  value={editForm.status}
                  onChange={(e) => setEditForm(prev => ({ ...prev, status: e.target.value }))}
                  className="w-full border border-[#e5e5e5] bg-white rounded p-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#CC2200]"
                >
                  <option value="APPROVED">Approved</option>
                  <option value="ACTIVE">Active</option>
                  <option value="DISABLED">Inactive / Disabled</option>
                  <option value="BLOCKED">Blocked</option>
                </select>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button 
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                disabled={isSubmitting}
                className="px-4 py-2 border border-[#e5e5e5] hover:bg-slate-100 rounded text-sm font-semibold transition-colors disabled:opacity-55"
              >
                Cancel
              </button>
              <button 
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm font-semibold flex items-center gap-1.5 shadow-sm transition-colors disabled:bg-blue-400"
              >
                {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                Save Changes
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 5. Delete Confirmation Modal */}
      {isDeleteModalOpen && userToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs" onClick={() => setIsDeleteModalOpen(false)} />
          <div className="bg-white border border-[#e5e5e5] rounded-lg shadow-xl max-w-md w-full z-10 overflow-hidden relative p-6 animate-scale-up">
            <h3 className="text-lg font-bold text-[#0a0a0a] text-rose-700">Delete User</h3>
            <p className="mt-2 text-sm text-[#0a0a0a]/60">
              Are you sure you want to delete the account for <strong>{userToDelete.full_name}</strong>? This action is permanent and cannot be undone. All user data, reviews, and logs will be orphaned.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button 
                onClick={() => setIsDeleteModalOpen(false)}
                disabled={isSubmitting}
                className="px-4 py-2 border border-[#e5e5e5] hover:bg-slate-100 rounded text-sm font-semibold transition-colors disabled:opacity-55"
              >
                Cancel
              </button>
              <button 
                onClick={handleDeleteConfirm}
                disabled={isSubmitting}
                className="px-4 py-2 bg-[#CC2200] hover:bg-[#CC2200]/90 text-white rounded text-sm font-semibold flex items-center gap-1.5 shadow-sm transition-colors disabled:bg-[#CC2200]/50"
              >
                {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                Delete Permanently
              </button>
            </div>
          </div>
        </div>
      )}





    </div>
  );
}
