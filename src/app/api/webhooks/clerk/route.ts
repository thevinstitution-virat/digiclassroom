/**
 * Clerk Webhook Handler
 * Automatically syncs users when they are created or updated in Clerk
 *
 * B2C Enhancement: Automatically verifies teachers via email domain detection
 * and sets verification_status in Clerk metadata for instant access
 */

import { NextRequest, NextResponse } from 'next/server'
import { Webhook } from 'svix'
import { headers } from 'next/headers'
import { clerkClient } from '@clerk/nextjs/server'
import { syncUserByClerkId } from '@/lib/auth/user-sync'
import { autoAssignUserRole } from '@/lib/auth/auto-role-assignment'
import { isEducationalDomain } from '@/lib/services/teacher-verification-service'

const webhookSecret = process.env.CLERK_WEBHOOK_SECRET

if (!webhookSecret) {
  throw new Error('Please add CLERK_WEBHOOK_SECRET from Clerk Dashboard to .env or .env.local')
}

export async function POST(req: NextRequest) {
  // Get the headers
  const headerPayload = headers()
  const svix_id = headerPayload.get('svix-id')
  const svix_timestamp = headerPayload.get('svix-timestamp')
  const svix_signature = headerPayload.get('svix-signature')

  // If there are no headers, error out
  if (!svix_id || !svix_timestamp || !svix_signature) {
    return new Response('Error occured -- no svix headers', {
      status: 400,
    })
  }

  // Get the body
  const payload = await req.json()
  const body = JSON.stringify(payload)

  // Create a new Svix instance with your secret.
  const wh = new Webhook(webhookSecret)

  let evt: any

  // Verify the payload with the headers
  try {
    evt = wh.verify(body, {
      'svix-id': svix_id,
      'svix-timestamp': svix_timestamp,
      'svix-signature': svix_signature,
    }) as any
  } catch (err) {
    console.error('Error verifying webhook:', err)
    return new Response('Error occured', {
      status: 400,
    })
  }

  // Handle the webhook
  const { id } = evt.data
  const eventType = evt.type

  console.log(`🔔 Webhook received: ${eventType} for user ${id}`)

  try {
    switch (eventType) {
      case 'user.created':
        await handleUserCreated(evt.data)
        break
      case 'user.updated':
        await handleUserUpdated(evt.data)
        break
      case 'user.deleted':
        await handleUserDeleted(evt.data)
        break
      default:
        console.log(`Unhandled webhook event type: ${eventType}`)
    }

    return NextResponse.json({ 
      success: true, 
      message: `Webhook ${eventType} processed successfully` 
    })

  } catch (error) {
    console.error(`Error processing webhook ${eventType}:`, error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Webhook processing failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

/**
 * Handle user created webhook
 *
 * B2C Enhancement: Automatically verifies teachers and updates Clerk metadata
 */
async function handleUserCreated(userData: any) {
  console.log('👤 Processing user.created webhook:', userData.id)

  try {
    // Get primary email
    const primaryEmail = userData.email_addresses?.find(
      (email: any) => email.id === userData.primary_email_address_id
    )

    if (!primaryEmail) {
      console.error('No primary email found for user:', userData.id)
      return
    }

    // Auto-assign role based on email
    const roleResult = await autoAssignUserRole(
      userData.id,
      primaryEmail.email_address,
      userData.first_name,
      userData.last_name
    )

    console.log(`✅ Role assignment result:`, roleResult)

    // B2C: If user is a teacher, set verification status in Clerk metadata
    if (roleResult.role === 'teacher') {
      const isEduDomain = isEducationalDomain(primaryEmail.email_address)
      const verificationStatus = isEduDomain ? 'verified_email' : 'unverified'

      const client = await clerkClient()
      await client.users.updateUserMetadata(userData.id, {
        publicMetadata: {
          ...userData.public_metadata,
          role: roleResult.role,
          approvalStatus: 'approved', // B2C: Instant approval for all teachers
          verificationStatus: verificationStatus,
          isEducationalDomain: isEduDomain,
        }
      })

      console.log(`✅ Teacher verification status set to: ${verificationStatus} (edu domain: ${isEduDomain})`)
    }

    // Sync user to database (includes verification fields)
    const syncSuccess = await syncUserByClerkId(userData.id)

    if (syncSuccess) {
      console.log(`✅ User ${userData.id} synced to database successfully`)
    } else {
      console.error(`❌ Failed to sync user ${userData.id} to database`)
    }

  } catch (error) {
    console.error('Error in handleUserCreated:', error)
    throw error
  }
}

/**
 * Handle user updated webhook
 */
async function handleUserUpdated(userData: any) {
  console.log('📝 Processing user.updated webhook:', userData.id)
  
  try {
    // Sync updated user to database
    const syncSuccess = await syncUserByClerkId(userData.id)
    
    if (syncSuccess) {
      console.log(`✅ User ${userData.id} updated in database successfully`)
    } else {
      console.error(`❌ Failed to update user ${userData.id} in database`)
    }

  } catch (error) {
    console.error('Error in handleUserUpdated:', error)
    throw error
  }
}

/**
 * Handle user deleted webhook
 */
async function handleUserDeleted(userData: any) {
  console.log('🗑️ Processing user.deleted webhook:', userData.id)
  
  try {
    // Note: In a production system, you might want to soft-delete users
    // or handle this differently based on your business requirements
    console.log(`User ${userData.id} was deleted from Clerk`)
    
    // For now, we'll just log this event
    // In the future, you could implement soft deletion or cleanup logic here
    
  } catch (error) {
    console.error('Error in handleUserDeleted:', error)
    throw error
  }
}

/**
 * GET handler for webhook endpoint verification
 */
export async function GET() {
  return NextResponse.json({ 
    message: 'Clerk webhook endpoint is active',
    timestamp: new Date().toISOString()
  })
}
