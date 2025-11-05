/**
 * Test Analytics Enhancement
 * Verifies that analytics tracking is working correctly
 * 
 * Run: npx tsx scripts/test-analytics-enhancement.ts
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

async function testAnalyticsEnhancement() {
  console.log('🧪 Testing Analytics Enhancement\n');
  console.log('='.repeat(60));

  try {
    // Test 1: Verify services are available
    console.log('\n📋 Test 1: Verify Analytics Service...');
    const { LegacyAgentAdapter } = await import('../src/lib/adapters/legacy-agent-adapter');
    
    await LegacyAgentAdapter.initialize();
    const services = await LegacyAgentAdapter.getServices();
    
    console.log('✅ Analytics service available');

    // Test 2: Test cache hit tracking
    console.log('\n📋 Test 2: Test Cache Hit Tracking...');
    await services.analytics.trackCacheHit('semantic', true);
    console.log('✅ Semantic cache hit tracked');

    await services.analytics.trackCacheHit('database', false);
    console.log('✅ Database cache miss tracked');

    // Test 3: Test event tracking
    console.log('\n📋 Test 3: Test Event Tracking...');
    await services.analytics.trackEvent({
      eventType: 'chat_request',
      userId: 'test_user',
      metadata: {
        menuIntent: 'explain_topic',
        subject: 'Science',
        classLevel: 'Class 9',
        duration: 1500,
        cached: false,
        success: true
      },
      timestamp: new Date()
    });
    console.log('✅ Chat request event tracked');

    // Test 4: Test agent execution tracking
    console.log('\n📋 Test 4: Test Agent Execution Tracking...');
    await services.analytics.trackAgentExecution('TopicExplanationAgent', 2000, true);
    console.log('✅ Agent execution tracked');

    console.log('\n' + '='.repeat(60));
    console.log('🎉 All Analytics Tests Passed!\n');

    console.log('✅ Analytics service is working correctly');
    console.log('✅ Cache hit/miss tracking works');
    console.log('✅ Event tracking works');
    console.log('✅ Agent execution tracking works\n');

    console.log('Next steps:');
    console.log('1. Open your application UI (http://localhost:3001)');
    console.log('2. Sign in and send a test message');
    console.log('3. Check the console logs for:');
    console.log('   - "📊 [Analytics] Request completed in XXXms"');
    console.log('   - Cache hit/miss tracking messages');
    console.log('4. Verify all 6 agents still work correctly\n');

    process.exit(0);

  } catch (error: any) {
    console.error('\n❌ Analytics Test Failed!');
    console.error('Error:', error.message);
    console.error('\n🔧 Troubleshooting:');
    console.error('1. Make sure the dev server is running: npm run dev');
    console.error('2. Check that enterprise services initialized correctly');
    console.error('3. Verify .env file has correct configuration\n');
    process.exit(1);
  }
}

testAnalyticsEnhancement();

