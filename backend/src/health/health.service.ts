import { Injectable, Logger, OnModuleInit, Inject } from '@nestjs/common';
import { REDIS_CLIENT } from '@/redis/redis.constants';
import Redis from 'ioredis';

@Injectable()
export class HealthService implements OnModuleInit {
  private readonly logger = new Logger(HealthService.name);
  private instanceName: string = 'Semaphore Chat Instance';
  private readonly INSTANCE_NAME_KEY = 'instance:name';

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async onModuleInit() {
    try {
      const name = await this.redis.get(this.INSTANCE_NAME_KEY);
      if (name) {
        this.instanceName = name;
        this.logger.log(`Loaded instance name from Redis: ${name}`);
      } else {
        this.logger.log(
          'No instance name found in Redis, using default: Semaphore Chat Instance',
        );
      }
    } catch (error) {
      this.logger.error('Failed to load instance name from Redis', error);
    }
  }

  getInstanceName(): string {
    return this.instanceName;
  }
}
