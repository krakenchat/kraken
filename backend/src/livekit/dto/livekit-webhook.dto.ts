import {
  IsString,
  IsOptional,
  IsNumber,
  IsEnum,
  IsObject,
} from 'class-validator';

/**
 * LiveKit Webhook Event Types
 */
export enum LiveKitWebhookEvent {
  EGRESS_STARTED = 'egress_started',
  EGRESS_UPDATED = 'egress_updated',
  EGRESS_ENDED = 'egress_ended',
  // Other events exist but we only care about egress for now
}

/**
 * LiveKit Egress Status
 */
export enum LiveKitEgressStatus {
  STARTING = 'EGRESS_STARTING',
  ACTIVE = 'EGRESS_ACTIVE',
  ENDING = 'EGRESS_ENDING',
  COMPLETE = 'EGRESS_COMPLETE',
  FAILED = 'EGRESS_FAILED',
  ABORTED = 'EGRESS_ABORTED',
}

/**
 * LiveKit Egress Info (subset of fields we care about)
 */
export class LiveKitEgressInfo {
  @IsString()
  egressId: string;

  @IsEnum(LiveKitEgressStatus)
  status: LiveKitEgressStatus;

  @IsOptional()
  @IsString()
  error?: string;

  @IsOptional()
  @IsNumber()
  startedAt?: number; // Unix timestamp in nanoseconds

  @IsOptional()
  @IsNumber()
  endedAt?: number; // Unix timestamp in nanoseconds

  @IsOptional()
  @IsNumber()
  updatedAt?: number; // Unix timestamp in nanoseconds
}

/**
 * LiveKit Webhook Payload
 *
 * Sent by LiveKit server to our webhook endpoint
 */
export class LiveKitWebhookDto {
  @IsEnum(LiveKitWebhookEvent)
  event: LiveKitWebhookEvent;

  @IsObject()
  egressInfo: LiveKitEgressInfo;

  @IsOptional()
  @IsString()
  id?: string; // Webhook event ID

  @IsOptional()
  @IsNumber()
  createdAt?: number; // Unix timestamp when webhook was created
}
