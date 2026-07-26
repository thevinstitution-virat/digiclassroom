import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { Webhook } from 'svix'
import { autoAssignUserRole } from '@/lib/auth/auto-role-assignment'

// Clerk webhook events we want to handle
type ClerkWebhookEvent = {
  type: 'user.created' | 'user.updated'
  data: {
    id: string
    email_addresses: Array<{
      id: string
      email_address: string
    }>
    primary_email_address_id: string
    first_name?: string
    last_name?: string
    public_metadata: Record<string, any>
  }
}

export async function POST(request: NextRequest) {
  // Get the headers
  const headerPayload = headers()
        // @ts-ignore
  const svix_id = headerPayload.get('svix-id')
        // @ts-ignore
  const svix_timestamp = headerPayload.get('svix-timestamp')
        // @ts-ignore
  const svix_signature = headerPayload.get('svix-signature')

  // If there are no headers, error out
  if (!svix_id || !svix_timestamp || !svix_signature) {
    return NextResponse.json(
      { error: 'Missing svix headers' },
      { status: 400 }
    )
  }

  // Get the body
  const payload = await request.text()
  const body = JSON.parse(payload)

  // Create a new Svix instance with your webhook secret
  const wh = new Webhook(process.env.CLERK_WEBHOOK_SECRET || 'whsec_your_webhook_secret_here')

  let evt: ClerkWebhookEvent

  // Verify the payload with the headers
  try {
    evt = wh.verify(payload, {
      'svix-id': svix_id,
      'svix-timestamp': svix_timestamp,
      'svix-signature': svix_signature,
    }) as ClerkWebhookEvent
  } catch (err) {
    console.error('Error verifying webhook:', err)
    return NextResponse.json(
      { error: 'Invalid webhook signature' },
      { status: 400 }
    )
  }

  // Handle the webhook
  const { type, data } = evt

  try {
    if (type === 'user.created') {
      // New user created - auto-assign role
      await handleUserCreated(data)
    } else if (type === 'user.updated') {
      // User updated - check if they need role assignment
      await handleUserUpdated(data)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Webhook handler error:', error)
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    )
  }
}

async function handleUserCreated(userData: ClerkWebhookEvent['data']) {
  console.log('🎉 New user created:', userData.id)

  // Get primary email
  const primaryEmail = userData.email_addresses.find(
    email => email.id === userData.primary_email_address_id
  )

  if (!primaryEmail) {
    console.error('No primary email found for user:', userData.id)
    return
  }

  // Auto-assign role
  const result = await autoAssignUserRole(
    userData.id,
    primaryEmail.email_address,
    userData.first_name,
    userData.last_name
  )

  if (result.success) {
    console.log(`✅ Auto-assigned role "${result.role}" to new user ${userData.id}`)
  } else {
    console.error(`❌ Failed to auto-assign role to user ${userData.id}:`, result.message)
  }
}

async function handleUserUpdated(userData: ClerkWebhookEvent['data']) {
  // Check if user still needs role assignment
  const hasRole = userData.public_metadata?.role

  if (!hasRole) {
    console.log('🔄 User updated but no role assigned:', userData.id)

    // Get primary email
    const primaryEmail = userData.email_addresses.find(
      email => email.id === userData.primary_email_address_id
    )

    if (primaryEmail) {
      // Auto-assign role
      const result = await autoAssignUserRole(
        userData.id,
        primaryEmail.email_address,
        userData.first_name,
        userData.last_name
      )

      if (result.success) {
        console.log(`✅ Auto-assigned role "${result.role}" to updated user ${userData.id}`)
      } else {
        console.error(`❌ Failed to auto-assign role to updated user ${userData.id}:`, result.message)
      }
    }
  }
}

// Health check endpoint
export async function GET() {
  return NextResponse.json({
    status: 'healthy',
    message: 'Clerk webhook endpoint is active',
    timestamp: new Date().toISOString()
  })
}
