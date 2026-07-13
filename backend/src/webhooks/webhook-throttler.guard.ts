import { Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  InjectThrottlerOptions,
  InjectThrottlerStorage,
  ThrottlerGuard,
  ThrottlerModuleOptions,
  ThrottlerOptions,
  ThrottlerStorage,
} from '@nestjs/throttler';

/**
 * Per-webhook-identity rate limit for the public webhook execute endpoint
 * (`POST /webhooks/:id/:token` — see WebhookExecutionController#execute).
 *
 * This composes with, rather than replaces, the route's existing per-IP
 * `@Throttle({ short, long })` tiers. Those are enforced by the global
 * `APP_GUARD` ThrottlerGuard (see app.module.ts) using the library's
 * default tracker (`req.ip`). A leaked webhook token can still flood a
 * channel by rotating source IPs (botnet / cloud IP churn), so this guard
 * additionally keys on the webhook id itself, independent of source IP.
 * Both guards run on the route and must both pass.
 *
 * ## Key-space separation from the IP-based tiers
 *
 * `ThrottlerGuard#generateKey` (inherited unchanged here) hashes
 * `sha256(`${controllerName}-${handlerName}-${throttlerName}-${tracker}`)`.
 * Two things independently guarantee this guard's Redis keys never collide
 * with the global guard's IP-keyed entries for the same route:
 *   1. Distinct throttler names: this guard uses `webhookShort` /
 *      `webhookLong`, never `short` / `medium` / `long` (the app-wide,
 *      IP-based tier names). The hash input differs on `throttlerName`
 *      alone, before the tracker is even considered.
 *   2. Distinct tracker values: this guard's tracker is `webhook:<id>`,
 *      the global guard's is the request IP — never equal in practice.
 *
 * Distinct names also matter for a second reason: `@Throttle()` metadata
 * (`THROTTLER_LIMIT:<name>` / `THROTTLER_TTL:<name>` etc., set via
 * `Reflect.defineMetadata` on the handler) is read by *any* ThrottlerGuard
 * instance checking that handler, keyed only by throttler name — not by
 * guard identity. Reusing `short`/`long` here would let the existing
 * `@Throttle({ short: {...}, long: {...} })` decorator on the execute
 * route silently override this guard's limits too. Using guard-private
 * names (`webhookShort`/`webhookLong`) makes that impossible: neither
 * guard's metadata can affect the other's tiers.
 *
 * ## Where the limits come from
 *
 * The 10-per-10s / 60-per-60s webhook tiers are hardcoded in
 * `configureWebhookThrottlers()` below rather than sourced from
 * `@Throttle()` route metadata or the global `ThrottlerModuleOptions`
 * ('short'/'medium'/'long' are reserved for app-wide IP-based limiting).
 * Storage is still the shared, injected `ThrottlerStorage` — the
 * Redis-backed, fail-open `FailOpenThrottlerStorage` configured in
 * app.module.ts — so these limits hold across replicas and fail open on a
 * Redis outage exactly like every other tier.
 *
 * ## Test-mode behavior
 *
 * The global `APP_GUARD` ThrottlerGuard is omitted entirely under
 * `NODE_ENV=test` (see app.module.ts). This guard is instead bound
 * directly to the route via `@UseGuards`, so it isn't skipped by that
 * omission — it must skip itself, mirroring the same convention.
 */
@Injectable()
export class WebhookThrottlerGuard extends ThrottlerGuard {
  constructor(
    @InjectThrottlerOptions() options: ThrottlerModuleOptions,
    @InjectThrottlerStorage() storageService: ThrottlerStorage,
    reflector: Reflector,
  ) {
    super(options, storageService, reflector);
    this.configureWebhookThrottlers();
  }

  /**
   * The base class's onModuleInit() derives `this.throttlers` from the
   * injected global ThrottlerModuleOptions (the IP-based 'short'/'medium'/
   * 'long' tiers), which would clobber the fixed webhook tiers set in the
   * constructor if Nest invokes this lifecycle hook for us. Re-applying the
   * same fixed config here keeps behavior correct whether or not Nest calls
   * onModuleInit for a guard resolved via `@UseGuards()` (as opposed to a
   * module `providers` entry).
   */
  onModuleInit(): Promise<void> {
    this.configureWebhookThrottlers();
    return Promise.resolve();
  }

  protected shouldSkip(): Promise<boolean> {
    return Promise.resolve(process.env.NODE_ENV === 'test');
  }

  protected getTracker(req: Record<string, any>): Promise<string> {
    const params = req.params as Record<string, string> | undefined;
    return Promise.resolve(`webhook:${params?.id}`);
  }

  private configureWebhookThrottlers(): void {
    const throttlers: ThrottlerOptions[] = [
      { name: 'webhookShort', ttl: 10_000, limit: 10 },
      { name: 'webhookLong', ttl: 60_000, limit: 60 },
    ];
    // Arrow functions (rather than `this.getTracker.bind(this)`) avoid the
    // `any`-typed return of Function.prototype.bind's lib.es5 overloads,
    // while still capturing `this` lexically.
    const getTracker: ThrottlerOptions['getTracker'] = (
      req: Record<string, any>,
    ) => this.getTracker(req);
    const generateKey: ThrottlerOptions['generateKey'] = (
      context,
      suffix,
      name,
    ) => this.generateKey(context, suffix, name);
    this.throttlers = throttlers;
    this.commonOptions = {
      getTracker,
      generateKey,
    };
  }
}
