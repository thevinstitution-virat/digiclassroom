# Sanchika Editor Source Code

## src/app/dashboard/user/sanchika/[id]/page.tsx
```tsx
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

      setNote(data.note);
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

      // CREATE NEW NOTE
      if (!note.id || note.id === '') {
        console.log('📝 Creating new note...');
        const response = await fetch('/api/notes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: note.title,
            content: note.content,
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
        body: JSON.stringify(note),
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
                    <Pin className={`h-4 w-4 ${note.is_pinned ? 'fill-blue-500 text-blue-500' : ''}`} />
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
              <div className="mt-6 border-t border-gray-200 dark:border-gray-700 pt-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
                  Linked references ({backlinks.length})
                </h3>
                <div className="space-y-1">
                  {backlinks.map((b) => (
                    <button
                      key={b.id}
                      onClick={() => router.push(`/dashboard/user/sanchika/${b.id}`)}
                      className="w-full flex items-center gap-2 text-left px-3 py-2 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors"
                    >
                      <span className="text-purple-500">↩</span>
                      <span className="font-medium truncate">{b.title || 'Untitled'}</span>
                      {b.subject && <span className="text-xs text-gray-400">· {b.subject}</span>}
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


```

## src/components/workspace/sanchika/RichTextEditor.tsx
```tsx
'use client';

/**
 * Sanchika Rich Text Editor (TipTap)
 *
 * Phase 0 of the "Obsidian-class" Sanchika upgrade: replaces the previous
 * <textarea> stub with a real WYSIWYG editor built on the @tiptap/* packages
 * that were already installed but unused.
 *
 * Backward-compatible props: the editor page calls this with
 *   <RichTextEditor content={...} onChange={...} editable={...} />
 * while older call sites used { initialContent, readOnly }. Both are accepted.
 *
 * Content is treated as HTML (matching the note preview, which renders HTML).
 * If a note is stored in the multi-page JSON format (multiPageContent.ts),
 * it is flattened to combined HTML for editing.
 */

import React, { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import { useEditor, EditorContent, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import Highlight from '@tiptap/extension-highlight';
import TextAlign from '@tiptap/extension-text-align';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { Table, TableRow, TableHeader, TableCell } from '@tiptap/extension-table';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { WikiLink } from './extensions/WikiLink';
import { PageBreak } from './extensions/PageBreak';
import { common, createLowlight } from 'lowlight';
import {
  Bold as BoldIcon,
  Italic as ItalicIcon,
  Underline as UnderlineIcon,
  Strikethrough,
  Code,
  Code2,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  ListChecks,
  Quote,
  Minus,
  Link as LinkIcon,
  Image as ImageIcon,
  Table as TableIcon,
  Highlighter,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Undo2,
  Redo2,
  FileText,
  Plus,
  SeparatorHorizontal,
  FilePlus,
  FilePlus2,
} from 'lucide-react';

const lowlight = createLowlight(common);

interface RichTextEditorProps {
  /** Current content (HTML, or multi-page JSON). Preferred prop. */
  content?: string;
  /** Legacy alias for `content`. */
  initialContent?: string;
  /** Called with the editor's HTML on every change. */
  onChange?: (content: string) => void;
  /** Whether the editor is editable. Preferred prop. */
  editable?: boolean;
  /** Legacy inverse of `editable`. */
  readOnly?: boolean;
  className?: string;
  placeholder?: string;
  autoFocus?: boolean;
  hideToolbar?: boolean;
  /** Provide note search results for the [[ wiki-link autocomplete. */
  searchNotes?: (query: string) => Promise<Array<{ id: string; title: string }>>;
  /** Called when a wiki-link is clicked (navigate to the target note). */
  onWikiLinkClick?: (target: { id: string | null; label: string }) => void;
  /** Page layout for the document. */
  pageLayout?: { size?: string; orientation?: string; margins?: string };
}

/** Flatten the multi-page JSON format to combined HTML; pass HTML through. */
function normalizeToHtml(raw: string | undefined): string {
  if (!raw) return '';
  const trimmed = raw.trim();
  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && parsed.version === 2 && Array.isArray(parsed.pages)) {
        return parsed.pages.map((p: { html?: string }) => p?.html || '').join('\n');
      }
    } catch {
      /* not JSON — treat as HTML */
    }
  }
  return raw;
}

function ToolbarButton({
  onClick,
  active,
  disabled,
  title,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={!!active}
      disabled={disabled}
      // preserve the editor's selection when clicking a toolbar button
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`stb${active ? ' stb-active' : ''}`}
    >
      {children}
    </button>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  const setLink = () => {
    const previous = (editor.getAttributes('link').href as string) || '';
    const url = window.prompt('Link URL', previous || 'https://');
    if (url === null) return;
    if (url.trim() === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url.trim() }).run();
  };

  const addImage = () => {
    const url = window.prompt('Image URL');
    if (url && url.trim()) editor.chain().focus().setImage({ src: url.trim() }).run();
  };

  const addTable = () =>
    editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();

  // Find the start/end doc positions of the page the caret is in (bounded by page breaks).
  const pageBounds = () => {
    const { doc, selection } = editor.state;
    const pos = selection.from;
    let start = 0;
    let end = doc.content.size;
    let foundEnd = false;
    doc.descendants((node, p) => {
      if (node.type.name === 'pageBreak') {
        const after = p + node.nodeSize;
        if (after <= pos) start = Math.max(start, after);
        else if (!foundEnd) { end = p; foundEnd = true; }
      }
    });
    return { start, end };
  };
  const newPageAfter = () => {
    const { end } = pageBounds();
    editor.chain().focus().insertContentAt(end, [{ type: 'pageBreak' }, { type: 'paragraph' }]).run();
  };
  const newPageBefore = () => {
    const { start } = pageBounds();
    editor.chain().focus().insertContentAt(start, [{ type: 'paragraph' }, { type: 'pageBreak' }]).run();
  };

  return (
    <div className="sanchika-toolbar" role="toolbar" aria-label="Formatting">
      <div className="stb-group">
        <ToolbarButton title="Bold (Ctrl+B)" active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}><BoldIcon size={16} /></ToolbarButton>
        <ToolbarButton title="Italic (Ctrl+I)" active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}><ItalicIcon size={16} /></ToolbarButton>
        <ToolbarButton title="Underline (Ctrl+U)" active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()}><UnderlineIcon size={16} /></ToolbarButton>
        <ToolbarButton title="Strikethrough" active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()}><Strikethrough size={16} /></ToolbarButton>
        <ToolbarButton title="Highlight" active={editor.isActive('highlight')} onClick={() => editor.chain().focus().toggleHighlight().run()}><Highlighter size={16} /></ToolbarButton>
        <ToolbarButton title="Inline code" active={editor.isActive('code')} onClick={() => editor.chain().focus().toggleCode().run()}><Code size={16} /></ToolbarButton>
      </div>

      <div className="stb-group">
        <ToolbarButton title="Heading 1" active={editor.isActive('heading', { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}><Heading1 size={16} /></ToolbarButton>
        <ToolbarButton title="Heading 2" active={editor.isActive('heading', { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}><Heading2 size={16} /></ToolbarButton>
        <ToolbarButton title="Heading 3" active={editor.isActive('heading', { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}><Heading3 size={16} /></ToolbarButton>
      </div>

      <div className="stb-group">
        <ToolbarButton title="Bullet list" active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()}><List size={16} /></ToolbarButton>
        <ToolbarButton title="Numbered list" active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()}><ListOrdered size={16} /></ToolbarButton>
        <ToolbarButton title="Checklist" active={editor.isActive('taskList')} onClick={() => editor.chain().focus().toggleTaskList().run()}><ListChecks size={16} /></ToolbarButton>
      </div>

      <div className="stb-group">
        <ToolbarButton title="Quote" active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()}><Quote size={16} /></ToolbarButton>
        <ToolbarButton title="Code block" active={editor.isActive('codeBlock')} onClick={() => editor.chain().focus().toggleCodeBlock().run()}><Code2 size={16} /></ToolbarButton>
        <ToolbarButton title="Divider" onClick={() => editor.chain().focus().setHorizontalRule().run()}><Minus size={16} /></ToolbarButton>
      </div>

      <div className="stb-group">
        <ToolbarButton title="Link" active={editor.isActive('link')} onClick={setLink}><LinkIcon size={16} /></ToolbarButton>
        <ToolbarButton title="Image (URL)" onClick={addImage}><ImageIcon size={16} /></ToolbarButton>
        <ToolbarButton title="Insert table" onClick={addTable}><TableIcon size={16} /></ToolbarButton>
      </div>

      <div className="stb-group">
        <ToolbarButton title="Insert page break" onClick={() => editor.chain().focus().setPageBreak().run()}><SeparatorHorizontal size={16} /></ToolbarButton>
        <ToolbarButton title="New page before this page" onClick={newPageBefore}><FilePlus2 size={16} /></ToolbarButton>
        <ToolbarButton title="New page after this page" onClick={newPageAfter}><FilePlus size={16} /></ToolbarButton>
      </div>

      <div className="stb-group">
        <ToolbarButton title="Align left" active={editor.isActive({ textAlign: 'left' })} onClick={() => editor.chain().focus().setTextAlign('left').run()}><AlignLeft size={16} /></ToolbarButton>
        <ToolbarButton title="Align center" active={editor.isActive({ textAlign: 'center' })} onClick={() => editor.chain().focus().setTextAlign('center').run()}><AlignCenter size={16} /></ToolbarButton>
        <ToolbarButton title="Align right" active={editor.isActive({ textAlign: 'right' })} onClick={() => editor.chain().focus().setTextAlign('right').run()}><AlignRight size={16} /></ToolbarButton>
      </div>

      <div className="stb-group">
        <ToolbarButton title="Undo (Ctrl+Z)" disabled={!editor.can().undo()} onClick={() => editor.chain().focus().undo().run()}><Undo2 size={16} /></ToolbarButton>
        <ToolbarButton title="Redo (Ctrl+Y)" disabled={!editor.can().redo()} onClick={() => editor.chain().focus().redo().run()}><Redo2 size={16} /></ToolbarButton>
      </div>
    </div>
  );
}

export function RichTextEditor(props: RichTextEditorProps) {
  const { content, initialContent, onChange, editable, readOnly, className, placeholder, autoFocus, hideToolbar, searchNotes, onWikiLinkClick, pageLayout } = props;

  const isEditable = editable ?? (readOnly === undefined ? true : !readOnly);

  // ----- page geometry (px @96dpi) -----
  const PAGE_SIZES: Record<string, [number, number]> = { A4: [794, 1123], Letter: [816, 1056], Legal: [816, 1344], A5: [559, 794] };
  const MARGIN_PX: Record<string, number> = { none: 0, narrow: 48, normal: 96, wide: 144 };
  const PRINT_MARGIN: Record<string, string> = { none: '0', narrow: '0.5in', normal: '1in', wide: '1.5in' };
  const pgSize = pageLayout?.size && PAGE_SIZES[pageLayout.size] ? pageLayout.size : 'A4';
  const pgOrient = pageLayout?.orientation === 'landscape' ? 'landscape' : 'portrait';
  let [pgW, pgH] = PAGE_SIZES[pgSize];
  if (pgOrient === 'landscape') [pgW, pgH] = [pgH, pgW];
  const pgMarginKey = pageLayout?.margins && MARGIN_PX[pageLayout.margins] !== undefined ? pageLayout.margins : 'normal';
  const pgPad = MARGIN_PX[pgMarginKey];
  const printMargin = PRINT_MARGIN[pgMarginKey];

  // Capture the initial content once (subsequent external updates handled below).
  const initialHtml = useMemo(() => normalizeToHtml(content ?? initialContent ?? ''), []); // eslint-disable-line react-hooks/exhaustive-deps

  const editor = useEditor({
    immediatelyRender: false,
    editable: isEditable,
    extensions: [
      // Underline / Link / codeBlock are disabled here and added explicitly so we
      // can use CodeBlockLowlight + a configured Link without duplicate extensions.
      StarterKit.configure({ codeBlock: false, link: false, underline: false } as never),
      Underline,
      Link.configure({ openOnClick: false, autolink: true, HTMLAttributes: { class: 'sanchika-link', rel: 'noopener noreferrer nofollow' } }),
      CodeBlockLowlight.configure({ lowlight }),
      Image.configure({ allowBase64: true, HTMLAttributes: { class: 'sanchika-img' } }),
      Placeholder.configure({ placeholder: placeholder || 'Start writing… use the toolbar to format. Wiki-links and slash commands are coming next.' }),
      Highlight,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      WikiLink,
      PageBreak,
    ],
    content: initialHtml,
    autofocus: autoFocus ? 'end' : false,
    onUpdate: ({ editor }) => onChange?.(editor.getHTML()),
    editorProps: {
      attributes: { class: 'sanchika-prose focus:outline-none', spellcheck: 'true' },
    },
  });

  // Sync external content changes (load / save) without clobbering the user's caret.
  useEffect(() => {
    if (!editor) return;
    const incoming = normalizeToHtml(content ?? initialContent ?? '');
    if (incoming !== editor.getHTML()) {
      editor.commands.setContent(incoming || '', { emitUpdate: false } as never);
    }
  }, [content]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync editable flag.
  useEffect(() => {
    if (editor) editor.setEditable(isEditable);
  }, [isEditable, editor]);

  // ---------- [[ wiki-link autocomplete ----------
  const [linkMenu, setLinkMenu] = useState<{ from: number; left: number; top: number } | null>(null);
  const [linkQuery, setLinkQuery] = useState('');
  const [linkResults, setLinkResults] = useState<Array<{ id: string; title: string }>>([]);
  const [linkActive, setLinkActive] = useState(0);
  const stateRef = useRef({ linkMenu, linkResults, linkActive, linkQuery });
  stateRef.current = { linkMenu, linkResults, linkActive, linkQuery };

  const closeLinkMenu = useCallback(() => {
    setLinkMenu(null);
    setLinkQuery('');
    setLinkResults([]);
    setLinkActive(0);
  }, []);

  const chooseLink = useCallback(
    (choice: { id: string | null; title: string }) => {
      const st = stateRef.current;
      if (!editor || !st.linkMenu) return;
      const label = (choice.title || '').trim();
      if (!label) { closeLinkMenu(); return; }
      const to = editor.state.selection.from;
      editor
        .chain()
        .focus()
        .deleteRange({ from: st.linkMenu.from, to })
        .insertContent([
          { type: 'wikiLink', attrs: { label, target: choice.id } },
          { type: 'text', text: ' ' },
        ])
        .run();
      closeLinkMenu();
    },
    [editor, closeLinkMenu]
  );

  // Detect an open "[[" before the caret and position the menu.
  useEffect(() => {
    if (!editor || !searchNotes) return;
    const detect = () => {
      const sel = editor.state.selection;
      if (!sel.empty) { setLinkMenu(null); return; }
      const $from = sel.$from;
      const textBefore = $from.parent.textBetween(0, $from.parentOffset, '\n', '￼');
      const open = textBefore.lastIndexOf('[[');
      if (open === -1) { setLinkMenu(null); return; }
      const after = textBefore.slice(open + 2);
      if (after.includes(']]') || after.includes('\n') || after.length > 80) { setLinkMenu(null); return; }
      const fromPos = sel.from - after.length - 2;
      const coords = editor.view.coordsAtPos(sel.from);
      setLinkMenu({ from: fromPos, left: coords.left, top: coords.bottom });
      setLinkQuery(after);
      setLinkActive(0);
    };
    editor.on('update', detect);
    editor.on('selectionUpdate', detect);
    return () => {
      editor.off('update', detect);
      editor.off('selectionUpdate', detect);
    };
  }, [editor, searchNotes]);

  // Fetch suggestions as the query changes.
  useEffect(() => {
    if (!linkMenu || !searchNotes) return;
    let cancelled = false;
    searchNotes(linkQuery)
      .then((rows) => { if (!cancelled) setLinkResults((rows || []).slice(0, 8)); })
      .catch(() => { if (!cancelled) setLinkResults([]); });
    return () => { cancelled = true; };
  }, [linkQuery, linkMenu, searchNotes]);

  // Keyboard navigation while the menu is open (capture phase to pre-empt ProseMirror).
  useEffect(() => {
    if (!linkMenu) return;
    const onKey = (e: KeyboardEvent) => {
      const st = stateRef.current;
      const total = st.linkResults.length + 1; // +1 for the "create" row
      if (e.key === 'ArrowDown') { e.preventDefault(); e.stopPropagation(); setLinkActive((i) => (i + 1) % total); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); e.stopPropagation(); setLinkActive((i) => (i - 1 + total) % total); }
      else if (e.key === 'Enter') {
        e.preventDefault(); e.stopPropagation();
        if (st.linkActive < st.linkResults.length) {
          const r = st.linkResults[st.linkActive];
          chooseLink({ id: r.id, title: r.title });
        } else {
          chooseLink({ id: null, title: st.linkQuery });
        }
      } else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeLinkMenu(); }
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [linkMenu, chooseLink, closeLinkMenu]);

  // Click navigation on wiki-links (works in edit and read-only modes).
  useEffect(() => {
    if (!editor) return;
    const dom = editor.view.dom as HTMLElement;
    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement)?.closest?.('a[data-wikilink]') as HTMLElement | null;
      if (!a) return;
      e.preventDefault();
      onWikiLinkClick?.({
        id: a.getAttribute('data-target') || null,
        label: a.getAttribute('data-label') || a.textContent || '',
      });
    };
    dom.addEventListener('click', onClick);
    return () => dom.removeEventListener('click', onClick);
  }, [editor, onWikiLinkClick]);

  return (
    <div className={`sanchika-editor${className ? ` ${className}` : ''}`} data-testid="sanchika-rich-editor">
      {editor && !hideToolbar && isEditable && <Toolbar editor={editor} />}
      {editor ? (
        <div className="sanchika-canvas">
          <div
            className="sanchika-page"
            style={{ width: pgW, minHeight: pgH, padding: pgPad, ['--page-pad' as keyof React.CSSProperties]: `${pgPad}px` } as React.CSSProperties}
          >
            <EditorContent editor={editor} />
          </div>
        </div>
      ) : (
        <div className="sanchika-editor-loading">Loading editor…</div>
      )}

      {linkMenu && (
        <div className="wiki-suggest" style={{ position: 'fixed', left: linkMenu.left, top: linkMenu.top + 4 }}>
          {linkResults.map((r, i) => (
            <button
              key={r.id}
              type="button"
              className={`wiki-suggest-item${i === linkActive ? ' active' : ''}`}
              onMouseDown={(e) => { e.preventDefault(); chooseLink({ id: r.id, title: r.title }); }}
            >
              <FileText size={14} />
              <span className="truncate">{r.title}</span>
            </button>
          ))}
          <button
            type="button"
            className={`wiki-suggest-item create${linkActive === linkResults.length ? ' active' : ''}`}
            onMouseDown={(e) => { e.preventDefault(); chooseLink({ id: null, title: linkQuery }); }}
          >
            <Plus size={14} />
            <span className="truncate">Create &ldquo;{linkQuery.trim() || '…'}&rdquo;</span>
          </button>
        </div>
      )}

      <style jsx global>{`
        .sanchika-editor {
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          background: #fff;
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }
        .sanchika-canvas {
          background: #e5e7eb;
          padding: 24px;
          overflow-x: auto;
        }
        .sanchika-page {
          background: #fff;
          margin: 0 auto;
          box-sizing: border-box;
          box-shadow: 0 1px 4px rgba(0, 0, 0, 0.12), 0 10px 28px rgba(0, 0, 0, 0.08);
        }
        .page-break {
          margin-left: calc(var(--page-pad, 96px) * -1);
          margin-right: calc(var(--page-pad, 96px) * -1);
          margin-top: 18px;
          margin-bottom: 18px;
          height: 44px;
          background: #e5e7eb;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: inset 0 9px 8px -8px rgba(0, 0, 0, 0.22), inset 0 -9px 8px -8px rgba(0, 0, 0, 0.22);
          user-select: none;
        }
        .page-break-label {
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: #6b7280;
          background: #fff;
          padding: 2px 10px;
          border-radius: 999px;
          border: 1px solid #d1d5db;
        }
        .page-break.ProseMirror-selectednode { outline: 2px solid #6366f1; outline-offset: -2px; }
        @media print {
          @page { size: ${pgSize.toLowerCase()} ${pgOrient}; margin: ${printMargin}; }
          .sanchika-toolbar, .wiki-suggest { display: none !important; }
          .sanchika-editor { border: none !important; }
          .sanchika-canvas { background: #fff !important; padding: 0 !important; overflow: visible !important; }
          .sanchika-page { width: auto !important; min-height: 0 !important; box-shadow: none !important; margin: 0 !important; padding: 0 !important; }
          .page-break { break-after: page; page-break-after: always; height: 0 !important; margin: 0 !important; background: none !important; box-shadow: none !important; }
          .page-break-label { display: none !important; }
        }
        .sanchika-toolbar {
          display: flex;
          flex-wrap: wrap;
          gap: 4px;
          padding: 8px;
          border-bottom: 1px solid #eef2f7;
          background: #fafbfc;
          position: sticky;
          top: 0;
          z-index: 5;
        }
        .stb-group {
          display: flex;
          gap: 2px;
          padding-right: 6px;
          margin-right: 2px;
          border-right: 1px solid #eef2f7;
        }
        .stb-group:last-child { border-right: none; }
        .stb {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 30px;
          height: 30px;
          border: none;
          border-radius: 7px;
          background: transparent;
          color: #475569;
          cursor: pointer;
          transition: background 0.12s ease, color 0.12s ease;
        }
        .stb:hover:not(:disabled) { background: #eef2ff; color: #4338ca; }
        .stb-active { background: #e0e7ff; color: #4338ca; }
        .stb:disabled { opacity: 0.4; cursor: not-allowed; }

        .sanchika-prose {
          padding: 0;
          min-height: 150px;
          font-size: 15px;
          line-height: 1.7;
          color: #1f2937;
          outline: none;
        }
        .sanchika-prose > * + * { margin-top: 0.75em; }
        .sanchika-prose h1 { font-size: 1.7em; font-weight: 700; line-height: 1.25; margin-top: 1em; }
        .sanchika-prose h2 { font-size: 1.4em; font-weight: 700; line-height: 1.3; margin-top: 1em; }
        .sanchika-prose h3 { font-size: 1.18em; font-weight: 600; margin-top: 1em; }
        .sanchika-prose ul { list-style: disc; padding-left: 1.5em; }
        .sanchika-prose ol { list-style: decimal; padding-left: 1.5em; }
        .sanchika-prose blockquote {
          border-left: 3px solid #c7d2fe;
          padding-left: 1em;
          color: #4b5563;
          font-style: italic;
        }
        .sanchika-prose code {
          background: #f1f5f9;
          padding: 0.15em 0.35em;
          border-radius: 5px;
          font-size: 0.9em;
          font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
        }
        .sanchika-prose pre {
          background: #0f172a;
          color: #e2e8f0;
          padding: 14px 16px;
          border-radius: 10px;
          overflow-x: auto;
          font-size: 0.88em;
        }
        .sanchika-prose pre code { background: transparent; padding: 0; color: inherit; }
        .sanchika-prose a.sanchika-link { color: #4338ca; text-decoration: underline; cursor: pointer; }
        .sanchika-prose mark { background: #fde68a; border-radius: 3px; padding: 0 2px; }
        .sanchika-prose img.sanchika-img { max-width: 100%; border-radius: 8px; }
        .sanchika-prose hr { border: none; border-top: 2px solid #e5e7eb; margin: 1.25em 0; }

        .sanchika-prose ul[data-type='taskList'] { list-style: none; padding-left: 0.25em; }
        .sanchika-prose ul[data-type='taskList'] li { display: flex; align-items: flex-start; gap: 0.5em; }
        .sanchika-prose ul[data-type='taskList'] li > label { margin-top: 0.25em; }

        .sanchika-prose table { border-collapse: collapse; width: 100%; overflow: hidden; }
        .sanchika-prose th, .sanchika-prose td { border: 1px solid #e5e7eb; padding: 6px 10px; text-align: left; }
        .sanchika-prose th { background: #f8fafc; font-weight: 600; }

        .sanchika-prose p.is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          color: #9ca3af;
          float: left;
          height: 0;
          pointer-events: none;
        }
        .sanchika-editor-loading { padding: 24px; color: #6b7280; }

        .sanchika-prose a.wikilink {
          color: #7c3aed;
          background: #f5f3ff;
          border-radius: 4px;
          padding: 0 3px;
          text-decoration: none;
          cursor: pointer;
          font-weight: 500;
        }
        .sanchika-prose a.wikilink:hover { background: #ede9fe; text-decoration: underline; }
        .sanchika-prose a.wikilink.wikilink-unresolved { color: #9333ea; background: #faf5ff; border: 1px dashed #d8b4fe; }

        .wiki-suggest {
          z-index: 60;
          min-width: 220px;
          max-width: 320px;
          background: #fff;
          border: 1px solid #e5e7eb;
          border-radius: 10px;
          box-shadow: 0 12px 32px rgba(0, 0, 0, 0.16);
          padding: 4px;
          max-height: 280px;
          overflow-y: auto;
        }
        .wiki-suggest-item {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 7px 10px;
          border: none;
          background: transparent;
          border-radius: 7px;
          font-size: 14px;
          color: #374151;
          text-align: left;
          cursor: pointer;
        }
        .wiki-suggest-item:hover, .wiki-suggest-item.active { background: #f5f3ff; color: #6d28d9; }
        .wiki-suggest-item.create { color: #6b7280; border-top: 1px solid #f1f5f9; margin-top: 2px; }
        .wiki-suggest-item .truncate { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      `}</style>
    </div>
  );
}

export default RichTextEditor;

```

