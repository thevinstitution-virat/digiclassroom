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
import dynamic from 'next/dynamic';
import type { InkLayerRef, InkStroke, PenTool } from './InkLayer';
import type { FavoritePen } from './PenToolbar';
import FloatingInkBar from './FloatingInkBar';
import HandwritingGuide from './HandwritingGuide';

const InkLayer = dynamic(() => import('./InkLayer').then(m => ({ default: m.InkLayer })), { ssr: false });
const PenToolbar = dynamic(() => import('./PenToolbar'), { ssr: false });

const lowlight = createLowlight(common);
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
  /** Expose ink controls to the parent */
  inkControls?: { getSVG?: () => string };
  /** Previously saved SVG ink to render under the canvas and merge on save */
  initialInkSVG?: string;
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

function Toolbar({ editor, inkActive, setInkActive }: { editor: Editor; inkActive?: boolean; setInkActive?: React.Dispatch<React.SetStateAction<boolean>> }) {
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

      {setInkActive && (
        <div className="stb-group">
          <button
            type="button"
            className={`stb${inkActive ? ' stb-active' : ''}`}
            onClick={() => setInkActive(v => !v)}
            title="Toggle ink/handwriting overlay (Ctrl+Shift+P)"
            style={inkActive ? { background: '#eff6ff', color: '#1d4ed8' } : {}}
          >
            🖊️
          </button>
        </div>
      )}
    </div>
  );
}

export function RichTextEditor(props: RichTextEditorProps) {
  const { content, initialContent, onChange, editable, readOnly, className, placeholder, autoFocus, hideToolbar, searchNotes, onWikiLinkClick, pageLayout, inkControls, initialInkSVG } = props;

  const isEditable = editable ?? (readOnly === undefined ? true : !readOnly);

  // ── Ink layer state ──────────────────────────────────────────────────────────
  const inkLayerRef = useRef<InkLayerRef>(null);
  const [inkActive, setInkActive]     = useState(false);
  const [inkTool, setInkTool]         = useState<PenTool>('gel');
  const [inkColor, setInkColor]       = useState('#1a1a1a');
  const [inkOpacity, setInkOpacity]   = useState(0.9);
  const [inkSize, setInkSize]         = useState<number>(18);
  const [inkStrokes, setInkStrokes]   = useState<InkStroke[]>([]);
  const [pageSize, setPageSize]       = useState({ w: 794, h: 1123 }); // A4 at 96 dpi
  const pageRef = useRef<HTMLDivElement>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const [guideFixedStyle, setGuideFixedStyle] = useState<React.CSSProperties>({});

  // New ink state for redesigned toolbar
  const [eraserMode, setEraserMode] = useState<'stroke' | 'area'>('stroke');
  const [eraseHighlighterOnly, setEraseHighlighterOnly] = useState(false);
  const [selectionMode, setSelectionMode] = useState<'lasso' | 'rectangle'>('lasso');
  const [includePartial, setIncludePartial] = useState(true);
  const [selectedStrokeIds, setSelectedStrokeIds] = useState<Set<string>>(new Set());
  const [showGuide, setShowGuide] = useState(false);
  const [changingStyle, setChangingStyle] = useState(false);
  const [showFloatingBar, setShowFloatingBar] = useState(false);
  const [floatingBarPos, setFloatingBarPos]   = useState({ top: 40, left: 40 });
  const [guideLineIndex, setGuideLineIndex]   = useState(0);

  // Favorite pens — persisted in localStorage
  const [favoritePens, setFavoritePens] = useState<FavoritePen[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const saved = localStorage.getItem('sanchika-fav-pens');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  useEffect(() => {
    try { localStorage.setItem('sanchika-fav-pens', JSON.stringify(favoritePens)); } catch {}
  }, [favoritePens]);

  const handleSaveFavorite = useCallback(() => {
    if (favoritePens.length >= 5) return;
    const fav: FavoritePen = {
      id: `fav_${Date.now()}`,
      tool: inkTool,
      color: inkColor,
      size: inkSize,
      opacity: inkOpacity,
    };
    setFavoritePens(prev => [...prev, fav]);
  }, [favoritePens.length, inkTool, inkColor, inkSize, inkOpacity]);

  const handleApplyFavorite = useCallback((f: FavoritePen) => {
    setInkTool(f.tool);
    setInkColor(f.color);
    setInkSize(f.size);
    setInkOpacity(f.opacity);
  }, []);

  const handleDeleteFavorite = useCallback((id: string) => {
    setFavoritePens(prev => prev.filter(f => f.id !== id));
  }, []);

  const handleApplyStyleToSelection = useCallback((updates: Partial<Pick<InkStroke, 'color' | 'size' | 'opacity'>>) => {
    setInkStrokes(prev => prev.map(s => selectedStrokeIds.has(s.id) ? { ...s, ...updates } : s));
  }, [selectedStrokeIds]);

  const firstSelectedStrokeStyle = useMemo(() => {
    const s = inkStrokes.find(s => selectedStrokeIds.has(s.id));
    if (!s) return null;
    return { size: s.size, color: s.color, opacity: s.opacity };
  }, [inkStrokes, selectedStrokeIds]);

  if (inkControls) {
    inkControls.getSVG = () => {
      const newSvg = inkLayerRef.current?.getSVGString() || '';
      if (!initialInkSVG) return newSvg;
      
      const isNewEmpty = !newSvg || newSvg.includes('width="0"') || newSvg.indexOf('<path') === -1;
      if (isNewEmpty) return initialInkSVG;

      // Extract new paths and append to initialSVG
      const newPathsMatch = newSvg.match(/<svg[^>]*>([\s\S]*?)<\/svg>/);
      if (newPathsMatch && newPathsMatch[1].trim()) {
        return initialInkSVG.replace('</svg>', newPathsMatch[1] + '\n</svg>');
      }
      return initialInkSVG;
    };
  }

  // Measure the actual .sanchika-page dimensions after mount
  useEffect(() => {
    if (!pageRef.current) return;
    const obs = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      setPageSize({ w: Math.round(width), h: Math.round(height) });
    });
    obs.observe(pageRef.current);
    return () => obs.disconnect();
  }, []);

  // Effect 1: Keep HandwritingGuide's position:fixed in sync with the canvas rect.
  useEffect(() => {
    if (!showGuide || !canvasContainerRef.current) return;

    const update = () => {
      const rect = canvasContainerRef.current?.getBoundingClientRect();
      if (!rect) return;
      setGuideFixedStyle({
        position: 'fixed',
        bottom: 0,
        left: rect.left,
        width: rect.width,
      });
    };

    update(); // run immediately on mount / showGuide toggle

    const ro = new ResizeObserver(update);
    ro.observe(canvasContainerRef.current);
    window.addEventListener('scroll', update, { passive: true });

    return () => {
      ro.disconnect();
      window.removeEventListener('scroll', update);
    };
  }, [showGuide]);


  // Keyboard shortcut: Ctrl/Cmd+Shift+P → toggle ink
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'P') {
        e.preventDefault();
        setInkActive(v => !v);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

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

  // Effect 2: Scroll the matching Tiptap block into view when lineIndex changes.
  useEffect(() => {
    if (!showGuide || !editor) return;

    let targetOffset = -1;
    let currentIndex = 0;

    editor.state.doc.forEach((_node, offset) => {
      if (currentIndex === guideLineIndex) targetOffset = offset;
      currentIndex++;
    });

    if (targetOffset === -1) return;

    // offset + 1 steps inside the node (ProseMirror content position convention)
    const dom = editor.view.nodeDOM(targetOffset + 1);
    if (dom instanceof HTMLElement) {
      dom.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [guideLineIndex, showGuide, editor]);

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
      {editor && !hideToolbar && isEditable && <Toolbar editor={editor} inkActive={inkActive} setInkActive={setInkActive} />}
      {editor ? (
        <div className="sanchika-canvas" ref={canvasContainerRef}>
          <div
            ref={pageRef}
            className={`sanchika-page ${inkActive ? 'ink-mode-active' : ''}`}
            style={{ position: 'relative', width: pgW, minHeight: pgH, padding: pgPad, ['--page-pad' as keyof React.CSSProperties]: `${pgPad}px` } as React.CSSProperties}
          >
            <EditorContent editor={editor} />
            {initialInkSVG && (
              <div 
                className="sanchika-ink-restore"
                style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 5 }}
                dangerouslySetInnerHTML={{ __html: initialInkSVG }}
              />
            )}
            <InkLayer
              ref={inkLayerRef}
              active={inkActive}
              tool={inkTool}
              color={inkColor}
              opacity={inkOpacity}
              size={inkSize}
              eraserMode={eraserMode}
              eraseHighlighterOnly={eraseHighlighterOnly}
              selectionMode={selectionMode}
              includePartial={includePartial}
              selectedStrokeIds={selectedStrokeIds}
              onSelectionChange={setSelectedStrokeIds}
              strokes={inkStrokes}
              onStrokesChange={setInkStrokes}
              pageW={pageSize.w}
              pageH={pageSize.h}
            />
          </div>
          {inkActive && (
            <PenToolbar
              tool={inkTool}
              color={inkColor}
              opacity={inkOpacity}
              size={inkSize}
              eraserMode={eraserMode}
              eraseHighlighterOnly={eraseHighlighterOnly}
              selectionMode={selectionMode}
              includePartial={includePartial}
              hasSelection={selectedStrokeIds.size > 0}
              onTool={setInkTool}
              onColor={setInkColor}
              onOpacity={setInkOpacity}
              onSize={setInkSize}
              onEraserMode={setEraserMode}
              onEraseHighlighterOnly={setEraseHighlighterOnly}
              onSelectionMode={setSelectionMode}
              onIncludePartial={setIncludePartial}
              onUndo={() => inkLayerRef.current?.undo()}
              onClear={() => inkLayerRef.current?.clear()}
              onChangeStyle={() => setChangingStyle(true)}
              onDeleteSelected={() => {
                setInkStrokes(prev => prev.filter(s => !selectedStrokeIds.has(s.id)));
                setSelectedStrokeIds(new Set());
              }}
              onClose={() => setInkActive(false)}
              onShowFloatingBar={() => setShowFloatingBar(true)}
              showGuide={showGuide}
              onToggleGuide={() => setShowGuide(v => !v)}
              favoritePens={favoritePens}
              onSaveFavorite={handleSaveFavorite}
              onApplyFavorite={handleApplyFavorite}
              onDeleteFavorite={handleDeleteFavorite}
              onApplyStyleToSelection={handleApplyStyleToSelection}
              selectedStyle={firstSelectedStrokeStyle}
            />
          )}
          {showFloatingBar && inkActive && (
            <FloatingInkBar
              tool={inkTool}
              onTool={(t) => setInkTool(t)}
              onUndo={() => inkLayerRef.current?.undo()}
              onClose={(lastPos) => {
                setFloatingBarPos(lastPos);
                setShowFloatingBar(false);
              }}
              initialPosition={floatingBarPos}
              containerRef={canvasContainerRef}
            />
          )}
        </div>
      ) : (
        <div className="sanchika-editor-loading">Loading editor…</div>
      )}

      {showGuide && inkActive && (
        <HandwritingGuide
          active={showGuide}
          lineIndex={guideLineIndex}
          totalLines={editor?.state.doc.childCount ?? 0}
          onPrev={() => setGuideLineIndex(i => Math.max(0, i - 1))}
          onNext={() =>
            setGuideLineIndex(i =>
              Math.min((editor?.state.doc.childCount ?? 1) - 1, i + 1)
            )
          }
          style={guideFixedStyle}
        />
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
          position: relative;
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

        /* ── Ink mode — page gets a subtle blue ring while active ── */
        .sanchika-page.ink-mode-active {
          box-shadow:
            0 0 0 2px #3b82f6,
            0 4px 24px rgba(0,0,0,0.10);
        }
      `}</style>
    </div>
  );
}

export default RichTextEditor;
