/**
 * Environment Variable Validation for DigiClassroom
 * Validates required environment variables at application startup
 */

import { z } from 'zod'

// Define environment variable schema
const envSchema = z.object({
  // Node Environment
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // Better Auth Authentication
  BETTER_AUTH_SECRET: z.string().optional(),
  BETTER_AUTH_URL: z.string().optional(),

  // Database (Required)
  DATABASE_URL: z.string().min(1, 'Database URL is required'),
  MYSQL_HOST: z.string().optional(),
  MYSQL_PORT: z.string().optional(),
  MYSQL_USER: z.string().optional(),
  MYSQL_PASSWORD: z.string().optional(),
  MYSQL_DATABASE: z.string().optional(),

  // AI Services (Required)
  OPENAI_API_KEY: z.string().min(1, 'OpenAI API key is required for answer generation and embeddings'),
  OPENROUTER_API_KEY: z.string().optional(),

  // Vector Database - Qdrant (Required)
  QDRANT_URL: z.string().default('http://localhost:6333'),
  QDRANT_COLLECTION_NAME: z.string().default('ncert-books-enhanced'),
  QDRANT_API_KEY: z.string().optional(), // Optional for self-hosted

  // Application URLs
  NEXT_PUBLIC_APP_URL: z.string().default('http://localhost:3000'),

  // Optional Services
  GOOGLE_CLOUD_PROJECT_ID: z.string().optional(),
  GOOGLE_CLOUD_KEY_FILE: z.string().optional(),
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  AWS_REGION: z.string().optional(),
  AZURE_SPEECH_KEY: z.string().optional(),
  AZURE_SPEECH_REGION: z.string().optional(),
  ASSEMBLYAI_API_KEY: z.string().optional(),

  // Feature Flags
  USE_AGENT_SYSTEM: z.string().optional(),
  USE_ENHANCED_RAG: z.string().optional(),
  USE_UNIFIED_PROMPTS: z.string().optional(),
  APM_ENABLED: z.string().optional(),

  // Redis (Optional)
  REDIS_HOST: z.string().optional(),
  REDIS_PORT: z.string().optional(),
  REDIS_PASSWORD: z.string().optional(),
  REDIS_DB: z.string().optional(),
})

export type Env = z.infer<typeof envSchema>

/**
 * Validate environment variables
 * @throws {Error} If validation fails
 */
export function validateEnv(): Env {
  try {
    const env = envSchema.parse(process.env)
    return env
  } catch (error) {
    if (error instanceof z.ZodError) {
      const missingVars = error.errors
        .map((err) => `  - ${err.path.join('.')}: ${err.message}`)
        .join('\n')

      throw new Error(
        `❌ Environment variable validation failed:\n\n${missingVars}\n\nPlease check your .env.local file.`
      )
    }
    throw error
  }
}

/**
 * Get validated environment variables
 * Safe to use after validateEnv() has been called
 */
export function getEnv(): Env {
  return process.env as unknown as Env
}

/**
 * Check if environment is production
 */
export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production'
}

/**
 * Check if environment is development
 */
export function isDevelopment(): boolean {
  return process.env.NODE_ENV === 'development'
}

/**
 * Check if environment is test
 */
export function isTest(): boolean {
  return process.env.NODE_ENV === 'test'
}

/**
 * Get environment variable with fallback
 */
export function getEnvVar(key: string, fallback?: string): string {
  const value = process.env[key]
  if (!value && !fallback) {
    throw new Error(`Environment variable ${key} is not set and no fallback provided`)
  }
  return value || fallback || ''
}

/**
 * Check if a feature flag is enabled
 */
export function isFeatureEnabled(flag: string): boolean {
  return process.env[flag] === 'true'
}

/**
 * Log environment configuration (safe - hides sensitive data)
 */
export function logEnvConfig(): void {
  if (isProduction()) {
    // Don't log in production
    return
  }

  console.log('🔧 Environment Configuration:')
  console.log(`  NODE_ENV: ${process.env.NODE_ENV}`)
  console.log(`  QDRANT_URL: ${process.env.QDRANT_URL}`)
  console.log(`  QDRANT_COLLECTION: ${process.env.QDRANT_COLLECTION_NAME}`)
  console.log(`  OPENAI_API_KEY: ${process.env.OPENAI_API_KEY ? '✅ Set' : '❌ Missing'}`)
  console.log(`  BETTER_AUTH_SECRET: ${process.env.BETTER_AUTH_SECRET ? '✅ Set' : '❌ Missing'}`)
  console.log(`  DATABASE_URL: ${process.env.DATABASE_URL ? '✅ Set' : '❌ Missing'}`)
  console.log(`  USE_AGENT_SYSTEM: ${isFeatureEnabled('USE_AGENT_SYSTEM') ? '✅ Enabled' : '❌ Disabled'}`)
  console.log(`  USE_ENHANCED_RAG: ${isFeatureEnabled('USE_ENHANCED_RAG') ? '✅ Enabled' : '❌ Disabled'}`)
}

/**
 * Validate environment on module load (only in development)
 * In production, validation should be done explicitly at startup
 */
if (isDevelopment() && typeof window === 'undefined') {
  try {
    validateEnv()
    console.log('✅ Environment variables validated successfully')
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Environment validation failed')
    // Don't throw in development - allow app to start for debugging
  }
}

