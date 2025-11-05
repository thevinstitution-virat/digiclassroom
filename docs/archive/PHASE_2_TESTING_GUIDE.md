# Phase 2 Testing Guide

**Date:** 2025-11-03  
**Purpose:** Step-by-step guide to test Phase 2 implementation

---

## 🎯 **Overview**

This guide walks you through testing all 4 tasks of Phase 2:

1. ✅ Content tRPC Router
2. ✅ Pipeline Metrics Table (MySQL)
3. ✅ Validation in Enhanced RAG Pipeline
4. ✅ Configuration Validation

---

## 📋 **Prerequisites**

Before testing, ensure you have:

- ✅ Node.js and npm installed
- ✅ MySQL server running
- ✅ Python environment with PDF-Extract-Kit dependencies
- ✅ `.env.local` configured correctly
- ✅ All Phase 2 files in place

---

## 🧪 **Test 1: Run Automated Test Suite**

### **Step 1: Run the test script**

```bash
# From project root
npx tsx scripts/test-phase2-implementation.ts
```

### **Expected Output:**

```
🚀 Phase 2 Implementation Test Suite
============================================================
Testing all 4 tasks of Phase 2 implementation

🧪 Test 1: Chunk Validation
============================================================

📊 Validation Results:
  - Total chunks: 5
  - Valid: 3 (60.0%)
  - Invalid: 2

✅ Valid Chunks:
  - chunk_1:
    Class: Class 9
    Subject: Mathematics
    Book: NCERT Mathematics
    Page: 45
  - chunk_2:
    Class: Class 9
    Subject: Mathematics
    Book: NCERT Mathematics
    Page: 46
  - chunk_5:
    Class: Class 10
    Subject: Science
    Book: NCERT Science
    Page: 120

❌ Invalid Chunks:
  - chunk_3: Missing required field: class
  - chunk_4: Invalid page number: must be positive

✅ Test 1 PASSED

🧪 Test 2: Class Level Normalization
============================================================
  ✅ "Class IX" → "Class 9"
  ✅ "Class 9" → "Class 9"
  ✅ "IX" → "Class 9"
  ✅ "9" → "Class 9"
  ✅ "Class X" → "Class 10"
  ✅ "Class XII" → "Class 12"

✅ Test 2 PASSED (6/6)

🧪 Test 3: Configuration Validation
============================================================

📄 Current Configuration:
  - Strategy: auto
  - Valid: true

✅ Test 3 PASSED

🧪 Test 4: Metadata Field Mapping
============================================================

📋 Field Mapping Results:
  - classLevel → class: Class 9
  - bookTitle → book_title: Test Book
  - curriculum → board: CBSE
  - language → medium: English
  ✅ class: "Class 9"
  ✅ book_title: "Test Book"
  ✅ board: "CBSE"
  ✅ medium: "English"

✅ Test 4 PASSED (4/4)

============================================================
📊 Test Summary
============================================================
  - Total tests: 4
  - Passed: 4
  - Failed: 0
  - Success rate: 100.0%

🎉 ALL TESTS PASSED! Phase 2 implementation is working correctly.
```

### **If Tests Fail:**

1. Check that all Phase 2 files are in place
2. Verify `chunk-metadata-schema.ts` is correctly imported
3. Check `.env.local` for `TEXT_EXTRACTION_STRATEGY`
4. Review error messages for specific issues

---

## 🗄️ **Test 2: MySQL Pipeline Metrics Table**

### **Step 1: Run the migration**

```bash
# Option 1: Run migration script
mysql -u root -p virat_gyankosh < scripts/migrations/001_add_pipeline_metrics_table.sql

# Option 2: Run full schema
mysql -u root -p virat_gyankosh < src/lib/db/schema.sql
```

### **Step 2: Verify table exists**

```bash
mysql -u root -p virat_gyankosh -e "DESCRIBE pipeline_metrics;"
```

### **Expected Output:**

```
+----------------------+--------------------------------------------------------------+------+-----+-------------------+-------+
| Field                | Type                                                         | Null | Key | Default           | Extra |
+----------------------+--------------------------------------------------------------+------+-----+-------------------+-------+
| id                   | varchar(36)                                                  | NO   | PRI | (uuid())          |       |
| tenant_id            | varchar(36)                                                  | NO   | MUL | NULL              |       |
| pdf_id               | varchar(255)                                                 | NO   |     | NULL              |       |
| strategy             | enum('auto','text_only','ocr_only','hybrid')                 | NO   | MUL | NULL              |       |
| pages_processed      | int                                                          | NO   |     | NULL              |       |
| extraction_time_ms   | int                                                          | NO   |     | NULL              |       |
| text_quality_score   | decimal(3,2)                                                 | YES  |     | NULL              |       |
| fallback_triggered   | tinyint(1)                                                   | YES  |     | 0                 |       |
| chunks_created       | int                                                          | NO   |     | NULL              |       |
| chunks_validated     | int                                                          | NO   |     | NULL              |       |
| chunks_failed        | int                                                          | NO   |     | NULL              |       |
| validation_rate      | decimal(5,4)                                                 | YES  |     | NULL              |       |
| total_time_ms        | int                                                          | NO   |     | NULL              |       |
| embedding_time_ms    | int                                                          | YES  |     | NULL              |       |
| indexing_time_ms     | int                                                          | YES  |     | NULL              |       |
| created_at           | timestamp                                                    | YES  | MUL | CURRENT_TIMESTAMP |       |
+----------------------+--------------------------------------------------------------+------+-----+-------------------+-------+
```

### **Step 3: Test inserting a metric**

```bash
mysql -u root -p virat_gyankosh
```

```sql
-- Insert test metric
INSERT INTO pipeline_metrics (
    tenant_id,
    pdf_id,
    strategy,
    pages_processed,
    extraction_time_ms,
    text_quality_score,
    fallback_triggered,
    chunks_created,
    chunks_validated,
    chunks_failed,
    validation_rate,
    total_time_ms
) VALUES (
    UUID(),
    'test-pdf-001',
    'auto',
    100,
    5000,
    0.95,
    FALSE,
    150,
    148,
    2,
    0.9867,
    10000
);

-- Verify insertion
SELECT * FROM pipeline_metrics ORDER BY created_at DESC LIMIT 1;
```

---

## 🌐 **Test 3: Content tRPC Router**

### **Step 1: Start the dev server**

```bash
npm run dev
```

### **Step 2: Test getValidationConfig endpoint**

Create a test file `test-trpc-content.ts`:

```typescript
import { createTRPCClient, httpBatchLink } from '@trpc/client';
import type { AppRouter } from './src/lib/trpc/routers';

const trpc = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: 'http://localhost:3000/api/trpc',
    }),
  ],
});

async function testContentRouter() {
  try {
    // Test getValidationConfig
    console.log('Testing getValidationConfig...');
    const config = await trpc.content.getValidationConfig.query();
    console.log('✅ Config:', config);
    
    // Test uploadChunks (with sample data)
    console.log('\nTesting uploadChunks...');
    const result = await trpc.content.uploadChunks.mutate({
      chunks: [
        {
          id: 'test_1',
          text: 'Test chunk',
          metadata: {
            class: 'Class 9',
            subject: 'Mathematics',
            book_title: 'Test Book',
            page: 1,
          }
        }
      ],
      pdfPath: '/test/path.pdf',
    });
    console.log('✅ Upload result:', result);
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testContentRouter();
```

Run it:
```bash
npx tsx test-trpc-content.ts
```

---

## 📄 **Test 4: PDF Upload with Validation**

### **Step 1: Upload a test PDF**

1. Start the dev server: `npm run dev`
2. Navigate to: `http://localhost:3000/dashboard/admin/content`
3. Upload a test NCERT PDF

### **Step 2: Check console logs**

You should see validation output:

```
📄 PDF Processor Configuration:
   Strategy: auto
   Mode: Smart Text Extraction (text-first)
   Script: smart_doc_processor.py

📊 Chunk Validation Before Indexing:
  - Total chunks: 150
  - Valid: 148 (98.7%)
  - Invalid: 2
❌ 2 chunks failed validation - skipping:
  - Chunk chunk_45: Missing required field: book_title
  - Chunk chunk_89: Invalid page number: must be positive

📥 Indexed batch 1: 100/148 chunks
📥 Indexed batch 2: 148/148 chunks
✅ Indexing complete: 148 chunks indexed (2 skipped due to validation failures)
```

### **Step 3: Verify in Qdrant**

```bash
# Check Qdrant for indexed chunks
curl http://localhost:6333/collections/ncert-books-enhanced/points/scroll | jq '.result.points[0].payload'
```

Expected payload structure:
```json
{
  "text": "...",
  "class": "Class 9",
  "subject": "Mathematics",
  "bookTitle": "NCERT Mathematics",
  "book_title": "NCERT Mathematics",
  "page": 45,
  "chapter": "Chapter 6: Triangles",
  "section": "Pythagorean Theorem",
  "board": "CBSE",
  "medium": "English",
  ...
}
```

---

## 🔍 **Test 5: Configuration Validation**

### **Test Invalid Strategy**

```bash
# Set invalid strategy
TEXT_EXTRACTION_STRATEGY=invalid_value npm run dev
```

**Expected Output:**
```
❌ Invalid TEXT_EXTRACTION_STRATEGY: invalid_value
   Valid values: auto, text_only, ocr_only, hybrid, force_pdf_extract_kit
   Defaulting to: auto

📄 PDF Processor Configuration:
   Strategy: auto
   Mode: Smart Text Extraction (text-first)
   Script: smart_doc_processor.py
```

### **Test Valid Strategies**

```bash
# Test each valid strategy
TEXT_EXTRACTION_STRATEGY=text_only npm run dev
TEXT_EXTRACTION_STRATEGY=ocr_only npm run dev
TEXT_EXTRACTION_STRATEGY=hybrid npm run dev
TEXT_EXTRACTION_STRATEGY=force_pdf_extract_kit npm run dev
```

Each should show the correct configuration without errors.

---

## ✅ **Success Criteria**

Phase 2 is working correctly if:

- ✅ All automated tests pass (100% success rate)
- ✅ MySQL `pipeline_metrics` table exists and accepts inserts
- ✅ Content tRPC router responds to queries/mutations
- ✅ PDF uploads show validation logs in console
- ✅ Invalid chunks are rejected with clear error messages
- ✅ Valid chunks are indexed in Qdrant with normalized metadata
- ✅ Configuration validation catches invalid strategies
- ✅ Metrics are recorded in MySQL after processing

---

## 🐛 **Troubleshooting**

### **Issue: Tests fail with import errors**

**Solution:**
```bash
# Ensure all dependencies are installed
npm install

# Rebuild TypeScript
npm run build
```

### **Issue: MySQL table creation fails**

**Solution:**
```bash
# Check MySQL is running
mysql -u root -p -e "SELECT 1;"

# Verify database exists
mysql -u root -p -e "SHOW DATABASES LIKE 'virat_gyankosh';"

# Create database if missing
mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS virat_gyankosh;"
```

### **Issue: tRPC router not found**

**Solution:**
```bash
# Verify router is exported in index.ts
cat src/lib/trpc/routers/index.ts

# Restart dev server
npm run dev
```

### **Issue: Validation not running**

**Solution:**
1. Check `chunk-metadata-schema.ts` exists
2. Verify import in `enhanced-rag-pipeline.ts`
3. Check console logs for validation output
4. Ensure chunks have metadata field

---

## 📊 **Monitoring**

After testing, monitor these metrics:

1. **Validation Rate:** Should be > 95%
2. **Processing Time:** Should be reasonable for PDF size
3. **Error Rate:** Should be < 5%
4. **MySQL Metrics:** Should be recorded for each upload

Query metrics:
```sql
SELECT 
    strategy,
    AVG(validation_rate) as avg_validation_rate,
    AVG(total_time_ms) as avg_processing_time,
    COUNT(*) as total_uploads
FROM pipeline_metrics
GROUP BY strategy;
```

---

## 🎉 **Next Steps**

After successful testing:

1. ✅ Deploy to staging environment
2. ✅ Monitor metrics in production
3. ✅ Create admin dashboard for metrics
4. ✅ Set up alerts for low validation rates
5. ✅ Document API for team

---

**Document Version:** 1.0  
**Last Updated:** 2025-11-03  
**Status:** Ready for Testing

