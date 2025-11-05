# Geography Textbook Data Integrity Investigation Report

**Date:** 2025-11-03  
**Issue:** 16-page geography book showing only 1 page in Content Overview UI  
**Status:** ✅ ROOT CAUSE IDENTIFIED

---

## Executive Summary

The investigation has confirmed a **critical data loss issue** in the vector database indexing pipeline. All 96 chunks from the geography textbook have been assigned `pageNumber: 1`, despite the source PDF containing 16 pages. This is **NOT a UI display bug** - the page number metadata is genuinely lost during the multi-level chunking process.

---

## Investigation Findings

### 1. Metadata Preservation Analysis

**✅ CONFIRMED: Page numbers ARE correctly extracted from PDF**
- Python extraction scripts (`doc_extract_engine_processor.py` line 187, `pdf_extract_kit_processor.py` line 113) correctly assign `page: page_num + 1`
- Each chunk from the PDF processor contains accurate page numbers

**❌ CRITICAL ISSUE: Page numbers are LOST during multi-level chunking**
- When `ENABLE_MULTI_LEVEL_CHUNKING=true` (currently enabled in `.env.local`)
- All chunk texts are concatenated into a single `fullText` string
- The `multiLevelChunker.chunkText()` receives only basic metadata (class, subject, book_title, source, curriculum, language)
- **NO page number information is passed to the multi-level chunker**
- Result: All chunks default to `pageNumber: 1`

### 2. Paragraph Search Results

**Paragraph 1 (Himachal/Lesser Himalaya):**
- ✅ Keywords FOUND in database: "Himachal", "Pir Panjal", "Mahabharat", "Kashmir", "Kangra", "Kullu"
- ❌ Complete paragraph NOT found as a single chunk
- 📍 Text is fragmented across multiple atomic-level chunks
- ⚠️ All chunks report `pageNumber: 1` (incorrect)

**Paragraph 2 (Deccan Trap/Aravali Hills):**
- ✅ Keywords FOUND in database: "black soil", "Aravali Hills", "Peninsular plateau"
- ❌ Keywords "Deccan Trap" and "volcanic origin" NOT found (possible OCR error or text variation)
- 📍 Text is fragmented across multiple atomic-level chunks
- ⚠️ All chunks report `pageNumber: 1` (incorrect)

### 3. Data Integrity Verification

**Database Statistics:**
- Total Chunks: 96
- Unique Pages: **1** (should be 16)
- Page Distribution: All 96 chunks assigned to page 1
- Metadata Issues: 96 chunks with "Unknown" chapter

**Sample Chunk Analysis:**
```
Book Title: chapter-1-Geography Class-9th NCERT Textbook
Class: Class 9
Subject: Geography
Page: 1 (INCORRECT - should vary from 1-16)
Chapter: Unknown (metadata not extracted)
Section: General Section
```

### 4. Root Cause Analysis

**Location:** `src/lib/ai/rag/enhanced-rag-pipeline.ts` lines 819-844

**Problem Flow:**
1. PDF is processed by `doc-extract-engine` → chunks have correct page numbers
2. Multi-level chunking is enabled (`ENABLE_MULTI_LEVEL_CHUNKING=true`)
3. All chunk texts are concatenated: `const fullText = processingResult.chunks.map(c => c.text).join('\n\n')`
4. Multi-level chunker is called with minimal metadata:
   ```typescript
   const multiLevelResult = await multiLevelChunker.chunkText(fullText, {
     class: metadata.classLevel,
     subject: metadata.subject,
     book_title: metadata.bookTitle,
     source: filename,
     curriculum: metadata.curriculum || 'CBSE',
     language: metadata.language || 'English'
     // ❌ NO PAGE NUMBERS!
   }, {...});
   ```
5. Multi-level chunker creates new chunks without page number context
6. All chunks default to `pageNumber: 1` during Qdrant indexing

**Alternative Path (When Multi-Level Chunking is Disabled):**
- Uses `transformToHierarchicalChunks()` which DOES preserve page numbers
- Correctly reads page numbers from original chunks: `const pageNumber = readMetaNumber(metadata, ['pageNumber', 'page'], 1)`

---

## Spelling and Text Accuracy

**OCR Quality:** Generally good, but some issues detected:
- Text is heavily fragmented into very small chunks (atomic level)
- Some chunks contain incomplete sentences
- Possible OCR errors: "Deccan Trap" may be stored as "Decean Trap" (typo found in chunk 1762143426231)

**Example Fragmentation:**
- Chunk 1: "1 INDIA SIZE AND LOCATION India is one of the ancient civilisations in the The tropic of Cancer (239 30'N) divides the world."
- Chunk 2: "It has achieved multi-faceted socio- country into almost two equal parts."
- Chunk 3: "To the economic progress during the last five southeast and southwest of the mainland, lie decades."

---

## UI Display vs. Data Loss

**Verdict:** This is a **DATA LOSS ISSUE**, not a UI bug.

**Evidence:**
1. Content Overview UI correctly displays what's in the database
2. API endpoint `/api/admin/qdrant/books` correctly calculates `totalPages` as `Math.max(book.totalPages, page)` (line 102)
3. Since all chunks have `page: 1`, the max is 1
4. UI shows "1 page" because that's the accurate representation of the corrupted data

---

## Impact Assessment

**Severity:** 🔴 CRITICAL

**Affected Areas:**
1. ✅ **Search Functionality:** Still works (text content is preserved)
2. ❌ **Page-based Filtering:** Broken (all content appears to be on page 1)
3. ❌ **Content Navigation:** Broken (cannot navigate by page)
4. ❌ **Analytics:** Broken (page-level metrics are meaningless)
5. ❌ **Citation/References:** Broken (cannot cite specific pages)

**Affected Books:**
- All books indexed with `ENABLE_MULTI_LEVEL_CHUNKING=true`
- Geography Class 9 (confirmed)
- Potentially all other books in the database

---

## Recommendations

### Immediate Actions (Priority 1)

1. **Disable Multi-Level Chunking** (Quick Fix)
   - Set `ENABLE_MULTI_LEVEL_CHUNKING=false` in `.env.local`
   - Re-index all affected books
   - This will preserve page numbers using `transformToHierarchicalChunks()`

2. **Verify Data Integrity**
   - Run investigation script on all books in the database
   - Identify which books have corrupted page numbers
   - Create a list of books that need re-indexing

### Long-Term Solutions (Priority 2)

3. **Fix Multi-Level Chunker to Preserve Page Numbers**
   - Modify `multiLevelChunker.chunkText()` to accept page-aware chunks instead of plain text
   - Track page boundaries during text concatenation
   - Assign page numbers to chunks based on their position in the original document
   - Implementation approach:
     ```typescript
     // Instead of concatenating text, pass chunks with metadata
     const multiLevelResult = await multiLevelChunker.chunkTextWithMetadata(
       processingResult.chunks, // Pass original chunks with page numbers
       metadata,
       options
     );
     ```

4. **Add Page Number Validation**
   - Add validation in `indexChunksInQdrant()` to warn if all chunks have the same page number
   - Add unit tests to verify page number preservation
   - Add integration tests for the full indexing pipeline

5. **Implement Chapter Extraction**
   - Fix "Unknown" chapter issue
   - Enhance chapter detection in Python scripts
   - Verify chapter metadata is preserved through the pipeline

### Testing & Verification (Priority 3)

6. **Create Test Suite**
   - Test multi-level chunking with page number preservation
   - Test hierarchical chunking with page number preservation
   - Test end-to-end indexing pipeline
   - Verify metadata integrity at each stage

7. **Re-index All Books**
   - After fixing the issue, re-index all books in the database
   - Verify page numbers are correct
   - Verify all metadata fields are preserved

---

## Technical Details

### Code Locations

**Issue Location:**
- File: `src/lib/ai/rag/enhanced-rag-pipeline.ts`
- Lines: 819-844
- Function: `indexPDF()`

**Working Alternative:**
- File: `src/lib/ai/rag/hierarchical-chunker.ts`
- Lines: 17-86
- Function: `transformToHierarchicalChunks()`

**Page Number Assignment (Python):**
- File: `scripts/doc_extract_engine_processor.py`, Line 187
- File: `scripts/pdf_extract_kit_processor.py`, Line 113

**Qdrant Indexing:**
- File: `src/lib/ai/rag/enhanced-rag-pipeline.ts`
- Lines: 972-1032
- Function: `indexChunksInQdrant()`

### Environment Configuration

**Current Setting:**
```bash
ENABLE_MULTI_LEVEL_CHUNKING=true  # ❌ Causes page number loss
```

**Recommended Setting (Temporary):**
```bash
ENABLE_MULTI_LEVEL_CHUNKING=false  # ✅ Preserves page numbers
```

---

## Conclusion

The investigation has successfully identified the root cause of the data integrity issue. The problem is architectural - the multi-level chunking feature, while providing better granularity for search, does not preserve page number metadata from the original PDF extraction.

**Next Steps:**
1. Disable multi-level chunking immediately
2. Re-index affected books
3. Implement page-aware multi-level chunking
4. Add comprehensive testing
5. Re-enable multi-level chunking with fixes

---

**Report Generated By:** Augment Agent  
**Investigation Scripts:**
- `scripts/investigate-geography-data-integrity.ts`
- `scripts/detailed-chunk-analysis.ts`

