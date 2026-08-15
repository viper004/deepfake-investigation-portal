'use client';

import React, { useState, useEffect, useRef } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import { 
  Bold, 
  Italic, 
  Underline as UnderlineIcon, 
  Strikethrough,
  AlignLeft,
  AlignCenter,
  AlignRight,
  List, 
  ListOrdered, 
  Quote, 
  Undo, 
  Redo, 
  Loader2, 
  Save, 
  Trash2, 
  Edit3, 
  X, 
  AlertCircle, 
  FileText, 
  Check,
  Plus,
  Eye,
  Calendar,
  Tag,
  Layers
} from "lucide-react";

export interface InvestigatorNoteType {
  id: number;
  case_id: number;
  investigator_id: number;
  investigator_name: string;
  content: string;
  content_json?: any;
  related_evidence_ids?: number[];
  observation_date?: string;
  investigation_stage?: string;
  tags?: string;
  created_at: string;
  updated_at?: string;
}

interface InvestigatorNotesEditorProps {
  caseId: number;
  accessToken: string;
  assignedExpertId?: number | string;
  caseStatus?: string;
  currentUserId?: number | string;
  isInvestigatorRole?: boolean;
  userFullName?: string;
}

interface ToolbarButtonProps {
  active?: boolean;
  disabled?: boolean;
  onMouseDown: (e: React.MouseEvent) => void;
  title: string;
  children: React.ReactNode;
}

const ToolbarButton: React.FC<ToolbarButtonProps> = ({
  active = false,
  disabled = false,
  onMouseDown,
  title,
  children
}) => {
  return (
    <button
      type="button"
      onMouseDown={onMouseDown}
      disabled={disabled}
      title={title}
      className={`px-2.5 py-1.5 rounded-md text-xs font-semibold transition-colors duration-150 inline-flex items-center justify-center cursor-pointer select-none ${
        disabled
          ? "opacity-30 text-slate-400 bg-transparent cursor-not-allowed"
          : active
          ? "bg-slate-300 text-slate-900 font-bold border border-slate-400/50 shadow-xs hover:bg-slate-300"
          : "bg-transparent text-slate-700 hover:bg-slate-200/80 hover:text-slate-900"
      }`}
    >
      {children}
    </button>
  );
};

export default function InvestigatorNotesEditor({
  caseId,
  accessToken,
  assignedExpertId,
  caseStatus,
  currentUserId,
  isInvestigatorRole = true,
  userFullName = "Investigator"
}: InvestigatorNotesEditorProps) {
  const [notes, setNotes] = useState<InvestigatorNoteType[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);

  // Modal States
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [editingNote, setEditingNote] = useState<InvestigatorNoteType | null>(null);
  const [viewingNote, setViewingNote] = useState<InvestigatorNoteType | null>(null);
  const [deletingNoteId, setDeletingNoteId] = useState<number | null>(null);
  const [showAllNotesModal, setShowAllNotesModal] = useState<boolean>(false);

  // Metadata Inputs State
  const [observationDate, setObservationDate] = useState<string>("");
  const [investigationStage, setInvestigationStage] = useState<string>("Initial Assessment");
  const [tags, setTags] = useState<string>("");

  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [isMounted, setIsMounted] = useState<boolean>(false);
  const [, forceUpdate] = useState<number>(0);

  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

  // Permission Checks
  const assignedIdStr = assignedExpertId !== undefined && assignedExpertId !== null ? String(assignedExpertId) : "";
  const currentUserIdStr = currentUserId !== undefined && currentUserId !== null ? String(currentUserId) : "";

  const isAssignedInvestigator = 
    Boolean(isInvestigatorRole) && 
    Boolean(currentUserIdStr) && 
    Boolean(assignedIdStr) && 
    (assignedIdStr === currentUserIdStr);

  const isUnderInvestigation = caseStatus === "CASE_UNDER_INVESTIGATION";
  const canCreateAndEditNotes = isAssignedInvestigator && isUnderInvestigation;

  useEffect(() => {
    setIsMounted(true);
    // Set default date to today
    setObservationDate(new Date().toISOString().split("T")[0]);
  }, []);

  // Tiptap Editor Initialization
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2]
        }
      }),
      Underline,
      TextAlign.configure({
        types: ["heading", "paragraph"]
      })
    ],
    content: "",
    editorProps: {
      attributes: {
        class: "prose prose-sm max-w-none focus:outline-none min-h-[160px] p-3.5 text-slate-800 text-xs leading-relaxed"
      }
    }
  });

  // Re-render toolbar when selection or transaction updates
  useEffect(() => {
    if (!editor) return;
    const handleEditorUpdate = () => {
      forceUpdate((prev) => prev + 1);
    };

    editor.on("transaction", handleEditorUpdate);
    editor.on("selectionUpdate", handleEditorUpdate);
    return () => {
      editor.off("transaction", handleEditorUpdate);
      editor.off("selectionUpdate", handleEditorUpdate);
    };
  }, [editor]);

  // ESC Key listener for closing active modals
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (deletingNoteId) setDeletingNoteId(null);
        else if (editingNote) handleCloseModal();
        else if (isCreateModalOpen) handleCloseModal();
        else if (viewingNote) setViewingNote(null);
        else if (showAllNotesModal) setShowAllNotesModal(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [deletingNoteId, editingNote, isCreateModalOpen, viewingNote, showAllNotesModal]);

  // Fetch Investigation Notes
  const fetchNotes = async () => {
    if (!accessToken || !caseId) return;
    try {
      setLoading(true);
      const res = await fetch(`${backendUrl}/api/v1/user/cases/${caseId}/investigation-notes`, {
        headers: {
          "Authorization": `Bearer ${accessToken}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setNotes(data);
      } else {
        const err = await res.json();
        console.error("Failed to fetch investigator notes:", err);
      }
    } catch (error) {
      console.error("Error fetching investigator notes:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isMounted) {
      fetchNotes();
    }
  }, [caseId, accessToken, isMounted]);

  // Show Feedback Message
  const showFeedback = (type: "success" | "error", message: string) => {
    setFeedback({ type, message });
    setTimeout(() => {
      setFeedback(null);
    }, 4000);
  };

  // Helper to validate non-empty content
  const isEmptyContent = (htmlContent: string) => {
    if (!htmlContent) return true;
    const stripped = htmlContent.replace(/<[^>]*>/g, "").trim();
    return stripped.length === 0;
  };

  // Plain Text Truncator Helper for Preview Cards
  const getPlainTextPreview = (html: string, maxLen = 110) => {
    if (!html) return "No content preview available.";
    const text = html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
    if (text.length <= maxLen) return text;
    return text.substring(0, maxLen) + "...";
  };

  // Date Formatter
  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric"
      }) + " · " + d.toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit"
      });
    } catch {
      return dateStr;
    }
  };

  // Modal Handlers
  const handleOpenCreateModal = () => {
    setEditingNote(null);
    setObservationDate(new Date().toISOString().split("T")[0]);
    setInvestigationStage("Initial Assessment");
    setTags("");
    if (editor) {
      editor.commands.clearContent();
    }
    setIsCreateModalOpen(true);
  };

  const handleOpenEditModal = (note: InvestigatorNoteType) => {
    setEditingNote(note);
    setObservationDate(note.observation_date || new Date().toISOString().split("T")[0]);
    setInvestigationStage(note.investigation_stage || "Forensic Analysis");
    setTags(note.tags || "");
    if (editor) {
      editor.commands.setContent(note.content);
    }
    setViewingNote(null);
    setIsCreateModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsCreateModalOpen(false);
    setEditingNote(null);
    if (editor) {
      editor.commands.clearContent();
    }
  };

  // Save or Update Note
  const handleSaveNote = async () => {
    if (!editor || !accessToken) return;
    const htmlContent = editor.getHTML();
    const jsonContent = editor.getJSON();

    if (isEmptyContent(htmlContent)) {
      showFeedback("error", "Investigation note cannot be empty.");
      return;
    }

    setSaving(true);
    try {
      if (editingNote) {
        // PUT update existing note
        const res = await fetch(`${backendUrl}/api/v1/user/cases/${caseId}/investigation-notes/${editingNote.id}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${accessToken}`
          },
          body: JSON.stringify({
            content: htmlContent,
            content_json: jsonContent,
            observation_date: observationDate,
            investigation_stage: investigationStage,
            tags: tags
          })
        });

        if (res.ok) {
          const updatedNote = await res.json();
          setNotes(prev => prev.map(n => n.id === editingNote.id ? { ...updatedNote, observation_date: observationDate, investigation_stage: investigationStage, tags } : n));
          handleCloseModal();
          showFeedback("success", "Investigation note updated successfully.");
        } else {
          const err = await res.json();
          showFeedback("error", err.detail || "Failed to update investigation note.");
        }
      } else {
        // POST create new note
        const res = await fetch(`${backendUrl}/api/v1/user/cases/${caseId}/investigation-notes`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${accessToken}`
          },
          body: JSON.stringify({
            content: htmlContent,
            content_json: jsonContent,
            observation_date: observationDate,
            investigation_stage: investigationStage,
            tags: tags
          })
        });

        if (res.ok) {
          const newNote = await res.json();
          setNotes(prev => [...prev, { ...newNote, observation_date: observationDate, investigation_stage: investigationStage, tags }]);
          handleCloseModal();
          showFeedback("success", "Investigation note added to case file.");
        } else {
          const err = await res.json();
          showFeedback("error", err.detail || "Failed to save investigation note.");
        }
      }
    } catch (error) {
      showFeedback("error", "Network error while saving note.");
    } finally {
      setSaving(false);
    }
  };

  // Confirm Delete Note
  const handleDeleteNote = async (noteId: number) => {
    if (!accessToken) return;
    try {
      const res = await fetch(`${backendUrl}/api/v1/user/cases/${caseId}/investigation-notes/${noteId}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${accessToken}`
        }
      });

      if (res.ok) {
        setNotes(prev => prev.filter(n => n.id !== noteId));
        setDeletingNoteId(null);
        if (viewingNote?.id === noteId) setViewingNote(null);
        showFeedback("success", "Investigation note deleted successfully.");
      } else {
        const err = await res.json();
        showFeedback("error", err.detail || "Failed to delete note.");
      }
    } catch (error) {
      showFeedback("error", "Error deleting note.");
    }
  };

  if (!isMounted) {
    return (
      <div className="bg-white border border-[#e5e5e5] rounded-xl p-6 text-center text-xs text-slate-400">
        Loading workspace panel...
      </div>
    );
  }

  // Display top 3 notes on compact sidebar card
  const visibleNotes = notes.slice(0, 3);

  return (
    <div className="bg-white border border-[#e5e5e5] rounded-xl shadow-xs overflow-hidden">
      {/* Panel Header */}
      <div className="px-5 py-3.5 bg-slate-900 text-white flex justify-between items-center border-b border-slate-800">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-[#CC2200]" />
          <h3 className="text-sm font-bold tracking-tight">Investigation Notes</h3>
        </div>

        {canCreateAndEditNotes && (
          <button
            type="button"
            onClick={handleOpenCreateModal}
            aria-label="New Investigation Note"
            title="New Investigation Note"
            className="w-7 h-7 rounded-lg bg-[#CC2200] hover:bg-[#b31e00] text-white flex items-center justify-center transition-all shadow-xs cursor-pointer shrink-0"
          >
            <Plus className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="p-5 space-y-4">
        {/* Feedback Alert */}
        {feedback && (
          <div className={`p-3 rounded-lg border text-xs font-semibold flex items-center justify-between transition-all ${
            feedback.type === "success"
              ? "bg-emerald-50 text-emerald-800 border-emerald-200"
              : "bg-rose-50 text-rose-800 border-rose-200"
          }`}>
            <div className="flex items-center gap-2">
              {feedback.type === "success" ? <Check className="h-4 w-4 text-emerald-600" /> : <AlertCircle className="h-4 w-4 text-rose-600" />}
              <span>{feedback.message}</span>
            </div>
            <button onClick={() => setFeedback(null)} className="text-slate-400 hover:text-slate-600">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* Compact Restriction Banner if not allowed */}
        {!canCreateAndEditNotes && (
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-500 text-center font-medium">
            {!isUnderInvestigation ? (
              <span>Note creation available only when case status is <strong className="text-slate-700">CASE_UNDER_INVESTIGATION</strong>.</span>
            ) : (
              <span>Note creation restricted to the assigned lead investigator.</span>
            )}
          </div>
        )}

        {/* Compact Chronological Note Cards List */}
        {loading ? (
          <div className="py-8 flex flex-col items-center justify-center gap-2 text-xs text-slate-400">
            <Loader2 className="h-5 w-5 animate-spin text-[#CC2200]" />
            <span>Loading notes history...</span>
          </div>
        ) : notes.length === 0 ? (
          <div className="py-8 text-center bg-slate-50/70 rounded-lg border border-dashed border-slate-200 text-xs text-slate-400 space-y-1">
            <p className="font-semibold text-slate-600">No investigation notes recorded yet.</p>
            {canCreateAndEditNotes && (
              <p className="text-[11px]">Click <strong>+ New Investigation Note</strong> above to document forensic observations.</p>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {visibleNotes.map((note) => (
              <div 
                key={note.id}
                className="p-3.5 bg-slate-50/90 border border-slate-200 rounded-xl hover:border-slate-300 transition-all text-left space-y-2 group"
              >
                {/* Note Card Header */}
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-slate-900 text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                      {note.investigator_name ? note.investigator_name[0] : "I"}
                    </div>
                    <div>
                      <span className="text-xs font-bold text-slate-900 block leading-tight">
                        {note.investigator_name}
                      </span>
                      <span className="text-[10px] text-slate-400 font-medium block">
                        {formatDate(note.created_at)}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setViewingNote(note)}
                      className="px-2 py-1 bg-white hover:bg-slate-200 text-slate-700 text-[10px] font-bold rounded border border-slate-200 inline-flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <Eye className="h-3 w-3 text-slate-500" />
                      <span>View</span>
                    </button>

                    {canCreateAndEditNotes && String(note.investigator_id) === currentUserIdStr && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleOpenEditModal(note)}
                          className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded transition-colors cursor-pointer"
                          title="Edit Note"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => setDeletingNoteId(note.id)}
                          className="p-1 text-slate-400 hover:text-[#CC2200] hover:bg-rose-50 rounded transition-colors cursor-pointer"
                          title="Delete Note"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Truncated Text Preview */}
                <p className="text-xs text-slate-700 font-medium line-clamp-2 leading-relaxed pl-8">
                  {getPlainTextPreview(note.content)}
                </p>
              </div>
            ))}

            {/* View All Notes Footer Button */}
            {notes.length > 3 && (
              <div className="pt-1 text-center">
                <button
                  type="button"
                  onClick={() => setShowAllNotesModal(true)}
                  className="w-full py-2 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg border border-slate-200 transition-colors cursor-pointer inline-flex items-center justify-center gap-1.5"
                >
                  <FileText className="h-3.5 w-3.5 text-slate-500" />
                  <span>View All Investigation Notes ({notes.length})</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ─────────────────────────────────────────────────────────────
          1. CREATE / EDIT INVESTIGATION NOTE MODAL
      ───────────────────────────────────────────────────────────── */}
      {isCreateModalOpen && (
        <div 
          className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) handleCloseModal();
          }}
        >
          <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden animate-scale-up">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-slate-900 text-white flex justify-between items-center border-b border-slate-800 shrink-0">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-[#CC2200]" />
                <h3 className="text-sm font-bold tracking-tight">
                  {editingNote ? `Edit Investigation Note #${editingNote.id}` : "New Investigation Note"}
                </h3>
              </div>

              <button
                type="button"
                onClick={handleCloseModal}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Scrollable Content */}
            <div className="p-6 overflow-y-auto space-y-5">
              {/* Optional Investigation Metadata Bar */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                    <Calendar className="h-3 w-3 text-slate-400" /> Observation Date
                  </label>
                  <input
                    type="date"
                    value={observationDate}
                    onChange={(e) => setObservationDate(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-slate-600"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                    <Layers className="h-3 w-3 text-slate-400" /> Investigation Stage
                  </label>
                  <select
                    value={investigationStage}
                    onChange={(e) => setInvestigationStage(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded px-2 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-slate-600"
                  >
                    <option value="Initial Assessment">Initial Assessment</option>
                    <option value="Evidence Examination">Evidence Examination</option>
                    <option value="Forensic Analysis">Forensic Analysis</option>
                    <option value="Final Verification">Final Verification</option>
                    <option value="Peer Review">Peer Review</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                    <Tag className="h-3 w-3 text-slate-400" /> Optional Tags
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Facial Deepfake, Audio"
                    value={tags}
                    onChange={(e) => setTags(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-slate-600"
                  />
                </div>
              </div>

              {/* Tiptap Rich Text Editor Container */}
              <div className="border border-[#e5e5e5] rounded-xl overflow-hidden focus-within:border-slate-600 transition-colors">
                {/* Word-style Toolbar */}
                {editor && (
                  <div className="bg-slate-100 border-b border-[#e5e5e5] p-2 flex flex-wrap items-center gap-1">
                    <ToolbarButton
                      active={editor.isActive("bold")}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        editor.chain().focus().toggleBold().run();
                      }}
                      title="Bold [Ctrl+B]"
                    >
                      <Bold className="h-3.5 w-3.5" />
                    </ToolbarButton>

                    <ToolbarButton
                      active={editor.isActive("italic")}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        editor.chain().focus().toggleItalic().run();
                      }}
                      title="Italic [Ctrl+I]"
                    >
                      <Italic className="h-3.5 w-3.5" />
                    </ToolbarButton>

                    <ToolbarButton
                      active={editor.isActive("underline")}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        editor.chain().focus().toggleUnderline().run();
                      }}
                      title="Underline [Ctrl+U]"
                    >
                      <UnderlineIcon className="h-3.5 w-3.5" />
                    </ToolbarButton>

                    <ToolbarButton
                      active={editor.isActive("strike")}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        editor.chain().focus().toggleStrike().run();
                      }}
                      title="Strikethrough"
                    >
                      <Strikethrough className="h-3.5 w-3.5" />
                    </ToolbarButton>

                    <div className="h-4 w-px bg-slate-300 mx-0.5" />

                    <ToolbarButton
                      active={editor.isActive("heading", { level: 1 })}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        editor.chain().focus().toggleHeading({ level: 1 }).run();
                      }}
                      title="Heading 1"
                    >
                      <span className="font-extrabold text-xs">H1</span>
                    </ToolbarButton>

                    <ToolbarButton
                      active={editor.isActive("heading", { level: 2 })}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        editor.chain().focus().toggleHeading({ level: 2 }).run();
                      }}
                      title="Heading 2"
                    >
                      <span className="font-extrabold text-xs">H2</span>
                    </ToolbarButton>

                    <div className="h-4 w-px bg-slate-300 mx-0.5" />

                    <ToolbarButton
                      active={editor.isActive("bulletList")}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        editor.chain().focus().toggleBulletList().run();
                      }}
                      title="Bullet List"
                    >
                      <List className="h-3.5 w-3.5" />
                    </ToolbarButton>

                    <ToolbarButton
                      active={editor.isActive("orderedList")}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        editor.chain().focus().toggleOrderedList().run();
                      }}
                      title="Numbered List"
                    >
                      <ListOrdered className="h-3.5 w-3.5" />
                    </ToolbarButton>

                    <ToolbarButton
                      active={editor.isActive("blockquote")}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        editor.chain().focus().toggleBlockquote().run();
                      }}
                      title="Blockquote"
                    >
                      <Quote className="h-3.5 w-3.5" />
                    </ToolbarButton>

                    <div className="h-4 w-px bg-slate-300 mx-0.5" />

                    <ToolbarButton
                      active={editor.isActive({ textAlign: 'left' })}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        editor.chain().focus().setTextAlign('left').run();
                      }}
                      title="Align Left"
                    >
                      <AlignLeft className="h-3.5 w-3.5" />
                    </ToolbarButton>

                    <ToolbarButton
                      active={editor.isActive({ textAlign: 'center' })}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        editor.chain().focus().setTextAlign('center').run();
                      }}
                      title="Align Center"
                    >
                      <AlignCenter className="h-3.5 w-3.5" />
                    </ToolbarButton>

                    <ToolbarButton
                      active={editor.isActive({ textAlign: 'right' })}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        editor.chain().focus().setTextAlign('right').run();
                      }}
                      title="Align Right"
                    >
                      <AlignRight className="h-3.5 w-3.5" />
                    </ToolbarButton>

                    <div className="h-4 w-px bg-slate-300 mx-0.5" />

                    <ToolbarButton
                      disabled={!editor.can().undo()}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        if (editor.can().undo()) {
                          editor.chain().focus().undo().run();
                        }
                      }}
                      title="Undo [Ctrl+Z]"
                    >
                      <Undo className="h-3.5 w-3.5" />
                    </ToolbarButton>

                    <ToolbarButton
                      disabled={!editor.can().redo()}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        if (editor.can().redo()) {
                          editor.chain().focus().redo().run();
                        }
                      }}
                      title="Redo [Ctrl+Y]"
                    >
                      <Redo className="h-3.5 w-3.5" />
                    </ToolbarButton>
                  </div>
                )}

                {/* Editor Content editable frame */}
                <div className="bg-slate-50/40">
                  <EditorContent editor={editor} />
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3.5 bg-slate-100 border-t border-[#e5e5e5] flex justify-between items-center shrink-0">
              <span className="text-[10px] text-slate-500 font-medium">
                Structured rich-text JSON format saved to case file
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  disabled={saving}
                  className="px-4 py-2 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={handleSaveNote}
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 px-5 py-2 rounded-lg bg-slate-900 hover:bg-[#CC2200] text-white text-xs font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {saving ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Save className="h-3.5 w-3.5" />
                      <span>{editingNote ? "Save Changes" : "Save Investigation Note"}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          2. VIEW INVESTIGATION NOTE MODAL
      ───────────────────────────────────────────────────────────── */}
      {viewingNote && (
        <div 
          className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setViewingNote(null);
          }}
        >
          <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden animate-scale-up">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-slate-900 text-white flex justify-between items-center border-b border-slate-800 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-slate-800 text-white text-xs font-bold flex items-center justify-center border border-slate-700">
                  {viewingNote.investigator_name ? viewingNote.investigator_name[0] : "I"}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white leading-tight">
                    {viewingNote.investigator_name}
                  </h3>
                  <span className="text-[10px] text-slate-400 block mt-0.5">
                    {formatDate(viewingNote.created_at)}
                    {viewingNote.updated_at && viewingNote.updated_at !== viewingNote.created_at && " (edited)"}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setViewingNote(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Body: Full Rich Text Note Content */}
            <div className="p-6 overflow-y-auto space-y-4">
              {/* Optional Metadata Badges */}
              {(viewingNote.observation_date || viewingNote.investigation_stage || viewingNote.tags) && (
                <div className="flex flex-wrap items-center gap-2 pb-3 border-b border-slate-100 text-[11px]">
                  {viewingNote.observation_date && (
                    <span className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-md font-semibold inline-flex items-center gap-1">
                      <Calendar className="h-3 w-3 text-slate-500" />
                      Observed: {viewingNote.observation_date}
                    </span>
                  )}
                  {viewingNote.investigation_stage && (
                    <span className="px-2.5 py-1 bg-blue-50 text-blue-800 rounded-md font-semibold inline-flex items-center gap-1 border border-blue-100">
                      <Layers className="h-3 w-3 text-blue-500" />
                      Stage: {viewingNote.investigation_stage}
                    </span>
                  )}
                  {viewingNote.tags && (
                    <span className="px-2.5 py-1 bg-amber-50 text-amber-800 rounded-md font-semibold inline-flex items-center gap-1 border border-amber-100">
                      <Tag className="h-3 w-3 text-amber-500" />
                      {viewingNote.tags}
                    </span>
                  )}
                </div>
              )}

              {/* Full Rich Text Rendered HTML */}
              <div 
                className="tiptap-content text-xs text-slate-800 leading-relaxed min-h-[120px]"
                dangerouslySetInnerHTML={{ __html: viewingNote.content }}
              />
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3.5 bg-slate-100 border-t border-[#e5e5e5] flex justify-between items-center shrink-0">
              <button
                type="button"
                onClick={() => setViewingNote(null)}
                className="px-4 py-2 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
              >
                Close
              </button>

              {canCreateAndEditNotes && String(viewingNote.investigator_id) === currentUserIdStr && (
                <button
                  type="button"
                  onClick={() => handleOpenEditModal(viewingNote)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-900 hover:bg-[#CC2200] text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
                >
                  <Edit3 className="h-3.5 w-3.5" />
                  <span>Edit Note</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          3. DELETE CONFIRMATION MODAL
      ───────────────────────────────────────────────────────────── */}
      {deletingNoteId !== null && (
        <div 
          className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setDeletingNoteId(null);
          }}
        >
          <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4 animate-scale-up text-left">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center shrink-0">
                <AlertCircle className="h-5 w-5 text-rose-600" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Delete Investigation Note?</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  This action will permanently remove this investigation note from the case record.
                </p>
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeletingNoteId(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold text-xs transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDeleteNote(deletingNoteId)}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold text-xs transition-colors cursor-pointer"
              >
                Delete Note
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          4. VIEW ALL NOTES LIST MODAL
      ───────────────────────────────────────────────────────────── */}
      {showAllNotesModal && (
        <div 
          className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowAllNotesModal(false);
          }}
        >
          <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden animate-scale-up">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-slate-900 text-white flex justify-between items-center border-b border-slate-800 shrink-0">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-[#CC2200]" />
                <h3 className="text-sm font-bold tracking-tight">
                  All Investigation Notes ({notes.length})
                </h3>
              </div>

              <button
                type="button"
                onClick={() => setShowAllNotesModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-3">
              {notes.map((note) => (
                <div 
                  key={note.id}
                  className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-left"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-slate-900 text-white text-[10px] font-bold flex items-center justify-center">
                        {note.investigator_name ? note.investigator_name[0] : "I"}
                      </div>
                      <div>
                        <span className="text-xs font-bold text-slate-900 block leading-tight">
                          {note.investigator_name}
                        </span>
                        <span className="text-[10px] text-slate-400 font-medium">
                          {formatDate(note.created_at)}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setShowAllNotesModal(false);
                          setViewingNote(note);
                        }}
                        className="px-2.5 py-1 bg-white hover:bg-slate-200 text-slate-700 text-[10px] font-bold rounded border border-slate-200 inline-flex items-center gap-1 cursor-pointer transition-colors"
                      >
                        <Eye className="h-3 w-3 text-slate-500" />
                        <span>View</span>
                      </button>

                      {canCreateAndEditNotes && String(note.investigator_id) === currentUserIdStr && (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              setShowAllNotesModal(false);
                              handleOpenEditModal(note);
                            }}
                            className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded transition-colors cursor-pointer"
                            title="Edit Note"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setShowAllNotesModal(false);
                              setDeletingNoteId(note.id);
                            }}
                            className="p-1 text-slate-400 hover:text-[#CC2200] hover:bg-rose-50 rounded transition-colors cursor-pointer"
                            title="Delete Note"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  <p className="text-xs text-slate-700 font-medium line-clamp-2 leading-relaxed pl-8">
                    {getPlainTextPreview(note.content, 140)}
                  </p>
                </div>
              ))}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3.5 bg-slate-100 border-t border-[#e5e5e5] flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => setShowAllNotesModal(false)}
                className="px-4 py-2 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
