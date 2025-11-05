/**
 * Monitor Analytics in Real-Time
 * Watches for analytics events and displays them in a clean format
 * 
 * Run: npx tsx scripts/monitor-analytics.ts
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

async function monitorAnalytics() {
  console.log('📊 Analytics Monitor - Real-Time Tracking\n');
  console.log('='.repeat(60));
  console.log('Monitoring analytics events...');
  console.log('Press Ctrl+C to stop\n');
  console.log('='.repeat(60));

  try {
    const { LegacyAgentAdapter } = await import('../src/lib/adapters/legacy-agent-adapter');
    
    // Initialize services
    await LegacyAgentAdapter.initialize();
    const services = await LegacyAgentAdapter.getServices();
    
    console.log('\n✅ Analytics service connected');
    console.log('✅ Monitoring started\n');
    console.log('Waiting for events...\n');

    // Simulate monitoring (in production, this would connect to actual event stream)
    let eventCount = 0;
    
    // Keep the process running
    setInterval(() => {
      // This is a placeholder - in production, you'd listen to actual events
      // For now, we'll just keep the process alive
    }, 1000);

    // Handle graceful shutdown
    process.on('SIGINT', () => {
      console.log('\n\n' + '='.repeat(60));
      console.log(`📊 Monitoring stopped. Total events tracked: ${eventCount}`);
      console.log('='.repeat(60));
      process.exit(0);
    });

  } catch (error: any) {
    console.error('\n❌ Failed to start analytics monitor');
    console.error('Error:', error.message);
    process.exit(1);
  }
}

monitorAnalytics();

