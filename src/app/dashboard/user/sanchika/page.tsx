'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getCoverDesign, COVER_DESIGNS } from '@/components/workspace/sanchika/CoverDesigns';
import NoteContextMenu from '@/components/workspace/sanchika/NoteContextMenu';
import { FolderManagementModal } from '@/components/workspace/sanchika/FolderManagementModal';
import { FolderTreeSidebar } from '@/components/workspace/sanchika/FolderTreeSidebar';
import {
  BookOpen,
  Plus,
  Search,
  Star,
  Pin,
  Trash2,
  Edit3,
  Filter,
  ArrowUpDown,
  Sparkles,
  FileText,
  Calendar,
  Tag,
  Loader2,
  BookMarked,
  Zap,
  TrendingUp,
  Clock,
  Grid3x3,
  List as ListIcon,
  Heart,
  Archive,
  ChevronRight,
  Folder,
  FolderOpen,
  FolderPlus,
  X,
  Settings,
  Menu,
} from 'lucide-react';

interface Folder {
  id: string;
  name: string;
  color?: string;
  icon?: string;
  created_at: string;
  updated_at: string;
}

interface Note {
  id: string;
  title: string;
  content: string;
  content_format: string;
  subject?: string;
  chapter?: string;
  tags?: string[];
  folder_id?: string;
  folder?: Folder;
  cover_design?: string;
  spine_color?: string;
  is_favorite: boolean;
  is_pinned: boolean;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export default function SanchikaListPage() {
  const router = useRouter();
  const [notes, setNotes] = useState<Note[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterBy, setFilterBy] = useState<'all' | 'favorites' | 'pinned'>('all');
  const [sortBy, setSortBy] = useState<'recent' | 'oldest' | 'title'>('recent');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [showManageFoldersModal, setShowManageFoldersModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ note: Note; x: number; y: number } | null>(null);
  const [draggedNote, setDraggedNote] = useState<Note | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedNotes, setSelectedNotes] = useState<Set<string>>(new Set());
  const [showSidebar, setShowSidebar] = useState(true);

  // ============ FETCH FOLDERS ============
  const fetchFolders = async () => {
    try {
      console.log('📁 Fetching folders from API');

      const response = await fetch('/api/folders', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch folders');
      }

      const data = await response.json();
      console.log('✅ Fetched folders:', data.length, 'folders');

      if (Array.isArray(data)) {
        setFolders(data);
      } else {
        setFolders([]);
      }
    } catch (err) {
      console.error('❌ Folder fetch error:', err);
      setFolders([]);
    }
  };

  // ============ FETCH NOTES ============
  const fetchNotes = async () => {
    try {
      setError(null);

      console.log('📊 Fetching notes from API');

      const response = await fetch('/api/notes?limit=100&offset=0', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch notes');
      }

      const data = await response.json();
      console.log('✅ Fetched notes:', data.length, 'notes');

      if (!Array.isArray(data)) {
        console.warn('⚠️ Data is not an array:', data);
        setNotes([]);
        return;
      }

      // Filter out archived notes
      const activeNotes = data.filter((note: Note) => !note.is_archived);
      console.log('📝 Active notes:', activeNotes.length);

      setNotes(activeNotes);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to fetch notes';
      console.error('❌ Fetch error:', errorMsg);
      setError(errorMsg);
      setNotes([]);
    }
  };

  // ============ LIFECYCLE ============
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        // Fetch folders and notes in parallel
        await Promise.all([fetchFolders(), fetchNotes()]);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  // ============ FILTERS & SORT ============
  const filteredNotes = notes
    .filter((note) => {
      // Folder filter
      if (selectedFolderId === 'uncategorized') {
        // Show only notes without a folder
        if (note.folder_id)
  return false;
      } else if (selectedFolderId && note.folder_id !== selectedFolderId) {
        // Show only notes in the selected folder
        return false;
      }

      // Search filter
      if (
        searchQuery &&
        !note.title.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !note.content.toLowerCase().includes(searchQuery.toLowerCase())
      ) {
        return false;
      }

      // Favorite/pinned filter
      if (filterBy === 'favorites' && !note.is_favorite)
  return false;
      if (filterBy === 'pinned' && !note.is_pinned)
  return false;

      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'recent') {
        return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
      }
      if (sortBy === 'oldest') {
        return new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime();
      }
      if (sortBy === 'title') {
        return a.title.localeCompare(b.title);
      }
      return 0;
    });

  // ============ HANDLERS ============
  const handleDeleteNote = async (noteId: string) => {
    if (!confirm('Are you sure you want to delete this note? This action cannot be undone.')) return;

    try {
      setDeletingId(noteId);
      const response = await fetch(`/api/notes/${noteId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete note');
      }

      // Remove from list with animation
      setNotes(notes.filter((n) => n.id !== noteId));
      console.log('✅ Note deleted');
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to delete note';
      console.error('❌ Delete error:', errorMsg);
      setError(errorMsg);
    } finally {
      setDeletingId(null);
    }
  };

  const handleToggleFavorite = async (note: Note) => {
    try {
      const response = await fetch(`/api/notes/${note.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...note,
          is_favorite: !note.is_favorite,
        }),
      });

      if (!response.ok)
  throw new Error('Failed to update note');

      const result = await response.json();
      const updated = result.note;
      setNotes(notes.map((n) => (n.id === note.id ? updated : n)));
    } catch (err) {
      console.error('❌ Toggle favorite error:', err);
    }
  };

  const handleTogglePin = async (note: Note) => {
    try {
      const response = await fetch(`/api/notes/${note.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...note,
          is_pinned: !note.is_pinned,
        }),
      });

      if (!response.ok)
  throw new Error('Failed to update note');

      const result = await response.json();
      const updated = result.note;
      setNotes(notes.map((n) => (n.id === note.id ? updated : n)));
    } catch (err) {
      console.error('❌ Toggle pin error:', err);
    }
  };

  // ============ FOLDER HANDLERS ============
  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;

    try {
      setCreatingFolder(true);
      const response = await fetch('/api/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newFolderName.trim() }),
      });

      if (!response.ok)
  throw new Error('Failed to create folder');

      const newFolder = await response.json();
      setFolders([...folders, newFolder]);
      setNewFolderName('');
      setShowFolderModal(false);
      console.log('✅ Folder created:', newFolder);
    } catch (err) {
      console.error('❌ Create folder error:', err);
      alert('Failed to create folder. Please try again.');
    } finally {
      setCreatingFolder(false);
    }
  };

  const handleDeleteFolder = async (folderId: string) => {
    if (!confirm('Delete this folder? Notes in this folder will not be deleted.')) return;

    try {
      const response = await fetch(`/api/folders/${folderId}`, {
        method: 'DELETE',
      });

      if (!response.ok)
  throw new Error('Failed to delete folder');

      setFolders(folders.filter((f) => f.id !== folderId));
      if (selectedFolderId === folderId) {
        setSelectedFolderId(null);
      }
      console.log('✅ Folder deleted');
    } catch (err) {
      console.error('❌ Delete folder error:', err);
      alert('Failed to delete folder. Please try again.');
    }
  };

  // Handlers for FolderManagementModal
  const handleCreateFolderWithDetails = async (name: string, color: string, icon: string) => {
    const response = await fetch('/api/folders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim(), color, icon }),
    });

    if (!response.ok)
  throw new Error('Failed to create folder');

    const newFolder = await response.json();
    setFolders([...folders, newFolder]);
    await fetchFolders(); // Refresh to get note counts
  };

  const handleUpdateFolderWithDetails = async (id: string, name: string, color: string, icon: string) => {
    const response = await fetch(`/api/folders/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim(), color, icon }),
    });

    if (!response.ok)
  throw new Error('Failed to update folder');

    const updatedFolder = await response.json();
    setFolders(folders.map((f) => (f.id === id ? updatedFolder : f)));
    await fetchFolders(); // Refresh to get note counts
  };

  const handleDeleteFolderFromModal = async (folderId: string) => {
    const response = await fetch(`/api/folders/${folderId}`, {
      method: 'DELETE',
    });

    if (!response.ok)
  throw new Error('Failed to delete folder');

    setFolders(folders.filter((f) => f.id !== folderId));
    if (selectedFolderId === folderId) {
      setSelectedFolderId(null);
    }
    await fetchNotes(); // Refresh notes to update folder_id
  };

  // Get note count for each folder
  const getFolderNoteCount = (folderId: string | null) => {
    if (folderId === null) {
      return notes.filter((n) => !n.folder_id).length;
    }
    return notes.filter((n) => n.folder_id === folderId).length;
  };

  // ============ CONTEXT MENU HANDLERS ============
  const handleContextMenu = (e: React.MouseEvent, note: Note) => {
    e.preventDefault();
    setContextMenu({ note, x: e.clientX, y: e.clientY });
  };

  const handleMoveToFolder = async (noteId: string, folderId: string | null) => {
    try {
      const note = notes.find((n) => n.id === noteId);
      if (!note) return;

      const response = await fetch(`/api/notes/${noteId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...note, folder_id: folderId }),
      });

      if (!response.ok)
  throw new Error('Failed to move note');

      const result = await response.json();
      setNotes(notes.map((n) => (n.id === noteId ? result.note : n)));
    } catch (err) {
      console.error('❌ Move note error:', err);
      alert('Failed to move note. Please try again.');
    }
  };

  const handleCopyToFolder = async (noteId: string, folderId: string) => {
    try {
      const response = await fetch('/api/notes/copy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ noteId, folderId }),
      });

      if (!response.ok)
  throw new Error('Failed to copy note');

      const result = await response.json();
      setNotes([...notes, result.note]);
      alert('Note copied successfully!');
    } catch (err) {
      console.error('❌ Copy note error:', err);
      alert('Failed to copy note. Please try again.');
    }
  };

  // ============ DRAG AND DROP HANDLERS ============
  const handleDragStart = (e: React.DragEvent, note: Note) => {
    setDraggedNote(note);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, folderId: string | null) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDropTarget(folderId || 'uncategorized');
  };

  const handleDragLeave = () => {
    setDropTarget(null);
  };

  const handleDrop = async (e: React.DragEvent, folderId: string | null) => {
    e.preventDefault();
    if (draggedNote) {
      await handleMoveToFolder(draggedNote.id, folderId);
      setDraggedNote(null);
      setDropTarget(null);
    }
  };

  // ============ BULK OPERATIONS ============
  const toggleNoteSelection = (noteId: string) => {
    const newSelection = new Set(selectedNotes);
    if (newSelection.has(noteId)) {
      newSelection.delete(noteId);
    } else {
      newSelection.add(noteId);
    }
    setSelectedNotes(newSelection);
  };

  const handleBulkMove = async (folderId: string | null) => {
    for (const noteId of selectedNotes) {
      await handleMoveToFolder(noteId, folderId);
    }
    setSelectedNotes(new Set());
    setSelectionMode(false);
  };

  const handleBulkDelete = async () => {
    if (!confirm(`Delete ${selectedNotes.size} selected notes?`)) return;
    for (const noteId of selectedNotes) {
      await handleDeleteNote(noteId);
    }
    setSelectedNotes(new Set());
    setSelectionMode(false);
  };

  // ============ RENDER ============
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:via-blue-900 dark:to-indigo-900">
      {/* ============ HEADER ============ */}
      <div className="sticky top-0 z-10 backdrop-blur-md bg-white/80 dark:bg-gray-900/80 border-b border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="relative flex-shrink-0">
                <div className="absolute inset-0 bg-gradient-to-r from-orange-500 to-blue-600 rounded-2xl blur-lg opacity-30 animate-pulse"></div>
                <div className="relative bg-gradient-to-r from-orange-500 to-blue-600 p-2 sm:p-3 rounded-2xl shadow-lg">
                  <BookMarked className="h-6 w-6 sm:h-8 sm:w-8 text-white" />
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-orange-500 to-blue-600 bg-clip-text text-transparent truncate">
                  Sanchika Notes
                </h1>
                <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-0.5 sm:mt-1 flex items-center gap-1.5 sm:gap-2 flex-wrap">
                  <FileText className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                  <span className="whitespace-nowrap">{filteredNotes.length} of {notes.length} notes</span>
                  {filterBy !== 'all' && (
                    <span className="inline-flex items-center px-1.5 sm:px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                      {filterBy === 'favorites' ? 'Favorites' : 'Pinned'}
                    </span>
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
              {selectionMode && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {selectedNotes.size} selected
                  </span>
                  <button
                    onClick={() => handleBulkDelete()}
                    disabled={selectedNotes.size === 0}
                    className="px-3 py-2 bg-red-500 hover:bg-red-600 text-white text-sm font-medium rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Delete
                  </button>
                </div>
              )}

              <button
                onClick={() => {
                  setSelectionMode(!selectionMode);
                  setSelectedNotes(new Set());
                }}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
                  selectionMode
                    ? 'bg-gray-500 hover:bg-gray-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                {selectionMode ? 'Cancel' : 'Select'}
              </button>

              <button
                onClick={() => router.push('/dashboard/user/sanchika/new')}
                className="group relative inline-flex items-center gap-1.5 sm:gap-2 px-4 sm:px-6 py-2.5 sm:py-3 bg-gradient-to-r from-orange-500 to-blue-600 hover:from-orange-600 hover:to-blue-700 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 overflow-hidden text-sm sm:text-base"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-700"></div>
                <Plus className="h-4 w-4 sm:h-5 sm:w-5 relative z-10 flex-shrink-0" />
                <span className="relative z-10 whitespace-nowrap">New Note</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ============ MAIN CONTENT AREA WITH SIDEBAR ============ */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex gap-6">
          {/* Sidebar - Hidden on mobile, visible on desktop */}
          <div className={`${showSidebar ? 'block' : 'hidden'} lg:block w-full lg:w-64 flex-shrink-0`}>
            <FolderTreeSidebar
              folders={folders.map(f => ({
                id: f.id,
                name: f.name,
                color: f.color || 'blue',
                icon: f.icon || 'folder',
                note_count: getFolderNoteCount(f.id),
                parent_id: null, // Will be updated when backend supports parent_id
              }))}
              selectedFolderId={selectedFolderId}
              onSelectFolder={(folderId) => setSelectedFolderId(folderId)}
              onCreateFolder={() => setShowFolderModal(true)}
              onManageFolders={() => setShowManageFoldersModal(true)}
              dropTargetId={dropTarget}
              onFolderDragOver={handleDragOver}
              onFolderDragLeave={handleDragLeave}
              onFolderDrop={handleDrop}
              onOpenGraph={() => router.push('/dashboard/user/sanchika/graph')}
            />
          </div>

          {/* Main Content */}
          <div className="flex-1 min-w-0">
            {/* Mobile Sidebar Toggle */}
            <div className="lg:hidden mb-4">
              <button
                onClick={() => setShowSidebar(!showSidebar)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm hover:shadow-md transition-all duration-200"
              >
                <Menu className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {showSidebar ? 'Hide' : 'Show'} Folders
                </span>
              </button>
            </div>

            {/* ============ CONTROLS ============ */}
            <div className="py-2">
              <div className="flex flex-col lg:flex-row gap-4 items-stretch lg:items-center">
                {/* Search Bar */}
                <div className="relative flex-1">
                  <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search notes by title or content..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 text-gray-900 dark:text-gray-100 placeholder-gray-500 shadow-sm hover:shadow-md"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* Filter Controls */}
                <div className="flex gap-3 flex-wrap lg:flex-nowrap">
                  {/* Filter Dropdown */}
                  <div className="relative">
                    <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                    <select
                      value={filterBy}
                      onChange={(e) => setFilterBy(e.target.value as any)}
                      className="pl-10 pr-8 py-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 text-gray-900 dark:text-gray-100 cursor-pointer shadow-sm hover:shadow-md appearance-none"
                    >
                      <option value="all">All Notes</option>
                      <option value="favorites">⭐ Favorites</option>
                      <option value="pinned">📌 Pinned</option>
                    </select>
                  </div>

                  {/* Sort Dropdown */}
                  <div className="relative">
                    <ArrowUpDown className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as any)}
                      className="pl-10 pr-8 py-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 text-gray-900 dark:text-gray-100 cursor-pointer shadow-sm hover:shadow-md appearance-none"
                    >
                      <option value="recent">Most Recent</option>
                      <option value="oldest">Oldest First</option>
                      <option value="title">By Title (A-Z)</option>
                    </select>
                  </div>

                  {/* View Mode Toggle */}
                  <div className="flex bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-xl shadow-sm overflow-hidden">
                    <button
                      onClick={() => setViewMode('grid')}
                      className={`px-4 py-3 transition-all duration-200 ${
                        viewMode === 'grid'
                          ? 'bg-gradient-to-r from-orange-500 to-blue-600 text-white'
                          : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                      }`}
                      title="Grid View"
                    >
                      <Grid3x3 className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => setViewMode('list')}
                      className={`px-4 py-3 transition-all duration-200 ${
                        viewMode === 'list'
                          ? 'bg-gradient-to-r from-orange-500 to-blue-600 text-white'
                          : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                      }`}
                      title="List View"
                    >
                      <ListIcon className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* ============ CONTENT ============ */}
            <div className="pb-12">
              {loading && (
                <div className="flex flex-col items-center justify-center py-20">
                  <div className="relative">
                    <div className="absolute inset-0 bg-gradient-to-r from-orange-500 to-blue-600 rounded-full blur-xl opacity-30 animate-pulse"></div>
                    <Loader2 className="relative h-16 w-16 text-blue-600 animate-spin" />
                  </div>
                  <p className="mt-6 text-lg font-medium text-gray-700 dark:text-gray-300 animate-pulse">
                    Loading your notes...
                  </p>
                  <div className="mt-4 flex gap-2">
                    <div className="h-2 w-2 bg-orange-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                    <div className="h-2 w-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                    <div className="h-2 w-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                  </div>
                </div>
              )}

              {error && (
                <div className="max-w-md mx-auto mt-12">
                  <div className="bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-800 rounded-2xl p-8 text-center shadow-lg">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 dark:bg-red-900/40 rounded-full mb-4">
                      <Sparkles className="h-8 w-8 text-red-600 dark:text-red-400" />
                    </div>
                    <h3 className="text-xl font-bold text-red-900 dark:text-red-100 mb-2">
                      Oops! Something went wrong
                    </h3>
                    <p className="text-red-700 dark:text-red-300 mb-6">{error}</p>
                    <button
                      onClick={fetchNotes}
                      className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
                    >
                      <Zap className="h-5 w-5" />
                      Try Again
                    </button>
                  </div>
                </div>
              )}

              {!loading && !error && filteredNotes.length === 0 && (
                <div className="max-w-2xl mx-auto mt-12">
                  <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-md border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-3xl p-12 text-center shadow-xl">
                    <div className="relative inline-block mb-6">
                      <div className="absolute inset-0 bg-gradient-to-r from-orange-500 to-blue-600 rounded-full blur-2xl opacity-20 animate-pulse"></div>
                      <div className="relative bg-gradient-to-r from-orange-100 to-blue-100 dark:from-orange-900/30 dark:to-blue-900/30 p-6 rounded-full">
                        {notes.length === 0 ? (
                          <BookOpen className="h-16 w-16 text-orange-600 dark:text-orange-400" />
                        ) : (
                          <Search className="h-16 w-16 text-blue-600 dark:text-blue-400" />
                        )}
                      </div>
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-3">
                      {notes.length === 0 ? 'No notes yet' : 'No matching notes'}
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400 mb-8 text-lg">
                      {notes.length === 0
                        ? 'Start your learning journey by creating your first note!'
                        : 'Try adjusting your search or filters to find what you\'re looking for.'}
                    </p>
                    {notes.length === 0 && (
                      <button
                        onClick={() => router.push('/dashboard/user/sanchika/new')}
                        className="group inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-orange-500 to-blue-600 hover:from-orange-600 hover:to-blue-700 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
                      >
                        <Plus className="h-6 w-6" />
                        <span>Create Your First Note</span>
                        <ChevronRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
                      </button>
                    )}
                  </div>
                </div>
              )}

              {!loading && !error && filteredNotes.length > 0 && (
                <div
                  className={
                    viewMode === 'grid'
                      ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 sm:gap-5 lg:gap-6'
                      : 'flex flex-col gap-4'
                  }
                >
                  {filteredNotes.map((note, index) => {
              // Safely get cover design with fallback
              let coverDesign;
              try {
                coverDesign = getCoverDesign(note.cover_design || 'solid-blue');
              } catch (err) {
                coverDesign = { pattern: 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)' };
              }
              const spineColor = note.spine_color || '#3B82F6';

              return (
                <div
                  key={note.id}
                  draggable={!selectionMode}
                  onDragStart={(e) => handleDragStart(e, note)}
                  onContextMenu={(e) => handleContextMenu(e, note)}
                  onClick={(e) => {
                    // Don't navigate if clicking on action buttons, checkboxes, or in selection mode
                    const target = e.target as HTMLElement;
                    if (
                      target.closest('button') ||
                      target.closest('input[type="checkbox"]') ||
                      selectionMode
                    ) {
                      return;
                    }
                    router.push(`/dashboard/user/sanchika/${note.id}`);
                  }}
                  className={`group relative rounded-xl border-2 border-gray-200 dark:border-gray-700 shadow-md hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 hover:scale-[1.02] overflow-hidden cursor-pointer ${
                    viewMode === 'list' ? 'flex flex-row' : 'flex flex-col'
                  } ${draggedNote?.id === note.id ? 'opacity-50' : ''} ${
                    selectedNotes.has(note.id) ? 'ring-4 ring-blue-500' : ''
                  }`}
                  style={{
                    animation: `fadeInUp 0.5s ease-out ${index * 0.05}s both`,
                    aspectRatio: viewMode === 'grid' ? '3/4' : 'auto',
                    height: viewMode === 'grid' ? 'auto' : 'auto',
                  }}
                >
                  {/* Spine (Left Edge) with Vertical Note Title */}
                  <div
                    className="absolute left-0 top-0 bottom-0 w-3 shadow-inner flex items-center justify-center overflow-hidden"
                    style={{
                      background: spineColor,
                      boxShadow: `inset -2px 0 4px rgba(0,0,0,0.2)`,
                    }}
                  >
                    <div
                      className="text-white font-bold text-[7px] tracking-wider opacity-90 px-0.5"
                      style={{
                        writingMode: 'vertical-rl',
                        textOrientation: 'mixed',
                        transform: 'rotate(180deg)',
                        letterSpacing: '0.3px',
                        maxHeight: '90%',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                      title={note.title}
                    >
                      {note.title.toUpperCase()}
                    </div>
                  </div>

                  {/* Cover Design Background */}
                  <div
                    className="absolute top-0 left-0 right-0 h-[60%] opacity-90"
                    style={{
                      background: coverDesign?.pattern || 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)',
                    }}
                  >
                    {/* Note Title on Cover */}
                    <div className="absolute inset-0 flex items-center justify-center p-4 sm:p-6">
                      <h2
                        className="text-white font-bold text-center line-clamp-3 sm:line-clamp-4 text-sm sm:text-base md:text-lg drop-shadow-lg"
                        style={{
                          textShadow: '0 2px 8px rgba(0,0,0,0.3), 0 1px 2px rgba(0,0,0,0.5)',
                        }}
                      >
                        {note.title}
                      </h2>
                    </div>
                  </div>

                  {/* Selection Checkbox */}
                  {selectionMode && (
                    <div className="absolute top-3 left-4 z-20">
                      <input
                        type="checkbox"
                        checked={selectedNotes.has(note.id)}
                        onChange={() => toggleNoteSelection(note.id)}
                        className="w-5 h-5 rounded border-2 border-white shadow-lg cursor-pointer"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                  )}

                  {/* Pinned/Favorite Badges */}
                  {(!!note.is_pinned || !!note.is_favorite) && (
                    <div className="absolute top-3 right-3 flex gap-1.5 z-10">
                      {!!note.is_pinned && (
                        <div className="bg-blue-500 text-white p-1 rounded-md shadow-lg">
                          <Pin className="h-3 w-3" />
                        </div>
                      )}
                      {!!note.is_favorite && (
                        <div className="bg-yellow-500 text-white p-1 rounded-md shadow-lg">
                          <Star className="h-3 w-3 fill-current" />
                        </div>
                      )}
                    </div>
                  )}

                  {/* Card Content - White Section at Bottom */}
                  <div className="absolute bottom-0 left-0 right-0 h-[40%] bg-white dark:bg-gray-800 rounded-b-xl">
                    <div className="flex flex-col h-full p-3 sm:p-4 pl-4 sm:pl-5">
                      {/* Title */}
                      <h3 className="font-bold text-gray-900 dark:text-gray-100 mb-1.5 sm:mb-2 line-clamp-2 text-sm sm:text-base group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                        {note.title}
                      </h3>

                      {/* Metadata Tags */}
                      <div className="flex flex-wrap gap-1 sm:gap-1.5 mb-auto">
                        {note.folder_id && note.folder && (
                          <span className="inline-flex items-center gap-0.5 sm:gap-1 px-1.5 sm:px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-[10px] sm:text-xs font-medium rounded-full">
                            <Folder className="h-2 w-2 sm:h-2.5 sm:w-2.5 flex-shrink-0" />
                            <span className="truncate max-w-[60px] sm:max-w-[80px]">{note.folder.name}</span>
                          </span>
                        )}
                        {!!note.subject && (
                          <span className="inline-flex items-center gap-0.5 sm:gap-1 px-1.5 sm:px-2 py-0.5 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 text-[10px] sm:text-xs font-medium rounded-full">
                            <BookOpen className="h-2 w-2 sm:h-2.5 sm:w-2.5 flex-shrink-0" />
                            <span className="truncate max-w-[60px] sm:max-w-[80px]">{note.subject}</span>
                          </span>
                        )}
                        {!!note.chapter && (
                          <span className="inline-flex items-center gap-0.5 sm:gap-1 px-1.5 sm:px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-[10px] sm:text-xs font-medium rounded-full">
                            <FileText className="h-2 w-2 sm:h-2.5 sm:w-2.5 flex-shrink-0" />
                            <span className="truncate max-w-[50px] sm:max-w-[60px]">{note.chapter}</span>
                          </span>
                        )}
                      </div>

                      {/* Footer - Action Buttons */}
                      <div className="flex items-center justify-between pt-1.5 sm:pt-2 mt-auto gap-2">
                        <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 min-w-0 flex-shrink">
                          <Clock className="h-3 w-3 flex-shrink-0" />
                          <span className="text-[10px] sm:text-xs truncate">
                            {new Date(note.updated_at).toLocaleDateString('en-IN', {
                              month: 'short',
                              day: 'numeric',
                            })}
                          </span>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center gap-1 sm:gap-1.5 flex-shrink-0">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleFavorite(note);
                            }}
                            className={`p-1.5 sm:p-2 rounded-md transition-all duration-200 ${
                              !!note.is_favorite
                                ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400'
                                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-yellow-100 dark:hover:bg-yellow-900/30 hover:text-yellow-600'
                            }`}
                            title={!!note.is_favorite ? 'Remove from favorites' : 'Add to favorites'}
                          >
                            <Star className={`h-3 w-3 sm:h-3.5 sm:w-3.5 ${!!note.is_favorite ? 'fill-current' : ''}`} />
                          </button>

                          <Link href={`/dashboard/user/sanchika/${note.id}`}>
                            <button className="p-1.5 sm:p-2 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-md transition-all duration-200 shadow-sm hover:shadow-md transform hover:scale-105">
                              <Edit3 className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                            </button>
                          </Link>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteNote(note.id);
                            }}
                            disabled={deletingId === note.id}
                            className="p-1.5 sm:p-2 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white rounded-md transition-all duration-200 shadow-sm hover:shadow-md transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Delete note"
                          >
                            {deletingId === note.id ? (
                              <Loader2 className="h-3 w-3 sm:h-3.5 sm:w-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                            )}
                          </button>
                        </div>
                      </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  </div>

      {/* ============ CONTEXT MENU ============ */}
      {contextMenu && (
        <NoteContextMenu
          note={contextMenu.note}
          folders={folders}
          position={{ x: contextMenu.x, y: contextMenu.y }}
          onClose={() => setContextMenu(null)}
          onMoveToFolder={handleMoveToFolder}
          onCopyToFolder={handleCopyToFolder}
          onTogglePin={handleTogglePin}
          onToggleFavorite={handleToggleFavorite}
          onEdit={(noteId) => router.push(`/dashboard/user/sanchika/${noteId}`)}
          onDelete={handleDeleteNote}
        />
      )}

      {/* ============ FOLDER MODAL ============ */}
      {showFolderModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-6 w-full max-w-md mx-4 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <FolderPlus className="h-6 w-6 text-blue-600" />
                Create New Folder
              </h3>
              <button
                onClick={() => {
                  setShowFolderModal(false);
                  setNewFolderName('');
                }}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Folder Name
              </label>
              <input
                type="text"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleCreateFolder()}
                placeholder="e.g., Mathematics, Science, History..."
                className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 text-gray-900 dark:text-gray-100 placeholder-gray-500"
                autoFocus
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowFolderModal(false);
                  setNewFolderName('');
                }}
                className="flex-1 px-4 py-3 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 font-medium rounded-xl transition-all duration-200"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateFolder}
                disabled={!newFolderName.trim() || creatingFolder}
                className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              >
                {creatingFolder ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Creating...
                  </span>
                ) : (
                  'Create Folder'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============ FOLDER MANAGEMENT MODAL ============ */}
      <FolderManagementModal
        isOpen={showManageFoldersModal}
        onClose={() => setShowManageFoldersModal(false)}
        folders={folders}
        onCreateFolder={handleCreateFolderWithDetails}
        onUpdateFolder={handleUpdateFolderWithDetails}
        onDeleteFolder={handleDeleteFolderFromModal}
      />

      {/* ============ ANIMATIONS ============ */}
      <style jsx global>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes shimmer {
          0% {
            background-position: -200% 0;
          }
          100% {
            background-position: 200% 0;
          }
        }

        .line-clamp-2 {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .line-clamp-3 {
          display: -webkit-box;
          -webkit-line-clamp: 3;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .line-clamp-4 {
          display: -webkit-box;
          -webkit-line-clamp: 4;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        /* Custom scrollbar */
        ::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }

        ::-webkit-scrollbar-track {
          background: rgba(0, 0, 0, 0.05);
          border-radius: 4px;
        }

        ::-webkit-scrollbar-thumb {
          background: linear-gradient(135deg, #f97316, #2563eb);
          border-radius: 4px;
        }

        ::-webkit-scrollbar-thumb:hover {
          background: linear-gradient(135deg, #ea580c, #1d4ed8);
        }
      `}</style>
    </div>
  );
}
