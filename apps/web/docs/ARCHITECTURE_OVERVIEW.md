# DigiClassroom Pro - Architecture Overview

**Last Updated:** January 15, 2026  
**Version:** Production  

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT LAYER                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│  Next.js 15.3.4 (App Router)  │  React 19  │  TypeScript 5  │  Tailwind CSS │
│                                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │  Dashboard   │  │  AI Tutor    │  │  Sanchika    │  │  Practest    │    │
│  │  Pages       │  │  Chat        │  │  Editor      │  │  Engine      │    │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                            AUTHENTICATION                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                        Clerk Authentication                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │   Sign In   │  │   Sign Up   │  │   RBAC      │  │   Session   │        │
│  │             │  │             │  │   Control   │  │   Mgmt      │        │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘        │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              API LAYER                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│  Next.js API Routes (App Router)  │  tRPC 11.4.2 (Type-safe RPC)            │
│                                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │  /api/user   │  │  /api/ai     │  │  /api/notes  │  │  /api/admin  │    │
│  │  /api/auth   │  │  /api/rag    │  │  /api/folder │  │  /api/test   │    │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                            SERVICE LAYER                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│  src/lib/services/ (60+ services)                                           │
│                                                                              │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐                │
│  │  AI Services   │  │  Content Svcs  │  │  User Services │                │
│  │  - RAG Engine  │  │  - PDF Process │  │  - Subscription│                │
│  │  - Embeddings  │  │  - OCR         │  │  - Profiles    │                │
│  │  - Chat        │  │  - Extraction  │  │  - Quota       │                │
│  └────────────────┘  └────────────────┘  └────────────────┘                │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              DATA LAYER                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐                │
│  │     MySQL      │  │     Redis      │  │     Qdrant     │                │
│  │   (Primary)    │  │   (Cache)      │  │  (Vectors)     │                │
│  │                │  │                │  │                │                │
│  │ - User tables  │  │ - Sessions     │  │ - Embeddings   │                │
│  │ - Notes        │  │ - API cache    │  │ - Semantic     │                │
│  │ - Subscriptions│  │ - Rate limits  │  │   search       │                │
│  └────────────────┘  └────────────────┘  └────────────────┘                │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          EXTERNAL SERVICES                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐                │
│  │    OpenAI      │  │  PDF-Extract   │  │   PaddleOCR    │                │
│  │                │  │      Kit       │  │                │                │
│  │ - GPT-4       │  │                │  │ - Text Extract │                │
│  │ - Embeddings   │  │ - DocLayout    │  │ - 148+ fixes   │                │
│  │ - Validation   │  │ - UniMERNet    │  │                │                │
│  └────────────────┘  └────────────────┘  └────────────────┘                │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Directory Structure

```
DigiClassroom Pro/
├── src/
│   ├── app/                          # Next.js App Router
│   │   ├── (auth)/                   # Auth routes (sign-in, sign-up)
│   │   ├── api/                      # API routes (50+ endpoints)
│   │   │   ├── admin/                # Admin APIs
│   │   │   ├── ai/                   # AI/RAG APIs
│   │   │   ├── notes/                # Notes CRUD
│   │   │   ├── user/                 # User management
│   │   │   └── ...
│   │   ├── dashboard/
│   │   │   ├── admin/                # Admin dashboard
│   │   │   ├── teacher/              # Teacher dashboard
│   │   │   └── user/                 # Student dashboard
│   │   └── pricing/                  # Subscription pricing
│   │
│   ├── components/                   # React components (134 files)
│   │   ├── admin/                    # Admin UI components
│   │   ├── ai-tutor/                 # AI chat interface
│   │   ├── dictionary/               # Shabdakosh components
│   │   ├── practest/                 # Assessment components
│   │   ├── sanchika/                 # Note editor (28 files)
│   │   │   ├── RichTextEditor.tsx    # TipTap editor
│   │   │   ├── AIWritingToolbar.tsx  # AI writing assistant
│   │   │   ├── DrawingCanvas.tsx     # Drawing support
│   │   │   └── ...
│   │   └── ui/                       # Shared UI components
│   │
│   ├── lib/                          # Core libraries
│   │   ├── ai/                       # AI services (49 files)
│   │   ├── db/                       # Database connections
│   │   ├── services/                 # Business logic (60 files)
│   │   ├── experiments/              # A/B testing framework
│   │   └── content/                  # Content processing
│   │
│   ├── hooks/                        # React hooks
│   ├── types/                        # TypeScript types
│   └── middleware.ts                 # Auth middleware
│
├── scripts/                          # Python & utility scripts
│   └── doc_extract_engine_processor.py
│
├── vendor/
│   └── PDF-Extract-Kit/              # Document processing engine
│
├── docs/                             # Documentation
├── prisma/                           # Prisma schema
└── docker-compose*.yml               # Container configs
```

---

## Technology Stack

### Frontend

| Technology | Version | Purpose |
|------------|---------|---------|
| Next.js | 15.3.4 | React framework with App Router |
| React | 19.0.0 | UI library |
| TypeScript | 5.x | Type-safe JavaScript |
| Tailwind CSS | 3.4.17 | Utility-first styling |
| TipTap | Latest | Rich text editor |
| Lucide React | Latest | Icon library |

### Backend

| Technology | Version | Purpose |
|------------|---------|---------|
| Next.js API | 15.3.4 | Server-side API routes |
| tRPC | 11.4.2 | Type-safe API layer |
| Clerk | 6.22.0 | Authentication |
| mysql2 | Latest | MySQL driver |

### Databases

| Technology | Version | Purpose |
|------------|---------|---------|
| MySQL | 8.0 | Primary database |
| Redis | 7.x | Caching & sessions |
| Qdrant | 1.7.4 | Vector database for RAG |

### AI & Processing

| Technology | Version | Purpose |
|------------|---------|---------|
| OpenAI API | Latest | GPT-4, embeddings |
| Python | 3.11.9 | Document processing |
| PaddlePaddle-GPU | 2.6.1 | OCR engine |
| PyTorch | 2.3.1+cu118 | ML inference |

---

## Data Flow

### AI Tutor Query Flow

```
User Question
      │
      ▼
┌─────────────┐
│  Frontend   │ → Subscription check
└─────────────┘
      │
      ▼
┌─────────────┐
│  API Layer  │ → Rate limiting, quota check
└─────────────┘
      │
      ▼
┌─────────────┐
│  Embedding  │ → text-embedding-3-large
│  Service    │
└─────────────┘
      │
      ▼
┌─────────────┐
│   Qdrant    │ → Semantic search, metadata filter
│   Search    │
└─────────────┘
      │
      ▼
┌─────────────┐
│   Context   │ → Chunk selection, citation prep
│   Builder   │
└─────────────┘
      │
      ▼
┌─────────────┐
│   GPT-4     │ → Answer generation
│   Response  │
└─────────────┘
      │
      ▼
┌─────────────┐
│  Frontend   │ → Markdown rendering, citations
└─────────────┘
```

### Document Processing Flow

```
PDF Upload
      │
      ▼
┌─────────────┐
│  PyMuPDF    │ → TOC extraction, page splitting
└─────────────┘
      │
      ▼
┌─────────────┐
│  DocLayout  │ → Layout detection (YOLO)
│   YOLO      │
└─────────────┘
      │
      ▼
┌─────────────┐
│  PaddleOCR  │ → Text extraction + 148 corrections
└─────────────┘
      │
      ▼
┌─────────────┐
│  UniMERNet  │ → Formula recognition
│  StructEq   │ → Table extraction
└─────────────┘
      │
      ▼
┌─────────────┐
│  Chunking   │ → 512-token chunks with overlap
└─────────────┘
      │
      ▼
┌─────────────┐
│  Embedding  │ → OpenAI embeddings (3072-dim)
└─────────────┘
      │
      ▼
┌─────────────┐
│   Qdrant    │ → Vector storage with metadata
└─────────────┘
```

---

## Key Database Tables

### User Management

```sql
enhanced_user_profiles     -- User profile data
user_subscriptions         -- Subscription tracking
ai_tutor_usage            -- Daily quota tracking
free_trials               -- Trial management
```

### Content

```sql
user_notes                -- Sanchika notes
note_folders              -- Note organization
note_smart_detections     -- AI-detected content
note_voice_recordings     -- Voice notes
note_pdf_attachments      -- PDF attachments
```

### Platform

```sql
books                     -- Content library
chapters                  -- Chapter metadata
answer_feedback           -- AI response feedback
experiments               -- A/B test configs
experiment_assignments    -- User variant tracking
```

---

## Security Architecture

### Authentication

- **Provider:** Clerk
- **Session Management:** JWT with automatic refresh
- **Role-Based Access Control (RBAC):**
  - Admin (Level 4)
  - Teacher (Level 3)
  - Guardian (Level 2)
  - Student (Level 1)

### API Security

- Clerk middleware on all protected routes
- Rate limiting via Redis
- Input validation with Zod schemas
- Prepared statements for SQL queries

### Data Protection

- All API keys in environment variables
- Database credentials secured
- HTTPS enforced in production

---

## Deployment Architecture

### Development

```yaml
# docker-compose.dev.yml
services:
  mysql:
    image: mysql:8.0
    ports: ["3307:3306"]
  redis:
    image: redis:7
    ports: ["6379:6379"]
  qdrant:
    image: qdrant/qdrant:v1.7.4
    ports: ["6333:6333"]
```

### Production

- Containerized deployment
- Kubernetes-ready (k8s/ directory present)
- Monitoring with Prometheus/Grafana (monitoring/ directory)

---

## Performance Characteristics

| Metric | Target | Implementation |
|--------|--------|----------------|
| Page Load | < 2.5s | Next.js SSR, code splitting |
| AI Response | < 5s | Cached embeddings, streaming |
| Search | < 500ms | Qdrant vector search |
| Auto-save | 2s debounce | Client-side buffering |
| Model Init | < 2s | HuggingFace cache |

---

## Related Documentation

- [Feature Status](./FEATURE_STATUS.md) - Complete feature matrix
- [README](../README.md) - Project overview and setup
- [Subscription Schema](../src/lib/db/SUBSCRIPTION_SCHEMA_README.md) - Subscription system
- [A/B Testing](../src/lib/experiments/README.md) - Experiment framework
