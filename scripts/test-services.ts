/**
 * Service Initialization Test Script
 * Tests that all services can be initialized correctly
 * Run: npx tsx scripts/test-services.ts
 */

import { Container } from '../src/lib/di/container';
import { registerServices, initializeServices, SERVICE_NAMES } from '../src/lib/di/service-registry';
import type {
  ILLMService,
  IVectorSearchService,
  ICacheService,
  IPreGeneratedAnswersService,
  IUserService,
  IAnalyticsService
} from '../src/lib/services/interfaces';

async function testServices() {
  console.log('🧪 Testing Service Initialization\n');
  console.log('='.repeat(60));
  console.log('');

  try {
    // Step 1: Create container
    console.log('📦 Step 1: Creating DI Container...');
    const container = Container.getInstance();
    console.log('✅ Container created\n');

    // Step 2: Register services
    console.log('📝 Step 2: Registering services...');
    await registerServices(container);
    console.log('✅ Services registered\n');

    // Step 3: Initialize services
    console.log('🔥 Step 3: Initializing services...');
    await initializeServices(container);
    console.log('✅ Services initialized\n');

    // Step 4: Check health
    console.log('🏥 Step 4: Checking service health...');
    const health = container.getHealthStatus();
    console.log('');
    console.log('Service Health Status:');
    console.log('-'.repeat(60));
    
    let healthyCount = 0;
    health.forEach(h => {
      const status = h.healthy ? '✅' : '❌';
      const instances = h.instanceCount > 0 ? `(${h.instanceCount} instances)` : '';
      console.log(`${status} ${h.name.padEnd(30)} ${instances}`);
      if (h.healthy) healthyCount++;
    });
    
    console.log('-'.repeat(60));
    console.log(`Total: ${healthyCount}/${health.length} services healthy\n`);

    // Step 5: Test individual services
    console.log('🔬 Step 5: Testing individual services...\n');

    // Test LLM Service
    try {
      const llmService = await container.resolve<ILLMService>(SERVICE_NAMES.LLM);
      const modelInfo = llmService.getModelInfo();
      console.log(`✅ LLM Service: ${modelInfo.name} (${modelInfo.dimensions}D embeddings)`);
    } catch (error) {
      console.log(`❌ LLM Service: ${error}`);
    }

    // Test Cache Service
    try {
      const cacheService = await container.resolve<ICacheService>(SERVICE_NAMES.CACHE);
      const stats = await cacheService.getStats();
      console.log(`✅ Cache Service: ${stats.hits} hits, ${stats.misses} misses`);
    } catch (error) {
      console.log(`❌ Cache Service: ${error}`);
    }

    // Test Vector Search Service
    try {
      const vectorService = await container.resolve<IVectorSearchService>(SERVICE_NAMES.VECTOR_SEARCH);
      const collectionInfo = await vectorService.getCollectionInfo();
      console.log(`✅ Vector Search Service: ${collectionInfo.name} (${collectionInfo.vectorCount} vectors)`);
    } catch (error) {
      console.log(`❌ Vector Search Service: ${error}`);
    }

    // Test Pre-Gen Answers Service
    try {
      const preGenService = await container.resolve<IPreGeneratedAnswersService>(SERVICE_NAMES.PRE_GEN_ANSWERS);
      const stats = await preGenService.getStats();
      console.log(`✅ Pre-Gen Answers Service: ${stats.total} cached answers`);
    } catch (error) {
      console.log(`❌ Pre-Gen Answers Service: ${error}`);
    }

    // Test User Service
    try {
      const userService = await container.resolve<IUserService>(SERVICE_NAMES.USER);
      const testUser = await userService.getUserContext('test_user_123');
      console.log(`✅ User Service: Retrieved context for ${testUser.userName}`);
    } catch (error) {
      console.log(`❌ User Service: ${error}`);
    }

    // Test Analytics Service
    try {
      const analyticsService = await container.resolve<IAnalyticsService>(SERVICE_NAMES.ANALYTICS);
      await analyticsService.trackEvent({
        eventType: 'test_event',
        userId: 'test_user',
        metadata: { test: true },
        timestamp: new Date()
      });
      console.log(`✅ Analytics Service: Event tracked successfully`);
    } catch (error) {
      console.log(`❌ Analytics Service: ${error}`);
    }

    console.log('');
    console.log('='.repeat(60));
    console.log('🎉 All tests completed!\n');

    // Summary
    if (healthyCount === health.length) {
      console.log('✅ SUCCESS: All services initialized and healthy');
      console.log('✅ Ready to proceed to Phase 2\n');
      process.exit(0);
    } else {
      console.log(`⚠️  WARNING: ${health.length - healthyCount} service(s) unhealthy`);
      console.log('⚠️  Review errors above before proceeding to Phase 2\n');
      process.exit(1);
    }

  } catch (error) {
    console.error('\n❌ FATAL ERROR during service initialization:');
    console.error(error);
    console.error('\n🔧 Troubleshooting:');
    console.error('  1. Check that all environment variables are set (.env file)');
    console.error('  2. Ensure Redis is running: redis-cli ping');
    console.error('  3. Ensure Qdrant is running: curl http://localhost:6333/health');
    console.error('  4. Ensure MySQL is running and database exists');
    console.error('  5. Verify OpenAI API key is valid\n');
    process.exit(1);
  }
}

// Run tests
testServices();

