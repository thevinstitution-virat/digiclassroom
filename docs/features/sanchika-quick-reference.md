# Sanchika Notes System - Quick Reference Guide

**For**: Developers working on DigiClassroom Pro  
**Last Updated**: November 20, 2025  
**Version**: 2.0

---

## 🚀 Quick Start

### Access Sanchika
```
URL: http://localhost:3000/dashboard/user/sanchika
```

### File Locations

```
Frontend:
├── src/app/dashboard/user/sanchika/page.tsx          # Notes list
├── src/app/dashboard/user/sanchika/[id]/page.tsx     # Note editor
├── src/components/sanchika/RichTextEditor.tsx        # TipTap editor
├── src/components/sanchika/EditorToolbar.tsx         # Toolbar
├── src/components/sanchika/CoverDesignPicker.tsx     # Cover picker
├── src/components/sanchika/CoverDesigns.tsx          # Cover definitions
└── src/components/sanchika/extensions/MathExtension.tsx  # LaTeX math

Backend:
├── src/app/api/notes/route.ts                        # Notes CRUD API
└── src/app/api/folders/route.ts                      # Folders API

Database:
└── src/lib/db/migrations/002_user_notes_sanchika.sql # Schema
```

---

## 📝 Common Code Snippets

### 1. Create a New Note

```typescript
const createNote = async (title: string, content: string) => {
  const response = await fetch('/api/notes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title,
      content,
      content_format: 'html',
      subject: 'Mathematics',
      tags: ['algebra'],
    }),
  });
  
  const { note } = await response.json();
  return note;
};
```

### 2. Fetch All Notes

```typescript
const fetchNotes = async () => {
  const response = await fetch('/api/notes?limit=50&offset=0');
  const notes = await response.json();
  return notes;
};
```

### 3. Update a Note

```typescript
const updateNote = async (noteId: string, updates: Partial<Note>) => {
  const response = await fetch('/api/notes', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: noteId, ...updates }),
  });
  
  const { note } = await response.json();
  return note;
};
```

### 4. Delete a Note

```typescript
const deleteNote = async (noteId: string) => {
  await fetch(`/api/notes?id=${noteId}`, {
    method: 'DELETE',
  });
};
```

### 5. Initialize TipTap Editor

```typescript
import { useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';

const editor = useEditor({
  extensions: [
    StarterKit,
    Link.configure({ openOnClick: false }),
    TaskList,
    TaskItem.configure({ nested: true }),
  ],
  content: '<p>Start typing...</p>',
  onUpdate: ({ editor }) => {
    console.log(editor.getHTML());
  },
});
```

### 6. Auto-Save Hook

```typescript
import { useEffect, useRef, useState } from 'react';

const useAutoSave = (data: any, saveFunction: (data: any) => Promise<void>) => {
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    
    setSaveStatus('saving');
    timeoutRef.current = setTimeout(async () => {
      await saveFunction(data);
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    }, 2000);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [data]);

  return { saveStatus };
};
```

### 7. Search Notes

```typescript
const searchNotes = (notes: Note[], query: string) => {
  const lowerQuery = query.toLowerCase();
  return notes.filter((note) => {
    return (
      note.title.toLowerCase().includes(lowerQuery) ||
      note.content.toLowerCase().includes(lowerQuery) ||
      note.tags?.some(tag => tag.toLowerCase().includes(lowerQuery))
    );
  });
};
```

### 8. Filter and Sort Notes

```typescript
const filterAndSortNotes = (
  notes: Note[],
  filterBy: 'all' | 'favorites' | 'pinned',
  sortBy: 'recent' | 'oldest' | 'title'
) => {
  // Filter
  let filtered = notes;
  if (filterBy === 'favorites') {
    filtered = notes.filter(n => n.is_favorite);
  } else if (filterBy === 'pinned') {
    filtered = notes.filter(n => n.is_pinned);
  }
  
  // Sort
  return filtered.sort((a, b) => {
    if (sortBy === 'recent') {
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    } else if (sortBy === 'oldest') {
      return new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime();
    } else {
      return a.title.localeCompare(b.title);
    }
  });
};
```

### 9. Drag & Drop Implementation

```typescript
const [draggedNote, setDraggedNote] = useState<Note | null>(null);

const handleDragStart = (note: Note) => {
  setDraggedNote(note);
};

const handleDrop = async (folderId: string) => {
  if (!draggedNote) return;
  
  await updateNote(draggedNote.id, { folder_id: folderId });
  setDraggedNote(null);
  refetchNotes();
};
```

### 10. Save AI Tutor Response

```typescript
const saveAIResponse = async (message: string, query: string) => {
  const note = await createNote(
    generateTitle(message),
    message,
  );
  
  await updateNote(note.id, {
    source_type: 'ai_tutor',
    source_query: query,
    tags: extractTags(message),
  });
  
  return note;
};
```

---

## 🔌 API Quick Reference

### Create Note
```bash
curl -X POST http://localhost:3000/api/notes \
  -H "Content-Type: application/json" \
  -d '{
    "title": "My Note",
    "content": "<p>Content</p>",
    "subject": "Mathematics"
  }'
```

### Get All Notes
```bash
curl http://localhost:3000/api/notes?limit=50&offset=0
```

### Get Single Note
```bash
curl http://localhost:3000/api/notes?id=note-uuid-123
```

### Update Note
```bash
curl -X PUT http://localhost:3000/api/notes \
  -H "Content-Type: application/json" \
  -d '{
    "id": "note-uuid-123",
    "title": "Updated Title",
    "is_favorite": true
  }'
```

### Delete Note
```bash
curl -X DELETE http://localhost:3000/api/notes?id=note-uuid-123
```

---

## 🗄️ Database Quick Reference

### Query All Notes for User
```sql
SELECT * FROM user_notes
WHERE clerk_id = ?
AND is_archived = 0
ORDER BY updated_at DESC;
```

### Search Notes
```sql
SELECT *, MATCH(title, content) AGAINST(? IN NATURAL LANGUAGE MODE) as relevance
FROM user_notes
WHERE MATCH(title, content) AGAINST(? IN NATURAL LANGUAGE MODE)
AND clerk_id = ?
ORDER BY relevance DESC;
```

### Get Favorites
```sql
SELECT * FROM user_notes
WHERE clerk_id = ?
AND is_favorite = 1
AND is_archived = 0
ORDER BY updated_at DESC;
```

### Get AI Tutor Notes
```sql
SELECT * FROM user_notes
WHERE clerk_id = ?
AND source_type = 'ai_tutor'
AND is_archived = 0
ORDER BY created_at DESC;
```

### Get Notes by Folder
```sql
SELECT n.*, f.name as folder_name
FROM user_notes n
LEFT JOIN note_folders f ON n.folder_id = f.id
WHERE n.clerk_id = ?
AND n.folder_id = ?
AND n.is_archived = 0;
```

---

## ⌨️ Keyboard Shortcuts

### Editor Shortcuts
- `Ctrl+B` - Bold
- `Ctrl+I` - Italic
- `Ctrl+Z` - Undo
- `Ctrl+Y` - Redo
- `Ctrl+S` - Manual save (auto-save is automatic)
- `Esc` - Exit editor

### Markdown Shortcuts
- `#` + space - Heading 1
- `##` + space - Heading 2
- `###` + space - Heading 3
- `-` + space - Bullet list
- `1.` + space - Numbered list
- `[ ]` + space - Checklist
- `**text**` - Bold
- `*text*` - Italic
- ``` - Code block
- `$formula$` - Inline math
- `$$formula$$` - Block math

### Navigation Shortcuts
- `Ctrl+N` - New note
- `Ctrl+F` - Focus search
- `Ctrl+K` - Open command palette

---

## 🐛 Common Issues & Solutions

### Issue 1: Editor Not Rendering
**Problem**: TipTap editor shows blank or doesn't load

**Solution**:
```typescript
// Add immediatelyRender: false to prevent SSR hydration mismatch
const editor = useEditor({
  extensions: [...],
  content: initialContent,
  immediatelyRender: false, // Important!
});
```

### Issue 2: Math Formulas Not Rendering
**Problem**: LaTeX formulas show as plain text

**Solution**:
```typescript
// Ensure KaTeX is loaded before rendering
useEffect(() => {
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
  
  loadKaTeX();
}, []);
```

### Issue 3: Auto-Save Not Working
**Problem**: Changes not saving automatically

**Solution**:
```typescript
// Check that isDirty flag is set correctly
const handleContentChange = (html: string) => {
  setNote({ ...note, content: html });
  setIsDirty(true); // Important!
};
```

### Issue 4: Search Not Finding Notes
**Problem**: Full-text search returns no results

**Solution**:
```sql
-- Ensure FULLTEXT index exists
CREATE FULLTEXT INDEX idx_search ON user_notes(title, content);

-- Rebuild index if needed
OPTIMIZE TABLE user_notes;
```

### Issue 5: Drag & Drop Not Working
**Problem**: Notes can't be dragged to folders

**Solution**:
```typescript
// Ensure draggable attribute is set
<div
  draggable
  onDragStart={(e) => handleDragStart(e, note)}
>
  {/* Note content */}
</div>

// Ensure drop target prevents default
<div
  onDragOver={(e) => e.preventDefault()}
  onDrop={(e) => handleDrop(e, folderId)}
>
  {/* Folder content */}
</div>
```

---

## 🧪 Testing Checklist

### Unit Tests
- [ ] Note CRUD operations
- [ ] Auto-save functionality
- [ ] Search and filter logic
- [ ] Drag & drop handlers
- [ ] Cover design selection

### Integration Tests
- [ ] Create note flow
- [ ] Edit note flow
- [ ] Delete note flow
- [ ] Folder organization
- [ ] AI Tutor integration

### E2E Tests
- [ ] Complete note creation workflow
- [ ] Search and find notes
- [ ] Organize notes into folders
- [ ] Save AI response as note
- [ ] Export notes

---

## 🚀 Performance Tips

### 1. Lazy Load Components
```typescript
const RichTextEditor = dynamic(() => import('@/components/sanchika/RichTextEditor'), {
  ssr: false,
  loading: () => <div>Loading editor...</div>,
});
```

### 2. Memoize Expensive Computations
```typescript
const filteredNotes = useMemo(() => {
  return filterAndSortNotes(notes, filterBy, sortBy);
}, [notes, filterBy, sortBy]);
```

### 3. Debounce Search
```typescript
const debouncedSearch = useMemo(
  () => debounce((query: string) => {
    setSearchQuery(query);
  }, 300),
  []
);
```

### 4. Virtual Scrolling for Large Lists
```typescript
import { FixedSizeList } from 'react-window';

<FixedSizeList
  height={600}
  itemCount={notes.length}
  itemSize={120}
  width="100%"
>
  {({ index, style }) => (
    <div style={style}>
      <NoteCard note={notes[index]} />
    </div>
  )}
</FixedSizeList>
```

---

## 📚 Related Documentation

- [Sanchika Notes System - Full Documentation](./sanchika-notes-system.md)
- [User Dashboard Feature Analysis](../user-dashboard-feature-analysis.md)
- [TipTap Documentation](https://tiptap.dev/)
- [KaTeX Documentation](https://katex.org/)

---

**Prepared By**: Augment AI Agent  
**For**: DigiClassroom Pro Development Team  
**Date**: November 20, 2025

---

*End of Quick Reference Guide*

