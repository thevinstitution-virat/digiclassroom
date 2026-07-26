# Sanchika Notes System - Comprehensive Technical Documentation

**Feature Name:** Sanchika (संचिका) - Advanced Note-Taking System  
**Version:** 2.0  
**Last Updated:** November 20, 2025  
**Application:** DigiClassroom Pro  
**Access URL:** `http://localhost:3000/dashboard/user/sanchika`

---

## 📋 Table of Contents

1. [Feature Overview](#feature-overview)
2. [Rich Text Editor (TipTap)](#rich-text-editor-tiptap)
3. [Editor Toolbar](#editor-toolbar)
4. [Note Organization](#note-organization)
5. [Search and Filtering](#search-and-filtering)
6. [View Modes](#view-modes)
7. [Auto-Save Mechanism](#auto-save-mechanism)
8. [AI Integration](#ai-integration)
9. [User Workflows](#user-workflows)
10. [Statistics Dashboard](#statistics-dashboard)
11. [API Endpoints](#api-endpoints)
12. [Database Schema](#database-schema)
13. [Code Structure](#code-structure)
14. [Technical Implementation](#technical-implementation)

---

## 🎯 Feature Overview

### What is Sanchika?

**Sanchika** (संचिका, meaning "collection" or "notebook" in Sanskrit) is DigiClassroom Pro's advanced note-taking system designed specifically for students. It combines the power of modern rich text editing with educational features like subject organization, AI integration, and beautiful notebook aesthetics.

### Key Features

✅ **Rich Text Editing**: TipTap-based editor with markdown shortcuts  
✅ **LaTeX Math Support**: Inline ($E=mc^2$) and block ($$\int_0^\infty$$) formulas  
✅ **Code Highlighting**: Syntax-highlighted code blocks for programming notes  
✅ **Smart Organization**: Folders, tags, favorites, pinned notes  
✅ **Full-Text Search**: MySQL FULLTEXT index for instant search  
✅ **Auto-Save**: Debounced auto-save every 2 seconds  
✅ **AI Integration**: Save AI Tutor responses directly as notes  
✅ **Beautiful Covers**: 50+ customizable notebook cover designs  
✅ **Drag & Drop**: Organize notes into folders with drag-and-drop  
✅ **Bulk Operations**: Multi-select for batch actions  
✅ **Context Menu**: Right-click quick actions  
✅ **View Modes**: Grid and list views  
✅ **Statistics**: Track total notes, favorites, AI notes, archived  

### Use Cases

1. **Class Notes**: Take notes during lectures with rich formatting
2. **AI Study Sessions**: Save AI Tutor explanations for later review
3. **Exam Preparation**: Organize notes by subject, chapter, and topic
4. **Code Snippets**: Store programming examples with syntax highlighting
5. **Math Problems**: Write mathematical formulas with LaTeX
6. **Project Documentation**: Create comprehensive project notes
7. **Quick Reminders**: Use checklists for to-do items

---

## 📝 Rich Text Editor (TipTap)

### Overview

Sanchika uses **TipTap**, a headless, framework-agnostic rich text editor built on ProseMirror. It provides a modern, extensible editing experience with markdown shortcuts and real-time formatting.

### TipTap Extensions Used

#### 1. **StarterKit** (Core Features)
Provides essential editing functionality:
- **Bold** (`**text**` or Ctrl+B)
- **Italic** (`*text*` or Ctrl+I)
- **Strikethrough** (~~text~~)
- **Headings** (H1, H2, H3)
- **Paragraphs**
- **Hard Break** (Shift+Enter)
- **Horizontal Rule** (---)
- **Blockquote** (> text)
- **Bullet List** (- item)
- **Ordered List** (1. item)
- **History** (Undo/Redo)

```typescript
StarterKit.configure({
  codeBlock: false, // Disabled (using CodeBlockLowlight instead)
})
```

#### 2. **Link Extension**
Enables hyperlink insertion and management:
- Click toolbar button to add links
- Prompt for URL input
- Custom styling with Tailwind classes
- Opens links on click (configurable)

```typescript
Link.configure({
  openOnClick: false,
  HTMLAttributes: {
    class: 'text-blue-600 underline hover:text-blue-800',
  },
})
```

#### 3. **TaskList & TaskItem**
Interactive checklists for to-do items:
- Markdown shortcut: `[ ]` for unchecked, `[x]` for checked
- Nested task lists supported
- Click to toggle completion

```typescript
TaskList.configure({
  HTMLAttributes: {
    class: 'task-list',
  },
})

TaskItem.configure({
  nested: true,
  HTMLAttributes: {
    class: 'task-item',
  },
})
```

**Example:**
```markdown
- [ ] Study Chapter 5
  - [x] Read section 5.1
  - [ ] Solve exercises
- [ ] Complete assignment
```

#### 4. **CodeBlockLowlight** (Syntax Highlighting)
Code blocks with syntax highlighting using Lowlight (highlight.js wrapper):
- Supports common programming languages (JavaScript, Python, Java, C++, etc.)
- Markdown shortcut: ``` followed by language name
- Automatic language detection

```typescript
CodeBlockLowlight.configure({
  lowlight,
  HTMLAttributes: {
    class: 'code-block',
  },
})
```

**Example:**
````markdown
```python
def fibonacci(n):
    if n <= 1:
        return n
    return fibonacci(n-1) + fibonacci(n-2)
```
````

#### 5. **MathExtension** (Inline LaTeX)
Inline mathematical formulas using KaTeX:
- Markdown shortcut: `$formula$`
- Renders inline with text
- Supports all LaTeX math commands

```typescript
// Usage
$E = mc^2$
$\sum_{i=1}^{n} i = \frac{n(n+1)}{2}$
$\int_0^\infty e^{-x} dx = 1$
```

**Rendered Examples:**
- $E = mc^2$ (Einstein's equation)
- $a^2 + b^2 = c^2$ (Pythagorean theorem)
- $\frac{-b \pm \sqrt{b^2 - 4ac}}{2a}$ (Quadratic formula)

#### 6. **MathBlockExtension** (Display LaTeX)
Block-level mathematical equations:
- Markdown shortcut: `$$formula$$`
- Centered display mode
- Larger font size

```typescript
// Usage
$$
\int_0^\infty \frac{x^3}{e^x - 1} dx = \frac{\pi^4}{15}
$$
```

### Markdown Shortcuts Reference

| Shortcut | Result | Description |
|----------|--------|-------------|
| `#` + space | Heading 1 | Largest heading |
| `##` + space | Heading 2 | Medium heading |
| `###` + space | Heading 3 | Small heading |
| `-` + space | Bullet list | Unordered list item |
| `1.` + space | Numbered list | Ordered list item |
| `[ ]` + space | Checklist | Unchecked task item |
| `**text**` | **Bold** | Bold text |
| `*text*` | *Italic* | Italic text |
| `~~text~~` | ~~Strikethrough~~ | Crossed-out text |
| `` `code` `` | `code` | Inline code |
| ``` + Enter | Code block | Multi-line code |
| `> ` + space | Blockquote | Quoted text |
| `---` + Enter | Horizontal rule | Divider line |
| `$formula$` | Math | Inline LaTeX formula |
| `$$formula$$` | Math block | Display LaTeX equation |

### Editor Configuration

```typescript
const editor = useEditor({
  extensions: [
    StarterKit.configure({ codeBlock: false }),
    Link.configure({ openOnClick: false }),
    TaskList,
    TaskItem.configure({ nested: true }),
    CodeBlockLowlight.configure({ lowlight }),
    MathExtension,
    MathBlockExtension,
  ],
  content: initialContent,
  editable: true,
  immediatelyRender: false, // Prevents SSR hydration mismatch
  onUpdate: ({ editor }) => {
    onChange(editor.getHTML());
  },
  editorProps: {
    attributes: {
      class: 'prose prose-sm sm:prose lg:prose-lg xl:prose-xl focus:outline-none min-h-[200px] max-w-none',
    },
  },
});
```

### KaTeX Integration

**Loading KaTeX:**
```typescript
export const loadKaTeX = async () => {
  if (typeof window === 'undefined') return;
  
  if (!window.katex) {
    const katex = await import('katex');
    window.katex = katex.default;
    
    // Load KaTeX CSS
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css';
    document.head.appendChild(link);
  }
};
```

**Rendering Math:**
```typescript
window.katex.render(latex, containerElement, {
  displayMode: isBlock,
  throwOnError: false,
  errorColor: '#dc2626',
});
```

### Editor Placeholder

When the editor is empty, a helpful placeholder is shown:

```
Start typing... Use # for heading, - for list, ** for bold
```

### Shortcuts Help Bar

At the bottom of the editor, a shortcuts reference is displayed:

```
Shortcuts: # Heading  - List  **Bold**  *Italic*  ```Code```  [ ] Checklist  $Math$  $$Block Math$$
```

---

## 🛠️ Editor Toolbar

### Toolbar Layout

The toolbar is organized into 5 groups with 20+ buttons:

```
[Text Formatting] | [Headings] | [Lists] | [Special Elements] | [History]
```

### Toolbar Buttons Reference

#### Group 1: Text Formatting

| Button | Icon | Shortcut | Function | Active State |
|--------|------|----------|----------|--------------|
| Bold | **B** | Ctrl+B | Toggle bold text | Blue when active |
| Italic | *I* | Ctrl+I | Toggle italic text | Blue when active |
| Strikethrough | ~~S~~ | - | Toggle strikethrough | Blue when active |
| Inline Code | `<>` | - | Toggle inline code | Blue when active |

#### Group 2: Headings

| Button | Icon | Shortcut | Function | Active State |
|--------|------|----------|----------|--------------|
| Heading 1 | H1 | - | Toggle H1 heading | Blue when active |
| Heading 2 | H2 | - | Toggle H2 heading | Blue when active |
| Heading 3 | H3 | - | Toggle H3 heading | Blue when active |

#### Group 3: Lists

| Button | Icon | Shortcut | Function | Active State |
|--------|------|----------|----------|--------------|
| Bullet List | • | - | Toggle bullet list | Blue when active |
| Numbered List | 1. | - | Toggle ordered list | Blue when active |
| Task List | ☑ | - | Toggle checklist | Blue when active |

#### Group 4: Special Elements

| Button | Icon | Shortcut | Function | Active State |
|--------|------|----------|----------|--------------|
| Code Block | `</>` | - | Toggle code block | Blue when active |
| Quote | " | - | Toggle blockquote | Blue when active |
| Link | 🔗 | - | Insert/edit link | Blue when active |
| Math Formula | Σ | - | Insert LaTeX formula | Green icon |

#### Group 5: History

| Button | Icon | Shortcut | Function | Disabled State |
|--------|------|----------|----------|----------------|
| Undo | ↶ | Ctrl+Z | Undo last action | Gray when no history |
| Redo | ↷ | Ctrl+Y | Redo last action | Gray when no future |

### Toolbar Implementation

```typescript
export const EditorToolbar: React.FC<EditorToolbarProps> = ({ editor }) => {
  const ToolbarButton = ({ onClick, active, disabled, children, title }) => (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`p-2 rounded hover:bg-gray-200 transition-colors ${
        active ? 'bg-gray-300 text-blue-600' : 'text-gray-700'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      {children}
    </button>
  );

  return (
    <div className="border-b bg-gray-50 p-2 flex flex-wrap gap-1">
      {/* Text Formatting */}
      <div className="flex gap-1 border-r pr-2">
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          active={editor.isActive('bold')}
          title="Bold (Ctrl+B)"
        >
          <Bold size={18} />
        </ToolbarButton>
        {/* ... more buttons ... */}
      </div>
    </div>
  );
};
```

### Link Insertion Dialog

```typescript
const setLink = () => {
  const url = window.prompt('Enter URL:');
  if (url) {
    editor.chain().focus().setLink({ href: url }).run();
  }
};
```

### Math Formula Dialog

```typescript
const setMath = () => {
  const latex = window.prompt('Enter LaTeX formula (e.g., E = mc^2):');
  if (latex) {
    editor.chain().focus().setMath({ latex, display: false }).run();
  }
};

const setMathBlock = () => {
  const latex = window.prompt('Enter LaTeX formula for block display:');
  if (latex) {
    editor.chain().focus().setMathBlock(latex).run();
  }
};
```

---

## 📁 Note Organization

### Folder System

Sanchika provides a hierarchical folder system for organizing notes by subject, topic, or any custom categorization.

#### Folder Features

✅ **Create Folders**: Organize notes into custom folders
✅ **Rename Folders**: Update folder names anytime
✅ **Delete Folders**: Remove folders (notes remain accessible)
✅ **Color Coding**: Assign colors to folders for visual organization
✅ **Icon Selection**: Choose icons for folder identification
✅ **Drag & Drop**: Move notes between folders with drag-and-drop
✅ **Folder Count**: See number of notes in each folder

#### Folder Structure

```typescript
interface Folder {
  id: string;              // UUID
  name: string;            // Folder name
  color?: string;          // Hex color code
  icon?: string;           // Icon name (Lucide React)
  created_at: string;      // ISO timestamp
  updated_at: string;      // ISO timestamp
}
```

#### Creating a Folder

```typescript
const createFolder = async (name: string) => {
  const response = await fetch('/api/folders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });

  const { folder } = await response.json();
  return folder;
};
```

#### Drag & Drop Implementation

```typescript
// Start dragging a note
const handleDragStart = (note: Note) => {
  setDraggedNote(note);
};

// Drop note into folder
const handleDrop = async (folderId: string) => {
  if (!draggedNote) return;

  await fetch('/api/notes', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: draggedNote.id,
      folder_id: folderId,
    }),
  });

  setDraggedNote(null);
  refetchNotes();
};
```

### Tags System

Tags provide flexible, non-hierarchical organization for notes.

#### Tag Features

✅ **Multiple Tags**: Add unlimited tags to each note
✅ **Auto-Complete**: Suggest existing tags while typing
✅ **Tag Filtering**: Filter notes by one or more tags
✅ **Tag Cloud**: Visual representation of popular tags
✅ **Color-Coded Tags**: Automatic color assignment

#### Tag Structure

```typescript
interface Note {
  tags?: string[];  // Array of tag strings
}
```

#### Adding Tags

```typescript
const addTag = (tag: string) => {
  if (!note.tags) note.tags = [];
  if (!note.tags.includes(tag)) {
    note.tags.push(tag);
    saveNote();
  }
};
```

#### Tag Input Component

```tsx
<input
  type="text"
  placeholder="Add tags (press Enter)"
  value={tagInput}
  onChange={(e) => setTagInput(e.target.value)}
  onKeyDown={(e) => {
    if (e.key === 'Enter' && tagInput.trim()) {
      addTag(tagInput.trim());
      setTagInput('');
    }
  }}
/>
```

### Favorites System

Mark important notes as favorites for quick access.

#### Favorite Features

✅ **Star Icon**: Click star to toggle favorite status
✅ **Favorites Filter**: View only favorited notes
✅ **Quick Access**: Favorites appear at top of list
✅ **Count Badge**: See total favorites in statistics

#### Toggle Favorite

```typescript
const toggleFavorite = async (noteId: string, isFavorite: boolean) => {
  await fetch('/api/notes', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: noteId,
      is_favorite: !isFavorite,
    }),
  });

  refetchNotes();
};
```

### Pinned Notes

Pin important notes to keep them at the top of the list.

#### Pinned Features

✅ **Pin Icon**: Click pin to toggle pinned status
✅ **Always on Top**: Pinned notes appear first
✅ **Pinned Filter**: View only pinned notes
✅ **Visual Indicator**: Pin icon shown on note card

#### Toggle Pinned

```typescript
const togglePinned = async (noteId: string, isPinned: boolean) => {
  await fetch('/api/notes', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: noteId,
      is_pinned: !isPinned,
    }),
  });

  refetchNotes();
};
```

### Archived Notes

Archive old notes to declutter the main view without deleting them.

#### Archive Features

✅ **Archive Action**: Move notes to archive
✅ **Hidden by Default**: Archived notes don't appear in main list
✅ **View Archived**: Toggle to view archived notes
✅ **Restore**: Unarchive notes to restore them
✅ **Permanent Delete**: Delete archived notes permanently

#### Toggle Archive

```typescript
const toggleArchive = async (noteId: string, isArchived: boolean) => {
  await fetch('/api/notes', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: noteId,
      is_archived: !isArchived,
    }),
  });

  refetchNotes();
};
```

### Bulk Operations

Select multiple notes for batch actions.

#### Bulk Features

✅ **Selection Mode**: Toggle multi-select mode
✅ **Select All**: Select all visible notes
✅ **Batch Delete**: Delete multiple notes at once
✅ **Batch Move**: Move notes to a folder
✅ **Batch Archive**: Archive multiple notes
✅ **Batch Favorite**: Mark multiple notes as favorites

#### Selection Mode Implementation

```typescript
const [selectionMode, setSelectionMode] = useState(false);
const [selectedNotes, setSelectedNotes] = useState<Set<string>>(new Set());

const toggleSelection = (noteId: string) => {
  const newSelection = new Set(selectedNotes);
  if (newSelection.has(noteId)) {
    newSelection.delete(noteId);
  } else {
    newSelection.add(noteId);
  }
  setSelectedNotes(newSelection);
};

const bulkDelete = async () => {
  for (const noteId of selectedNotes) {
    await fetch(`/api/notes?id=${noteId}`, { method: 'DELETE' });
  }
  setSelectedNotes(new Set());
  setSelectionMode(false);
  refetchNotes();
};
```

### Context Menu

Right-click on notes for quick actions.

#### Context Menu Actions

- **Open**: Open note in editor
- **Edit**: Edit note metadata
- **Favorite**: Toggle favorite status
- **Pin**: Toggle pinned status
- **Move to Folder**: Move to a different folder
- **Duplicate**: Create a copy of the note
- **Archive**: Archive the note
- **Delete**: Delete the note permanently

#### Context Menu Implementation

```typescript
const [contextMenu, setContextMenu] = useState<{
  note: Note;
  x: number;
  y: number;
} | null>(null);

const handleContextMenu = (e: React.MouseEvent, note: Note) => {
  e.preventDefault();
  setContextMenu({
    note,
    x: e.clientX,
    y: e.clientY,
  });
};

// Close context menu on click outside
useEffect(() => {
  const handleClick = () => setContextMenu(null);
  document.addEventListener('click', handleClick);
  return () => document.removeEventListener('click', handleClick);
}, []);
```

### Cover Design System

Customize note appearance with beautiful cover designs.

#### Cover Categories

1. **Floral** (4 designs): Pink Blossoms, Lavender Dreams, Mint Garden, Peach Petals
2. **Abstract** (5 designs): Ocean Waves, Geometric Mosaic, Sunset Gradient, Aurora Borealis, Fire & Ice
3. **Subject-Specific** (6 designs): Mathematics, Science Lab, Literature, History, Geography, Computer Science
4. **Solid Colors** (10 designs): Blue, Red, Green, Purple, Orange, Pink, Teal, Indigo, Gray, Black
5. **Gradients** (15 designs): Various multi-color gradients

**Total: 50+ Cover Designs**

#### Cover Design Structure

```typescript
interface CoverDesign {
  id: string;              // e.g., 'floral-pink'
  name: string;            // e.g., 'Pink Blossoms'
  category: 'floral' | 'abstract' | 'subject' | 'solid' | 'gradient';
  pattern: string;         // CSS gradient or background
  thumbnail: string;       // Preview color
}
```

#### Spine Color Picker

Choose from 20+ predefined spine colors:

```typescript
export const SPINE_COLORS = [
  { name: 'Blue', value: '#3B82F6' },
  { name: 'Red', value: '#EF4444' },
  { name: 'Green', value: '#10B981' },
  { name: 'Purple', value: '#8B5CF6' },
  { name: 'Orange', value: '#F97316' },
  { name: 'Pink', value: '#EC4899' },
  { name: 'Teal', value: '#14B8A6' },
  { name: 'Indigo', value: '#6366F1' },
  // ... 12 more colors
];
```

#### Cover Design Picker Modal

```tsx
<CoverDesignPicker
  currentCoverDesign={note.cover_design}
  currentSpineColor={note.spine_color}
  onSelect={(coverDesign, spineColor) => {
    updateNote({
      cover_design: coverDesign,
      spine_color: spineColor,
    });
  }}
  onClose={() => setShowCoverPicker(false)}
/>
```

---

## 🔍 Search and Filtering

### Full-Text Search

Sanchika uses MySQL FULLTEXT index for fast, accurate search across note titles and content.

#### Search Features

✅ **Instant Search**: Results appear as you type
✅ **Title & Content**: Searches both title and content
✅ **Relevance Ranking**: Most relevant results first
✅ **Highlight Matches**: Search terms highlighted in results
✅ **Search History**: Recent searches saved

#### Search Implementation

```typescript
const [searchQuery, setSearchQuery] = useState('');

const filteredNotes = notes.filter((note) => {
  if (!searchQuery) return true;

  const query = searchQuery.toLowerCase();
  const titleMatch = note.title.toLowerCase().includes(query);
  const contentMatch = note.content.toLowerCase().includes(query);
  const tagMatch = note.tags?.some(tag => tag.toLowerCase().includes(query));

  return titleMatch || contentMatch || tagMatch;
});
```

#### Database FULLTEXT Index

```sql
CREATE FULLTEXT INDEX idx_search ON user_notes(title, content);

-- Search query
SELECT * FROM user_notes
WHERE MATCH(title, content) AGAINST(? IN NATURAL LANGUAGE MODE)
AND clerk_id = ?
ORDER BY MATCH(title, content) AGAINST(? IN NATURAL LANGUAGE MODE) DESC;
```

### Filter Options

#### Filter by Status

- **All Notes**: Show all active notes (default)
- **Favorites**: Show only favorited notes
- **Pinned**: Show only pinned notes
- **Archived**: Show archived notes

```typescript
const [filterBy, setFilterBy] = useState<'all' | 'favorites' | 'pinned'>('all');

const filteredNotes = notes.filter((note) => {
  if (filterBy === 'favorites') return note.is_favorite;
  if (filterBy === 'pinned') return note.is_pinned;
  return true;
});
```

#### Filter by Subject

```typescript
const [selectedSubject, setSelectedSubject] = useState<string | null>(null);

const filteredNotes = notes.filter((note) => {
  if (!selectedSubject) return true;
  return note.subject === selectedSubject;
});
```

#### Filter by Folder

```typescript
const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);

const filteredNotes = notes.filter((note) => {
  if (!selectedFolderId) return true;
  return note.folder_id === selectedFolderId;
});
```

#### Filter by Tags

```typescript
const [selectedTags, setSelectedTags] = useState<string[]>([]);

const filteredNotes = notes.filter((note) => {
  if (selectedTags.length === 0) return true;
  return selectedTags.every(tag => note.tags?.includes(tag));
});
```

### Sort Options

#### Sort by Date

- **Recent**: Newest notes first (default)
- **Oldest**: Oldest notes first

```typescript
const [sortBy, setSortBy] = useState<'recent' | 'oldest' | 'title'>('recent');

const sortedNotes = [...filteredNotes].sort((a, b) => {
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
```

#### Sort by Title

- **A-Z**: Alphabetical order
- **Z-A**: Reverse alphabetical order

---

## 📊 View Modes

### Grid View

Display notes as cards in a responsive grid layout.

#### Grid Features

✅ **Responsive**: 1-4 columns based on screen size
✅ **Cover Preview**: Show note cover design
✅ **Quick Actions**: Hover to reveal actions
✅ **Visual Hierarchy**: Pinned notes highlighted
✅ **Metadata Display**: Subject, tags, date

#### Grid Layout

```tsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
  {notes.map((note) => (
    <div
      key={note.id}
      className="relative bg-white dark:bg-gray-800 rounded-xl shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:scale-105 cursor-pointer overflow-hidden"
      onClick={() => router.push(`/dashboard/user/sanchika/${note.id}`)}
    >
      {/* Cover Design */}
      <div
        className="h-32 relative"
        style={{
          background: getCoverDesign(note.cover_design)?.pattern || 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)',
        }}
      >
        {/* Spine */}
        <div
          className="absolute left-0 top-0 bottom-0 w-2"
          style={{ background: note.spine_color || '#3B82F6' }}
        />

        {/* Pinned Badge */}
        {note.is_pinned && (
          <div className="absolute top-2 right-2 bg-white/90 rounded-full p-1">
            <Pin className="h-4 w-4 text-orange-500" />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        <h3 className="font-bold text-lg mb-2 line-clamp-2">{note.title}</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-3">
          {stripHtml(note.content)}
        </p>

        {/* Metadata */}
        <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
          <span>{note.subject || 'General'}</span>
          <span>{formatDate(note.updated_at)}</span>
        </div>

        {/* Tags */}
        {note.tags && note.tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {note.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded-full text-xs"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
        <button onClick={(e) => { e.stopPropagation(); toggleFavorite(note.id); }}>
          <Star className={note.is_favorite ? 'fill-yellow-400 text-yellow-400' : 'text-gray-400'} />
        </button>
      </div>
    </div>
  ))}
</div>
```

### List View

Display notes as compact rows in a table-like layout.

#### List Features

✅ **Compact**: More notes visible at once
✅ **Sortable Columns**: Click headers to sort
✅ **Quick Scan**: Easy to scan titles
✅ **Inline Actions**: Actions visible without hover
✅ **Metadata Columns**: Subject, date, tags

#### List Layout

```tsx
<div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden">
  <table className="w-full">
    <thead className="bg-gray-50 dark:bg-gray-900">
      <tr>
        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
          Title
        </th>
        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
          Subject
        </th>
        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
          Tags
        </th>
        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
          Updated
        </th>
        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
          Actions
        </th>
      </tr>
    </thead>
    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
      {notes.map((note) => (
        <tr
          key={note.id}
          className="hover:bg-gray-50 dark:hover:bg-gray-900 cursor-pointer"
          onClick={() => router.push(`/dashboard/user/sanchika/${note.id}`)}
        >
          <td className="px-6 py-4">
            <div className="flex items-center gap-2">
              {note.is_pinned && <Pin className="h-4 w-4 text-orange-500" />}
              {note.is_favorite && <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />}
              <span className="font-medium">{note.title}</span>
            </div>
          </td>
          <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
            {note.subject || '-'}
          </td>
          <td className="px-6 py-4">
            <div className="flex flex-wrap gap-1">
              {note.tags?.slice(0, 2).map((tag) => (
                <span
                  key={tag}
                  className="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded-full text-xs"
                >
                  {tag}
                </span>
              ))}
            </div>
          </td>
          <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
            {formatDate(note.updated_at)}
          </td>
          <td className="px-6 py-4 text-right">
            <button
              onClick={(e) => { e.stopPropagation(); handleContextMenu(e, note); }}
              className="text-gray-400 hover:text-gray-600"
            >
              •••
            </button>
          </td>
        </tr>
      ))}
    </tbody>
  </table>
</div>
```

### View Mode Toggle

```tsx
<div className="flex gap-2">
  <button
    onClick={() => setViewMode('grid')}
    className={`p-2 rounded ${viewMode === 'grid' ? 'bg-blue-100 text-blue-600' : 'text-gray-600'}`}
  >
    <Grid3x3 className="h-5 w-5" />
  </button>
  <button
    onClick={() => setViewMode('list')}
    className={`p-2 rounded ${viewMode === 'list' ? 'bg-blue-100 text-blue-600' : 'text-gray-600'}`}
  >
    <ListIcon className="h-5 w-5" />
  </button>
</div>
```

---

## 💾 Auto-Save Mechanism

### Overview

Sanchika implements an intelligent auto-save system that saves notes automatically without interrupting the user's workflow.

### Auto-Save Features

✅ **Debounced Saving**: Waits 2 seconds after typing stops
✅ **Save Status Indicator**: Shows "Saving...", "Saved", or "Error"
✅ **Optimistic Updates**: UI updates immediately
✅ **Error Recovery**: Retries failed saves
✅ **Draft Persistence**: Saves drafts locally
✅ **Conflict Resolution**: Handles concurrent edits

### Implementation

#### Debounced Auto-Save Hook

```typescript
import { useEffect, useRef, useState } from 'react';

export const useAutoSave = (
  data: any,
  saveFunction: (data: any) => Promise<void>,
  delay: number = 2000
) => {
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const previousDataRef = useRef(data);

  useEffect(() => {
    // Skip if data hasn't changed
    if (JSON.stringify(data) === JSON.stringify(previousDataRef.current)) {
      return;
    }

    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Set saving status
    setSaveStatus('saving');

    // Schedule save
    timeoutRef.current = setTimeout(async () => {
      try {
        await saveFunction(data);
        setSaveStatus('saved');
        previousDataRef.current = data;

        // Reset to idle after 2 seconds
        setTimeout(() => setSaveStatus('idle'), 2000);
      } catch (error) {
        console.error('Auto-save failed:', error);
        setSaveStatus('error');
      }
    }, delay);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [data, saveFunction, delay]);

  return { saveStatus };
};
```

#### Usage in Note Editor

```typescript
const [note, setNote] = useState<Note>(initialNote);
const [isDirty, setIsDirty] = useState(false);

const saveNote = async (noteData: Note) => {
  const response = await fetch('/api/notes', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(noteData),
  });

  if (!response.ok) {
    throw new Error('Failed to save note');
  }

  setIsDirty(false);
};

const { saveStatus } = useAutoSave(note, saveNote, 2000);

const handleContentChange = (html: string) => {
  setNote({ ...note, content: html });
  setIsDirty(true);
};
```

#### Save Status Indicator

```tsx
<div className="flex items-center gap-2 text-sm">
  {saveStatus === 'saving' && (
    <>
      <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
      <span className="text-blue-500">Saving...</span>
    </>
  )}
  {saveStatus === 'saved' && (
    <>
      <Check className="h-4 w-4 text-green-500" />
      <span className="text-green-500">Saved</span>
    </>
  )}
  {saveStatus === 'error' && (
    <>
      <AlertCircle className="h-4 w-4 text-red-500" />
      <span className="text-red-500">Error saving</span>
      <button onClick={() => saveNote(note)} className="text-blue-500 underline">
        Retry
      </button>
    </>
  )}
  {saveStatus === 'idle' && isDirty && (
    <span className="text-gray-500">Unsaved changes</span>
  )}
</div>
```

### Draft Persistence

Save drafts to localStorage for recovery after browser crashes or accidental closes.

```typescript
const saveDraft = (noteId: string, content: string) => {
  localStorage.setItem(`draft_${noteId}`, JSON.stringify({
    content,
    timestamp: Date.now(),
  }));
};

const loadDraft = (noteId: string): string | null => {
  const draft = localStorage.getItem(`draft_${noteId}`);
  if (!draft) return null;

  const { content, timestamp } = JSON.parse(draft);

  // Discard drafts older than 24 hours
  if (Date.now() - timestamp > 24 * 60 * 60 * 1000) {
    localStorage.removeItem(`draft_${noteId}`);
    return null;
  }

  return content;
};

const clearDraft = (noteId: string) => {
  localStorage.removeItem(`draft_${noteId}`);
};
```

### Conflict Resolution

Handle concurrent edits from multiple devices or tabs.

```typescript
const handleConflict = async (localNote: Note, serverNote: Note) => {
  // Compare timestamps
  const localTime = new Date(localNote.updated_at).getTime();
  const serverTime = new Date(serverNote.updated_at).getTime();

  if (serverTime > localTime) {
    // Server version is newer
    const shouldOverwrite = confirm(
      'This note was modified elsewhere. Do you want to overwrite with your changes?'
    );

    if (shouldOverwrite) {
      await saveNote(localNote);
    } else {
      setNote(serverNote);
    }
  }
};
```

---

## 🤖 AI Integration

### Overview

Sanchika seamlessly integrates with the AI Tutor (Virat Gyankosh) to save AI-generated explanations, solutions, and study materials directly as notes.

### AI Integration Features

✅ **One-Click Save**: Save AI responses with a single click
✅ **Automatic Metadata**: Extract subject, chapter, board, class from context
✅ **Source Tracking**: Track which AI query generated the note
✅ **Rich Formatting**: Preserve markdown, code, and math formatting
✅ **Batch Save**: Save multiple AI responses at once
✅ **Smart Titles**: Auto-generate descriptive titles

### Saving AI Tutor Responses

#### From AI Tutor Chat Interface

```tsx
// In AI Tutor component
const saveToSanchika = async (message: AIMessage) => {
  const response = await fetch('/api/notes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: generateTitle(message.content),
      content: message.content,
      content_format: 'markdown',
      subject: currentSubject,
      chapter: currentChapter,
      board: userBoard,
      class_level: userClass,
      source_type: 'ai_tutor',
      source_query: message.query,
      tags: extractTags(message.content),
    }),
  });

  const { note } = await response.json();

  // Show success notification
  toast.success('Saved to Sanchika!', {
    action: {
      label: 'View',
      onClick: () => router.push(`/dashboard/user/sanchika/${note.id}`),
    },
  });
};
```

#### Auto-Generate Title

```typescript
const generateTitle = (content: string): string => {
  // Extract first heading
  const headingMatch = content.match(/^#+ (.+)$/m);
  if (headingMatch) {
    return headingMatch[1].trim();
  }

  // Extract first sentence
  const firstSentence = content.split(/[.!?]/)[0].trim();
  if (firstSentence.length > 0 && firstSentence.length < 100) {
    return firstSentence;
  }

  // Fallback to first 50 characters
  return content.substring(0, 50).trim() + '...';
};
```

#### Extract Tags

```typescript
const extractTags = (content: string): string[] => {
  const tags: string[] = [];

  // Extract subject-specific keywords
  const keywords = [
    'algebra', 'geometry', 'calculus', 'physics', 'chemistry',
    'biology', 'history', 'geography', 'literature', 'grammar',
  ];

  const lowerContent = content.toLowerCase();
  keywords.forEach((keyword) => {
    if (lowerContent.includes(keyword)) {
      tags.push(keyword);
    }
  });

  return [...new Set(tags)]; // Remove duplicates
};
```

### Database Source Tracking

Notes saved from AI Tutor include source information:

```typescript
interface Note {
  source_type: 'manual' | 'ai_tutor' | 'imported';
  source_query?: string;  // Original question asked to AI
}
```

#### Query Source Information

```sql
-- Find all notes from AI Tutor
SELECT * FROM user_notes
WHERE source_type = 'ai_tutor'
AND clerk_id = ?
ORDER BY created_at DESC;

-- Find notes related to a specific query
SELECT * FROM user_notes
WHERE source_query LIKE ?
AND clerk_id = ?;
```

### AI Notes Statistics

Track how many notes were created from AI Tutor:

```typescript
const getAINotesCount = async (userId: string): Promise<number> => {
  const result = await executeQuery(
    `SELECT COUNT(*) as count FROM user_notes
     WHERE clerk_id = ? AND source_type = 'ai_tutor'`,
    [userId]
  );

  return result[0].count;
};
```

---

## 👤 User Workflows

### Workflow 1: Creating a New Note from Scratch

**Step-by-Step Guide:**

1. **Navigate to Sanchika**
   - Click "Sanchika" in the user sidebar
   - Or visit `/dashboard/user/sanchika`

2. **Click "New Note" Button**
   - Large "+" button in the top-right corner
   - Or press `Ctrl+N` keyboard shortcut

3. **Enter Note Title**
   - Click on "Untitled Note" to edit
   - Type a descriptive title (e.g., "Chapter 5: Algebra Notes")

4. **Select Subject and Metadata**
   - Choose subject from dropdown (Mathematics, Science, etc.)
   - Optionally add chapter name
   - Select board (CBSE, ICSE, STATE_BOARD)
   - Select class level (1-12)

5. **Start Writing Content**
   - Click in the editor area
   - Use markdown shortcuts for formatting
   - Add headings with `#`, `##`, `###`
   - Create lists with `-` or `1.`
   - Add code blocks with ```
   - Insert math formulas with `$...$` or `$$...$$`

6. **Format with Toolbar**
   - Use toolbar buttons for bold, italic, etc.
   - Insert links, code blocks, quotes
   - Add checklists for to-do items

7. **Add Tags**
   - Type tags in the tag input field
   - Press Enter to add each tag
   - Tags help with organization and search

8. **Customize Cover Design** (Optional)
   - Click the palette icon
   - Choose from 50+ cover designs
   - Select spine color
   - Preview and apply

9. **Auto-Save**
   - Note saves automatically every 2 seconds
   - Watch for "Saved" indicator
   - No need to manually save

10. **Organize** (Optional)
    - Move to a folder by dragging
    - Mark as favorite with star icon
    - Pin to top with pin icon

### Workflow 2: Saving an AI Tutor Response as a Note

**Step-by-Step Guide:**

1. **Ask Question in AI Tutor**
   - Navigate to AI Tutor (Virat Gyankosh)
   - Select subject and chapter
   - Type your question
   - Get AI response

2. **Review AI Response**
   - Read the explanation
   - Check if it's helpful
   - Verify accuracy

3. **Click "Save to Sanchika" Button**
   - Button appears below AI response
   - Icon: Bookmark or Save icon
   - Tooltip: "Save this response to your notes"

4. **Automatic Processing**
   - Title auto-generated from content
   - Subject and chapter auto-filled
   - Source query saved for reference
   - Tags extracted from content

5. **Confirmation**
   - Success notification appears
   - "View" button to open note
   - Note added to Sanchika list

6. **Edit if Needed**
   - Click "View" to open note
   - Add personal annotations
   - Highlight important parts
   - Add related examples

### Workflow 3: Editing an Existing Note

**Step-by-Step Guide:**

1. **Find the Note**
   - Use search bar to find by title
   - Filter by subject or folder
   - Sort by recent or title

2. **Open Note**
   - Click on note card (grid view)
   - Or click on note row (list view)
   - Note opens in editor

3. **Switch to Edit Mode**
   - Click "Edit" tab (if in preview mode)
   - Editor becomes active

4. **Make Changes**
   - Edit title, content, metadata
   - Add or remove tags
   - Update subject or chapter

5. **Auto-Save**
   - Changes save automatically
   - Watch for "Saved" indicator

6. **Preview Changes**
   - Click "Preview" tab
   - See formatted output
   - Check math rendering

7. **Return to List**
   - Click back arrow
   - Or press `Esc` key
   - Note appears in list with updates

### Workflow 4: Organizing Notes into Folders

**Step-by-Step Guide:**

1. **Create a Folder**
   - Click "New Folder" button
   - Enter folder name (e.g., "Mathematics")
   - Optionally choose color and icon
   - Click "Create"

2. **Move Notes to Folder**
   - **Method 1: Drag & Drop**
     - Click and hold note card
     - Drag to folder in sidebar
     - Release to drop

   - **Method 2: Context Menu**
     - Right-click on note
     - Select "Move to Folder"
     - Choose folder from list

   - **Method 3: Bulk Move**
     - Enable selection mode
     - Select multiple notes
     - Click "Move to Folder"
     - Choose destination folder

3. **View Folder Contents**
   - Click folder in sidebar
   - Only notes in that folder shown
   - Folder name displayed in header

4. **Rename Folder**
   - Right-click folder
   - Select "Rename"
   - Enter new name
   - Press Enter

5. **Delete Folder**
   - Right-click folder
   - Select "Delete"
   - Confirm deletion
   - Notes remain (moved to "All Notes")

### Workflow 5: Searching and Filtering Notes

**Step-by-Step Guide:**

1. **Use Search Bar**
   - Click search input at top
   - Type search query
   - Results filter in real-time

2. **Apply Filters**
   - Click "Filter" button
   - Select filter type:
     - All Notes
     - Favorites
     - Pinned
     - Archived
   - Notes update immediately

3. **Filter by Subject**
   - Click subject dropdown
   - Select subject
   - Only notes for that subject shown

4. **Filter by Tags**
   - Click tag in tag cloud
   - Or select from tag dropdown
   - Notes with that tag shown

5. **Sort Results**
   - Click "Sort" button
   - Choose sort order:
     - Recent (newest first)
     - Oldest (oldest first)
     - Title (A-Z)
   - List reorders

6. **Clear Filters**
   - Click "Clear Filters" button
   - Or click "All Notes" filter
   - All notes shown again

### Workflow 6: Using Favorites and Pinned Notes

**Step-by-Step Guide:**

1. **Mark as Favorite**
   - Hover over note card
   - Click star icon
   - Star turns yellow
   - Note marked as favorite

2. **View Favorites**
   - Click "Favorites" filter
   - Only favorited notes shown
   - Quick access to important notes

3. **Pin Note**
   - Hover over note card
   - Click pin icon
   - Pin turns orange
   - Note pinned to top

4. **Pinned Notes Behavior**
   - Always appear first in list
   - Regardless of sort order
   - Visible in all views

5. **Unmark Favorite/Unpin**
   - Click star/pin icon again
   - Icon returns to gray
   - Note returns to normal position

### Workflow 7: Archiving and Deleting Notes

**Step-by-Step Guide:**

1. **Archive a Note**
   - Right-click note
   - Select "Archive"
   - Note removed from main list
   - Moved to archive

2. **View Archived Notes**
   - Click "Archived" filter
   - All archived notes shown
   - Can search and sort

3. **Restore from Archive**
   - Right-click archived note
   - Select "Restore"
   - Note returns to main list

4. **Delete Note Permanently**
   - Right-click note
   - Select "Delete"
   - Confirm deletion
   - Note removed permanently
   - **Warning**: Cannot be undone

5. **Bulk Archive/Delete**
   - Enable selection mode
   - Select multiple notes
   - Click "Archive" or "Delete"
   - Confirm action
   - All selected notes processed

---

## 📊 Statistics Dashboard

### Overview

The Sanchika statistics dashboard provides insights into note-taking habits and content organization.

### Statistics Displayed

#### 1. Total Notes
- Count of all active notes (excluding archived)
- Displayed with book icon
- Updates in real-time

```typescript
const totalNotes = notes.filter(n => !n.is_archived).length;
```

#### 2. Favorites Count
- Number of favorited notes
- Displayed with star icon
- Quick access to favorites

```typescript
const favoritesCount = notes.filter(n => n.is_favorite && !n.is_archived).length;
```

#### 3. AI Tutor Notes
- Notes created from AI Tutor
- Displayed with sparkles icon
- Shows AI integration usage

```typescript
const aiNotesCount = notes.filter(n => n.source_type === 'ai_tutor' && !n.is_archived).length;
```

#### 4. Archived Notes
- Number of archived notes
- Displayed with archive icon
- Hidden from main view

```typescript
const archivedCount = notes.filter(n => n.is_archived).length;
```

### Statistics Card Component

```tsx
<div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
  <StatCard
    icon={<BookOpen className="h-8 w-8 text-blue-500" />}
    label="Total Notes"
    value={totalNotes}
    color="blue"
  />
  <StatCard
    icon={<Star className="h-8 w-8 text-yellow-500" />}
    label="Favorites"
    value={favoritesCount}
    color="yellow"
  />
  <StatCard
    icon={<Sparkles className="h-8 w-8 text-purple-500" />}
    label="AI Tutor Notes"
    value={aiNotesCount}
    color="purple"
  />
  <StatCard
    icon={<Archive className="h-8 w-8 text-gray-500" />}
    label="Archived"
    value={archivedCount}
    color="gray"
  />
</div>
```

### Recent Activity Feed

Shows last 5 note activities:

```typescript
interface Activity {
  id: string;
  note_id: string;
  user_id: string;
  activity_type: 'created' | 'updated' | 'deleted' | 'archived';
  created_at: string;
}

const recentActivities = await executeQuery(
  `SELECT a.*, n.title as note_title
   FROM note_activity_log a
   JOIN user_notes n ON a.note_id = n.id
   WHERE a.user_id = ?
   ORDER BY a.created_at DESC
   LIMIT 5`,
  [userId]
);
```

---

## 🔌 API Endpoints

### Base URL
```
http://localhost:3000/api
```

### Authentication
All endpoints require Clerk authentication. Include the Clerk session token in requests.

---

### `POST /api/notes` - Create Note

**Purpose**: Create a new note

**Authentication**: Required

**Request Body**:
```json
{
  "title": "Chapter 5: Algebra",
  "content": "<p>Rich HTML content</p>",
  "content_format": "html",
  "subject": "Mathematics",
  "chapter": "Algebra",
  "board": "CBSE",
  "class_level": 10,
  "tags": ["algebra", "equations"],
  "folder_id": "folder-uuid",
  "cover_design": "solid-blue",
  "spine_color": "#3B82F6",
  "is_favorite": false,
  "is_pinned": false,
  "source_type": "manual",
  "source_query": null
}
```

**Response** (201 Created):
```json
{
  "note": {
    "id": "note-uuid",
    "title": "Chapter 5: Algebra",
    "content": "<p>Rich HTML content</p>",
    "content_format": "html",
    "subject": "Mathematics",
    "chapter": "Algebra",
    "board": "CBSE",
    "class_level": 10,
    "tags": ["algebra", "equations"],
    "folder_id": "folder-uuid",
    "cover_design": "solid-blue",
    "spine_color": "#3B82F6",
    "is_favorite": false,
    "is_pinned": false,
    "is_archived": false,
    "source_type": "manual",
    "source_query": null,
    "created_at": "2025-11-20T10:30:00Z",
    "updated_at": "2025-11-20T10:30:00Z",
    "last_accessed_at": "2025-11-20T10:30:00Z"
  }
}
```

**Error Responses**:
- `400 Bad Request`: Missing or invalid title
- `401 Unauthorized`: Not authenticated
- `500 Internal Server Error`: Database error

---

### `GET /api/notes` - List Notes

**Purpose**: Fetch all notes for the authenticated user

**Authentication**: Required

**Query Parameters**:
- `limit` (optional): Number of results (default: 20, max: 100)
- `offset` (optional): Pagination offset (default: 0)

**Example Request**:
```
GET /api/notes?limit=50&offset=0
```

**Response** (200 OK):
```json
[
  {
    "id": "note-uuid-1",
    "title": "Chapter 5: Algebra",
    "content": "<p>Rich HTML content</p>",
    "content_format": "html",
    "subject": "Mathematics",
    "chapter": "Algebra",
    "board": "CBSE",
    "class_level": 10,
    "tags": ["algebra", "equations"],
    "folder_id": "folder-uuid",
    "folder": {
      "id": "folder-uuid",
      "name": "Mathematics",
      "color": "#3B82F6",
      "icon": "calculator"
    },
    "cover_design": "solid-blue",
    "spine_color": "#3B82F6",
    "is_favorite": true,
    "is_pinned": false,
    "is_archived": false,
    "source_type": "manual",
    "source_query": null,
    "created_at": "2025-11-20T10:30:00Z",
    "updated_at": "2025-11-20T10:35:00Z",
    "last_accessed_at": "2025-11-20T10:35:00Z"
  },
  // ... more notes
]
```

**Error Responses**:
- `401 Unauthorized`: Not authenticated
- `500 Internal Server Error`: Database error

---

### `GET /api/notes?id={noteId}` - Get Single Note

**Purpose**: Fetch a specific note by ID

**Authentication**: Required

**Query Parameters**:
- `id` (required): Note UUID

**Example Request**:
```
GET /api/notes?id=note-uuid-123
```

**Response** (200 OK):
```json
{
  "note": {
    "id": "note-uuid-123",
    "title": "Chapter 5: Algebra",
    "content": "<p>Rich HTML content</p>",
    "content_format": "html",
    "subject": "Mathematics",
    "chapter": "Algebra",
    "board": "CBSE",
    "class_level": 10,
    "tags": ["algebra", "equations"],
    "folder_id": "folder-uuid",
    "folder": {
      "id": "folder-uuid",
      "name": "Mathematics",
      "color": "#3B82F6",
      "icon": "calculator"
    },
    "cover_design": "solid-blue",
    "spine_color": "#3B82F6",
    "is_favorite": true,
    "is_pinned": false,
    "is_archived": false,
    "source_type": "manual",
    "source_query": null,
    "created_at": "2025-11-20T10:30:00Z",
    "updated_at": "2025-11-20T10:35:00Z",
    "last_accessed_at": "2025-11-20T10:35:00Z"
  }
}
```

**Error Responses**:
- `401 Unauthorized`: Not authenticated
- `404 Not Found`: Note doesn't exist or doesn't belong to user
- `500 Internal Server Error`: Database error

---

### `PUT /api/notes` - Update Note

**Purpose**: Update an existing note

**Authentication**: Required

**Request Body** (all fields optional except `id`):
```json
{
  "id": "note-uuid-123",
  "title": "Updated Title",
  "content": "<p>Updated content</p>",
  "content_format": "html",
  "subject": "Mathematics",
  "chapter": "Algebra",
  "board": "CBSE",
  "class_level": 10,
  "tags": ["algebra", "equations", "quadratic"],
  "is_favorite": true,
  "is_pinned": false,
  "is_archived": false
}
```

**Response** (200 OK):
```json
{
  "note": {
    "id": "note-uuid-123",
    "title": "Updated Title",
    "content": "<p>Updated content</p>",
    // ... full note object
    "updated_at": "2025-11-20T10:40:00Z"
  }
}
```

**Error Responses**:
- `400 Bad Request`: Missing note ID
- `401 Unauthorized`: Not authenticated
- `404 Not Found`: Note doesn't exist or doesn't belong to user
- `500 Internal Server Error`: Database error

---

### `DELETE /api/notes?id={noteId}` - Delete Note

**Purpose**: Permanently delete a note

**Authentication**: Required

**Query Parameters**:
- `id` (required): Note UUID

**Example Request**:
```
DELETE /api/notes?id=note-uuid-123
```

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Note deleted successfully"
}
```

**Error Responses**:
- `400 Bad Request`: Missing note ID
- `401 Unauthorized`: Not authenticated
- `404 Not Found`: Note doesn't exist or doesn't belong to user
- `500 Internal Server Error`: Database error

---

### `GET /api/folders` - List Folders

**Purpose**: Fetch all folders for the authenticated user

**Authentication**: Required

**Response** (200 OK):
```json
[
  {
    "id": "folder-uuid-1",
    "name": "Mathematics",
    "color": "#3B82F6",
    "icon": "calculator",
    "created_at": "2025-11-20T10:00:00Z",
    "updated_at": "2025-11-20T10:00:00Z"
  },
  // ... more folders
]
```

---

### `POST /api/folders` - Create Folder

**Purpose**: Create a new folder

**Authentication**: Required

**Request Body**:
```json
{
  "name": "Mathematics",
  "color": "#3B82F6",
  "icon": "calculator"
}
```

**Response** (201 Created):
```json
{
  "folder": {
    "id": "folder-uuid",
    "name": "Mathematics",
    "color": "#3B82F6",
    "icon": "calculator",
    "created_at": "2025-11-20T10:00:00Z",
    "updated_at": "2025-11-20T10:00:00Z"
  }
}
```

---

## 🗄️ Database Schema

### `user_notes` Table

Complete schema for storing notes:

```sql
CREATE TABLE user_notes (
  -- Primary Key
  id VARCHAR(36) PRIMARY KEY,

  -- User Identification
  clerk_id VARCHAR(255) NOT NULL,
  user_id VARCHAR(255) NOT NULL,

  -- Content
  title VARCHAR(500) NOT NULL,
  content LONGTEXT,
  content_format ENUM('markdown', 'html', 'plain') DEFAULT 'html',

  -- Educational Metadata
  subject VARCHAR(100),
  chapter VARCHAR(200),
  board ENUM('CBSE', 'ICSE', 'STATE_BOARD'),
  class_level TINYINT CHECK (class_level >= 1 AND class_level <= 12),

  -- Organization
  orientation VARCHAR(20) DEFAULT 'portrait',
  tags JSON,
  folder_id VARCHAR(36),

  -- Customization
  cover_design VARCHAR(50) DEFAULT 'solid-blue',
  spine_color VARCHAR(20) DEFAULT '#3B82F6',

  -- Source Tracking
  source_type ENUM('manual', 'ai_tutor', 'imported') DEFAULT 'manual',
  source_query TEXT,

  -- Flags
  is_favorite BOOLEAN DEFAULT FALSE,
  is_pinned BOOLEAN DEFAULT FALSE,
  is_archived BOOLEAN DEFAULT FALSE,

  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  last_accessed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- Indexes
  INDEX idx_user_notes (clerk_id, is_archived),
  INDEX idx_subject (subject),
  INDEX idx_folder (folder_id),
  INDEX idx_source_type (source_type),
  INDEX idx_created_at (created_at),
  INDEX idx_updated_at (updated_at),
  FULLTEXT INDEX idx_search (title, content),

  -- Foreign Keys
  FOREIGN KEY (folder_id) REFERENCES note_folders(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### Field Descriptions

| Field | Type | Description |
|-------|------|-------------|
| `id` | VARCHAR(36) | UUID primary key |
| `clerk_id` | VARCHAR(255) | Clerk user ID (authentication) |
| `user_id` | VARCHAR(255) | Application user ID |
| `title` | VARCHAR(500) | Note title (required) |
| `content` | LONGTEXT | Note content (HTML/Markdown) |
| `content_format` | ENUM | Format: 'markdown', 'html', 'plain' |
| `subject` | VARCHAR(100) | Subject name (e.g., "Mathematics") |
| `chapter` | VARCHAR(200) | Chapter name (e.g., "Algebra") |
| `board` | ENUM | Educational board |
| `class_level` | TINYINT | Class/grade (1-12) |
| `orientation` | VARCHAR(20) | Page orientation (portrait/landscape) |
| `tags` | JSON | Array of tag strings |
| `folder_id` | VARCHAR(36) | Parent folder UUID |
| `cover_design` | VARCHAR(50) | Cover design ID |
| `spine_color` | VARCHAR(20) | Hex color code for spine |
| `source_type` | ENUM | How note was created |
| `source_query` | TEXT | Original AI query (if from AI Tutor) |
| `is_favorite` | BOOLEAN | Favorite flag |
| `is_pinned` | BOOLEAN | Pinned flag |
| `is_archived` | BOOLEAN | Archived flag |
| `created_at` | TIMESTAMP | Creation timestamp |
| `updated_at` | TIMESTAMP | Last update timestamp |
| `last_accessed_at` | TIMESTAMP | Last access timestamp |

### `note_folders` Table

```sql
CREATE TABLE note_folders (
  id VARCHAR(36) PRIMARY KEY,
  clerk_id VARCHAR(255) NOT NULL,
  user_id VARCHAR(255) NOT NULL,
  name VARCHAR(100) NOT NULL,
  color VARCHAR(20) DEFAULT '#3B82F6',
  icon VARCHAR(50) DEFAULT 'folder',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_user_folders (clerk_id),
  UNIQUE KEY unique_user_folder_name (clerk_id, name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### `note_activity_log` Table

```sql
CREATE TABLE note_activity_log (
  id VARCHAR(36) PRIMARY KEY,
  note_id VARCHAR(36) NOT NULL,
  user_id VARCHAR(255) NOT NULL,
  activity_type ENUM('created', 'updated', 'deleted', 'archived', 'restored') NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  INDEX idx_note_activity (note_id),
  INDEX idx_user_activity (user_id, created_at),
  FOREIGN KEY (note_id) REFERENCES user_notes(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### Database Migrations

#### Migration: Add Cover Design Columns

```sql
-- 004_sanchika_performance_optimization.sql
ALTER TABLE user_notes
ADD COLUMN cover_design VARCHAR(50) DEFAULT 'solid-blue' AFTER folder_id,
ADD COLUMN spine_color VARCHAR(20) DEFAULT '#3B82F6' AFTER cover_design;
```

#### Migration: Add Source Tracking

```sql
ALTER TABLE user_notes
ADD COLUMN source_type ENUM('manual', 'ai_tutor', 'imported') DEFAULT 'manual' AFTER spine_color,
ADD COLUMN source_query TEXT AFTER source_type,
ADD INDEX idx_source_type (source_type);
```

---

## 📂 Code Structure

### File Organization

```
src/
├── app/
│   ├── dashboard/
│   │   └── user/
│   │       └── sanchika/
│   │           ├── page.tsx                    # Notes list page
│   │           └── [id]/
│   │               └── page.tsx                # Note editor page
│   └── api/
│       ├── notes/
│       │   └── route.ts                        # Notes CRUD API
│       └── folders/
│           └── route.ts                        # Folders CRUD API
│
├── components/
│   └── sanchika/
│       ├── RichTextEditor.tsx                  # TipTap editor component
│       ├── EditorToolbar.tsx                   # Formatting toolbar
│       ├── CoverDesignPicker.tsx               # Cover customization modal
│       ├── CoverDesigns.tsx                    # Cover design definitions
│       ├── NoteContextMenu.tsx                 # Right-click menu
│       ├── FlashcardGenerator.tsx              # AI flashcard generation
│       └── extensions/
│           └── MathExtension.tsx               # LaTeX math extension
│
├── hooks/
│   ├── useAutoSave.ts                          # Auto-save hook
│   ├── useNotes.ts                             # Notes data fetching
│   └── useFolders.ts                           # Folders data fetching
│
└── lib/
    └── db/
        └── migrations/
            ├── 002_user_notes_sanchika.sql     # Initial schema
            └── 004_sanchika_performance_optimization.sql  # Optimizations
```

### Key Components

#### 1. Notes List Page (`page.tsx`)

**Location**: `src/app/dashboard/user/sanchika/page.tsx`

**Responsibilities**:
- Display notes in grid or list view
- Search and filter functionality
- Folder sidebar
- Statistics dashboard
- Bulk operations
- Context menu

**Key State**:
```typescript
const [notes, setNotes] = useState<Note[]>([]);
const [folders, setFolders] = useState<Folder[]>([]);
const [searchQuery, setSearchQuery] = useState('');
const [filterBy, setFilterBy] = useState<'all' | 'favorites' | 'pinned'>('all');
const [sortBy, setSortBy] = useState<'recent' | 'oldest' | 'title'>('recent');
const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
```

**Key Functions**:
- `fetchNotes()`: Load notes from API
- `fetchFolders()`: Load folders from API
- `handleSearch()`: Filter notes by search query
- `handleSort()`: Sort notes by criteria
- `handleDragDrop()`: Move notes to folders
- `handleBulkAction()`: Perform bulk operations

#### 2. Note Editor Page (`[id]/page.tsx`)

**Location**: `src/app/dashboard/user/sanchika/[id]/page.tsx`

**Responsibilities**:
- Rich text editing with TipTap
- Auto-save functionality
- Metadata editing (title, subject, tags)
- Cover design customization
- Preview mode
- Settings panel

**Key State**:
```typescript
const [note, setNote] = useState<Note | null>(null);
const [activeTab, setActiveTab] = useState<'edit' | 'preview' | 'settings'>('edit');
const [isSaving, setIsSaving] = useState(false);
const [isDirty, setIsDirty] = useState(false);
const [showCoverPicker, setShowCoverPicker] = useState(false);
```

**Key Functions**:
- `fetchNote()`: Load note from API
- `saveNote()`: Save note to API
- `handleContentChange()`: Update content and trigger auto-save
- `handleMetadataChange()`: Update title, subject, tags
- `handleCoverChange()`: Update cover design

#### 3. Rich Text Editor (`RichTextEditor.tsx`)

**Location**: `src/components/sanchika/RichTextEditor.tsx`

**Responsibilities**:
- TipTap editor initialization
- Extension configuration
- Content change handling
- Placeholder display
- Shortcuts help

**Props**:
```typescript
interface RichTextEditorProps {
  content: string;
  onChange: (html: string) => void;
  editable?: boolean;
  placeholder?: string;
  className?: string;
}
```

**Extensions**:
- StarterKit
- Link
- TaskList & TaskItem
- CodeBlockLowlight
- MathExtension
- MathBlockExtension

#### 4. Editor Toolbar (`EditorToolbar.tsx`)

**Location**: `src/components/sanchika/EditorToolbar.tsx`

**Responsibilities**:
- Formatting buttons
- Heading controls
- List controls
- Special element insertion
- Undo/Redo

**Props**:
```typescript
interface EditorToolbarProps {
  editor: Editor;
}
```

#### 5. Cover Design Picker (`CoverDesignPicker.tsx`)

**Location**: `src/components/sanchika/CoverDesignPicker.tsx`

**Responsibilities**:
- Display cover design gallery
- Category filtering
- Spine color picker
- Live preview
- Apply changes

**Props**:
```typescript
interface CoverDesignPickerProps {
  currentCoverDesign?: string;
  currentSpineColor?: string;
  onSelect: (coverDesign: string, spineColor: string) => void;
  onClose: () => void;
}
```

---

## ⚙️ Technical Implementation

### TipTap Editor Setup

```typescript
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { common, createLowlight } from 'lowlight';
import { MathExtension, MathBlockExtension } from './extensions/MathExtension';

const lowlight = createLowlight(common);

const editor = useEditor({
  extensions: [
    StarterKit.configure({ codeBlock: false }),
    Link.configure({ openOnClick: false }),
    TaskList,
    TaskItem.configure({ nested: true }),
    CodeBlockLowlight.configure({ lowlight }),
    MathExtension,
    MathBlockExtension,
  ],
  content: initialContent,
  editable: true,
  immediatelyRender: false,
  onUpdate: ({ editor }) => {
    onChange(editor.getHTML());
  },
});
```

### KaTeX Math Rendering

```typescript
// Load KaTeX dynamically
const loadKaTeX = async () => {
  if (!window.katex) {
    const katex = await import('katex');
    window.katex = katex.default;

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css';
    document.head.appendChild(link);
  }
};

// Render math formula
window.katex.render(latex, containerElement, {
  displayMode: isBlock,
  throwOnError: false,
  errorColor: '#dc2626',
});
```

### Auto-Save Implementation

```typescript
useEffect(() => {
  if (!note || !isDirty) return;

  const timeoutId = setTimeout(async () => {
    setIsSaving(true);
    try {
      await saveNote(note);
      setIsDirty(false);
    } catch (error) {
      console.error('Auto-save failed:', error);
    } finally {
      setIsSaving(false);
    }
  }, 2000);

  return () => clearTimeout(timeoutId);
}, [note, isDirty]);
```

### Drag & Drop Implementation

```typescript
const handleDragStart = (e: React.DragEvent, note: Note) => {
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('noteId', note.id);
  setDraggedNote(note);
};

const handleDragOver = (e: React.DragEvent, folderId: string) => {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  setDropTarget(folderId);
};

const handleDrop = async (e: React.DragEvent, folderId: string) => {
  e.preventDefault();
  const noteId = e.dataTransfer.getData('noteId');

  await fetch('/api/notes', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: noteId, folder_id: folderId }),
  });

  setDraggedNote(null);
  setDropTarget(null);
  refetchNotes();
};
```

### Full-Text Search Query

```typescript
const searchNotes = async (query: string) => {
  const response = await fetch(`/api/notes/search?q=${encodeURIComponent(query)}`);
  const notes = await response.json();
  return notes;
};

// Backend implementation
const searchQuery = `
  SELECT *, MATCH(title, content) AGAINST(? IN NATURAL LANGUAGE MODE) as relevance
  FROM user_notes
  WHERE MATCH(title, content) AGAINST(? IN NATURAL LANGUAGE MODE)
  AND clerk_id = ?
  AND is_archived = 0
  ORDER BY relevance DESC, updated_at DESC
  LIMIT 50
`;
```

---

## 🎯 Best Practices

### 1. Content Sanitization

Always sanitize user-generated HTML content:

```typescript
import DOMPurify from 'dompurify';

const sanitizeContent = (html: string): string => {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 's', 'h1', 'h2', 'h3', 'ul', 'ol', 'li', 'code', 'pre', 'blockquote', 'a', 'span', 'div'],
    ALLOWED_ATTR: ['href', 'class', 'data-type', 'data-latex', 'data-display'],
  });
};
```

### 2. Error Handling

Implement comprehensive error handling:

```typescript
try {
  await saveNote(note);
} catch (error) {
  if (error.code === 'NETWORK_ERROR') {
    toast.error('Network error. Changes saved locally.');
    saveDraft(note.id, note.content);
  } else if (error.code === 'CONFLICT') {
    handleConflict(note);
  } else {
    toast.error('Failed to save note. Please try again.');
  }
}
```

### 3. Performance Optimization

- Use React.memo for expensive components
- Implement virtual scrolling for large note lists
- Lazy load images and cover designs
- Debounce search and filter operations
- Use IndexedDB for offline caching

### 4. Accessibility

- Provide keyboard shortcuts for all actions
- Use semantic HTML elements
- Add ARIA labels to interactive elements
- Ensure sufficient color contrast
- Support screen readers

---

## 📚 Additional Resources

### Related Documentation
- [User Dashboard Feature Analysis](../user-dashboard-feature-analysis.md)
- [Sanchika Quick Reference](./sanchika-quick-reference.md)
- [TipTap Documentation](https://tiptap.dev/)
- [KaTeX Documentation](https://katex.org/)

### External Libraries
- **TipTap**: Rich text editor framework
- **KaTeX**: LaTeX math rendering
- **Lowlight**: Syntax highlighting
- **DOMPurify**: HTML sanitization
- **UUID**: Unique ID generation

---

**Document Prepared By**: Augment AI Agent
**For**: DigiClassroom Pro Development Team
**Date**: November 20, 2025
**Version**: 2.0

---

*End of Sanchika Notes System Documentation*

