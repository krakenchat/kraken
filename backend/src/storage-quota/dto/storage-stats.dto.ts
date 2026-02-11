import { IsNumber, IsOptional, Min, Max } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * User storage stats response
 */
export class UserStorageStatsDto {
  userId: string;
  username: string;
  usedBytes: number;
  quotaBytes: number;
  percentUsed: number;
  fileCount: number;
}

/**
 * Paginated user storage list response
 */
export class UserStorageListResponseDto {
  @ApiProperty({ type: [UserStorageStatsDto] })
  users: UserStorageStatsDto[];
  total: number;
}

/**
 * Server hardware stats
 */
export class ServerStatsDto {
  // Memory
  memoryTotalBytes: number;
  memoryUsedBytes: number;
  memoryFreeBytes: number;
  memoryUsedPercent: number;

  // CPU
  cpuCores: number;
  cpuModel: string;
  loadAverage: number[]; // 1, 5, 15 minute averages

  // Disk (root filesystem)
  diskTotalBytes: number;
  diskUsedBytes: number;
  diskFreeBytes: number;
  diskUsedPercent: number;

  // System info
  platform: string;
  hostname: string;
  uptime: number; // seconds
}

/**
 * Storage distribution by usage percentage
 */
export class StorageDistributionDto {
  under25Percent: number;
  under50Percent: number;
  under75Percent: number;
  under90Percent: number;
  over90Percent: number;
}

/**
 * Storage breakdown by resource type
 */
export class StorageByTypeDto {
  type: string;
  bytes: number;
  count: number;
}

/**
 * Instance-wide storage statistics (aggregate, privacy-conscious)
 */
export class InstanceStorageStatsDto {
  // Totals
  totalStorageUsedBytes: number;
  totalFileCount: number;
  totalUserCount: number;

  // Averages
  averageStoragePerUserBytes: number;

  // Distribution (aggregate, not individual)
  userStorageDistribution: StorageDistributionDto;

  // Breakdown by type
  storageByType: StorageByTypeDto[];

  // Instance settings
  defaultQuotaBytes: number;
  maxFileSizeBytes: number;

  // Health indicators
  usersApproachingQuota: number; // > 75%
  usersOverQuota: number; // > 90%

  // Server hardware stats
  server: ServerStatsDto;
}

/**
 * Update user quota request
 */
export class UpdateUserQuotaDto {
  @IsNumber()
  @Min(0)
  quotaBytes: number;
}

/**
 * Update instance storage settings request
 */
export class UpdateStorageSettingsDto {
  @IsOptional()
  @IsNumber()
  @Min(1073741824) // Minimum 1GB
  defaultStorageQuotaBytes?: number;

  @IsOptional()
  @IsNumber()
  @Min(1048576) // Minimum 1MB
  @Max(1073741824) // Maximum 1GB per file
  maxFileSizeBytes?: number;
}

/**
 * Storage quota check result
 */
export class QuotaCheckResultDto {
  canUpload: boolean;
  currentUsedBytes: number;
  quotaBytes: number;
  requestedBytes: number;
  remainingBytes: number;
  message?: string;
}
