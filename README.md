# Virat Gyankosh - Educational Platform

A sophisticated educational platform that provides personalized learning through multi-tenant role-based access control.

## 🚀 Features

### Core Architecture
- **Next.js 15** with App Router and TypeScript
- **Multi-tenant architecture** with role-based access control
- **Enhanced AI system** with intelligent RAG search
- **Qdrant vector database** for efficient retrieval
- **Cohere Command-R** integration for natural language processing
- **Clerk authentication** with advanced role management
- **tRPC** for type-safe API calls
- **Zustand** for modern state management

### AI-Powered Learning
- **Intelligent RAG Search** - Multi-strategy search with fallback mechanisms
- **Role-based AI Tutoring** - Personalized responses for students, teachers, parents, and admins
- **CBSE Curriculum Alignment** - Content tailored to Indian educational standards
- **Streaming Responses** - Real-time AI interactions
- **Cultural Context Adaptation** - Indian examples and cultural references
- **Class-specific Content** - Grade-appropriate explanations and examples

### Educational Features
- **AI Tutor** - Intelligent conversational learning assistant
- **Assessment Engine** - Creates quizzes, tests, and evaluations
- **Study Materials** - Comprehensive learning resources
- **Dictionary System** - English-Hindi dictionary with cultural context
- **Progress Tracking** - Monitor learning progress and performance

### Multi-Role Support
- **Admin Dashboard** - Tenant and user management with AI-powered analytics
- **Teacher Portal** - Content creation, lesson planning, and AI teaching assistance
- **Student Interface** - Interactive learning with personalized AI tutoring
- **Parent Dashboard** - Progress tracking and AI-guided learning support

## 🛠️ Technology Stack

### Frontend
- **Next.js 15.1.0** - React framework with App Router
- **TypeScript 5.3.2** - Type safety and developer experience
- **Tailwind CSS 3.3.5** - Utility-first styling
- **Heroicons & Lucide React** - Beautiful icons
- **Zustand** - Lightweight state management
- **tRPC** - End-to-end type safety

### Backend & AI
- **Cohere Command-R** - Primary AI engine
- **Qdrant** - Vector database
- **MySQL** - Relational database with multi-tenant design
- **Clerk** - Authentication and user management
- **Resend** - Email services

### Development Tools
- **ESLint** - Code linting
- **Prettier** - Code formatting
- **TypeScript** - Static type checking

## 📋 Prerequisites

Before you begin, ensure you have the following installed:
- **Node.js 20.10.0** or later
- **npm** or **yarn** package manager
- **MySQL** database (local or cloud)
- **Git** for version control

## 🔧 Installation & Setup

### 1. Clone the Repository
```bash
git clone <repository-url>
cd virat-gyankosh
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Environment Configuration
Copy the environment example file and configure your variables:
```bash
cp .env.example .env.local
```

Fill in your environment variables in `.env.local`:

```env
# Authentication - Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_your_key_here
CLERK_SECRET_KEY=sk_test_your_key_here
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/dashboard

# Database - MySQL
DATABASE_URL="mysql://username:password@localhost:3306/virat_gyankosh"
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=your_password
MYSQL_DATABASE=virat_gyankosh

# AI Services
COHERE_API_KEY=your_cohere_api_key_here

# Vector Database - Qdrant
QDRANT_URL=http://localhost:6333
QDRANT_COLLECTION_NAME=digiclassroom
# QDRANT_API_KEY=your_api_key_here  # Optional for self-hosted

# Email Service (removed - using alternative solution)

# Application
NEXT_PUBLIC_APP_URL=http://localhost:3000
NODE_ENV=development
```

### 4. Database Setup
Create your MySQL database and run the schema:
```bash
# Create database
mysql -u root -p -e "CREATE DATABASE virat_gyankosh;"

# Import schema
mysql -u root -p virat_gyankosh < src/lib/db/schema.sql
```

### 5. Clerk Configuration
1. Create a Clerk account at [clerk.com](https://clerk.com)
2. Create a new application
3. Configure authentication methods (email, social, etc.)
4. Set up role-based metadata in Clerk dashboard
5. Copy your publishable and secret keys to `.env.local`

### 6. Cohere Setup
1. Create a Cohere account at https://cohere.com
2. Generate an API key
3. Add COHERE_API_KEY to your `.env.local` file

### 7. Qdrant Setup
1. Qdrant is included in the Docker Compose setup
2. Start Qdrant with: `docker-compose -f docker-compose.qdrant.yml up -d`
3. Qdrant will be available at `http://localhost:6333`
4. (Optional) Set QDRANT_API_KEY in `.env.local` for production deployments

## 🚀 Running the Application

### Development Mode
```bash
npm run dev
```

The application will be available at `http://localhost:3000`

### Production Build
```bash
npm run build
npm start
```
