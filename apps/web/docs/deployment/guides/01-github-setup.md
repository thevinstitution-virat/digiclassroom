# Step 1: GitHub Repository Setup

## Overview
Set up a private GitHub repository for DigiClassroom Pro with proper configuration for large files, secrets, and CI/CD integration.

---

## 1.1 Create Private Repository

### Via GitHub.com:
1. Go to [github.com/new](https://github.com/new)
2. **Repository name**: `DigiClassroom-Pro`
3. **Visibility**: Private
4. **DO NOT** initialize with README (you have existing code)
5. Click **Create repository**

### Via Command Line:
```bash
# Install GitHub CLI if not installed
winget install GitHub.cli

# Authenticate
gh auth login

# Create private repo
gh repo create DigiClassroom-Pro --private --source=. --remote=origin
```

---

## 1.2 Configure Git LFS for Large Files

Your Qdrant snapshots and model files are too large for regular Git. Use Git LFS:

```powershell
# Install Git LFS
winget install GitHub.GitLFS

# Initialize in your project
cd "J:\DigiClassroom Pro"
git lfs install

# Track large file types
git lfs track "*.snapshot"
git lfs track "*.bin"
git lfs track "*.onnx"
git lfs track "*.pt"
git lfs track "*.pth"
git lfs track "qdrant_data/**"
git lfs track "models/**"

# Verify .gitattributes was created
cat .gitattributes
```

---

## 1.3 Optimized .gitignore

Create/update `.gitignore`:

```gitignore
# Dependencies
node_modules/
.pnpm-store/

# Build outputs
.next/
out/
dist/
build/

# Environment files (CRITICAL - never commit secrets!)
.env
.env.local
.env.*.local

# Python virtual environment
.venv-py311/
__pycache__/
*.pyc

# Large data files (use LFS or external storage)
qdrant_data/
models/
*.snapshot

# IDE
.idea/
.vscode/
*.swp

# OS
.DS_Store
Thumbs.db

# Logs
*.log
npm-debug.log*

# Temporary files
tmp/
temp/
uploads/

# Cache
.cache/
.eslintcache

# Test coverage
coverage/

# Prisma
prisma/migrations/dev/
```

---

## 1.4 Initial Push to GitHub

```powershell
cd "J:\DigiClassroom Pro"

# Initialize git (if not already)
git init

# Add origin
git remote add origin https://github.com/YOUR_USERNAME/DigiClassroom-Pro.git

# Stage all files
git add .

# Commit
git commit -m "Initial commit: DigiClassroom Pro"

# Push to main branch
git branch -M main
git push -u origin main
```

---

## 1.5 Set Up Repository Secrets

Go to: `Settings > Secrets and variables > Actions`

Add these secrets for CI/CD:

| Secret Name | Value | Purpose |
|-------------|-------|---------|
| `VERCEL_TOKEN` | Your Vercel token | Auto-deploy |
| `VERCEL_ORG_ID` | Organization ID | Vercel project |
| `VERCEL_PROJECT_ID` | Project ID | Vercel project |
| `DATABASE_URL` | PlanetScale URL | Production DB |
| `QDRANT_URL` | Qdrant Cloud URL | Vector DB |
| `QDRANT_API_KEY` | Qdrant API key | Auth |
| `REDIS_URL` | Upstash Redis URL | Cache |
| `OPENAI_API_KEY` | OpenAI key | AI features |
| `CLERK_SECRET_KEY` | Clerk secret | Auth |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk public key | Auth |

---

## 1.6 Branch Protection Rules

Go to: `Settings > Branches > Add rule`

**Branch name pattern**: `main`

Enable:
- [x] Require pull request reviews before merging
- [x] Require status checks to pass before merging
- [x] Require branches to be up to date before merging
- [x] Do not allow bypassing the above settings

---

## 1.7 Create Development Branch

```bash
# Create and switch to development branch
git checkout -b development

# Push development branch
git push -u origin development
```

**Workflow:**
- `main` → Production (auto-deploys to Vercel)
- `development` → Staging/testing
- Feature branches → PR to `development` → PR to `main`

---

## ✅ Verification Checklist

- [ ] Repository created and private
- [ ] Code pushed successfully
- [ ] `.gitignore` excludes sensitive files
- [ ] Git LFS tracking large files
- [ ] Secrets added for CI/CD
- [ ] Branch protection enabled
- [ ] Development branch created

---

## Next Step
→ [Step 2: Vercel Deployment Guide](./02-vercel-deployment.md)
