'use client';

/**
 * Sanchika Note Context Menu
 *
 * Phase 0 of the Sanchika upgrade: replaces the placeholder stub with a real
 * right-click menu. The list page already wires every handler — this renders
 * them: Open, Favorite, Pin, Move to folder, Copy to folder, Delete.
 */

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  Pencil,
  Star,
  Pin,
  FolderInput,
  Copy,
  Trash2,
  Folder as FolderIcon,
  Check,
  CornerUpLeft,
  ChevronRight,
} from 'lucide-react';

interface NoteLike {
  id: string;
  title?: string;
  folder_id?: string | null;
  is_favorite?: boolean;
  is_pinned?: boolean;
}
interface FolderLike {
  id: string;
  name: string;
  color?: string;
}

interface NoteContextMenuProps {
  note: NoteLike;
  folders: FolderLike[];
  position: { x: number; y: number };
  onClose: () => void;
  // Method syntax → bivariant params, so the page's (note: Note) handlers assign cleanly.
  onMoveToFolder(noteId: string, folderId: string | null): void;
  onCopyToFolder(noteId: string, folderId: string): void;
  onTogglePin(note: NoteLike): void;
  onToggleFavorite(note: NoteLike): void;
  onEdit(noteId: string): void;
  onDelete(noteId: string): void;
}

function tint(color?: string): string {
  return color && color.trim() ? color : '#3b82f6';
}

export default function NoteContextMenu({
  note,
  folders,
  position,
  onClose,
  onMoveToFolder,
  onCopyToFolder,
  onTogglePin,
  onToggleFavorite,
  onEdit,
  onDelete,
}: NoteContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState(position);
  const [expanded, setExpanded] = useState<null | 'move' | 'copy'>(null);

  // Keep the menu on-screen (recompute when its height changes via expand).
  useLayoutEffect(() => {
    const el = menuRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    let { x, y } = position;
    if (x + r.width > window.innerWidth) x = window.innerWidth - r.width - 8;
    if (y + r.height > window.innerHeight) y = window.innerHeight - r.height - 8;
    setPos({ x: Math.max(8, x), y: Math.max(8, y) });
  }, [position, expanded]);

  // Close on outside click or Escape.
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const row =
    'w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left text-foreground hover:bg-muted/70 transition-colors';
  const subRow =
    'w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left text-muted-foreground hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-md transition-colors disabled:opacity-50 disabled:cursor-default';

  return (
    <div
      ref={menuRef}
      role="menu"
      className="fixed z-[100] min-w-[224px] max-w-[260px] bg-card rounded-xl shadow-2xl border border-border py-1.5"
      style={{ top: pos.y, left: pos.x }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <button className={row} onClick={() => { onEdit(note.id); onClose(); }}>
        <Pencil className="h-4 w-4 text-muted-foreground" /> Open
      </button>
      <button className={row} onClick={() => { onToggleFavorite(note); onClose(); }}>
        <Star className={`h-4 w-4 ${note.is_favorite ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'}`} />
        {note.is_favorite ? 'Remove from favorites' : 'Add to favorites'}
      </button>
      <button className={row} onClick={() => { onTogglePin(note); onClose(); }}>
        <Pin className={`h-4 w-4 ${note.is_pinned ? 'fill-orange-400 text-orange-500' : 'text-muted-foreground'}`} />
        {note.is_pinned ? 'Unpin' : 'Pin to top'}
      </button>

      <div className="my-1 border-t border-border/60" />

      {/* Move to folder */}
      <button className={row} onClick={() => setExpanded(expanded === 'move' ? null : 'move')} aria-expanded={expanded === 'move'}>
        <FolderInput className="h-4 w-4 text-muted-foreground" />
        <span className="flex-1">Move to folder</span>
        <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${expanded === 'move' ? 'rotate-90' : ''}`} />
      </button>
      {expanded === 'move' && (
        <div className="px-1.5 pb-1 max-h-44 overflow-auto">
          {note.folder_id && (
            <button className={subRow} onClick={() => { onMoveToFolder(note.id, null); onClose(); }}>
              <CornerUpLeft className="h-4 w-4 text-muted-foreground" /> Remove from folder
            </button>
          )}
          {folders.length === 0 ? (
            <div className="px-3 py-1.5 text-xs text-muted-foreground">No folders yet</div>
          ) : (
            folders.map((f) => (
              <button
                key={f.id}
                className={subRow}
                disabled={note.folder_id === f.id}
                onClick={() => { onMoveToFolder(note.id, f.id); onClose(); }}
              >
                <FolderIcon className="h-4 w-4 flex-shrink-0" style={{ color: tint(f.color) }} />
                <span className="truncate flex-1">{f.name}</span>
                {note.folder_id === f.id && <Check className="h-4 w-4 text-blue-500" />}
              </button>
            ))
          )}
        </div>
      )}

      {/* Copy to folder */}
      <button className={row} onClick={() => setExpanded(expanded === 'copy' ? null : 'copy')} aria-expanded={expanded === 'copy'}>
        <Copy className="h-4 w-4 text-muted-foreground" />
        <span className="flex-1">Copy to folder</span>
        <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${expanded === 'copy' ? 'rotate-90' : ''}`} />
      </button>
      {expanded === 'copy' && (
        <div className="px-1.5 pb-1 max-h-44 overflow-auto">
          {folders.length === 0 ? (
            <div className="px-3 py-1.5 text-xs text-muted-foreground">No folders yet</div>
          ) : (
            folders.map((f) => (
              <button key={f.id} className={subRow} onClick={() => { onCopyToFolder(note.id, f.id); onClose(); }}>
                <FolderIcon className="h-4 w-4 flex-shrink-0" style={{ color: tint(f.color) }} />
                <span className="truncate flex-1">{f.name}</span>
              </button>
            ))
          )}
        </div>
      )}

      <div className="my-1 border-t border-border/60" />

      <button
        className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
        onClick={() => { onDelete(note.id); onClose(); }}
      >
        <Trash2 className="h-4 w-4" /> Delete
      </button>
    </div>
  );
}
