import re

with open("scratch/page_original.tsx", "r") as f:
    content = f.read()

# 1. Add states
state_insertion = """
  const [investigatorsTab, setInvestigatorsTab] = useState<"Active Investigators" | "Pending Invitations" | "Pending Verification" | "Invitation Logs">("Active Investigators");
  const [invitationLogs, setInvitationLogs] = useState<any[]>([]);
  const [invitationLogsLoading, setInvitationLogsLoading] = useState(false);
  const [invitationLogsLoaded, setInvitationLogsLoaded] = useState(false);
  const [selectedLogs, setSelectedLogs] = useState<number[]>([]);
  const [isLogDrawerOpen, setIsLogDrawerOpen] = useState(false);
  const [selectedLog, setSelectedLog] = useState<any | null>(null);
  
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
    const csvHeader = "ID,Event Type,Status,Recipient,Performed By,IP Address,Created At\\n";
    const csvContent = invitationLogs.map(l => `${l.id},${l.event_type},${l.status},${l.recipient_email},${l.performed_by || "System"},${l.ip_address || "N/A"},${l.created_at}`).join("\\n");
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
"""
content = content.replace("  const [isPendingSectionOpen, setIsPendingSectionOpen] = useState(false);", state_insertion)

# 2. Add fetchInvitationLogs
fetch_logs = """
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
"""
content = content.replace("  // Fetch Invitations", fetch_logs + "\n  // Fetch Invitations")

# 3. Add to useEffect
content = content.replace("    fetchInvitations();", "    fetchInvitations();\n    fetchInvitationLogs();")

# 4. Remove Invitations from User Management
pattern_remove_invites = re.compile(r'\) : adminTab === "invitations" \? \(\s*/\* Tab 3: Invitations \*/.*?(?=\s*\n\s*</div>\n\s*\)\s*\}?\n\s*\{activeSidebarTab === "Investigators")', re.DOTALL)
content = re.sub(pattern_remove_invites, "", content)

# 5. Extract Pending Invitations UI
pending_invitations_ui = """
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
"""

# 6. Extract Pending Verification UI
pending_verification_ui = """
              {investigatorsTab === "Pending Verification" && (
                  <div className="bg-white border border-[#e5e5e5] rounded-lg shadow-sm">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                      <thead className="bg-[#fafafa] text-[#0a0a0a]/50 uppercase text-[11px] font-bold tracking-wider border-b border-[#e5e5e5]">
                        <tr>
                          <th className="py-3 px-6">Applicant</th>
                          <th className="py-3 px-6">Organization</th>
                          <th className="py-3 px-6">Department</th>
                          <th className="py-3 px-6">Submitted</th>
                          <th className="py-3 px-6">Verification</th>
                          <th className="py-3 px-6 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#f0f0f0] bg-white">
                        {applicationsLoading ? (
                          Array.from({ length: 3 }).map((_, i) => (
                            <tr key={i} className="animate-pulse">
                              <td className="py-4 px-6"><div className="h-8 w-32 bg-slate-200 rounded"></div></td>
                              <td className="py-4 px-6"><div className="h-4 w-24 bg-slate-200 rounded"></div></td>
                              <td className="py-4 px-6"><div className="h-4 w-24 bg-slate-200 rounded"></div></td>
                              <td className="py-4 px-6"><div className="h-4 w-20 bg-slate-200 rounded"></div></td>
                              <td className="py-4 px-6"><div className="h-4 w-24 bg-slate-200 rounded"></div></td>
                              <td className="py-4 px-6"><div className="h-8 w-24 bg-slate-200 rounded ml-auto"></div></td>
                            </tr>
                          ))
                        ) : pendingApplications.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="py-12 text-center">
                              <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-3">
                                <CheckCircle className="w-6 h-6 text-slate-400" />
                              </div>
                              <p className="text-sm font-medium text-slate-900">All caught up!</p>
                              <p className="text-xs text-slate-500 mt-1">There are no pending verification requests.</p>
                            </td>
                          </tr>
                        ) : (
                          pendingApplications.map((app) => (
                            <tr key={app.id} className="hover:bg-[#fafafa]/50 transition-colors">
                              <td className="py-3.5 px-6 font-semibold text-[#0a0a0a]">
                                <div className="flex items-center gap-3">
                                  {app.profile_picture ? (
                                    <img src={app.profile_picture} alt="Avatar" className="w-8 h-8 rounded-full object-cover shadow-sm border border-slate-200" />
                                  ) : (
                                    <div className="w-8 h-8 rounded-full bg-[#CC2200]/10 text-[#CC2200] flex items-center justify-center font-bold text-xs">
                                      {app.full_name.substring(0, 2).toUpperCase()}
                                    </div>
                                  )}
                                  <div>
                                    <div>{app.full_name}</div>
                                    <div className="text-xs text-[#0a0a0a]/50 font-normal">{app.email}</div>
                                  </div>
                                </div>
                              </td>
                              <td className="py-3.5 px-6 text-[#0a0a0a]/80">{app.organization}</td>
                              <td className="py-3.5 px-6 text-[#0a0a0a]/80">{app.department}</td>
                              <td className="py-3.5 px-6 text-xs text-[#0a0a0a]/60">{formatDate(app.applied_date)}</td>
                              <td className="py-3.5 px-6">
                                {app.government_id_path ? (
                                  <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600">
                                    <CheckCircle className="w-3.5 h-3.5" /> Uploaded
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-600">
                                    <AlertCircle className="w-3.5 h-3.5"/> Missing
                                  </span>
                                )}
                              </td>
                              <td className="py-3.5 px-6 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <button onClick={() => { setSelectedApplication(app); setIsAppViewDrawerOpen(true); }} className="text-xs font-semibold px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded transition-colors">View Details</button>
                                  <button onClick={() => { setAppToApprove(app); setIsAppApproveModalOpen(true); }} className="text-xs font-semibold px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded transition-colors">Approve</button>
                                  <button onClick={() => { setAppToReject(app); setIsAppRejectModalOpen(true); }} className="text-xs font-semibold px-3 py-1.5 bg-[#CC2200] hover:bg-[#CC2200]/90 text-white rounded transition-colors">Reject</button>
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
              )}
"""

# 7. Invitation Logs UI
invitation_logs_ui = """
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
"""

# Re-write the Investigator Management section
investigator_header_and_tabs = """
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
                {["Active Investigators", "Pending Invitations", "Pending Verification", "Invitation Logs"].map((tab) => (
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
                    {tab === "Pending Verification" && pendingApplications.length > 0 && (
                      <span className="ml-2 px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-xs">{pendingApplications.length}</span>
                    )}
                  </button>
                ))}
              </div>
              
              {investigatorsTab === "Active Investigators" && (
                <div className="flex flex-col gap-4 animate-slide-in">
"""

content = content.replace('              {/* Header */}\n              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-lg border border-[#e5e5e5] shadow-sm">', investigator_header_and_tabs + '              {/* Search & Filters */}')

pending_verification_collapsible = re.compile(r'\s*\{\s*/\*\s*Pending\s*Verifications\s*Collapsible\s*\*/\s*\}\s*<div.*?</button>\s*</div>\s*\{isPendingSectionOpen && \(\s*<div.*?\)\s*\}?\s*</div>\n', re.DOTALL)
content = re.sub(pending_verification_collapsible, "", content)

pattern_end_investigators = r'                  </div>\n                \)\}\n              </div>\n            </div>\n'
replacement_end = f'                  </div>\n                )}}\n              </div>\n            </div>\n          )}}\n\n{pending_invitations_ui}\n{pending_verification_ui}\n{invitation_logs_ui}\n'
content = re.sub(pattern_end_investigators, replacement_end, content)


# 8. Add Drawer for Logs
log_drawer_ui = """
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
"""
content = content.replace("      {/* Bulk Invite Modal */}", log_drawer_ui + "\n      {/* Bulk Invite Modal */}")

with open("scratch/page_updated.tsx", "w") as f:
    f.write(content)
