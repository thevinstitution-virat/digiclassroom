# Step 4: Qdrant Cloud Setup

## Overview
Move your local Qdrant vector database to Qdrant Cloud for scalable, managed vector search. Use offline snapshot creation to minimize costs.

---

## 4.1 Create Qdrant Cloud Account

1. Go to [cloud.qdrant.io](https://cloud.qdrant.io)
2. Sign up with GitHub or email
3. Verify your email

---

## 4.2 Create Local Snapshot

Before moving to cloud, create a snapshot of your existing vectors:

```powershell
# Ensure local Qdrant is running
docker ps | findstr qdrant

# Create snapshot via API
curl -X POST "http://localhost:6333/collections/ncert-books-enhanced/snapshots"

# Response will include snapshot name like:
# {"result":{"name":"ncert-books-enhanced-2026-01-18-03-45-00.snapshot"}}

# List snapshots
curl "http://localhost:6333/collections/ncert-books-enhanced/snapshots"

# Download snapshot to local file
curl -o ncert-books-snapshot.snapshot \
  "http://localhost:6333/collections/ncert-books-enhanced/snapshots/ncert-books-enhanced-2026-01-18-03-45-00.snapshot/download"
```

**Snapshot location in Docker:**
```powershell
# Snapshots are stored in:
# J:\DigiClassroom Pro\qdrant_data\snapshots\ncert-books-enhanced\

# Copy to working directory
copy "J:\DigiClassroom Pro\qdrant_data\snapshots\ncert-books-enhanced\*.snapshot" .
```

---

## 4.3 Create Qdrant Cloud Cluster

### Via Dashboard:
1. Click **Create Cluster**
2. **Cluster name**: `digiclassroom-prod`
3. **Cloud provider**: AWS
4. **Region**: `ap-south-1` (Mumbai) ← **Important for India!**
5. **Configuration**:
   - Free tier: 1GB storage, shared resources
   - Starter: $25/mo, 4GB RAM, dedicated
6. Click **Create**

Wait 2-3 minutes for cluster to be ready.

---

## 4.4 Get API Key and URL

1. Go to **Data Access Control** → **API Keys**
2. Click **Create API Key**
3. **Name**: `production-key`
4. **Permissions**: `manage` (or `read-write` for app)
5. Copy and save the key securely

**Cluster URL format:**
```
https://abc123-xyz789.aws.cloud.qdrant.io:6333
```

---

## 4.5 Create Collection on Cloud

```powershell
# Set environment variables
$env:QDRANT_URL = "https://your-cluster.aws.cloud.qdrant.io:6333"
$env:QDRANT_API_KEY = "your-api-key"

# Create collection with same config as local
curl -X PUT "$env:QDRANT_URL/collections/ncert-books-enhanced" `
  -H "api-key: $env:QDRANT_API_KEY" `
  -H "Content-Type: application/json" `
  -d '{
    "vectors": {
      "size": 3072,
      "distance": "Cosine"
    },
    "optimizers_config": {
      "indexing_threshold": 20000
    },
    "replication_factor": 1
  }'
```

---

## 4.6 Restore Snapshot to Cloud

### Option A: Upload via URL (if snapshot is public)
```powershell
# First, upload snapshot to cloud storage (S3, GCS, or R2)
# Then restore from URL
curl -X PUT "$env:QDRANT_URL/collections/ncert-books-enhanced/snapshots/recover" `
  -H "api-key: $env:QDRANT_API_KEY" `
  -H "Content-Type: application/json" `
  -d '{
    "location": "https://your-bucket.s3.amazonaws.com/ncert-books-snapshot.snapshot"
  }'
```

### Option B: Upload via Qdrant Dashboard
1. Go to cluster → Collections → `ncert-books-enhanced`
2. Click **Snapshots** tab
3. Click **Upload Snapshot**
4. Select your `.snapshot` file
5. Wait for upload and restoration

### Option C: Re-index (if snapshot is too large)
If your snapshot is very large, you may need to re-create embeddings:

```typescript
// Script to migrate vectors
import { QdrantClient } from '@qdrant/js-client-rest';

const localClient = new QdrantClient({ host: 'localhost', port: 6333 });
const cloudClient = new QdrantClient({
  url: process.env.QDRANT_URL,
  apiKey: process.env.QDRANT_API_KEY,
});

async function migrate() {
  // Scroll through all points in local
  let offset = null;
  do {
    const result = await localClient.scroll('ncert-books-enhanced', {
      limit: 100,
      offset,
      with_payload: true,
      with_vector: true,
    });
    
    if (result.points.length > 0) {
      // Upsert to cloud
      await cloudClient.upsert('ncert-books-enhanced', {
        points: result.points,
      });
    }
    
    offset = result.next_page_offset;
  } while (offset);
}

migrate();
```

---

## 4.7 Update Application Configuration

```typescript
// src/lib/ai/qdrant.ts
import { QdrantClient } from '@qdrant/js-client-rest';

export const qdrantClient = new QdrantClient({
  url: process.env.QDRANT_URL!,
  apiKey: process.env.QDRANT_API_KEY,
});

// Test connection
export async function testQdrantConnection() {
  try {
    const collections = await qdrantClient.getCollections();
    console.log('Qdrant connected:', collections);
    return true;
  } catch (error) {
    console.error('Qdrant connection failed:', error);
    return false;
  }
}
```

---

## 4.8 Environment Variables

Add to Vercel/production:
```env
QDRANT_URL=https://your-cluster.aws.cloud.qdrant.io:6333
QDRANT_API_KEY=your-api-key
QDRANT_COLLECTION_NAME=ncert-books-enhanced
```

---

## ✅ Verification Checklist

- [ ] Qdrant Cloud account created
- [ ] Cluster in Mumbai region
- [ ] Local snapshot created
- [ ] Collection created on cloud
- [ ] Snapshot restored
- [ ] API key secured
- [ ] Application connection tested

---

## 💰 Pricing

| Plan | Price | Storage | Vectors |
|------|-------|---------|---------|
| Free | ₹0 | 1 GB | ~200K vectors |
| Starter | ₹2,000/mo | 4 GB | ~1M vectors |
| Standard | ₹8,000/mo | 16 GB | ~4M vectors |

---

## Next Step
→ [Step 5: Upstash Redis Setup](./05-upstash-redis-setup.md)
