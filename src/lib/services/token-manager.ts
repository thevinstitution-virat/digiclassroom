/**
 * Proactive Token Management Service for VG Kosh Google Drive Integration
 * Automatically refreshes tokens before they expire to prevent upload failures
 */

import mysql from 'mysql2/promise'
import { GoogleDriveService } from './google-drive'

interface TokenInfo {
  access_token: string
  refresh_token: string
  expiry_date: Date
  scope: string
}

export class TokenManager {
  private refreshInterval: number
  private intervalId: NodeJS.Timeout | null = null
  private isRefreshing: boolean = false
  private dbConfig: any

  constructor() {
    // Refresh every 50 minutes (tokens expire in 60 minutes)
    this.refreshInterval = 50 * 60 * 1000
    
    this.dbConfig = {
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'virat_gyankosh',
      port: parseInt(process.env.DB_PORT || '3306')
    }
  }

  /**
   * Start the proactive token refresh service
   */
  start(): void {
    if (this.intervalId) {
      console.log('Token refresh service already running')
      return
    }

    console.log('🚀 Starting proactive token refresh service...')
    
    // Initial check
    this.checkAndRefreshTokens()
    
    // Set up interval
    this.intervalId = setInterval(() => {
      this.checkAndRefreshTokens()
    }, this.refreshInterval)

    console.log(`✅ Token refresh service started (checking every ${this.refreshInterval / 60000} minutes)`)
  }

  /**
   * Stop the token refresh service
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
      console.log('🛑 Token refresh service stopped')
    }
  }

  /**
   * Check token expiry and refresh if needed
   */
  private async checkAndRefreshTokens(): Promise<void> {
    if (this.isRefreshing) {
      console.log('Token refresh already in progress, skipping...')
      return
    }

    try {
      this.isRefreshing = true
      
      const tokens = await this.getStoredTokens()
      if (!tokens) {
        console.log('No stored tokens found, skipping refresh')
        return
      }

      const now = new Date()
      const expiryDate = new Date(tokens.expiry_date)
      const timeUntilExpiry = expiryDate.getTime() - now.getTime()
      const minutesUntilExpiry = Math.floor(timeUntilExpiry / (1000 * 60))

      console.log(`🔍 Token check: expires in ${minutesUntilExpiry} minutes`)

      // Refresh if expires in less than 10 minutes
      if (timeUntilExpiry < 10 * 60 * 1000) {
        console.log('🔄 Proactive token refresh needed...')
        await this.refreshTokens(tokens)
        console.log('✅ Proactive token refresh completed successfully')
      } else {
        console.log('✅ Tokens are still valid, no refresh needed')
      }

    } catch (error) {
      console.error('❌ Proactive token refresh failed:', error)
      
      // Log the error for monitoring
      await this.logTokenError(error)
      
    } finally {
      this.isRefreshing = false
    }
  }

  /**
   * Get stored tokens from database
   */
  private async getStoredTokens(): Promise<TokenInfo | null> {
    const connection = await mysql.createConnection(this.dbConfig)
    
    try {
      const [result] = await connection.execute(
        'SELECT access_token, refresh_token, expiry_date, scope FROM google_drive_config WHERE id = ?',
        ['main']
      ) as any[]

      if (result.length === 0) {
        return null
      }

      return result[0] as TokenInfo
    } finally {
      await connection.end()
    }
  }

  /**
   * Refresh tokens using Google Drive service
   */
  private async refreshTokens(currentTokens: TokenInfo): Promise<void> {
    const credentials = {
      access_token: currentTokens.access_token,
      refresh_token: currentTokens.refresh_token,
      expiry_date: new Date(currentTokens.expiry_date).getTime(),
      token_type: 'Bearer',
      scope: currentTokens.scope
    }

    const driveService = new GoogleDriveService(credentials)
    
    // Attempt to refresh the access token
    const newTokens = await driveService.refreshAccessToken()
    
    if (newTokens) {
      await this.updateStoredTokens(newTokens)
      console.log('✅ Tokens updated in database')
    } else {
      throw new Error('Failed to refresh tokens')
    }
  }

  /**
   * Update tokens in database
   */
  private async updateStoredTokens(tokens: any): Promise<void> {
    const connection = await mysql.createConnection(this.dbConfig)
    
    try {
      const expiryDate = new Date(tokens.expiry_date || Date.now() + 3600000) // 1 hour default
      
      await connection.execute(`
        UPDATE google_drive_config 
        SET access_token = ?, expiry_date = ?, updated_at = NOW()
        WHERE id = ?
      `, [tokens.access_token, expiryDate, 'main'])
      
    } finally {
      await connection.end()
    }
  }

  /**
   * Log token refresh errors for monitoring
   */
  private async logTokenError(error: any): Promise<void> {
    try {
      const connection = await mysql.createConnection(this.dbConfig)
      
      await connection.execute(`
        INSERT INTO admin_activity_log (admin_id, action, details, created_at)
        VALUES (?, ?, ?, NOW())
      `, [
        'system',
        'token_refresh_error',
        JSON.stringify({
          error: error.message,
          timestamp: new Date().toISOString(),
          service: 'TokenManager'
        })
      ])
      
      await connection.end()
    } catch (logError) {
      console.error('Failed to log token error:', logError)
    }
  }

  /**
   * Manual token refresh (for testing or emergency use)
   */
  async forceRefresh(): Promise<boolean> {
    try {
      console.log('🔄 Manual token refresh initiated...')
      await this.checkAndRefreshTokens()
      return true
    } catch (error) {
      console.error('❌ Manual token refresh failed:', error)
      return false
    }
  }

  /**
   * Get token status for monitoring
   */
  async getTokenStatus(): Promise<{
    hasTokens: boolean
    expiresIn: number
    isExpired: boolean
    lastRefresh: Date | null
  }> {
    const tokens = await this.getStoredTokens()
    
    if (!tokens) {
      return {
        hasTokens: false,
        expiresIn: 0,
        isExpired: true,
        lastRefresh: null
      }
    }

    const now = new Date()
    const expiryDate = new Date(tokens.expiry_date)
    const expiresIn = Math.max(0, expiryDate.getTime() - now.getTime())
    
    return {
      hasTokens: true,
      expiresIn,
      isExpired: expiresIn <= 0,
      lastRefresh: expiryDate
    }
  }
}

// Singleton instance
export const tokenManager = new TokenManager()

// Auto-start only at runtime, not during build/prerender
// Avoid starting in Next.js build/export or edge environment
const isBuildPhase = !!process.env.NEXT_PHASE || process.env.CI === 'true'
const isVercelBuild = !!process.env.VERCEL && process.env.VERCEL === '1' && process.env.NEXT_PHASE === 'phase-production-build'
const isEdgeRuntime = (process as any).env?.NEXT_RUNTIME === 'edge'

if (process.env.NODE_ENV === 'production' && !isBuildPhase && !isVercelBuild && !isEdgeRuntime) {
  tokenManager.start()
}
