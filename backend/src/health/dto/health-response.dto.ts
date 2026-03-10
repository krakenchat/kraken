export class HealthCheckDetail {
  status: 'up' | 'down';
}

export class HealthChecks {
  redis: HealthCheckDetail;
  database: HealthCheckDetail;
}

export class HealthResponseDto {
  status: 'ok' | 'degraded';
  instanceName: string;
  version: string;
  timestamp: string;
  checks: HealthChecks;
}
