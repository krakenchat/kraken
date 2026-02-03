import { Injectable, Logger, OnModuleInit, Inject } from '@nestjs/common';
import { REDIS_CLIENT } from '@/redis/redis.constants';
import Redis from 'ioredis';
import { version } from '../../package.json';

@Injectable()
export class HealthService implements OnModuleInit {
  private readonly logger = new Logger(HealthService.name);
  private instanceName: string = 'Kraken Instance'; // Default fallback
  private readonly INSTANCE_NAME_KEY = 'instance:name';

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  /**
   * Load instance name from Redis on module initialization
   * Cache in memory to avoid Redis load on every health check
   */
  async onModuleInit() {
    try {
      const name = await this.redis.get(this.INSTANCE_NAME_KEY);
      if (name) {
        this.instanceName = name;
        this.logger.log(`Loaded instance name from Redis: ${name}`);
      } else {
        this.logger.log(
          'No instance name found in Redis, using default: Kraken Instance',
        );
      }
    } catch (error) {
      this.logger.error('Failed to load instance name from Redis', error);
      // Continue with default name
    }
  }

  /**
   * Get the cached instance name
   * No Redis/DB calls - returns in-memory cached value
   */
  getInstanceName(): string {
    return this.instanceName;
  }

  /**
   * Get health check metadata
   * Returns instance information for validation and monitoring
   */
  getHealthMetadata(): {
    status: string;
    instanceName: string;
    version: string;
    timestamp: string;
  } {
    return {
      status: 'ok',
      instanceName: this.instanceName,
      version,
      timestamp: new Date().toISOString(),
    };
  }
}
