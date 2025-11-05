/**
 * User Sync Utility - Syncs Clerk users with application database
 * Ensures all admin and user accounts are visible in the application
 *
 * B2C Enhancement: Includes automatic teacher verification via email domain detection
 */

import { clerkClient } from '@clerk/nextjs/server'
import mysql from 'mysql2/promise'
import { UserRole } from '@/types/user-management'
import {
  extractEmailDomain,
  isEducationalDomain,
  type VerificationStatus
} from '@/lib/services/teacher-verification-service'

// Database connection configuration
const dbConfig = {
  host: process.env.DB_HOST || process.env.MYSQL_HOST || 'localhost',
  user: process.env.DB_USER || process.env.MYSQL_USER || 'root',
  password: process.env.DB_PASSWORD || process.env.MYSQL_PASSWORD || '',
  database: process.env.DB_NAME || process.env.MYSQL_DATABASE || 'virat_gyankosh',
  port: parseInt(process.env.DB_PORT || process.env.MYSQL_PORT || '3306')
}

interface ClerkUser {
  id: string
  emailAddresses: Array<{
    id: string
    emailAddress: string
  }>
  primaryEmailAddressId: string
  firstName?: string
  lastName?: string
  publicMetadata: Record<string, any>
  createdAt: number
  lastSignInAt?: number
  imageUrl?: string
}

interface SyncResult {
  success: boolean
  totalUsers: number
  syncedUsers: number
  errors: string[]
  newUsers: number
  updatedUsers: number
}

/**
 * Sync all Clerk users to application database
 */
export async function syncAllUsersFromClerk(): Promise<SyncResult> {
  const result: SyncResult = {
    success: false,
    totalUsers: 0,
    syncedUsers: 0,
    errors: [],
    newUsers: 0,
    updatedUsers: 0
  }

  let connection: mysql.Connection | null = null

  try {
    console.log('🔄 Starting user sync from Clerk...')
    
    // Get database connection
    connection = await mysql.createConnection(dbConfig)
    
    // Ensure database tables exist
    await ensureTablesExist(connection)
    
    // Get default tenant
    const tenant = await getOrCreateDefaultTenant(connection)
    
    // Fetch all users from Clerk
    const clerkUsers = await fetchAllClerkUsers()
    result.totalUsers = clerkUsers.length
    
    console.log(`📊 Found ${clerkUsers.length} users in Clerk`)
    
    // Sync each user
    for (const clerkUser of clerkUsers) {
      try {
        const syncUserResult = await syncSingleUser(connection, clerkUser, tenant.id)
        if (syncUserResult.isNew) {
          result.newUsers++
        } else {
          result.updatedUsers++
        }
        result.syncedUsers++
      } catch (error) {
        const errorMsg = `Failed to sync user ${clerkUser.id}: ${error}`
        console.error(errorMsg)
        result.errors.push(errorMsg)
      }
    }
    
    result.success = result.errors.length === 0
    
    console.log(`✅ User sync completed:`)
    console.log(`   - Total users: ${result.totalUsers}`)
    console.log(`   - Synced users: ${result.syncedUsers}`)
    console.log(`   - New users: ${result.newUsers}`)
    console.log(`   - Updated users: ${result.updatedUsers}`)
    console.log(`   - Errors: ${result.errors.length}`)
    
    return result

  } catch (error) {
    console.error('❌ User sync failed:', error)
    result.errors.push(`Sync operation failed: ${error}`)
    return result
  } finally {
    if (connection) {
      await connection.end()
    }
  }
}

/**
 * Fetch all users from Clerk
 */
async function fetchAllClerkUsers(): Promise<ClerkUser[]> {
  const allUsers: ClerkUser[] = []
  const limit = 100
  let offset = 0
  
  try {
    const client = await clerkClient()
    
    while (true) {
      const response = await client.users.getUserList({
        limit,
        offset
      })
      
      if (response.length === 0) {
        break
      }
      
      allUsers.push(...response.map(user => ({
        id: user.id,
        emailAddresses: user.emailAddresses.map(email => ({
          id: email.id,
          emailAddress: email.emailAddress
        })),
        primaryEmailAddressId: user.primaryEmailAddressId || '',
        firstName: user.firstName || undefined,
        lastName: user.lastName || undefined,
        publicMetadata: user.publicMetadata || {},
        createdAt: user.createdAt,
        lastSignInAt: user.lastSignInAt || undefined,
        imageUrl: user.imageUrl || undefined
      })))
      
      offset += limit
      
      // Break if we got fewer results than requested (last page)
      if (response.length < limit) {
        break
      }
    }
    
    return allUsers
  } catch (error) {
    console.error('Error fetching Clerk users:', error)
    throw error
  }
}

/**
 * Sync a single user to the database
 *
 * B2C Enhancement: Automatically sets verification status for teachers based on email domain
 */
async function syncSingleUser(
  connection: mysql.Connection,
  clerkUser: ClerkUser,
  tenantId: string
): Promise<{ isNew: boolean }> {
  // Get primary email
  const primaryEmail = clerkUser.emailAddresses.find(
    email => email.id === clerkUser.primaryEmailAddressId
  )

  if (!primaryEmail) {
    throw new Error(`No primary email found for user ${clerkUser.id}`)
  }

  // Determine user role
  const role = determineUserRole(clerkUser, primaryEmail.emailAddress)

  // B2C: Extract email domain and check if educational (for teachers)
  const emailDomain = extractEmailDomain(primaryEmail.emailAddress)
  const isEduDomain = isEducationalDomain(primaryEmail.emailAddress)

  // B2C: Determine verification status for teachers
  let verificationStatus: VerificationStatus = 'unverified'
  let verificationMethod: string | null = null
  let verifiedAt: Date | null = null

  if (role === 'teacher' && isEduDomain) {
    verificationStatus = 'verified_email'
    verificationMethod = 'email_domain'
    verifiedAt = new Date()
    console.log(`✅ Auto-verified teacher via educational domain: ${emailDomain}`)
  }

  // B2C: All teachers get instant approval (no manual approval bottleneck)
  const approvalStatus = role === 'teacher' ? 'approved' : 'pending'

  // Check if user already exists
  const [existingUsers] = await connection.execute(
    'SELECT id, role, first_name, last_name FROM users WHERE clerk_id = ?',
    [clerkUser.id]
  ) as any[]

  const now = new Date()
  const lastLogin = clerkUser.lastSignInAt ? new Date(clerkUser.lastSignInAt) : null

  if (existingUsers.length > 0) {
    // Update existing user
    await connection.execute(
      `UPDATE users SET
        email = ?,
        role = ?,
        first_name = ?,
        last_name = ?,
        profile_image_url = ?,
        last_login = ?,
        updated_at = ?
      WHERE clerk_id = ?`,
      [
        primaryEmail.emailAddress,
        role,
        clerkUser.firstName || '',
        clerkUser.lastName || '',
        clerkUser.imageUrl || null,
        lastLogin,
        now,
        clerkUser.id
      ]
    )

    console.log(`📝 Updated user: ${clerkUser.firstName} ${clerkUser.lastName} (${role})`)
    return { isNew: false }
  } else {
    // Create new user with B2C verification fields
    const userId = generateId()

    await connection.execute(
      `INSERT INTO users (
        id, tenant_id, clerk_id, email, role,
        approval_status, verification_status, verification_method, verified_at,
        email_domain, is_educational_domain,
        first_name, last_name, profile_image_url, last_login,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        tenantId,
        clerkUser.id,
        primaryEmail.emailAddress,
        role,
        approvalStatus,
        verificationStatus,
        verificationMethod,
        verifiedAt,
        emailDomain,
        isEduDomain ? 1 : 0,
        clerkUser.firstName || '',
        clerkUser.lastName || '',
        clerkUser.imageUrl || null,
        lastLogin,
        now,
        now
      ]
    )

    console.log(`✨ Created new user: ${clerkUser.firstName} ${clerkUser.lastName} (${role}, verification: ${verificationStatus})`)
    return { isNew: true }
  }
}

/**
 * Determine user role based on Clerk metadata and email
 */
function determineUserRole(clerkUser: ClerkUser, email: string): UserRole {
  // Check metadata first
  const metadataRole = clerkUser.publicMetadata?.role as UserRole
  if (metadataRole && ['admin', 'teacher', 'student', 'parent'].includes(metadataRole)) {
    return metadataRole
  }
  
  // Check for specific role assignments (highest priority)
  const specificRoleAssignments: Record<string, UserRole> = {
    'thevinstitution@gmail.com': 'admin',  // Only admin account
    'bhaarat2050@gmail.com': 'student',    // Normal student account, not admin
  }
  
  if (specificRoleAssignments[email.toLowerCase()]) {
    return specificRoleAssignments[email.toLowerCase()]
  }
  
  // Check for admin emails (legacy support)
  const adminEmails = [
    'thevinstitution@gmail.com',
    'admin@viratgyankosh.com'
  ]
  
  if (adminEmails.includes(email.toLowerCase())) {
    return 'admin'
  }
  
  // Check email domain for teachers
  const teacherDomains = ['.edu', 'school.', 'university.', 'college.']
  if (teacherDomains.some(domain => email.toLowerCase().includes(domain))) {
    return 'teacher'
  }
  
  // Default to student
  return 'student'
}

/**
 * Ensure required database tables exist
 */
async function ensureTablesExist(connection: mysql.Connection) {
  // Create tenants table if not exists
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS tenants (
      id VARCHAR(36) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      domain VARCHAR(255) UNIQUE,
      subscription_plan ENUM('starter', 'pro', 'enterprise') NOT NULL DEFAULT 'starter',
      subscription_status ENUM('active', 'inactive', 'trial') NOT NULL DEFAULT 'trial',
      settings JSON,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `)

  // Create users table if not exists
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id VARCHAR(36) PRIMARY KEY,
      tenant_id VARCHAR(36) NOT NULL,
      clerk_id VARCHAR(255) UNIQUE NOT NULL,
      email VARCHAR(255) NOT NULL,
      role ENUM('admin', 'teacher', 'student', 'parent') NOT NULL,
      first_name VARCHAR(100) NOT NULL,
      last_name VARCHAR(100) NOT NULL,
      class_id VARCHAR(36),
      profile_image_url TEXT,
      preferences JSON,
      last_login TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY unique_tenant_email (tenant_id, email),
      INDEX idx_tenant_role (tenant_id, role),
      INDEX idx_clerk_id (clerk_id)
    )
  `)
}

/**
 * Get or create default tenant
 */
async function getOrCreateDefaultTenant(connection: mysql.Connection) {
  // Check if default tenant exists
  const [tenants] = await connection.execute(
    'SELECT id, name FROM tenants LIMIT 1'
  ) as any[]

  if (tenants.length > 0) {
    return tenants[0]
  }

  // Create default tenant
  const tenantId = generateId()
  await connection.execute(
    `INSERT INTO tenants (id, name, domain, subscription_plan, subscription_status)
     VALUES (?, ?, ?, ?, ?)`,
    [tenantId, 'Virat Gyankosh', 'viratgyankosh.com', 'pro', 'active']
  )

  return { id: tenantId, name: 'Virat Gyankosh' }
}

/**
 * Generate unique ID
 */
function generateId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0
    const v = c == 'x' ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  })
}

/**
 * Sync specific user by Clerk ID
 */
export async function syncUserByClerkId(clerkId: string): Promise<boolean> {
  let connection: mysql.Connection | null = null

  try {
    connection = await mysql.createConnection(dbConfig)
    const tenant = await getOrCreateDefaultTenant(connection)

    const client = await clerkClient()
    const clerkUser = await client.users.getUser(clerkId)

    const mappedUser: ClerkUser = {
      id: clerkUser.id,
      emailAddresses: clerkUser.emailAddresses.map(email => ({
        id: email.id,
        emailAddress: email.emailAddress
      })),
      primaryEmailAddressId: clerkUser.primaryEmailAddressId || '',
      firstName: clerkUser.firstName || undefined,
      lastName: clerkUser.lastName || undefined,
      publicMetadata: clerkUser.publicMetadata || {},
      createdAt: clerkUser.createdAt,
      lastSignInAt: clerkUser.lastSignInAt || undefined,
      imageUrl: clerkUser.imageUrl || undefined
    }

    await syncSingleUser(connection, mappedUser, tenant.id)
    return true

  } catch (error) {
    console.error('Error syncing user by Clerk ID:', error)
    return false
  } finally {
    if (connection) {
      await connection.end()
    }
  }
}
