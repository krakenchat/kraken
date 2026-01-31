import { Module, OnModuleDestroy, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { REDIS_CLIENT } from './redis.constants';

const redisClientProvider = {
  provide: REDIS_CLIENT,
  useFactory: (config: ConfigService): Redis => {
    return new Redis({
      host: config.get('REDIS_HOST') || 'localhost',
      port: parseInt(config.get('REDIS_PORT') || '6379', 10),
      password: config.get('REDIS_PASSWORD') || undefined,
      db: parseInt(config.get('REDIS_DB') || '0', 10),
    });
  },
  inject: [ConfigService],
};

@Module({
  providers: [redisClientProvider],
  exports: [REDIS_CLIENT],
})
export class RedisModule implements OnModuleDestroy {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async onModuleDestroy() {
    await this.redis.quit();
  }
}
