# Admin Content Upload Page - Architecture Documentation

**Date:** 2025-11-03  
**Purpose:** Document current architecture for Phase 3 integration

---

## 📁 **File Structure**

### **Main Page Component**
- **Path:** `src/app/dashboard/admin/content/page.tsx`
- **Type:** Next.js 15 Client Component (`'use client'`)
- **Lines:** 705 lines

### **Supporting Components**
1. **UploadProgressModal** - `src/components/admin/UploadProgressModal.tsx`
2. **ContentOverview** - `src/components/admin/ContentOverview.tsx`
3. **DocumentManagement** - `src/components/admin/DocumentManagement.tsx`

### **API Routes**
1. **Upload:** `/api/admin/content/upload` - `src/app/api/admin/content/upload/route.ts`
2. **Progress SSE:** `/api/admin/content/progress/[uploadId]` - Server-Sent Events
3. **Cancel:** `/api/admin/content/cancel` - Cancel upload
4. **Books API:** `/api/admin/qdrant/books` - List uploaded books
5. **Stats API:** `/api/admin/qdrant/stats` - Collection statistics

---

## 🎨 **UI/UX Patterns**

### **Design System**
- **Framework:** Tailwind CSS with custom gradients
- **Theme:** Light/Dark mode support (`dark:` classes)
- **Colors:** Orange-to-red gradients for primary actions, blue-purple for secondary
- **Effects:** 
  - Backdrop blur (`backdrop-blur-xl`)
  - Glassmorphism (`bg-white/90`, `border-white/20`)
  - Hover animations (`hover:scale-[1.02]`, `transition-all duration-300`)
  - Shadow layers (`shadow-xl`, `hover:shadow-2xl`)

### **Component Patterns**
- **Cards:** Rounded-2xl with gradient borders and shadows
- **Icons:** Lucide React icons in gradient backgrounds
- **Buttons:** Full-width gradient buttons with loading states
- **Progress:** Gradient progress bars with percentage display
- **Stats:** Grid layout with color-coded metric cards

---

## 🔄 **Data Flow**

### **Upload Flow**

```
User fills form → handleSubmit() → FormData creation
    ↓
Generate uploadId → Establish SSE connection
    ↓
POST /api/admin/content/upload → Backend processing
    ↓
SSE progress updates → UploadProgressModal
    ↓
Response → setResult() → Display results
    ↓
SWR mutate → Refresh ContentOverview & DocumentManagement
```

### **State Management**

**Local State (useState):**
```typescript
const [isUploading, setIsUploading] = useState(false)
const [uploadProgress, setUploadProgress] = useState(0)
const [result, setResult] = useState<UploadResult | null>(null)
const [currentStep, setCurrentStep] = useState('')
const [showProgressModal, setShowProgressModal] = useState(false)
const [activeUploadId, setActiveUploadId] = useState<string | null>(null)
const [activeTab, setActiveTab] = useState<'upload' | 'overview' | 'manage'>('upload')
const [formData, setFormData] = useState({
  file: null as File | null,
  classLevel: '',
  subject: '',
  bookTitle: '',
  board: '',
  medium: ''
})
```

**Remote State (SWR):**
```typescript
// In ContentOverview component
const { data: booksData, mutate: mutateBooks } = useSWR(
  '/api/admin/qdrant/books',
  fetcher,
  { refreshInterval: 10000 }
)

const { data: statsData, mutate: mutateStats } = useSWR(
  '/api/admin/qdrant/stats',
  fetcher,
  { refreshInterval: 10000 }
)
```

---

## 📊 **Current Upload Result Interface**

```typescript
interface UploadResult {
  success: boolean
  message: string
  stats?: {
    totalPages: number
    totalChunks: number
    totalWords: number
    uploadedChunks: number
    processingTime: number
  }
  extractionMethod?: string
  errors?: string[]
  additionalStats?: {
    tablesFound?: number
    equationsFound?: number
    figuresFound?: number
  }
}
```

**Missing from current interface:**
- ❌ Validation statistics (validCount, invalidCount, validationRate)
- ❌ Chunk-level error details
- ❌ Extraction strategy used
- ❌ Text quality score
- ❌ Fallback information

---

## 🔌 **Backend Processing**

### **Upload Route** (`/api/admin/content/upload`)

**Flow:**
1. Parse FormData (file, classLevel, subject, bookTitle, board, medium, uploadId)
2. Save file to temp location
3. Normalize class level
4. Initialize EnhancedRAGPipeline
5. Call `enhancedRAG.indexPDF(buffer, metadata, filename, { uploadId })`
6. Return result with stats

**Current Response:**
```typescript
{
  success: true,
  message: 'PDF processed successfully with doc-extract-engine',
  stats: {
    totalPages: number,
    totalChunks: number,
    totalWords: number,
    uploadedChunks: number,
    processingTime: number
  },
  extractionMethod: string,
  errors: string[],
  additionalStats: {
    tablesFound: number,
    equationsFound: number,
    figuresFound: number
  }
}
```

---

## 🎯 **Integration Points for Phase 3**

### **1. Where to Add Validation Statistics**

**Location:** `src/app/dashboard/admin/content/page.tsx`

**Current Results Panel:** Lines 552-700
- Success/failure status (lines 568-599)
- Extraction method (lines 601-609)
- Statistics grid (lines 611-639)
- Additional stats (lines 641-670)

**Add After Line 639:**
```typescript
{/* Validation Statistics */}
{result.validationStats && (
  <div className="p-4 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-xl border border-green-200/50 dark:border-green-800/50">
    <h4 className="font-semibold text-green-800 dark:text-green-200 mb-3">
      Data Quality
    </h4>
    <div className="space-y-2">
      <div className="flex justify-between text-sm">
        <span className="text-green-700 dark:text-green-300">Validation Rate:</span>
        <span className="font-bold text-green-600 dark:text-green-400">
          {(result.validationStats.validationRate * 100).toFixed(1)}%
        </span>
      </div>
      {/* More validation details */}
    </div>
  </div>
)}
```

### **2. Where to Call tRPC Mutations**

**Location:** `src/app/dashboard/admin/content/page.tsx`

**Current Upload Handler:** Lines 108-267 (`handleSubmit`)

**Add After Line 246 (after result is received):**
```typescript
// Record metrics via tRPC
if (result.success && result.validationStats) {
  try {
    await trpc.content.recordMetrics.mutate({
      tenantId: 'default-tenant', // Get from auth context
      pdfId: formData.bookTitle,
      strategy: result.strategy || 'auto',
      pagesProcessed: result.stats.totalPages,
      extractionTimeMs: result.stats.processingTime,
      textQualityScore: result.validationStats.textQualityScore,
      fallbackTriggered: result.validationStats.fallbackTriggered,
      chunksCreated: result.stats.totalChunks,
      chunksValidated: result.validationStats.validCount,
      chunksFailed: result.validationStats.invalidCount,
      totalTimeMs: result.stats.processingTime,
    });
  } catch (error) {
    console.error('Failed to record metrics:', error);
  }
}
```

### **3. Where to Add Metrics Dashboard**

**Location:** New tab in `src/app/dashboard/admin/content/page.tsx`

**Add to activeTab state:** Line 98
```typescript
const [activeTab, setActiveTab] = useState<'upload' | 'overview' | 'manage' | 'metrics'>('upload')
```

**Add new tab button:** After line 349
```typescript
<button
  onClick={() => setActiveTab('metrics')}
  className={`px-6 py-3 rounded-xl font-semibold transition-all ${
    activeTab === 'metrics'
      ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg'
      : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
  }`}
>
  <Activity className="inline-block mr-2 h-5 w-5" />
  Metrics
</button>
```

**Add metrics panel:** After line 700
```typescript
{activeTab === 'metrics' && (
  <MetricsDashboard />
)}
```

---

## 🎨 **Styling Conventions**

### **Card Pattern**
```typescript
className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl rounded-2xl p-8 shadow-xl border border-white/20 dark:border-gray-700/20 hover:shadow-2xl transition-all duration-300 transform hover:scale-[1.02]"
```

### **Gradient Header Pattern**
```typescript
<div className="w-12 h-12 bg-gradient-to-r from-orange-500 to-red-500 rounded-2xl flex items-center justify-center shadow-lg">
  <Icon className="h-6 w-6 text-white" />
</div>
<h2 className="text-2xl font-bold bg-gradient-to-r from-orange-600 to-blue-600 bg-clip-text text-transparent">
  Title
</h2>
```

### **Stat Card Pattern**
```typescript
<div className="p-4 bg-gradient-to-br from-orange-50 to-red-50 dark:from-orange-900/20 dark:to-red-900/20 rounded-xl border border-orange-200/50 dark:border-orange-800/50">
  <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
    {value}
  </div>
  <div className="text-sm text-orange-700 dark:text-orange-300">Label</div>
</div>
```

### **Color Scheme by Metric Type**
- **Pages:** Orange-to-red gradient
- **Chunks:** Blue-to-purple gradient
- **Words:** Green-to-emerald gradient
- **Time:** Purple-to-pink gradient
- **Tables:** Cyan-to-teal gradient
- **Equations:** Indigo-to-blue gradient
- **Figures:** Pink-to-rose gradient
- **Validation:** Green-to-emerald gradient (quality indicator)

---

## 🔧 **Validation Integration Strategy**

### **Phase 3 Enhancements**

**1. Update UploadResult Interface**
```typescript
interface UploadResult {
  success: boolean
  message: string
  stats: { /* existing */ }
  extractionMethod?: string
  errors?: string[]
  additionalStats?: { /* existing */ }
  
  // NEW: Validation statistics
  validationStats?: {
    validCount: number
    invalidCount: number
    validationRate: number
    textQualityScore?: number
    fallbackTriggered: boolean
    invalidChunks?: Array<{
      chunkId: string
      error: string
    }>
  }
  
  // NEW: Strategy used
  strategy?: 'auto' | 'text_only' | 'ocr_only' | 'hybrid'
}
```

**2. Update Backend Response**
- Modify `/api/admin/content/upload/route.ts` to include validation stats
- Get validation stats from `enhancedRAG.indexPDF()` result
- Pass through to frontend

**3. Add Validation Display**
- Show validation rate with color coding (green > 95%, yellow 90-95%, red < 90%)
- Display invalid chunk count and errors
- Show extraction strategy used
- Display text quality score if available

**4. Add Metrics Recording**
- Call `trpc.content.recordMetrics.mutate()` after successful upload
- Store metrics in MySQL `pipeline_metrics` table
- Enable historical analysis

**5. Add Metrics Dashboard**
- New tab showing recent uploads
- Validation rate trends
- Processing time trends
- Strategy usage breakdown
- Error analysis

---

## 📋 **Next Steps for Phase 3**

1. ✅ Update `UploadResult` interface
2. ✅ Modify backend to return validation stats
3. ✅ Add validation display to results panel
4. ✅ Integrate tRPC metrics recording
5. ✅ Create MetricsDashboard component
6. ✅ Add metrics tab to page
7. ✅ Test end-to-end flow

---

**Document Version:** 1.0  
**Last Updated:** 2025-11-03  
**Status:** Ready for Phase 3 Implementation

