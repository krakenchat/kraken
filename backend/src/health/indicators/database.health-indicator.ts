import { Injectable } from '@nestjs/common';
import { HealthIndicatorResult, HealthCheckError } from '@nestjs/terminus';
import { DatabaseService } from '@/database/database.service';

const CHECK_TIMEOUT_MS = 3000;

@Injectable()
export class DatabaseHealthIndicator {
  constructor(private readonly databaseService: DatabaseService) {}

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      await Promise.race([
        this.databaseService.$executeRaw`SELECT 1`,
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error('Database health check timed out')),
            CHECK_TIMEOUT_MS,
          ),
        ),
      ]);
      return { [key]: { status: 'up' } };
    } catch {
      throw new HealthCheckError('Database check failed', {
        [key]: { status: 'down' },
      });
    }
  }
}
