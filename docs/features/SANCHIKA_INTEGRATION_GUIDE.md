# Sanchika Feature Integration Guide

**Quick Start Guide for Sanchika Features**  
**Original Date**: November 2025  
**Last Verified**: January 15, 2026  
**Status**: Components implemented, integration steps verified

> **Note:** The features described in this guide have been implemented. Refer to `src/components/sanchika/` for all available components.

---

## 🚀 Step 1: Run Database Migration

```bash
# Navigate to project root
cd "C:\DigiClassroom Pro"

# Run the migration
mysql -u root -p digiclassroom_pro < src/lib/db/migrations/007_sanchika_advanced_features.sql

# Or use the batch file (Windows)
cd src/lib/db/migrations
run_migrations.bat
```

This creates tables for:
- Smart detections
- Voice recordings
- PDF attachments & annotations
- Drawings
- Flashcards

---

## 🎨 Step 2: Integrate AI Writing Toolbar

### Option A: Add to RichTextEditor Component

Edit `src/components/sanchika/RichTextEditor.tsx`:

```typescript
import { AIWritingToolbar } from './AIWritingToolbar';
import { useState } from 'react';

// Inside your component:
const [selectedText, setSelectedText] = useState('');

// Add selection handler to editor
const handleSelectionUpdate = ({ editor }) => {
  const { from, to } = editor.state.selection;
  const text = editor.state.doc.textBetween(from, to, ' ');
  setSelectedText(text);
};

// Add to editor configuration
const editor = useEditor({
  // ... existing config
  onSelectionUpdate: handleSelectionUpdate,
});

// Add toolbar above or below editor
<AIWritingToolbar 
  selectedText={selectedText}
  onApply={(newText) => {
    editor?.commands.insertContent(newText);
  }}
/>
```

### Option B: Add to EditorToolbar Component

Edit `src/components/sanchika/EditorToolbar.tsx`:

```typescript
import { AIWritingToolbar } from './AIWritingToolbar';

// Add to toolbar
<div className="flex items-center gap-2">
  {/* Existing toolbar buttons */}
  
  <div className="border-l border-gray-300 h-6 mx-2" />
  
  <AIWritingToolbar 
    selectedText={editor?.state.doc.textBetween(
      editor.state.selection.from,
      editor.state.selection.to,
      ' '
    ) || ''}
    onApply={(newText) => {
      editor?.commands.insertContent(newText);
    }}
  />
</div>
```

---

## 📁 Step 3: Integrate Folder Management Modal

Edit `src/app/dashboard/user/sanchika/page.tsx`:

```typescript
import { FolderManagementModal } from '@/components/sanchika/FolderManagementModal';
import { useState } from 'react';

// Add state
const [showFolderModal, setShowFolderModal] = useState(false);

// Add handlers
const handleCreateFolder = async (name: string, color: string, icon: string) => {
  const response = await fetch('/api/folders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, color, icon }),
  });
  
  if (response.ok) {
    // Refresh folders list
    fetchFolders();
  }
};

const handleUpdateFolder = async (id: string, name: string, color: string, icon: string) => {
  const response = await fetch(`/api/folders/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, color, icon }),
  });
  
  if (response.ok) {
    fetchFolders();
  }
};

const handleDeleteFolder = async (id: string) => {
  const response = await fetch(`/api/folders/${id}`, {
    method: 'DELETE',
  });
  
  if (response.ok) {
    fetchFolders();
  }
};

// Add button to open modal
<button
  onClick={() => setShowFolderModal(true)}
  className="px-4 py-2 bg-blue-500 text-white rounded-lg"
>
  Manage Folders
</button>

// Add modal component
<FolderManagementModal
  isOpen={showFolderModal}
  onClose={() => setShowFolderModal(false)}
  folders={folders}
  onCreateFolder={handleCreateFolder}
  onUpdateFolder={handleUpdateFolder}
  onDeleteFolder={handleDeleteFolder}
/>
```

---

## 🔍 Step 4: Add Smart Detection (Optional)

Create API endpoint `src/app/api/smart-detect/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { smartDetectionService } from '@/lib/services/smart-detection-service';
import { executeQuery } from '@/lib/db/connection';

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { noteId, content } = await req.json();
  
  // Run detection
  const detections = await smartDetectionService.detectAndEnrich(content);
  
  // Save to database
  const allDetections = [
    ...detections.dates,
    ...detections.formulas,
    ...detections.chemicalEquations,
    ...detections.definitions,
  ];
  
  for (const detection of allDetections) {
    await executeQuery(
      `INSERT INTO note_smart_detections (id, note_id, detection_type, detected_text, parsed_data, position, context_text, suggestions)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        crypto.randomUUID(),
        noteId,
        detection.type,
        detection.text,
        JSON.stringify(detection.parsedData || {}),
        detection.position,
        detection.context,
        JSON.stringify(detection.suggestions || []),
      ]
    );
  }
  
  return NextResponse.json({ success: true, detections: allDetections });
}
```

---

## ✅ Step 5: Test Everything

### Test AI Writing Assistant
1. Open a note in Sanchika
2. Select some text
3. Click "Proofread", "Rewrite", or "Summarize"
4. Verify the AI result appears
5. Click "Apply Changes" to insert

### Test Quick Notes Widget
1. Press `Ctrl+Shift+N` anywhere in the app
2. Type a quick note
3. Save and verify it appears in Sanchika

### Test Folder Management
1. Click "Manage Folders" button
2. Create a new folder with color/icon
3. Edit and delete folders
4. Drag notes to folders

### Test Checklist Progress
1. Create a note with checkboxes
2. Verify progress bar appears
3. Check/uncheck items and see progress update

---

## 🐛 Troubleshooting

### AI Features Not Working
- Check OpenAI API key: `process.env.OPENAI_API_KEY`
- Check API endpoint: `http://localhost:3000/api/ai-writing`
- Check browser console for errors

### Database Errors
- Verify migration ran successfully
- Check MySQL connection
- Verify table names match code

### Quick Notes Widget Not Appearing
- Check `src/app/dashboard/user/layout.tsx` includes `<QuickNoteWidgetWrapper />`
- Verify no z-index conflicts
- Check browser console for errors

---

## 📊 Monitoring

### Check AI Usage
```sql
-- Count AI writing requests (add logging to track)
SELECT COUNT(*) FROM note_activity_log 
WHERE activity_type = 'ai_writing' 
AND created_at > DATE_SUB(NOW(), INTERVAL 1 DAY);
```

### Check Smart Detections
```sql
SELECT detection_type, COUNT(*) as count
FROM note_smart_detections
GROUP BY detection_type;
```

### Check Feature Adoption
```sql
SELECT 
  COUNT(DISTINCT CASE WHEN has_voice_notes THEN id END) as notes_with_voice,
  COUNT(DISTINCT CASE WHEN has_pdf_attachments THEN id END) as notes_with_pdf,
  COUNT(DISTINCT CASE WHEN has_drawings THEN id END) as notes_with_drawings,
  COUNT(DISTINCT CASE WHEN has_smart_detections THEN id END) as notes_with_detections
FROM user_notes;
```

---

**Integration Complete!** 🎉

Your Sanchika now has:
- ✅ AI Writing Assistant
- ✅ Smart Data Detection (backend ready)
- ✅ Quick Notes Widget
- ✅ Folder Management
- ✅ Checklist Progress Tracking
- ✅ Database schema for advanced features

Next: Implement Voice Notes, PDF Annotation, and Drawing Canvas!

