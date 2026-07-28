import { db } from '../packages/core/src/db'
import { session, user } from '../packages/core/src/db/schema'
import { auth } from '../packages/core/src/auth'
import { desc } from 'drizzle-orm'

async function debugSession() {
  console.log('=== DEBUG SESSION START ===')
  
  // 1. Get latest sessions from DB
  const latestSessions = await db.query.session.findMany({
    orderBy: [desc(session.createdAt)],
    limit: 5,
  })
  
  console.log(`Found ${latestSessions.length} sessions in DB:`)
  for (const s of latestSessions) {
    const now = new Date()
    const isExpired = s.expiresAt < now
    console.log({
      id: s.id,
      token: s.token.slice(0, 10) + '...',
      userId: s.userId,
      expiresAt: s.expiresAt.toISOString(),
      now: now.toISOString(),
      isExpired,
      createdAt: s.createdAt?.toISOString(),
    })

    // Test auth.api.getSession with this session token cookie
    const dummyHeaders = new Headers({
      cookie: `better-auth.session_token=${s.token}`,
    })
    
    try {
      const authSession = await auth.api.getSession({ headers: dummyHeaders })
      console.log(`[auth.api.getSession result for token ${s.token.slice(0, 10)}...]:`, authSession ? 'FOUND (User: ' + authSession.user.email + ')' : 'NULL (NOT FOUND)')
    } catch (err) {
      console.error('[auth.api.getSession error]:', err)
    }
  }

  // 2. Get latest users
  const latestUsers = await db.query.user.findMany({
    orderBy: [desc(user.createdAt)],
    limit: 5,
  })
  console.log(`Found ${latestUsers.length} users in DB:`)
  for (const u of latestUsers) {
    console.log({ id: u.id, email: u.email, name: u.name, role: u.role })
  }

  process.exit(0)
}

debugSession().catch(err => {
  console.error(err)
  process.exit(1)
})
