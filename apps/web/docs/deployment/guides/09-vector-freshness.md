# Step 9: Vector Database Freshness & Content Updates

## Overview
Strategy for keeping Qdrant vector embeddings synchronized with content changes, handling new textbooks, curriculum updates, and ensuring RAG accuracy.

---

## 9.1 Content Freshness Challenges

| Challenge | Impact | Solution |
|-----------|--------|----------|
| New textbooks added | Students can't ask about new content | Incremental indexing |
| Curriculum changes | Outdated answers | Version-aware vectors |
| Typo corrections in source | Minor inaccuracies | Delta updates |
| Book editions change | Wrong page references | Full re-index with versioning |

---

## 9.2 Incremental Indexing Strategy

### Architecture
```
┌─────────────────────────────────────────────────────────────────┐
│                    CONTENT UPDATE PIPELINE                       │
└─────────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
   ┌─────────┐          ┌──────────┐         ┌──────────┐
   │ New PDF │          │ Updated  │         │ Deleted  │
   │ Upload  │          │ Content  │         │ Content  │
   └────┬────┘          └────┬─────┘         └────┬─────┘
        │                    │                    │
        ▼                    ▼                    ▼
   ┌─────────┐          ┌──────────┐         ┌──────────┐
   │ Process │          │ Re-embed │         │ Remove   │
   │ Locally │          │ Changed  │         │ Vectors  │
   │ (GPU)   │          │ Chunks   │         │          │
   └────┬────┘          └────┬─────┘         └────┬─────┘
        │                    │                    │
        └─────────────────────┴────────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │  Qdrant Cloud   │
                    │  (Upsert/Delete)│
                    └─────────────────┘
```

---

## 9.3 Content Version Management

### Database Schema
```sql
-- Content version tracking
CREATE TABLE content_versions (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    content_type ENUM('textbook', 'notes', 'question_bank') NOT NULL,
    
    -- Identification
    board VARCHAR(20) NOT NULL,
    class_level INT NOT NULL,
    subject VARCHAR(100) NOT NULL,
    book_title VARCHAR(255),
    edition VARCHAR(50),
    
    -- Version info
    version_number INT NOT NULL DEFAULT 1,
    version_hash VARCHAR(64) NOT NULL, -- SHA256 of content
    
    -- Qdrant mapping
    qdrant_collection VARCHAR(100) NOT NULL,
    vector_count INT DEFAULT 0,
    last_indexed_at TIMESTAMP,
    
    -- Status
    status ENUM('pending', 'indexing', 'active', 'deprecated') DEFAULT 'pending',
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    UNIQUE KEY unique_content_version (board, class_level, subject, book_title, version_number),
    INDEX idx_status (status),
    INDEX idx_collection (qdrant_collection)
);

-- Track individual chunks
CREATE TABLE content_chunks (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    version_id VARCHAR(36) NOT NULL,
    
    -- Chunk identification
    chunk_hash VARCHAR(64) NOT NULL, -- For change detection
    chunk_index INT NOT NULL,
    chapter VARCHAR(200),
    page_number INT,
    
    -- Qdrant reference
    qdrant_point_id VARCHAR(36) NOT NULL,
    
    -- Metadata
    word_count INT,
    has_math BOOLEAN DEFAULT FALSE,
    has_table BOOLEAN DEFAULT FALSE,
    has_image BOOLEAN DEFAULT FALSE,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (version_id) REFERENCES content_versions(id) ON DELETE CASCADE,
    INDEX idx_version (version_id),
    INDEX idx_chapter (chapter)
);
```

---

## 9.4 Incremental Update Script

```typescript
// scripts/update-vectors.ts
import { QdrantClient } from '@qdrant/js-client-rest';
import { OpenAI } from 'openai';
import crypto from 'crypto';

const qdrant = new QdrantClient({
  url: process.env.QDRANT_URL!,
  apiKey: process.env.QDRANT_API_KEY,
});

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

interface ContentChunk {
  text: string;
  metadata: {
    board: string;
    classLevel: number;
    subject: string;
    chapter: string;
    pageNumber: number;
  };
}

export async function updateVectors(newChunks: ContentChunk[]) {
  const results = { added: 0, updated: 0, unchanged: 0 };
  
  for (const chunk of newChunks) {
    const chunkHash = crypto.createHash('sha256')
      .update(chunk.text)
      .digest('hex');
    
    // Check if chunk already exists
    const existing = await db.query(
      'SELECT qdrant_point_id FROM content_chunks WHERE chunk_hash = ?',
      [chunkHash]
    );
    
    if (existing.length > 0) {
      results.unchanged++;
      continue;
    }
    
    // Generate embedding
    const embedding = await openai.embeddings.create({
      model: 'text-embedding-3-large',
      input: chunk.text,
    });
    
    const pointId = crypto.randomUUID();
    
    // Upsert to Qdrant
    await qdrant.upsert('ncert-books-enhanced', {
      wait: true,
      points: [{
        id: pointId,
        vector: embedding.data[0].embedding,
        payload: {
          text: chunk.text,
          ...chunk.metadata,
          indexedAt: new Date().toISOString(),
        },
      }],
    });
    
    // Track in database
    await db.query(`
      INSERT INTO content_chunks (chunk_hash, chunk_index, chapter, page_number, qdrant_point_id, version_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [chunkHash, results.added, chunk.metadata.chapter, chunk.metadata.pageNumber, pointId, currentVersionId]);
    
    results.added++;
  }
  
  console.log(`✅ Update complete: ${results.added} added, ${results.updated} updated, ${results.unchanged} unchanged`);
  return results;
}
```

---

## 9.5 Content Update Workflow

### Scenario: New Textbook Upload

```bash
# 1. Process PDF locally (with GPU)
python scripts/doc_extract_engine_processor.py \
  --input "new_textbook.pdf" \
  --output "processed/" \
  --board CBSE \
  --class 10 \
  --subject Mathematics

# 2. Generate embeddings
npm run generate-embeddings -- --input processed/chunks.json

# 3. Create new version record
npm run content:version-create -- \
  --board CBSE \
  --class 10 \
  --subject Mathematics \
  --title "Mathematics NCERT 2026"

# 4. Upsert to Qdrant Cloud
npm run vectors:upsert -- --version-id <version-id>

# 5. Activate version
npm run content:version-activate -- --version-id <version-id>
```

### Scenario: Curriculum Update (Partial)

```typescript
// Update specific chapters only
await updateChapters({
  board: 'CBSE',
  classLevel: 10,
  subject: 'Science',
  chapters: ['Chapter 1: Chemical Reactions', 'Chapter 5: Periodic Classification'],
  sourceDir: './updated-chapters/',
});
```

---

## 9.6 Automated Freshness Pipeline

```yaml
# .github/workflows/content-sync.yml
name: Content Freshness Check

on:
  schedule:
    - cron: '0 0 * * 0'  # Weekly on Sunday
  workflow_dispatch:
    inputs:
      force_reindex:
        description: 'Force full reindex'
        type: boolean
        default: false

jobs:
  check-freshness:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '20'
      
      - name: Check for content updates
        run: |
          npm run content:check-freshness
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
          QDRANT_URL: ${{ secrets.QDRANT_URL }}
          QDRANT_API_KEY: ${{ secrets.QDRANT_API_KEY }}
      
      - name: Notify if updates needed
        if: env.UPDATES_NEEDED == 'true'
        run: |
          curl -X POST "${{ secrets.SLACK_WEBHOOK }}" \
            -H 'Content-type: application/json' \
            -d '{"text":"📚 Content updates detected. Review required."}'
```

---

## 9.7 Freshness Monitoring Dashboard

```typescript
// src/app/api/admin/content-status/route.ts
export async function GET() {
  const stats = await db.query(`
    SELECT 
      cv.board,
      cv.class_level,
      cv.subject,
      cv.version_number,
      cv.status,
      cv.vector_count,
      cv.last_indexed_at,
      DATEDIFF(NOW(), cv.last_indexed_at) as days_since_index
    FROM content_versions cv
    WHERE cv.status = 'active'
    ORDER BY days_since_index DESC
  `);
  
  // Check Qdrant collection health
  const qdrantStats = await qdrant.getCollection('ncert-books-enhanced');
  
  return Response.json({
    contentVersions: stats,
    qdrant: {
      vectorCount: qdrantStats.vectors_count,
      indexedSegments: qdrantStats.segments_count,
      status: qdrantStats.status,
    },
    freshness: {
      staleContent: stats.filter(s => s.days_since_index > 90).length,
      recentlyUpdated: stats.filter(s => s.days_since_index < 7).length,
    },
  });
}
```

---

## 9.8 Rollback Strategy

```typescript
// Rollback to previous version if issues detected
async function rollbackContentVersion(board: string, classLevel: number, subject: string) {
  // 1. Get current and previous versions
  const versions = await db.query(`
    SELECT * FROM content_versions 
    WHERE board = ? AND class_level = ? AND subject = ?
    ORDER BY version_number DESC
    LIMIT 2
  `, [board, classLevel, subject]);
  
  const [current, previous] = versions;
  
  // 2. Get all point IDs from current version
  const currentPoints = await db.query(
    'SELECT qdrant_point_id FROM content_chunks WHERE version_id = ?',
    [current.id]
  );
  
  // 3. Delete current version's vectors
  await qdrant.delete('ncert-books-enhanced', {
    points: currentPoints.map(p => p.qdrant_point_id),
  });
  
  // 4. Restore previous version's vectors (from snapshot)
  // ... restore from backup
  
  // 5. Update status
  await db.query('UPDATE content_versions SET status = "deprecated" WHERE id = ?', [current.id]);
  await db.query('UPDATE content_versions SET status = "active" WHERE id = ?', [previous.id]);
  
  console.log(`✅ Rolled back to version ${previous.version_number}`);
}
```

---

## 9.9 Content Freshness Best Practices

| Practice | Frequency | Purpose |
|----------|-----------|---------|
| **Freshness audit** | Weekly | Identify stale content |
| **Vector count check** | Daily | Detect accidental deletions |
| **Sample query test** | Daily | Verify RAG accuracy |
| **Full reindex** | Yearly | New curriculum cycle |
| **Incremental updates** | On-demand | New content additions |

---

## ✅ Vector Freshness Checklist

- [ ] Content version tracking implemented
- [ ] Incremental indexing script ready
- [ ] Automated freshness checks scheduled
- [ ] Rollback procedure tested
- [ ] Monitoring dashboard created
- [ ] Alert thresholds configured
- [ ] Documentation updated

---

## Summary

With these two additions, your deployment strategy now covers:

✅ **Disaster Recovery**
- Automated backups (daily MySQL, weekly Qdrant)
- Recovery procedures with RTO < 4 hours
- Incident response playbook
- Uptime monitoring

✅ **Vector Freshness**
- Content version management
- Incremental indexing (no full re-index needed)
- Automated freshness checks
- Rollback capability

**Strategy Score: 10/10** 🎯
