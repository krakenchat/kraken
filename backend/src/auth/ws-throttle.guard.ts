import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '@/redis/redis.constants';

/**
 * Atomically increments the per-socket counter and, only on the first
 * increment of a window (i.e. when the key was just created), sets a
 * millisecond TTL equal to the window length. Returns the post-increment
 * count. Running this as a single EVAL keeps the "increment + maybe set
 * TTL" sequence atomic without a round trip for a separate NX check.
 */
const INCR_WITH_WINDOW_SCRIPT = `
local current = redis.call('INCR', KEYS[1])
if current == 1 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
end
return current
`;

/**
 * WebSocket rate limiting guard, Redis-backed.
 *
 * Tracks message counts per socket connection using a fixed window stored
 * in Redis (via the shared REDIS_CLIENT), so limits are shared across
 * replicas and survive process restarts. The HTTP ThrottlerGuard doesn't
 * apply to WebSocket gateways, so this provides equivalent protection for
 * WS events.
 *
 * Default: 50 events per 10 seconds per connection.
 *
 * Fails OPEN: if Redis is unreachable or errors, the request is allowed and
 * a warning is logged — rate limiting must never become an availability
 * dependency for the whole app (mirrors FailOpenThrottlerStorage's
 * philosophy for the HTTP throttler).
 */
@Injectable()
export class WsThrottleGuard implements CanActivate {
  private readonly logger = new Logger(WsThrottleGuard.name);
  private readonly maxEventsPerWindow = 50;
  private readonly windowMs = 10000;

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (process.env.NODE_ENV === 'test') {
      return true;
    }

    const client = context.switchToWs().getClient<Socket>();
    const key = `ws:throttle:${client.id}`;

    let count: number;
    try {
      count = (await this.redis.eval(
        INCR_WITH_WINDOW_SCRIPT,
        1,
        key,
        this.windowMs,
      )) as number;
    } catch (error) {
      this.logger.warn(
        `WS throttle store unavailable, failing open (request allowed): ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return true;
    }

    if (count > this.maxEventsPerWindow) {
      this.logger.warn(
        `WebSocket rate limit exceeded for socket ${client.id} (${count}/${this.maxEventsPerWindow} in ${this.windowMs}ms)`,
      );
      throw new WsException('Rate limit exceeded. Please slow down.');
    }

    return true;
  }
}
