# DigiClassroom Pro

An AI-powered educational platform built with Next.js 15.3.4, featuring advanced document processing, RAG (Retrieval-Augmented Generation), GPU-accelerated PDF extraction, and comprehensive learning tools.

## 🌟 The Educational Excellence Trio

This application is proudly part of an integrated trio of platforms designed to deliver complete educational excellence, working seamlessly together to manage, educate, and empower institutions:

1. **Vidyaverse Pro**: The core Educational Management Platform. Handles institutional administration, student records, ID cards, certificates, and operational workflows.
2. **PDLMS Pro**: The Digital Library Management System. Provides a comprehensive, multi-tenant digital library for students and institutions to access and manage educational resources.
3. **DigiClassroom Pro**: The AI-Powered Learning Engine. Delivers advanced document processing, Retrieval-Augmented Generation (RAG), and AI tutoring capabilities to transform static materials into interactive learning experiences.

## 🚀 Key Features

### AI & Document Processing
- **PDF-Extract-Kit Integration**: State-of-the-art document processing with GPU acceleration
- **TOC-Based Chapter Extraction**: 95% chapter confidence (up from 30-50%)
- **Advanced OCR**: PaddleOCR with 148+ correction patterns
- **Formula Recognition**: UniMERNet for mathematical equations
- **Table Extraction**: StructEqTable for complex tables
- **Layout Detection**: DocLayout-YOLO for document structure

### RAG System
- **OpenAI GPT-4**: Primary AI engine for tutoring and content generation
- **Qdrant Vector Database**: Semantic search with 3072-dimensional embeddings
- **Metadata Filtering**: Class, subject, chapter-based retrieval
- **Citation System**: Accurate source attribution with page numbers

### Learning Platform
- **Multi-Role Support**: Student, Teacher, Parent, and Admin interfaces
- **AI Tutor**: Context-aware conversational learning assistant
- **Assessment Engine**: Practice tests with automated grading
- **Study Materials**: Organized resources with smart categorization
- **Progress Tracking**: Comprehensive analytics and performance monitoring

## 📋 Prerequisites

**Required:**
- Node.js 18+ (tested with 20.x)
- Python 3.11.9 (for PaddlePaddle compatibility)
- MySQL 8.0
- Redis 7
- Qdrant 1.7.4
- Docker Desktop
- NVIDIA GPU with CUDA 11.8 (for document processing)

**Verify Installation:**
```bash
node --version    # v20.x.x
python --version  # Python 3.11.9
docker --version  # Docker version 24.x.x
nvidia-smi        # NVIDIA GPU info
```

## 🛠️ Quick Start

### 1. Clone Repository

```bash
git clone <repository-url>
cd "DigiClassroom Pro"
```

### 2. Install Node.js Dependencies

```bash
npm install
```

### 3. Setup Python Environment

```bash
# Create virtual environment
python -m venv .venv-py311

# Activate virtual environment
.venv-py311\Scripts\activate

# Install dependencies
pip install paddlepaddle-gpu==2.6.1.post117 -f https://www.paddlepaddle.org.cn/whl/windows/mkl/avx/stable.html
pip install torch==2.3.1+cu118 torchvision==0.18.1+cu118 --index-url https://download.pytorch.org/whl/cu118
pip install paddleocr==2.7.3 doclayout-yolo==0.0.4 unimernet==0.2.1 struct-eqtable==0.1.0
pip install PyMuPDF==1.26.6 omegaconf==2.3.0 ultralytics==8.3.228
```

### 4. Configure Environment

Create `.env.local`:

```env
# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...

# Database
DATABASE_URL="mysql://digiclassroom_user:digiclassroom123@localhost:3307/virat_gyankosh"

# Redis
REDIS_URL=redis://:redis123@localhost:6379

# Qdrant
QDRANT_URL=http://localhost:6333
QDRANT_COLLECTION_NAME=ncert-books-enhanced

# OpenAI
OPENAI_API_KEY=sk-proj-...

# Python Environment
DOC_EXTRACT_ENGINE_PYTHON_PATH=.venv-py311\Scripts\python.exe

# Model Caching (speeds up initialization from 4+ minutes to < 2 seconds)
HF_HOME=./.cache/huggingface
TORCH_HOME=./.cache/torch
PADDLEOCR_HOME=./.cache/paddleocr
KMP_DUPLICATE_LIB_OK=TRUE
```

### 5. Start Docker Services

```bash
docker-compose -f docker-compose.dev.yml up -d
```

### 6. Initialize Database

```bash
mysql -h localhost -P 3307 -u digiclassroom_user -pdigiclassroom123 virat_gyankosh < src/lib/db/schema.sql
mysql -h localhost -P 3307 -u digiclassroom_user -pdigiclassroom123 virat_gyankosh < src/lib/db/subscription-schema.sql
```

### 7. Start Development Server

```bash
npm run dev
```

**Access Application:**
- Frontend: http://localhost:3000
- Qdrant Dashboard: http://localhost:6333/dashboard

## 🏗️ Tech Stack

**Frontend:**
- Next.js 15.3.4 (App Router)
- React 19.0.0
- TypeScript 5
- Tailwind CSS 3.4.17
- Clerk 6.22.0 (Authentication)

**Backend:**
- tRPC 11.4.2 (Type-safe API)
- MySQL 8.0 (Database)
- Redis 7 (Caching)
- Qdrant 1.7.4 (Vector DB)

**AI & Processing:**
- OpenAI GPT-4 (AI Engine)
- PDF-Extract-Kit 1.0.0
- Python 3.11.9
- PaddlePaddle-GPU 2.6.1
- PyTorch 2.3.1+cu118
- CUDA 11.8


## 📁 Project Structure

```
DigiClassroom Pro/
├── src/
│   ├── app/                    # Next.js App Router pages
│   ├── components/             # React components
│   ├── lib/
│   │   ├── ai/                 # AI services (OpenAI, RAG)
│   │   ├── content/            # Document processing
│   │   ├── db/                 # Database schemas and queries
│   │   └── services/           # Business logic
│   └── server/                 # tRPC server
├── scripts/                    # Python processing scripts
│   └── doc_extract_engine_processor.py
├── vendor/
│   └── PDF-Extract-Kit/        # Document processing engine
├── .venv-py311/                # Python virtual environment
├── docs/                       # Documentation
├── docker-compose.dev.yml      # Development services
└── .env.local                  # Environment configuration
```

## 🎯 Recent Improvements

### TOC-Based Chapter Extraction (Latest)
- **95% chapter confidence** (up from 30-50%)
- **82% fewer GPT-4 API calls** (cost savings)
- **Document-wide context** for accurate chapter mapping
- **Backward compatible** with graceful fallback

### GPU Acceleration
- **CUDA 11.8** support for PyTorch and PaddlePaddle
- **2-3x faster** document processing
- **< 2 seconds** model initialization (vs 4+ minutes)

### Quality Enhancement
- **148+ OCR correction patterns**
- **GPT-4o-mini validation** for chapter extraction
- **Visual element detection** (charts, diagrams, maps)

## 📚 Documentation

Comprehensive documentation is available in the `docs/` folder:

- **[App Overview](docs/APP_OVERVIEW.md)** - Architecture, features, tech stack
- **[Database Setup](docs/DATABASE_SETUP.md)** - MySQL, Redis configuration
- **[PDF-Extract-Kit Setup](docs/PDF_EXTRACT_KIT_SETUP.md)** - Document processing setup
- **[Python Environment](docs/PYTHON_ENVIRONMENT.md)** - Python 3.11.9 setup
- **[Docker Services](docs/DOCKER_SERVICES.md)** - MySQL, Redis, Qdrant
- **[Qdrant Collections](docs/QDRANT_COLLECTIONS.md)** - Vector database schema
- **[Development Workflow](docs/DEVELOPMENT_WORKFLOW.md)** - Getting started guide

## 🔧 Available Scripts

```bash
npm run dev          # Start development server (port 3000)
npm run build        # Build for production
npm start            # Start production server
npm run lint         # Run ESLint
npm run type-check   # Run TypeScript type checking
npm test             # Run tests
```

## 🐛 Troubleshooting

### Common Issues

**Port Already in Use:**
```bash
netstat -ano | findstr :3000
taskkill /PID <PID> /F
```

**Database Connection Failed:**
```bash
docker-compose -f docker-compose.dev.yml restart mysql
docker logs digiclassroom-mysql-dev
```

**Python Module Not Found:**
```bash
.venv-py311\Scripts\activate
pip install <package-name>
```

**GPU Not Detected:**
```bash
nvidia-smi
pip install torch==2.3.1+cu118 --index-url https://download.pytorch.org/whl/cu118
```

See [Development Workflow](docs/DEVELOPMENT_WORKFLOW.md) for detailed troubleshooting.

## 📄 License

This project is licensed under the MIT License.

## 🙏 Acknowledgments

- Next.js team for the amazing framework
- OpenAI for GPT-4 and embeddings
- PDF-Extract-Kit for document processing
- Qdrant for vector search
- All contributors and supporters
