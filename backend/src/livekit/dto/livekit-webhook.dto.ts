import {
  IsString,
  IsOptional,
  IsNumber,
  IsEnum,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * LiveKit Webhook Event Types
 *
 * See: https://docs.livekit.io/home/server/webhooks/#events
 */
export enum LiveKitWebhookEvent {
  // Room events
  ROOM_STARTED = 'room_started',
  ROOM_FINISHED = 'room_finished',

  // Participant events
  PARTICIPANT_JOINED = 'participant_joined',
  PARTICIPANT_LEFT = 'participant_left',

  // Egress events
  EGRESS_STARTED = 'egress_started',
  EGRESS_UPDATED = 'egress_updated',
  EGRESS_ENDED = 'egress_ended',
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
 * LiveKit Room Info
 */
export class LiveKitRoomInfo {
  @IsString()
  name: string; // Room name (we use channelId or dmGroupId as room name)

  @IsOptional()
  @IsString()
  sid?: string; // Room session ID

  @IsOptional()
  @IsNumber()
  numParticipants?: number;

  @IsOptional()
  @IsNumber()
  creationTime?: number; // Unix timestamp in nanoseconds
}

/**
 * LiveKit Participant Info
 */
export class LiveKitParticipantInfo {
  @IsString()
  identity: string; // User ID (we set this during token generation)

  @IsOptional()
  @IsString()
  name?: string; // Display name (optional)

  @IsOptional()
  @IsString()
  sid?: string; // Participant session ID

  @IsOptional()
  @IsString()
  metadata?: string; // JSON metadata (for isDeafened, etc.)

  @IsOptional()
  @IsNumber()
  joinedAt?: number; // Unix timestamp in nanoseconds
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
 * Sent by LiveKit server to our webhook endpoint.
 * Different event types include different fields.
 */
export class LiveKitWebhookDto {
  @IsEnum(LiveKitWebhookEvent)
  event: LiveKitWebhookEvent;

  @IsOptional()
  @IsString()
  id?: string; // Webhook event ID

  @IsOptional()
  @IsNumber()
  createdAt?: number; // Unix timestamp when webhook was created

  // Room info (present in room_* and participant_* events)
  @IsOptional()
  @ValidateNested()
  @Type(() => LiveKitRoomInfo)
  room?: LiveKitRoomInfo;

  // Participant info (present in participant_* events)
  @IsOptional()
  @ValidateNested()
  @Type(() => LiveKitParticipantInfo)
  participant?: LiveKitParticipantInfo;

  // Egress info (present in egress_* events)
  @IsOptional()
  @ValidateNested()
  @Type(() => LiveKitEgressInfo)
  egressInfo?: LiveKitEgressInfo;
}
