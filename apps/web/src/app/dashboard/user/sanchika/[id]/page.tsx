'use client';

import { use } from 'react';
import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { getCombinedHtml, isMultiPageContent, getPageCount } from '@/lib/utils/multiPageContent';
import DOMPurify from 'dompurify';
import {
  Palette,
  Star,
  Pin,
  Save,
  Trash2,
  ArrowLeft,
  Edit3,
  Eye,
  Settings,
  Loader2,
  Archive,
  ChevronRight,
  Home,
  BookOpen,
  PenTool,
  FileText,
  Paperclip,
  Mic,
  MoreVertical,
  X,
} from 'lucide-react';

// Dynamic import to avoid SSR issues
const RichTextEditor = dynamic(
  () => import('@/components/workspace/sanchika/RichTextEditor').then((mod) => mod.RichTextEditor),
  { ssr: false, loading: () => <div className="loading">Loading editor...</div> }
);

const CoverDesignPicker = dynamic(
  () => import('@/components/workspace/sanchika/CoverDesignPicker'),
  { ssr: false }
);

const ChecklistProgressBar = dynamic(
  () => import('@/components/workspace/sanchika/ChecklistProgressBar').then((mod) => ({ default: mod.ChecklistProgressBar })),
  { ssr: false }
);

const SmartDetectionPanel = dynamic(
  () => import('@/components/workspace/sanchika/SmartDetectionPanel').then((mod) => ({ default: mod.SmartDetectionPanel })),
  { ssr: false }
);

const VoiceNotesPanel = dynamic(
  () => import('@/components/workspace/sanchika/VoiceNotesPanel').then((mod) => ({ default: mod.VoiceNotesPanel })),
  { ssr: false }
);

const PDFAttachmentsPanel = dynamic(
  () => import('@/components/workspace/sanchika/PDFAttachmentsPanel').then((mod) => ({ default: mod.PDFAttachmentsPanel })),
  { ssr: false }
);

const DrawingCanvas = dynamic(
  () => import('@/components/workspace/sanchika/DrawingCanvas'),
  { ssr: false }
);

interface Note {
  id: string;
  title: string;
  content: string;
  content_format: 'plain' | 'markdown' | 'html';
  subject?: string;
  chapter?: string;
  board?: string;
  class_level?: string;
  tags?: string[];
  cover_design?: string;
  spine_color?: string;
  orientation?: string;
  page_size?: string;
  page_margins?: string;
  is_favorite: boolean;
  is_archived: boolean;
  is_pinned: boolean;
  folder_id?: string;
  created_at: string;
  updated_at: string;
}

type TabType = 'edit' | 'preview' | 'settings';
type EditorMode = 'text' | 'draw' | 'attach' | 'voice';

// ── Ink serialisation helpers ────────────────────────────────────────────────
const INK_MARKER_START = '<!-- sanchika-ink:';
const INK_MARKER_END   = ':sanchika-ink -->';

function embedInkInContent(html: string, svgString: string): string {
  // Strip any existing ink block
  const stripped = html.replace(
    new RegExp(`${INK_MARKER_START}[\\s\\S]*?${INK_MARKER_END}`), ''
  ).trimEnd();
  
  const isNewEmpty = !svgString || svgString.includes('width="0"') || svgString.indexOf('<path') === -1;
  if (isNewEmpty) {
    return stripped;
  }
  return `${stripped}\n${INK_MARKER_START}${btoa(svgString)}${INK_MARKER_END}`;
}

function extractInkFromContent(html: string): string | null {
  const match = html.match(
    new RegExp(`${INK_MARKER_START}([\\s\\S]*?)${INK_MARKER_END}`)
  );
  return match ? atob(match[1]) : null;
}

interface NoteViewEditPageProps {
  params: Promise<{ id: string }>;
}

export default function NoteViewEditPage({ params }: NoteViewEditPageProps) {
  const router = useRouter();
  const { id } = use(params); // ← FIX: Unwrap params Promise with React.use()

  // ============ STATES ============
  const [activeTab, setActiveTab] = useState<TabType>('edit');
  const [editorMode, setEditorMode] = useState<EditorMode>('text');
  const [note, setNote] = useState<Note | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const [showCoverPicker, setShowCoverPicker] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(true);
  const [wordCount, setWordCount] = useState({ words: 0, characters: 0 });
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [backlinks, setBacklinks] = useState<Array<{ id: string; title: string; subject?: string }>>([]);
  const notesCacheRef = useRef<{ at: number; items: Array<{ id: string; title: string }> } | null>(null);
  const inkControlsRef = useRef<{ getSVG?: () => string }>({});
  const [initialInkSVG, setInitialInkSVG] = useState<string>('');

  // ============ FETCH NOTE ============
  const fetchNote = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // NEW NOTE: Return template
      if (id === 'new') {
        console.log('📝 Creating new note template');
        const presetTitle = typeof window !== 'undefined'
          ? (new URLSearchParams(window.location.search).get('title') || '')
          : '';
        const emptyNote: Note = {
          id: '',
          title: presetTitle || 'Untitled Note',
          content: '',
          content_format: 'markdown',
          orientation: 'portrait',
          page_size: 'A4',
          page_margins: 'normal',
          subject: undefined,
          chapter: undefined,
          board: undefined,
          class_level: undefined,
          tags: [],
          is_favorite: false,
          is_archived: false,
          is_pinned: false,
          folder_id: undefined,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        setNote(emptyNote);
        setIsDirty(false);
        setLoading(false);
        return;
      }

      // EXISTING NOTE: Fetch from API
      console.log('🔍 Fetching note:', id);
      const response = await fetch(`/api/notes?id=${id}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Note not found');
        }
        throw new Error(`Failed to fetch note (${response.status})`);
      }

      const data = await response.json();
      console.log('✅ Note fetched:', data);

      const fetchedNote = data.note;
      const savedSvg = extractInkFromContent(fetchedNote.content || '');
      if (savedSvg) {
        setInitialInkSVG(savedSvg);
        // Strip the ink from the HTML so the editor doesn't see the raw comment
        fetchedNote.content = fetchedNote.content.replace(
          new RegExp(`${INK_MARKER_START}[\\s\\S]*?${INK_MARKER_END}`), ''
        ).trimEnd();
      }

      setNote(fetchedNote);
      setIsDirty(false);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to fetch note';
      console.error('❌ Fetch error:', errorMsg);
      setError(errorMsg);
      setNote(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  // ============ LIFECYCLE ============
  useEffect(() => {
    fetchNote();
  }, [fetchNote]);

  // ============ AUTO-SAVE ============
  useEffect(() => {
    if (!autoSaveEnabled || !isDirty || isSaving || !note?.id) return;

    const timer = setTimeout(() => {
      handleSave();
    }, 30000); // 30 seconds

    return () => clearTimeout(timer);
  }, [isDirty, autoSaveEnabled, note?.id]);

  // ============ WIKI-LINKS / BACKLINKS ============
  // Autocomplete source for [[ links — cached note list, filtered client-side.
  const searchNotes = useCallback(async (q: string) => {
    const now = Date.now();
    if (!notesCacheRef.current || now - notesCacheRef.current.at > 15000) {
      try {
        const res = await fetch('/api/notes?limit=200');
        const data = await res.json();
        const items = Array.isArray(data)
          ? data.map((n: { id: string; title: string }) => ({ id: n.id, title: n.title }))
          : [];
        notesCacheRef.current = { at: now, items };
      } catch {
        notesCacheRef.current = { at: now, items: [] };
      }
    }
    const items = notesCacheRef.current.items.filter((n) => n.id !== id);
    const ql = q.trim().toLowerCase();
    const filtered = ql ? items.filter((n) => n.title.toLowerCase().includes(ql)) : items;
    return filtered.slice(0, 8);
  }, [id]);

  const handleWikiLinkClick = useCallback(
    (target: { id: string | null; label: string }) => {
      if (target.id) router.push(`/dashboard/user/sanchika/${target.id}`);
      else router.push(`/dashboard/user/sanchika/new?title=${encodeURIComponent(target.label)}`);
    },
    [router]
  );

  // Load inbound links (notes that link to this one).
  useEffect(() => {
    if (!note?.id) { setBacklinks([]); return; }
    let cancelled = false;
    fetch(`/api/notes/${note.id}/backlinks`)
      .then((r) => (r.ok ? r.json() : { backlinks: [] }))
      .then((d) => { if (!cancelled) setBacklinks(d.backlinks || []); })
      .catch(() => { if (!cancelled) setBacklinks([]); });
    return () => { cancelled = true; };
  }, [note?.id]);

  // ============ HANDLERS ============
  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!note) return;
    setNote({ ...note, title: e.target.value });
    setIsDirty(true);
  };

  const handleContentChange = (newContent: string) => {
    if (!note) return;
    setNote({ ...note, content: newContent });
    setIsDirty(true);

    // Calculate word count
    const text = newContent.replace(/<[^>]*>/g, ' '); // Strip HTML tags
    const words = text.trim().split(/\s+/).filter((word: string) => word.length > 0).length;
    const characters = text.replace(/\s/g, '').length;
    setWordCount({ words, characters });
  };

  const handleSubjectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (!note) return;
    setNote({ ...note, subject: e.target.value });
    setIsDirty(true);
  };

  const updatePageSetting = (key: 'orientation' | 'page_size' | 'page_margins', value: string) => {
    if (!note) return;
    setNote({ ...note, [key]: value });
    setIsDirty(true);
  };

  const handleChapterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!note) return;
    setNote({ ...note, chapter: e.target.value });
    setIsDirty(true);
  };

  const handleAddTag = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && tagInput.trim()) {
      e.preventDefault();
      if (!note) return;

      const newTag = tagInput.trim().toLowerCase();
      if (!note.tags?.includes(newTag)) {
        setNote({
          ...note,
          tags: [...(note.tags || []), newTag],
        });
        setTagInput('');
        setIsDirty(true);
      }
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    if (!note) return;
    setNote({
      ...note,
      tags: note.tags?.filter((tag) => tag !== tagToRemove) || [],
    });
    setIsDirty(true);
  };

  const handleToggleFavorite = () => {
    if (!note) return;
    setNote({ ...note, is_favorite: !note.is_favorite });
    setIsDirty(true);
  };

  const handleTogglePin = () => {
    if (!note) return;
    setNote({ ...note, is_pinned: !note.is_pinned });
    setIsDirty(true);
  };

  // ============ SAVE NOTE ============
  const handleSave = async () => {
    if (!note) {
      setError('No note to save');
      return;
    }

    try {
      setIsSaving(true);
      setError(null);

      // Validation
      if (!note.title.trim()) {
        throw new Error('Note title cannot be empty');
      }

      const svgString = inkControlsRef.current.getSVG ? inkControlsRef.current.getSVG() : '';
      const contentWithInk = embedInkInContent(note.content, svgString);

      // CREATE NEW NOTE
      if (!note.id || note.id === '') {
        console.log('📝 Creating new note...');
        const response = await fetch('/api/notes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: note.title,
            content: contentWithInk,
            content_format: note.content_format,
            subject: note.subject,
            chapter: note.chapter,
            board: note.board,
            class_level: note.class_level,
            tags: note.tags,
            is_favorite: note.is_favorite,
            is_pinned: note.is_pinned,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || 'Failed to create note');
        }

        const result = await response.json();
        const newNote = result.note;
        console.log('✅ Note created:', newNote.id);

        setNote(newNote);
        setIsDirty(false);

        // Show success and redirect to dashboard
        console.log('✨ Redirecting to dashboard...');
        setTimeout(() => {
          router.push('/dashboard/user/sanchika');
        }, 500);
        return;
      }

      // UPDATE EXISTING NOTE
      console.log('📝 Updating note:', note.id);
      const response = await fetch(`/api/notes/${note.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...note, content: contentWithInk }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to update note');
      }

      const result = await response.json();
      console.log('✅ Note updated');

      setNote(result.note);
      setIsDirty(false);
      setLastSaved(new Date());

      // Stay on editor for updates - no redirect
      console.log('✨ Note saved successfully');
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to save note';
      console.error('❌ Save error:', errorMsg);
      setError(errorMsg);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!note || !note.id) {
      setError('Cannot delete unsaved note');
      return;
    }

    if (!confirm('Are you sure you want to delete this note? This cannot be undone.')) {
      return;
    }

    try {
      setIsSaving(true);
      const response = await fetch(`/api/notes/${note.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete note');
      }

      console.log('✅ Note deleted');
      router.push('/dashboard/user/sanchika');
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to delete note';
      console.error('❌ Delete error:', errorMsg);
      setError(errorMsg);
    } finally {
      setIsSaving(false);
    }
  };

  // ============ RENDER ============
  if (loading) {
    return (
      <div className="note-editor-container loading">
        <div className="spinner">Loading note...</div>
      </div>
    );
  }

  if (error && !note) {
    return (
      <div className="note-editor-container error">
        <div className="error-container">
          <h2>Error</h2>
          <p>{error}</p>
          <button onClick={() => router.back()} className="btn-secondary">
            Go Back
          </button>
        </div>
      </div>
    );
  }

  if (!note) {
    return (
      <div className="note-editor-container error">
        <div className="error-container">
          <h2>Note not found</h2>
          <button onClick={() => router.back()} className="btn-secondary">
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="note-editor-container">
      {/* ============ COMPACT HEADER ============ */}
      <div className="compact-header">
        {/* Left: Back button */}
        <button
          onClick={() => router.push('/dashboard/user/sanchika')}
          className="header-back-btn"
          title="Back to Notes"
        >
          <ArrowLeft className="h-5 w-5" />
          <span className="back-text">Back</span>
        </button>

        {/* Center: Title with status */}
        <div className="header-title-section">
          <input
            type="text"
            value={note.title}
            onChange={handleTitleChange}
            placeholder="Untitled Note"
            className="header-title-input"
            disabled={isSaving}
          />
          {/* Status dot */}
          {isDirty && (
            <span className="status-dot unsaved" title="Unsaved changes">
              <span className="dot-pulse"></span>
            </span>
          )}
          {!isDirty && lastSaved && (
            <span className="status-dot saved" title="All changes saved">
              <span className="dot-saved"></span>
            </span>
          )}
        </div>

        {/* Right: Actions */}
        <div className="header-actions">
          {/* Save button - always visible */}
          <button
            onClick={handleSave}
            disabled={!isDirty || isSaving}
            className="header-save-btn"
            title={isDirty ? 'Save changes' : 'No changes to save'}
          >
            {isSaving ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Save className="h-5 w-5" />
            )}
            <span className="save-text">Save</span>
          </button>

          {/* More menu */}
          <div className="more-menu-container">
            <button
              onClick={() => setShowMoreMenu(!showMoreMenu)}
              className="header-more-btn"
              title="More actions"
            >
              <MoreVertical className="h-5 w-5" />
            </button>

            {showMoreMenu && (
              <>
                <div className="menu-backdrop" onClick={() => setShowMoreMenu(false)} />
                <div className="more-menu-dropdown">
                  <button
                    onClick={() => { handleToggleFavorite(); setShowMoreMenu(false); }}
                    className="menu-item"
                  >
                    <Star className={`h-4 w-4 ${note.is_favorite ? 'fill-yellow-400 text-yellow-400' : ''}`} />
                    <span>{note.is_favorite ? 'Remove from favorites' : 'Add to favorites'}</span>
                  </button>
                  <button
                    onClick={() => { handleTogglePin(); setShowMoreMenu(false); }}
                    className="menu-item"
                  >
                    <Pin className={`h-4 w-4 ${note.is_pinned ? 'fill-blue-500 text-primary' : ''}`} />
                    <span>{note.is_pinned ? 'Unpin note' : 'Pin note'}</span>
                  </button>
                  <button
                    onClick={() => { setAutoSaveEnabled(!autoSaveEnabled); setShowMoreMenu(false); }}
                    className="menu-item"
                  >
                    <Settings className={`h-4 w-4 ${autoSaveEnabled ? 'text-green-500' : ''}`} />
                    <span>Auto-save: {autoSaveEnabled ? 'ON' : 'OFF'}</span>
                  </button>
                  <div className="menu-divider" />
                  <button
                    onClick={() => { handleDelete(); setShowMoreMenu(false); }}
                    className="menu-item danger"
                    disabled={!note.id}
                  >
                    <Trash2 className="h-4 w-4" />
                    <span>Delete note</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ============ TABS ============ */}
      <div className="note-tabs">
        <button
          className={`tab-button ${activeTab === 'edit' ? 'active' : ''}`}
          onClick={() => setActiveTab('edit')}
        >
          <Edit3 className="h-5 w-5" />
          <span>Edit</span>
        </button>
        <button
          className={`tab-button ${activeTab === 'preview' ? 'active' : ''}`}
          onClick={() => setActiveTab('preview')}
        >
          <Eye className="h-5 w-5" />
          <span>Preview</span>
        </button>
        <button
          className={`tab-button ${activeTab === 'settings' ? 'active' : ''}`}
          onClick={() => setActiveTab('settings')}
        >
          <Settings className="h-5 w-5" />
          <span>Settings</span>
        </button>
      </div>

      {/* ============ CHECKLIST PROGRESS ============ */}
      {note.content && (
        <div className="px-6 pt-4">
          <ChecklistProgressBar noteContent={note.content} />
        </div>
      )}

      {/* ============ SMART DETECTION ============ */}
      {note.id && note.content && note.content.length > 50 && activeTab !== 'edit' && (
        <div className="px-6 pt-4">
          <SmartDetectionPanel
            noteId={note.id}
            content={note.content}
            onRunDetection={() => {
              // Optionally refresh note data after detection
              console.log('Smart detection completed');
            }}
          />
        </div>
      )}

      {/* ============ CONTENT ============ */}
      <div className="note-content">
        {/* EDIT TAB */}
        {activeTab === 'edit' && (
          <div className="tab-content edit-tab">
            {/* MODE SELECTOR */}
            <div className="editor-mode-selector">
              <button
                className={`mode-button ${editorMode === 'text' ? 'active' : ''}`}
                onClick={() => setEditorMode('text')}
                title="Text Editor"
              >
                <FileText className="h-5 w-5" />
                <span>Text</span>
              </button>
              <button
                className={`mode-button ${editorMode === 'draw' ? 'active' : ''}`}
                onClick={() => setEditorMode('draw')}
                title="Drawing Canvas"
              >
                <PenTool className="h-5 w-5" />
                <span>Draw</span>
              </button>
              <button
                className={`mode-button ${editorMode === 'attach' ? 'active' : ''}`}
                onClick={() => setEditorMode('attach')}
                title="PDF Attachments"
              >
                <Paperclip className="h-5 w-5" />
                <span>Attach</span>
              </button>
              <button
                className={`mode-button ${editorMode === 'voice' ? 'active' : ''}`}
                onClick={() => setEditorMode('voice')}
                title="Voice Notes"
              >
                <Mic className="h-5 w-5" />
                <span>Voice</span>
              </button>
            </div>

            {/* TEXT MODE */}
            {editorMode === 'text' && (
              <div className="editor-mode-content">
                <RichTextEditor
                  content={note.content}
                  onChange={handleContentChange}
                  editable={!isSaving}
                  searchNotes={searchNotes}
                  onWikiLinkClick={handleWikiLinkClick}
                  pageLayout={{ size: note.page_size, orientation: note.orientation, margins: note.page_margins }}
                  inkControls={inkControlsRef.current}
                  initialInkSVG={initialInkSVG}
                />
              </div>
            )}

            {/* DRAW MODE */}
            {editorMode === 'draw' && note.id && (
              <div className="editor-mode-content">
                <DrawingCanvas
                  noteId={note.id}
                  onSave={async (imageData, ocrText) => {
                    try {
                      const response = await fetch('/api/drawings', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ noteId: note.id, imageData, ocrText }),
                      });

                      if (response.ok) {
                        console.log('✅ Drawing saved successfully');
                        alert('Drawing saved successfully!');
                      } else {
                        const errorData = await response.json();
                        console.error('❌ Failed to save drawing:', errorData);
                        alert('Failed to save drawing. Please try again.');
                      }
                    } catch (error) {
                      console.error('❌ Error saving drawing:', error);
                      alert('Error saving drawing. Please check your connection.');
                    }
                  }}
                />
              </div>
            )}

            {/* ATTACH MODE */}
            {editorMode === 'attach' && note.id && (
              <div className="editor-mode-content">
                <PDFAttachmentsPanel noteId={note.id} />
              </div>
            )}

            {/* VOICE MODE */}
            {editorMode === 'voice' && note.id && (
              <div className="editor-mode-content">
                <VoiceNotesPanel noteId={note.id} />
              </div>
            )}

            {/* BACKLINKS (inbound [[ links) */}
            {note.id && backlinks.length > 0 && (
              <div className="mt-6 border-t border-border pt-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  Linked references ({backlinks.length})
                </h3>
                <div className="space-y-1">
                  {backlinks.map((b) => (
                    <button
                      key={b.id}
                      onClick={() => router.push(`/dashboard/user/sanchika/${b.id}`)}
                      className="w-full flex items-center gap-2 text-left px-3 py-2 rounded-lg text-sm text-foreground hover:bg-primary/10 transition-colors"
                    >
                      <span className="text-primary">↩</span>
                      <span className="font-medium truncate">{b.title || 'Untitled'}</span>
                      {b.subject && <span className="text-xs text-muted-foreground">· {b.subject}</span>}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* PREVIEW TAB */}
        {activeTab === 'preview' && (
          <div className="tab-content preview-tab">
            <div className="preview-content">
              <h1>{note.title}</h1>
              <div
                className="preview-body"
                dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(getCombinedHtml(note.content)) }}
              />
            </div>
          </div>
        )}

        {/* SETTINGS TAB */}
        {activeTab === 'settings' && (
          <div className="tab-content settings-tab">
            <div className="settings-form">
              <div className="form-group">
                <label>Subject</label>
                <select
                  value={note.subject || ''}
                  onChange={handleSubjectChange}
                  disabled={isSaving}
                >
                  <option value="">Select a subject</option>
                  <option value="Mathematics">Mathematics</option>
                  <option value="Science">Science</option>
                  <option value="English">English</option>
                  <option value="History">History</option>
                  <option value="Geography">Geography</option>
                  <option value="Civics">Civics</option>
                  <option value="Economics">Economics</option>
                  <option value="Hindi">Hindi</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div className="form-group">
                <label>Chapter</label>
                <input
                  type="text"
                  value={note.chapter || ''}
                  onChange={handleChapterChange}
                  placeholder="e.g., Chapter 5"
                  disabled={isSaving}
                />
              </div>

              <div className="form-group">
                <label>Tags</label>
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={handleAddTag}
                  placeholder="Type and press Enter to add..."
                  disabled={isSaving}
                />
                <div className="tags-container">
                  {note.tags?.map((tag) => (
                    <span key={tag} className="tag">
                      {tag}
                      <button
                        onClick={() => handleRemoveTag(tag)}
                        className="tag-remove"
                        disabled={isSaving}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label className="form-label-gradient">
                  <Palette className="h-5 w-5" />
                  Cover Design
                </label>
                <button
                  onClick={() => setShowCoverPicker(true)}
                  className="cover-design-button"
                  disabled={isSaving}
                >
                  <Palette className="h-5 w-5" />
                  <span>Customize Cover Design</span>
                </button>
                <div className="cover-info">
                  <div className="cover-preview">
                    <div
                      className="cover-preview-spine"
                      style={{ background: note.spine_color || '#3B82F6' }}
                    />
                    <div className="cover-preview-text">
                      <span className="cover-preview-label">Current Design:</span>
                      <span className="cover-preview-value">{note.cover_design || 'solid-blue'}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label-gradient">
                  <FileText className="h-5 w-5" />
                  Page Layout
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={{ fontSize: 12, color: '#6b7280' }}>Size</label>
                    <select value={note.page_size || 'A4'} onChange={(e) => updatePageSetting('page_size', e.target.value)} disabled={isSaving}>
                      <option value="A4">A4</option>
                      <option value="Letter">Letter</option>
                      <option value="Legal">Legal</option>
                      <option value="A5">A5</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 12, color: '#6b7280' }}>Orientation</label>
                    <select value={note.orientation || 'portrait'} onChange={(e) => updatePageSetting('orientation', e.target.value)} disabled={isSaving}>
                      <option value="portrait">Portrait</option>
                      <option value="landscape">Landscape</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 12, color: '#6b7280' }}>Margins</label>
                    <select value={note.page_margins || 'normal'} onChange={(e) => updatePageSetting('page_margins', e.target.value)} disabled={isSaving}>
                      <option value="normal">Normal (1in)</option>
                      <option value="narrow">Narrow (0.5in)</option>
                      <option value="wide">Wide (1.5in)</option>
                      <option value="none">None</option>
                    </select>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                    <button
                      type="button"
                      onClick={() => window.print()}
                      disabled={isSaving}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer', fontSize: 14 }}
                    >
                      <FileText className="h-4 w-4" /> Print / Export PDF
                    </button>
                  </div>
                </div>
              </div>

              <div className="form-group">
                <label>Metadata</label>
                <div className="metadata-info">
                  <p>
                    <strong>Created:</strong> {new Date(note.created_at).toLocaleString()}
                  </p>
                  <p>
                    <strong>Updated:</strong> {new Date(note.updated_at).toLocaleString()}
                  </p>
                  {note.id && <p>
                    <strong>ID:</strong> {note.id}
                  </p>}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ============ COVER DESIGN PICKER ============ */}
      {showCoverPicker && (
        <CoverDesignPicker
          currentCoverDesign={note.cover_design}
          currentSpineColor={note.spine_color}
          onSelect={(coverDesign, spineColor) => {
            setNote({ ...note, cover_design: coverDesign, spine_color: spineColor });
            setIsDirty(true);
            setShowCoverPicker(false);
          }}
          onClose={() => setShowCoverPicker(false)}
        />
      )}

      {/* ============ STYLES ============ */}
      <style jsx>{`
        /* ============ CONTAINER ============ */
        .note-editor-container {
          display: flex;
          flex-direction: column;
          min-height: 100vh;
          background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
          background-attachment: fixed;
          animation: fadeIn 0.3s ease-out;
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .note-editor-container.loading,
        .note-editor-container.error {
          justify-content: center;
          align-items: center;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        }

        .spinner {
          font-size: 18px;
          color: white;
        }

        .error-container {
          text-align: center;
          padding: 40px;
          background: white;
          border-radius: 16px;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
          max-width: 500px;
        }

        .error-container h2 {
          color: #ef4444;
          margin-bottom: 16px;
          font-size: 24px;
        }

        .error-container p {
          color: #6b7280;
          margin-bottom: 24px;
        }

        /* ============ COMPACT HEADER ============ */
        .compact-header {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 16px;
          background: rgba(255, 255, 255, 0.95);
          backdrop-filter: blur(20px);
          border-bottom: 1px solid rgba(0, 0, 0, 0.06);
          position: sticky;
          top: 0;
          z-index: 20;
        }

        .header-back-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 12px;
          background: #f3f4f6;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          color: #374151;
          font-weight: 500;
          font-size: 14px;
          cursor: pointer;
          transition: all 0.15s;
          flex-shrink: 0;
        }

        .header-back-btn:hover {
          background: #e5e7eb;
        }

        .header-title-section {
          flex: 1;
          display: flex;
          align-items: center;
          gap: 8px;
          min-width: 0;
        }

        .header-title-input {
          flex: 1;
          font-size: 18px;
          font-weight: 600;
          border: none;
          background: transparent;
          color: #1f2937;
          outline: none;
          padding: 6px 0;
          min-width: 0;
        }

        .header-title-input:focus {
          outline: none;
        }

        .header-title-input::placeholder {
          color: #9ca3af;
        }

        /* Status dot */
        .status-dot {
          flex-shrink: 0;
          width: 10px;
          height: 10px;
          border-radius: 50%;
          position: relative;
        }

        .status-dot.unsaved .dot-pulse {
          width: 10px;
          height: 10px;
          background: #f59e0b;
          border-radius: 50%;
          display: block;
          animation: pulse-dot 1.5s infinite;
        }

        .status-dot.saved .dot-saved {
          width: 10px;
          height: 10px;
          background: #10b981;
          border-radius: 50%;
          display: block;
        }

        @keyframes pulse-dot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.8); }
        }

        .header-actions {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-shrink: 0;
        }

        .header-save-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 16px;
          background: linear-gradient(135deg, #f97316 0%, #3b82f6 100%);
          color: white;
          border: none;
          border-radius: 8px;
          font-weight: 600;
          font-size: 14px;
          cursor: pointer;
          transition: all 0.15s;
        }

        .header-save-btn:hover:not(:disabled) {
          box-shadow: 0 4px 12px rgba(249, 115, 22, 0.3);
        }

        .header-save-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .header-more-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 36px;
          height: 36px;
          background: #f3f4f6;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          color: #6b7280;
          cursor: pointer;
          transition: all 0.15s;
        }

        .header-more-btn:hover {
          background: #e5e7eb;
          color: #374151;
        }

        /* More menu dropdown */
        .more-menu-container {
          position: relative;
        }

        .menu-backdrop {
          position: fixed;
          inset: 0;
          z-index: 40;
        }

        .more-menu-dropdown {
          position: absolute;
          top: calc(100% + 8px);
          right: 0;
          min-width: 200px;
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15);
          padding: 6px;
          z-index: 50;
          animation: slideDown 0.15s ease-out;
        }

        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .menu-item {
          display: flex;
          align-items: center;
          gap: 10px;
          width: 100%;
          padding: 10px 12px;
          background: transparent;
          border: none;
          border-radius: 8px;
          font-size: 14px;
          color: #374151;
          cursor: pointer;
          transition: background 0.15s;
          text-align: left;
        }

        .menu-item:hover:not(:disabled) {
          background: #f3f4f6;
        }

        .menu-item.danger {
          color: #dc2626;
        }

        .menu-item.danger:hover:not(:disabled) {
          background: #fef2f2;
        }

        .menu-item:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .menu-divider {
          height: 1px;
          background: #e5e7eb;
          margin: 6px 0;
        }

        /* ============ RESPONSIVE ============ */
        @media (max-width: 640px) {
          .back-text {
            display: none;
          }

          .save-text {
            display: none;
          }

          .header-back-btn {
            padding: 10px;
            min-width: 44px;
            min-height: 44px;
            justify-content: center;
          }

          .header-save-btn {
            padding: 10px;
            min-width: 44px;
            min-height: 44px;
            justify-content: center;
          }

          .header-more-btn {
            min-width: 44px;
            min-height: 44px;
          }

          .header-title-input {
            font-size: 16px;
          }

          .compact-header {
            padding: 8px 12px;
            gap: 8px;
          }
        }

        @media (min-width: 641px) and (max-width: 768px) {
          .header-title-input {
            font-size: 17px;
          }
        }

        /* Hide old styles - keep for backward compatibility */
        .breadcrumb-section {
          display: none;
        }

        .note-header {
          display: none;
        }

        .unsaved-indicator {
          display: flex;
          align-items: center;
          gap: 6px;
          color: #f59e0b;
          font-size: 13px;
          font-weight: 600;
          padding: 6px 12px;
          background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
          border-radius: 20px;
          animation: pulse 2s infinite;
        }

        .pulse-dot {
          width: 8px;
          height: 8px;
          background: #f59e0b;
          border-radius: 50%;
          animation: pulse-dot 1.5s infinite;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.8; transform: scale(0.98); }
        }

        @keyframes pulse-dot {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }

        .note-header-actions {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
        }

        .error-message {
          color: #ef4444;
          font-size: 12px;
          max-width: 200px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        /* ============ BUTTONS ============ */
        .btn-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          background: white;
          border: 1px solid #e5e7eb;
          padding: 6px;
          border-radius: 6px;
          cursor: pointer;
          color: #6b7280;
          transition: all 0.2s;
        }

        .btn-icon:hover:not(:disabled) {
          background: #f3f4f6;
          border-color: #d1d5db;
        }

        .btn-icon.active.favorite {
          background: #fef3c7;
          border-color: #fbbf24;
          color: #f59e0b;
        }

        .btn-icon.active.pinned {
          background: #dbeafe;
          border-color: #60a5fa;
          color: #3b82f6;
        }

        .btn-icon:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .btn-primary,
        .btn-secondary,
        .btn-danger {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 14px;
          border: none;
          border-radius: 8px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          font-size: 13px;
        }

        .btn-primary {
          background: linear-gradient(135deg, #f97316 0%, #3b82f6 100%);
          color: white;
          box-shadow: 0 2px 8px rgba(249, 115, 22, 0.25);
        }

        .btn-primary:hover:not(:disabled) {
          box-shadow: 0 4px 12px rgba(249, 115, 22, 0.35);
        }

        .btn-primary:active:not(:disabled) {
          transform: scale(0.98);
        }

        .btn-secondary {
          background: #f3f4f6;
          color: #374151;
          border: 1px solid #d1d5db;
        }

        .btn-secondary:hover:not(:disabled) {
          background: #e5e7eb;
        }

        .btn-danger {
          background: transparent;
          color: #dc2626;
          border: 1px solid #fca5a5;
        }

        .btn-danger:hover:not(:disabled) {
          background: #fef2f2;
          border-color: #ef4444;
        }

        button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
          transform: none !important;
        }

        /* ============ TABS ============ */
        .note-tabs {
          display: flex;
          gap: 0;
          background: rgba(255, 255, 255, 0.95);
          backdrop-filter: blur(10px);
          border-bottom: 1px solid #e5e7eb;
          padding: 0 16px;
        }

        .tab-button {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 10px 16px;
          border: none;
          background: transparent;
          cursor: pointer;
          color: #6b7280;
          font-weight: 500;
          font-size: 13px;
          transition: all 0.2s;
          border-bottom: 2px solid transparent;
          position: relative;
        }

        .tab-button:hover {
          color: #1f2937;
          background: rgba(0, 0, 0, 0.02);
        }

        .tab-button.active {
          color: #f97316;
          border-bottom-color: #f97316;
        }

        .tab-button.active::after {
          display: none;
        }

        /* ============ CONTENT ============ */
        .note-content {
          flex: 1;
          overflow-y: auto;
          padding: 32px 24px;
          background: linear-gradient(135deg, #fafbfc 0%, #f0f4f8 100%);
        }

        .tab-content {
          animation: fadeInUp 0.4s ease-out;
          max-width: 1200px;
          margin: 0 auto;
        }

        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .edit-tab {
          max-width: 1200px;
          display: flex;
          flex-direction: column;
          gap: 0;
        }

        .preview-tab {
          max-width: 900px;
        }

        /* ============ EDITOR MODE SELECTOR ============ */
        .editor-mode-selector {
          display: flex;
          gap: 6px;
          padding: 10px 16px;
          background: white;
          border-radius: 8px 8px 0 0;
          border: 1px solid #e5e7eb;
          border-bottom: none;
        }

        .mode-button {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 14px;
          border: 1px solid #e5e7eb;
          background: #ffffff;
          border-radius: 6px;
          cursor: pointer;
          color: #6b7280;
          font-weight: 500;
          font-size: 13px;
          transition: all 0.2s;
        }

        .mode-button:hover:not(.active) {
          border-color: #d1d5db;
          background: #f9fafb;
        }

        .mode-button.active {
          background: linear-gradient(135deg, #f97316 0%, #3b82f6 100%);
          border-color: transparent;
          color: white;
          box-shadow: 0 2px 8px rgba(249, 115, 22, 0.3);
        }

        .editor-mode-content {
          background: white;
          border: 2px solid #e5e7eb;
          border-top: none;
          border-radius: 0 0 12px 12px;
          min-height: 500px;
          animation: fadeIn 0.3s ease-out;
        }

        .preview-content {
          background: white;
          padding: 32px;
          border-radius: 16px;
          border: 2px solid #e5e7eb;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
        }

        .preview-content h1 {
          margin-top: 0;
          color: #1f2937;
          font-size: 32px;
          font-weight: 700;
          background: linear-gradient(135deg, #f97316 0%, #3b82f6 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .preview-body {
          color: #374151;
          line-height: 1.8;
          font-size: 16px;
        }

        /* ============ SETTINGS TAB ============ */
        .settings-tab {
          max-width: 700px;
        }

        .settings-form {
          display: flex;
          flex-direction: column;
          gap: 32px;
          background: white;
          padding: 32px;
          border-radius: 16px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .form-group label {
          font-weight: 700;
          color: #1f2937;
          font-size: 15px;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .form-label-gradient {
          background: linear-gradient(135deg, #f97316 0%, #3b82f6 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .form-group input,
        .form-group select {
          padding: 12px 16px;
          border: 2px solid #e5e7eb;
          border-radius: 10px;
          background: white;
          color: #1f2937;
          font-family: inherit;
          font-size: 14px;
          transition: all 0.2s;
        }

        .form-group input:focus,
        .form-group select:focus {
          outline: none;
          border-color: #f97316;
          box-shadow: 0 0 0 4px rgba(249, 115, 22, 0.1);
        }

        .tags-container {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin-top: 8px;
        }

        .tag {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 8px 16px;
          background: linear-gradient(135deg, #f97316 0%, #3b82f6 100%);
          color: white;
          border-radius: 20px;
          font-size: 13px;
          font-weight: 600;
          box-shadow: 0 2px 8px rgba(249, 115, 22, 0.3);
          transition: all 0.2s;
        }

        .tag:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(249, 115, 22, 0.4);
        }

        .tag-remove {
          background: rgba(255, 255, 255, 0.3);
          border: none;
          color: white;
          cursor: pointer;
          font-size: 16px;
          padding: 4px;
          line-height: 1;
          border-radius: 50%;
          width: 20px;
          height: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
        }

        .tag-remove:hover {
          background: rgba(255, 255, 255, 0.5);
          transform: rotate(90deg);
        }

        /* ============ COVER DESIGN BUTTON ============ */
        .cover-design-button {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 14px 20px;
          background: linear-gradient(135deg, #f97316 0%, #3b82f6 100%);
          color: white;
          border: none;
          border-radius: 12px;
          cursor: pointer;
          font-weight: 600;
          font-size: 15px;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          box-shadow: 0 4px 12px rgba(249, 115, 22, 0.3);
        }

        .cover-design-button:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 8px 20px rgba(249, 115, 22, 0.4);
        }

        .cover-design-button:active:not(:disabled) {
          transform: translateY(0);
        }

        .cover-info {
          margin-top: 12px;
        }

        .cover-preview {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 16px;
          background: linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%);
          border-radius: 10px;
          border: 2px solid #d1d5db;
        }

        .cover-preview-spine {
          width: 8px;
          height: 40px;
          border-radius: 4px;
          box-shadow: inset -2px 0 4px rgba(0, 0, 0, 0.2);
        }

        .cover-preview-text {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .cover-preview-label {
          font-size: 12px;
          color: #6b7280;
          font-weight: 600;
        }

        .cover-preview-value {
          font-size: 14px;
          color: #1f2937;
          font-weight: 700;
        }

        .metadata-info {
          background: linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%);
          padding: 16px;
          border-radius: 12px;
          font-size: 14px;
          border: 2px solid #d1d5db;
        }

        .metadata-info p {
          margin: 8px 0;
          color: #6b7280;
        }

        .metadata-info strong {
          color: #1f2937;
          font-weight: 700;
        }

        /* ============ RESPONSIVE ============ */
        @media (max-width: 768px) {
          .breadcrumb-section {
            flex-direction: column;
            align-items: flex-start;
          }

          .note-header {
            flex-direction: column;
            align-items: stretch;
          }

          .note-header-actions {
            justify-content: flex-end;
          }

          .note-tabs {
            overflow-x: auto;
          }

          .tab-button {
            padding: 12px 16px;
            font-size: 14px;
          }

          .btn-primary span,
          .btn-danger span {
            display: none;
          }
        }
      `}</style>
    </div>
  );
}

