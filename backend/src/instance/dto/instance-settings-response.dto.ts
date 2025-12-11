import { Transform } from 'class-transformer';
import { RegistrationMode, InstanceSettings } from '@prisma/client';

/**
 * Instance settings response DTO with BigInt converted to Number for JSON serialization
 */
export class InstanceSettingsResponseDto implements InstanceSettings {
  id: string;
  name: string;
  description: string | null;
  registrationMode: RegistrationMode;
  createdAt: Date;
  updatedAt: Date;

  @Transform(({ value }) => (value ? Number(value) : 0))
  defaultStorageQuotaBytes: bigint;

  @Transform(({ value }) => (value ? Number(value) : 0))
  maxFileSizeBytes: bigint;

  constructor(partial: Partial<InstanceSettingsResponseDto>) {
    Object.assign(this, partial);
  }
}
