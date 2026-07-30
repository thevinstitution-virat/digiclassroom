/**
 * Grant Trial Access Script
 * 
 * This script grants full trial access to a specific user by email.
 * It creates a subscription with full access to all boards, classes, and subjects.
 * 
 * Usage: npx tsx scripts/grant-trial-access.ts <email>
 * Example: npx tsx scripts/grant-trial-access.ts bhaarat2050@gmail.com
 */

import { clerkClient } from '@clerk/nextjs/server'
import mysql from 'mysql2/promise'

// Database connection configuration
const dbConfig = {
  host: process.env.DB_HOST || process.env.MYSQL_HOST || 'localhost',
  user: process.env.DB_USER || process.env.MYSQL_USER || 'root',
  password: process.env.DB_PASSWORD || process.env.MYSQL_PASSWORD || '',
  database: process.env.DB_NAME || process.env.MYSQL_DATABASE || 'virat_gyankosh',
  port: parseInt(process.env.DB_PORT || process.env.MYSQL_PORT || '3306')
}

interface UserInfo {
  clerk_id: string
  user_id: string
  email: string
  first_name: string
  last_name: string
}

/**
 * Get user info from Clerk by email
 */
async function getUserByEmail(email: string): Promise<UserInfo | null> {
  try {
    const client = await clerkClient()
    const users = await client.users.getUserList({
      emailAddress: [email]
    })

    if (users.data.length === 0) {
      console.error(`❌ No user found with email: ${email}`)
      return null
    }

    const clerkUser = users.data[0]
    const primaryEmail = clerkUser.emailAddresses.find(
      e => e.id === clerkUser.primaryEmailAddressId
    )

    if (!primaryEmail) {
      console.error(`❌ No primary email found for user`)
      return null
    }

    return {
      clerk_id: clerkUser.id,
      user_id: clerkUser.id, // Using clerk_id as user_id
      email: primaryEmail.emailAddress,
      first_name: clerkUser.firstName || '',
      last_name: clerkUser.lastName || ''
    }
  } catch (error) {
    console.error('Error fetching user from Clerk:', error)
    return null
  }
}

/**
 * Check if user already has a subscription or trial
 */
async function checkExistingSubscription(connection: mysql.Connection, clerkId: string): Promise<boolean> {
  try {
    // Check for active subscription
    const [subscriptions] = await connection.execute(
      `SELECT id, plan_code, subscription_status, expiry_date 
       FROM user_subscriptions 
       WHERE clerk_id = ? 
       AND subscription_status IN ('active', 'trial')
       AND expiry_date > NOW()
       ORDER BY expiry_date DESC
       LIMIT 1`,
      [clerkId]
    ) as any[]

    if (subscriptions.length > 0) {
      const sub = subscriptions[0]
      console.log(`⚠️  User already has an active subscription:`)
      console.log(`   Plan: ${sub.plan_code}`)
      console.log(`   Status: ${sub.subscription_status}`)
      console.log(`   Expires: ${sub.expiry_date}`)
      return true
    }

    // Check for free trial
    const [trials] = await connection.execute(
      `SELECT id, trial_status, trial_end_date, trial_questions_used, trial_questions_limit
       FROM free_trials 
       WHERE clerk_id = ? 
       AND trial_status = 'active'
       AND trial_end_date > NOW()`,
      [clerkId]
    ) as any[]

    if (trials.length > 0) {
      const trial = trials[0]
      console.log(`⚠️  User already has an active free trial:`)
      console.log(`   Questions used: ${trial.trial_questions_used}/${trial.trial_questions_limit}`)
      console.log(`   Expires: ${trial.trial_end_date}`)
      return true
    }

    return false
  } catch (error) {
    console.error('Error checking existing subscription:', error)
    return false
  }
}

/**
 * Create a full access trial subscription
 */
async function createTrialSubscription(
  connection: mysql.Connection,
  userInfo: UserInfo
): Promise<boolean> {
  try {
    const { clerk_id, user_id, email } = userInfo

    // Calculate dates (30 days trial)
    const startDate = new Date()
    const expiryDate = new Date()
    expiryDate.setDate(expiryDate.getDate() + 30) // 30 days trial

    const nextBillingDate = new Date(expiryDate)

    console.log(`\n📝 Creating trial subscription...`)
    console.log(`   User: ${email}`)
    console.log(`   Clerk ID: ${clerk_id}`)
    console.log(`   Start Date: ${startDate.toISOString()}`)
    console.log(`   Expiry Date: ${expiryDate.toISOString()}`)

    // Insert subscription
    const [result] = await connection.execute(
      `INSERT INTO user_subscriptions (
        user_id, clerk_id, subscription_plan_id, subscription_type, subscription_status,
        purchased_board, purchased_class, class_access_type, purchased_subjects,
        plan_name, plan_code, monthly_price, billing_cycle, daily_question_limit,
        start_date, expiry_date, next_billing_date, payment_status, payment_gateway,
        transaction_id, auto_renew
      ) VALUES (?, ?, NULL, 'full_access', 'active', 'ALL', NULL, 'all', NULL, 
        'Full Access Trial', 'TRIAL_FULL_ACCESS', 0.00, 'monthly', 30, 
        ?, ?, ?, 'paid', 'manual', ?, FALSE)
      RETURNING id`,
      [
        user_id,
        clerk_id,
        startDate,
        expiryDate,
        nextBillingDate,
        `trial_${Date.now()}`
      ]
    ) as any[]

    const subscriptionId = result.insertId

    console.log(`✅ Subscription created with ID: ${subscriptionId}`)

    // Create subscription history entry
    await connection.execute(
      `INSERT INTO subscription_history (
        user_id, clerk_id, subscription_id, action, new_plan_code, new_status,
        amount, transaction_id, changed_by, reason
      ) VALUES (?, ?, ?, 'created', 'TRIAL_FULL_ACCESS', 'active', 0.00, ?, 'admin', 'Manual trial grant')`,
      [user_id, clerk_id, subscriptionId, `trial_${Date.now()}`]
    )

    console.log(`✅ Subscription history entry created`)

    return true
  } catch (error) {
    console.error('❌ Error creating trial subscription:', error)
    return false
  }
}

/**
 * Main function
 */
async function main() {
  const email = process.argv[2]

  if (!email) {
    console.error('❌ Please provide an email address')
    console.log('Usage: npx tsx scripts/grant-trial-access.ts <email>')
    console.log('Example: npx tsx scripts/grant-trial-access.ts bhaarat2050@gmail.com')
    process.exit(1)
  }

  console.log(`\n🚀 Granting trial access to: ${email}\n`)

  let connection: mysql.Connection | null = null

  try {
    // Step 1: Get user from Clerk
    console.log(`📋 Step 1: Fetching user from Clerk...`)
    const userInfo = await getUserByEmail(email)

    if (!userInfo) {
      console.error(`❌ Failed to fetch user from Clerk`)
      process.exit(1)
    }

    console.log(`✅ User found:`)
    console.log(`   Name: ${userInfo.first_name} ${userInfo.last_name}`)
    console.log(`   Email: ${userInfo.email}`)
    console.log(`   Clerk ID: ${userInfo.clerk_id}`)

    // Step 2: Connect to database
    console.log(`\n📋 Step 2: Connecting to database...`)
    connection = await mysql.createConnection(dbConfig)
    console.log(`✅ Database connected`)

    // Step 3: Check existing subscription
    console.log(`\n📋 Step 3: Checking for existing subscriptions...`)
    const hasExisting = await checkExistingSubscription(connection, userInfo.clerk_id)

    if (hasExisting) {
      console.log(`\n⚠️  User already has an active subscription or trial.`)
      console.log(`   If you want to replace it, please manually delete the existing subscription first.`)
      process.exit(0)
    }

    console.log(`✅ No existing subscription found`)

    // Step 4: Create trial subscription
    console.log(`\n📋 Step 4: Creating trial subscription...`)
    const success = await createTrialSubscription(connection, userInfo)

    if (!success) {
      console.error(`❌ Failed to create trial subscription`)
      process.exit(1)
    }

    // Step 5: Verify subscription
    console.log(`\n📋 Step 5: Verifying subscription...`)
    const [subscriptions] = await connection.execute(
      `SELECT plan_code, subscription_status, daily_question_limit, expiry_date
       FROM user_subscriptions
       WHERE clerk_id = ?
       ORDER BY created_at DESC
       LIMIT 1`,
      [userInfo.clerk_id]
    ) as any[]

    if (subscriptions.length > 0) {
      const sub = subscriptions[0]
      console.log(`✅ Subscription verified:`)
      console.log(`   Plan: ${sub.plan_code}`)
      console.log(`   Status: ${sub.subscription_status}`)
      console.log(`   Daily Limit: ${sub.daily_question_limit} questions`)
      console.log(`   Expires: ${sub.expiry_date}`)
    }

    console.log(`\n🎉 SUCCESS! Trial access granted to ${email}`)
    console.log(`\n📝 Next steps:`)
    console.log(`   1. User can now log in and use the AI Tutor`)
    console.log(`   2. User has access to ALL boards, classes, and subjects`)
    console.log(`   3. User can ask up to 30 questions per day`)
    console.log(`   4. Trial expires in 30 days`)

  } catch (error) {
    console.error(`\n❌ Error:`, error)
    process.exit(1)
  } finally {
    if (connection) {
      await connection.end()
      console.log(`\n🔌 Database connection closed`)
    }
  }
}

// Run the script
main()

