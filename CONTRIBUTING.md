# Contributing to DigiClassroom Pro

First off, thank you for considering contributing to DigiClassroom Pro.

## Local Development Setup

### 1. Prerequisites
- Node.js (v20+)
- PostgreSQL (Local or Neon URL)
- Redis (Local or Upstash URL)
- Qdrant (Local Docker or Cloud URL)
- API Keys: OpenAI, Anthropic (optional for multi-llm)

### 2. Installation
```bash
git clone https://github.com/your-repo/digiclassroom.git
cd digiclassroom
npm install
```

### 3. Environment Variables
Copy `.env.example` to `.env` and fill in the required keys.
**NEVER commit `.env` or any secret keys to the repository.**

### 4. Database Setup
```bash
npm run db:setup
```

### 5. Running the App
```bash
npm dev
```

## Pull Request Process

1. **Branch Naming**: Use the format `feature/your-feature-name` or `fix/issue-description`.
2. **Pre-commit Hooks**: We use Husky + `lint-staged`. When you run `git commit`, ESLint and Prettier will format your code automatically. Please ensure it passes type safety checks (`npx tsc --noEmit`).
3. **Testing**: Write Jest tests (`npm run test:unit`) covering your new functionality, especially if touching the AI agent layer or core utilities.
4. **Code Quality**:
   - Do NOT use `console.log`. Use the structured logger (`import { logger } from '@/lib/logger'`).
   - Avoid `as any` type casting unless absolutely necessary. Use `unknown` and type narrow using Zod.
   - Return strict `TRPCError` instances from tRPC endpoints. Don't throw raw errors.

## CI/CD Pipeline
Every PR will trigger our GitHub Actions workflow which performs:
- Code Linting (ESLint/Prettier)
- TypeScript Compilation checks
- Unit and Golden Integration Tests

Ensure all tests pass before requesting a review.
