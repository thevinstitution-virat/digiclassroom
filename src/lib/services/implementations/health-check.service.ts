/**
 * Health Check Service Implementation
 * Monitors health of all services
 * Features:
 * - Individual service health checks
 * - Aggregate health status
 * - Latency measurement
 * - Error tracking
 */

import type { IHealthCheckService, HealthCheckResult } from '../interfaces';
import type { Container } from '@/lib/di/container';
import { SERVICE_NAMES } from '@/lib/di/service-registry';

export class HealthCheckService implements IHealthCheckService {
  private container: Container;

  constructor(container: Container) {
    this.container = container;
    console.log('✅ Health Check Service initialized');
  }

  async checkHealth(serviceName: string): Promise<HealthCheckResult> {
    const startTime = Date.now();

    try {
      // Try to resolve service
      const service = await this.container.resolve(serviceName);

      // Service exists and can be resolved
      const latency = Date.now() - startTime;

      return {
        service: serviceName,
        healthy: true,
        latency,
        lastChecked: new Date()
      };

    } catch (error) {
      const latency = Date.now() - startTime;

      return {
        service: serviceName,
        healthy: false,
        latency,
        error: error instanceof Error ? error.message : 'Unknown error',
        lastChecked: new Date()
      };
    }
  }

  async checkAllServices(): Promise<HealthCheckResult[]> {
    const serviceNames = Object.values(SERVICE_NAMES);

    const results = await Promise.all(
      serviceNames.map(name => this.checkHealth(name))
    );

    // Log summary
    const healthyCount = results.filter(r => r.healthy).length;
    const totalCount = results.length;

    console.log(`🏥 Health Check: ${healthyCount}/${totalCount} services healthy`);

    return results;
  }
}

