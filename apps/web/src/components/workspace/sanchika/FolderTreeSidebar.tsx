'use client';

/**
 * Sanchika Folder Tree Sidebar
 *
 * Phase 0 of the Sanchika upgrade: replaces the previous placeholder stub
 * (which only rendered the text "Folder Tree") with a real folder list.
 *
 * The list page already wires all the props/handlers — this component just
 * renders them: "All Notes" + "Uncategorized" pseudo-folders, the user's
 * folders with note counts, selection highlighting, and create/manage actions.
 */

import React from 'react';
import { Folder as FolderIcon, FolderPlus, Settings2, FileText, Inbox, Network } from 'lucide-react';

export interface FolderTreeItem {
  id: string;
  name: string;
  color?: string;
  icon?: string;
  note_count?: number;
  parent_id?: string | null;
}

interface FolderTreeSidebarProps {
  folders: FolderTreeItem[];
  selectedFolderId: string | null;
  onSelectFolder: (folderId: string | null) => void;
  onCreateFolder?: () => void;
  onManageFolders?: () => void;
  // Drag-and-drop: drop a note onto a folder (or onto Uncategorized => folderId null).
  onFolderDragOver?: (e: React.DragEvent, folderId: string | null) => void;
  onFolderDragLeave?: () => void;
  onFolderDrop?: (e: React.DragEvent, folderId: string | null) => void;
  /** Active drop target key: a folder id, or 'uncategorized'. */
  dropTargetId?: string | null;
  /** Open the knowledge graph view. */
  onOpenGraph?: () => void;
}

// Folder color names stored in the DB ('blue', 'red', …) are valid CSS color
// keywords, so we can use them directly to tint the folder icon.
function tint(color?: string): string {
  return color && color.trim() ? color : '#3b82f6';
}

export function FolderTreeSidebar({
  folders,
  selectedFolderId,
  onSelectFolder,
  onCreateFolder,
  onManageFolders,
  onFolderDragOver,
  onFolderDragLeave,
  onFolderDrop,
  dropTargetId,
  onOpenGraph,
}: FolderTreeSidebarProps) {
  const itemBase =
    'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors text-left';
  const itemIdle =
    'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/60';
  const itemActive =
    'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 font-medium';
  const dropHi = 'ring-2 ring-blue-400 ring-inset bg-blue-50 dark:bg-blue-900/20';

  const cls = (active: boolean, dropKey?: string) =>
    `${itemBase} ${active ? itemActive : itemIdle} ${dropKey && dropTargetId === dropKey ? dropHi : ''}`;

  // Drag-and-drop handlers for a droppable folder item.
  const dropHandlers = (folderId: string | null) =>
    onFolderDrop
      ? {
          onDragOver: (e: React.DragEvent) => onFolderDragOver?.(e, folderId),
          onDragLeave: () => onFolderDragLeave?.(),
          onDrop: (e: React.DragEvent) => onFolderDrop(e, folderId),
        }
      : {};

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-3">
      {/* Header */}
      <div className="flex items-center justify-between px-1 mb-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
          Folders
        </h3>
        <div className="flex items-center gap-1">
          {onCreateFolder && (
            <button
              type="button"
              onClick={onCreateFolder}
              title="New folder"
              aria-label="New folder"
              className="p-1.5 rounded-md text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
            >
              <FolderPlus className="h-4 w-4" />
            </button>
          )}
          {onManageFolders && (
            <button
              type="button"
              onClick={onManageFolders}
              title="Manage folders"
              aria-label="Manage folders"
              className="p-1.5 rounded-md text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
            >
              <Settings2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Pseudo-folders */}
      <nav className="space-y-1">
        <button type="button" className={cls(selectedFolderId === null)} onClick={() => onSelectFolder(null)}>
          <FileText className="h-4 w-4 flex-shrink-0" />
          <span className="truncate">All Notes</span>
        </button>
        <button
          type="button"
          className={cls(selectedFolderId === 'uncategorized', 'uncategorized')}
          onClick={() => onSelectFolder('uncategorized')}
          {...dropHandlers(null)}
        >
          <Inbox className="h-4 w-4 flex-shrink-0" />
          <span className="truncate">Uncategorized</span>
        </button>

        {/* User folders */}
        <div className="pt-2 mt-1 border-t border-gray-100 dark:border-gray-700/60 space-y-1">
          {folders.length === 0 ? (
            <p className="px-3 py-3 text-xs text-gray-400 dark:text-gray-500">
              No folders yet. Click the <FolderPlus className="inline h-3.5 w-3.5 -mt-0.5" /> icon to create one.
            </p>
          ) : (
            folders.map((f) => {
              const active = selectedFolderId === f.id;
              return (
                <button key={f.id} type="button" className={cls(active, f.id)} onClick={() => onSelectFolder(f.id)} {...dropHandlers(f.id)}>
                  <FolderIcon className="h-4 w-4 flex-shrink-0" style={{ color: tint(f.color) }} />
                  <span className="truncate flex-1">{f.name}</span>
                  {typeof f.note_count === 'number' && (
                    <span className="ml-auto text-xs px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
                      {f.note_count}
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>
      </nav>

      {onOpenGraph && (
        <button
          type="button"
          onClick={onOpenGraph}
          className="mt-3 w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-purple-700 dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-900/20 border border-purple-100 dark:border-purple-900/40 transition-colors"
        >
          <Network className="h-4 w-4" /> Graph view
        </button>
      )}
    </div>
  );
}

export default FolderTreeSidebar;
