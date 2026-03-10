import { Injectable } from '@nestjs/common';
import { HealthIndicatorResult, HealthCheckError } from '@nestjs/terminus';
import { DatabaseService } from '@/database/database.service';

@Injectable()
export class DatabaseHealthIndicator {
  constructor(private readonly databaseService: DatabaseService) {}

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      await this.databaseService.$executeRaw`SELECT 1`;
      return { [key]: { status: 'up' } };
    } catch {
      throw new HealthCheckError('Database check failed', {
        [key]: { status: 'down' },
      });
    }
  }
}
