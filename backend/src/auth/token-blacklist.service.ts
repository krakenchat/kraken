import { Inject, Injectable } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '@/redis/redis.constants';

const BLACKLIST_PREFIX = 'token:blacklist:';

@Injectable()
export class TokenBlacklistService {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  /**
   * Add a token JTI to the blacklist with a TTL matching the token's remaining lifetime.
   * @param jti - The JWT ID to blacklist
   * @param expiresAt - Token expiration timestamp (seconds since epoch)
   */
  async blacklist(jti: string, expiresAt: number): Promise<void> {
    const ttlSeconds = expiresAt - Math.floor(Date.now() / 1000);
    if (ttlSeconds <= 0) {
      // Token already expired, no need to blacklist
      return;
    }
    await this.redis.set(`${BLACKLIST_PREFIX}${jti}`, '1', 'EX', ttlSeconds);
  }

  /**
   * Check if a token JTI is blacklisted.
   */
  async isBlacklisted(jti: string): Promise<boolean> {
    const result = await this.redis.exists(`${BLACKLIST_PREFIX}${jti}`);
    return result === 1;
  }
}
