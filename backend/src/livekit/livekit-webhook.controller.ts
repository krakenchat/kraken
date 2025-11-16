import {
  Controller,
  Post,
  Body,
  Headers,
  Logger,
  BadRequestException,
  RawBodyRequest,
  Req,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WebhookReceiver } from 'livekit-server-sdk';
import { LivekitReplayService } from './livekit-replay.service';
import {
  LiveKitWebhookDto,
  LiveKitWebhookEvent,
  LiveKitEgressStatus,
} from './dto/livekit-webhook.dto';

/**
 * LiveKit Webhook Controller
 *
 * Receives webhook events from LiveKit server for egress status updates.
 * Verifies webhook signatures and delegates to LivekitReplayService.
 *
 * @example
 * Configure in LiveKit Cloud dashboard or self-hosted server:
 * Webhook URL: https://your-domain.com/api/livekit/webhook
 * Secret: [LIVEKIT_WEBHOOK_SECRET from env]
 */
@Controller('livekit')
export class LivekitWebhookController {
  private readonly logger = new Logger(LivekitWebhookController.name);
  private readonly webhookReceiver: WebhookReceiver;

  constructor(
    private readonly configService: ConfigService,
    private readonly livekitReplayService: LivekitReplayService,
  ) {
    const apiKey = this.configService.get<string>('LIVEKIT_API_KEY');
    const apiSecret = this.configService.get<string>('LIVEKIT_API_SECRET');

    if (!apiKey || !apiSecret) {
      this.logger.warn(
        'LIVEKIT_API_KEY or LIVEKIT_API_SECRET not set - webhook signature verification disabled',
      );
    }

    // Initialize webhook receiver with API credentials for signature verification
    // Note: WebhookReceiver uses API secret to verify webhook signatures
    this.webhookReceiver = new WebhookReceiver(
      apiKey || 'insecure-development-key',
      apiSecret || 'insecure-development-secret',
    );
  }

  /**
   * Handle LiveKit webhook events
   *
   * Verifies webhook signature and processes egress_ended events
   *
   * @param req - Raw request (needed for signature verification)
   * @param authorization - Authorization header containing webhook signature
   * @param body - Parsed webhook payload
   */
  @Post('webhook')
  async handleWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('authorization') authorization: string,
    @Body() body: LiveKitWebhookDto,
  ) {
    this.logger.debug(`Received webhook event: ${body.event}`);

    // Verify webhook signature using API credentials
    const apiKey = this.configService.get<string>('LIVEKIT_API_KEY');
    const apiSecret = this.configService.get<string>('LIVEKIT_API_SECRET');

    if (apiKey && apiSecret) {
      try {
        // Extract raw body for signature verification
        const rawBody = req.rawBody?.toString('utf-8') || JSON.stringify(body);

        // Verify signature using LiveKit SDK
        const verified = await this.webhookReceiver.receive(
          rawBody,
          authorization,
        );

        if (!verified) {
          this.logger.warn('Invalid webhook signature');
          throw new BadRequestException('Invalid webhook signature');
        }
      } catch (error) {
        this.logger.error(
          `Webhook signature verification failed: ${error instanceof Error ? error.message : String(error)}`,
        );
        throw new BadRequestException('Webhook verification failed');
      }
    }

    // Handle egress_ended event
    if (body.event === LiveKitWebhookEvent.EGRESS_ENDED) {
      await this.handleEgressEnded(body);
    } else {
      this.logger.debug(`Ignoring webhook event: ${body.event}`);
    }

    return { success: true };
  }

  /**
   * Handle egress_ended webhook event
   *
   * Updates session status in database and notifies user if egress failed
   */
  private async handleEgressEnded(webhook: LiveKitWebhookDto) {
    const { egressInfo } = webhook;
    const { egressId, status, error: errorMessage } = egressInfo;

    this.logger.log(
      `Egress ended: ${egressId} with status: ${status}${errorMessage ? ` (error: ${errorMessage})` : ''}`,
    );

    // Determine if egress completed successfully or failed
    const isFailed =
      status === LiveKitEgressStatus.FAILED ||
      status === LiveKitEgressStatus.ABORTED;

    try {
      // Delegate to replay service to handle the egress end
      await this.livekitReplayService.handleEgressEnded(
        egressId,
        isFailed ? 'failed' : 'stopped',
        errorMessage,
      );

      this.logger.log(`Successfully processed egress_ended for ${egressId}`);
    } catch (serviceError) {
      this.logger.error(
        `Failed to process egress_ended for ${egressId}: ${serviceError instanceof Error ? serviceError.message : String(serviceError)}`,
      );
      // Don't throw - we don't want LiveKit to retry webhooks for internal errors
      // Just log and return success to acknowledge webhook receipt
    }
  }
}
