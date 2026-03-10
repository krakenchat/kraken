import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { RedisModule } from '@/redis/redis.module';
import { DatabaseModule } from '@/database/database.module';
import { DatabaseHealthIndicator } from './indicators/database.health-indicator';
import { RedisHealthIndicator } from './indicators/redis.health-indicator';

@Module({
  imports: [TerminusModule, RedisModule, DatabaseModule],
  controllers: [HealthController],
  providers: [HealthService, DatabaseHealthIndicator, RedisHealthIndicator],
})
export class HealthModule {}
