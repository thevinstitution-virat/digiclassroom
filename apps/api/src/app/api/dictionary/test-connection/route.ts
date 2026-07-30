/**
 * Database Connection Test API
 * Tests connection to XAMPP MySQL and verifies database setup
 */

import { NextRequest, NextResponse } from 'next/server'
import { getConnection, executeQuery } from '@/lib/db/connection'

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Testing database connection...')
    
    // Test 1: Basic connection
    let connection
    try {
      connection = await getConnection()
      console.log('✅ Database connection successful')
    } catch (error: any) {
      console.error('❌ Database connection failed:', error)
      return NextResponse.json({
        success: false,
        error: 'Database connection failed',
        details: error.message,
        suggestions: [
          'Ensure XAMPP MySQL is running on port 3306',
          'Check if virat_gyankosh database exists',
          'Verify MySQL credentials in .env.local'
        ]
      }, { status: 500 })
    } finally {
      if (connection) {
        connection.release()
      }
    }

    // Test 2: report which database we are actually connected to.
    // On Postgres the database is fixed by DATABASE_URL — an app cannot create
    // it on demand (CREATE DATABASE cannot run in a transaction and needs
    // rights the app role deliberately does not have). If it were missing,
    // Test 1 above would already have failed to connect.
    try {
      const rows = await executeQuery<{ db: string }>('SELECT current_database() AS db')
      const dbName = rows?.[0]?.db
      console.log(`📊 Connected to database: ${dbName}`)
    } catch (error: any) {
      console.error('❌ Database check failed:', error)
      return NextResponse.json({
        success: false,
        error: 'Database check failed',
        details: error.message
      }, { status: 500 })
    }

    // Test 3: Check if dictionary_words table exists
    let tableExists = false
    let wordCount = 0
    
    try {
      const [tables] = await executeQuery(`
        SELECT COUNT(*) as count 
        FROM information_schema.tables 
        WHERE table_schema = 'virat_gyankosh' 
        AND table_name = 'dictionary_words'
      `)
      
      tableExists = tables && (tables as any)[0]?.count > 0
      console.log(`📚 dictionary_words table exists: ${tableExists}`)
      
      if (tableExists) {
        const [rows] = await executeQuery(`
          SELECT COUNT(*) as count
          FROM virat_gyankosh.dictionary_words
        `)
        wordCount = rows && (rows as any)[0]?.count || 0
        console.log(`📊 Total words in table: ${wordCount}`)
      }
    } catch (error: any) {
      console.error('❌ Table check failed:', error)
      // This is expected if table doesn't exist, so we continue
    }

    // Test 4: MySQL version and configuration
    let mysqlInfo = {}
    try {
      const [versionResult] = await executeQuery('SELECT VERSION() as version')
      const [charsetResult] = await executeQuery('SELECT @@character_set_database as charset')
      const [collationResult] = await executeQuery('SELECT @@collation_database as collation')
      
      mysqlInfo = {
        version: (versionResult as any)[0]?.version,
        charset: (charsetResult as any)[0]?.charset,
        collation: (collationResult as any)[0]?.collation
      }
      console.log('📋 MySQL Info:', mysqlInfo)
    } catch (error) {
      console.error('⚠️ Could not get MySQL info:', error)
    }

    // Test 5: Connection pool status
    const connectionConfig = {
      host: process.env.MYSQL_HOST || 'localhost',
      port: parseInt(process.env.MYSQL_PORT || '3306'),
      user: process.env.MYSQL_USER || 'root',
      database: process.env.MYSQL_DATABASE || 'virat_gyankosh'
    }

    return NextResponse.json({
      success: true,
      message: 'Database connection test completed successfully',
      results: {
        connectionStatus: 'Connected',
        databaseExists: true,
        tableExists,
        wordCount,
        mysqlInfo,
        connectionConfig: {
          ...connectionConfig,
          password: '***' // Hide password in response
        }
      },
      recommendations: tableExists 
        ? wordCount > 0 
          ? ['Database is ready for use']
          : ['Table exists but is empty - run migration to populate with words']
        : ['Table does not exist - run full migration to create and populate']
    })

  } catch (error: any) {
    console.error('❌ Database connection test failed:', error)
    
    return NextResponse.json({
      success: false,
      error: 'Database connection test failed',
      details: error.message,
      troubleshooting: {
        xamppChecks: [
          'Is XAMPP Control Panel running?',
          'Is MySQL service started in XAMPP?',
          'Is MySQL running on port 3306?'
        ],
        databaseChecks: [
          'Does virat_gyankosh database exist?',
          'Are the credentials correct in .env.local?',
          'Can you connect via phpMyAdmin?'
        ],
        networkChecks: [
          'Is localhost accessible?',
          'Are there any firewall restrictions?',
          'Is port 3306 available?'
        ]
      }
    }, { status: 500 })
  }
}

// Handle OPTIONS for CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}
