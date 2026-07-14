/**
 * `semaphore://` deep link URL parser.
 *
 * This is the security-relevant surface of the deep-link feature: once the
 * `semaphore:` scheme is registered with the OS, ANY application on the
 * user's system — not just Semaphore Chat itself — can hand this process an
 * arbitrary string and ask it to be opened. Nothing here may be trusted.
 *
 * Kept as a standalone, dependency-free module (no `electron` import) so it
 * can be:
 *   - unit tested directly from the frontend vitest suite without an
 *     Electron test harness (there isn't one in this repo), and
 *   - reasoned about in isolation as the one place hostile input is turned
 *     into a typed, safe-to-act-on value.
 *
 * `main.ts` imports this for the actual parsing; it must NEVER navigate the
 * BrowserWindow to a raw deep-link URL — only ever forward the typed
 * `DeepLinkRoute` produced here over IPC.
 */

/** Protocol name as registered with the OS via `app.setAsDefaultProtocolClient`. */
export const DEEP_LINK_PROTOCOL = 'semaphore';

/** Full URL scheme (with trailing colon), as `URL#protocol` reports it. */
export const DEEP_LINK_SCHEME = `${DEEP_LINK_PROTOCOL}:` as const;

/** Prefix used to spot candidate deep-link URLs in argv before parsing. */
const DEEP_LINK_PREFIX = `${DEEP_LINK_SCHEME}//`;

// Generous but finite caps. These exist purely to fail fast/cheaply on
// garbage input (e.g. someone shelling out `open semaphore://$(python3 -c
// "print('a'*10_000_000)")`) before it ever reaches URL parsing or regex
// matching — not because any legitimate deep link approaches these sizes.
const MAX_URL_LENGTH = 2048;
const MAX_SEGMENT_LENGTH = 200;

/**
 * All entity IDs reachable via deep links (community, channel, DM group)
 * are Prisma `String @id @default(uuid())` columns — see
 * backend/prisma/schema.prisma. Deep links therefore validate id SHAPE
 * (must look like a UUID) rather than passing arbitrary strings straight
 * through to the renderer/router.
 *
 * This is a deliberate, if modest, defense-in-depth choice: the app never
 * uses these ids for filesystem access or code execution, so a shape
 * mismatch isn't a memory-safety issue — TanStack Query calls with a
 * bogus id just 404 harmlessly. But this parser is the one place that
 * turns fully-untrusted, OS-wide-reachable input into something the main
 * process forwards and the renderer acts on, so failing closed on anything
 * that isn't shaped like a real id costs nothing and avoids forwarding
 * arbitrary attacker-chosen strings any further than necessary. If the ID
 * scheme ever changes (e.g. a migration to cuid), this regex needs to move
 * with it — a mismatch fails safe (the link silently no-ops) rather than
 * unsafe.
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Invite codes are NOT ids — they're `randomBytes(12).toString('base64url')`
 * (see backend/src/invite/invite.service.ts `generateInviteCode`), i.e.
 * base64url characters, not fixed to exactly 12 chars if that default ever
 * changes. Validated against the base64url alphabet with a generous length
 * cap rather than an exact-length match, for the same fail-safe reasoning
 * as UUIDs above.
 */
const INVITE_CODE_RE = /^[A-Za-z0-9_-]{1,64}$/;

export type DeepLinkRoute =
  | { type: 'community'; communityId: string }
  | { type: 'channel'; communityId: string; channelId: string }
  | { type: 'dm-inbox' }
  | { type: 'dm'; dmGroupId: string }
  | { type: 'invite'; inviteCode: string };

function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

function isInviteCode(value: string): boolean {
  return INVITE_CODE_RE.test(value);
}

/**
 * Whether a single (already percent-decoded) path segment is safe to
 * consider at all. This is a generic pre-filter, not the actual
 * validation — each route case below still validates segment content
 * against a specific allowlist (UUID / invite-code regex, or an exact
 * literal). It exists mainly so traversal/smuggling attempts have one
 * obvious, testable rejection point instead of relying solely on the
 * incidental fact that "../etc/passwd" doesn't match a UUID regex either.
 *
 * Path traversal note: `new URL()` itself already collapses literal `..`
 * and `%2e%2e` segments as part of standard URL path normalization (dot-
 * segment removal applies to non-special schemes with an authority too),
 * so by the time we split `pathname` those are already gone. What it does
 * NOT do is decode `%2f` (encoded `/`) — that arrives as a single opaque
 * segment (e.g. `a%2fb`) and must be rejected after we percent-decode it
 * ourselves, since a decoded slash would otherwise smuggle extra path
 * segments past the split that already happened on the raw string.
 */
function isSafeSegment(segment: string): boolean {
  if (segment.length === 0 || segment.length > MAX_SEGMENT_LENGTH) return false;
  if (segment.includes('/') || segment.includes('\\')) return false;
  if (segment === '.' || segment === '..') return false;
  if (hasControlCharacter(segment)) return false;
  return true;
}

/**
 * Reject control characters (including a decoded null byte). Written as an
 * explicit char-code scan rather than a `/[\x00-\x1f\x7f]/` regex, which
 * trips `eslint no-control-regex`.
 */
function hasControlCharacter(segment: string): boolean {
  for (let i = 0; i < segment.length; i++) {
    const code = segment.charCodeAt(i);
    if (code <= 0x1f || code === 0x7f) return true;
  }
  return false;
}

/**
 * Parse and validate a `semaphore://` deep link into a typed route object.
 *
 * Returns `null` for anything that isn't an exact, well-formed match for
 * one of the known route shapes — wrong scheme, wrong host, wrong segment
 * count, malformed percent-encoding, oversized input, or an id/code that
 * doesn't match its expected shape. Callers must drop `null` results with
 * a log and take no further action; this function never throws.
 */
export function parseDeepLink(rawUrl: unknown): DeepLinkRoute | null {
  if (typeof rawUrl !== 'string' || rawUrl.length === 0) return null;
  if (rawUrl.length > MAX_URL_LENGTH) return null;

  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return null;
  }

  // Exact match only — URL#protocol is always lowercased by the WHATWG URL
  // parser, so this is implicitly case-insensitive on the input scheme.
  if (parsed.protocol !== DEEP_LINK_SCHEME) return null;

  // Unlike special schemes (http/https/...), opaque hosts on a custom
  // scheme are NOT lowercased by the URL parser, so do it ourselves.
  const host = parsed.hostname.toLowerCase();

  let segments: string[];
  try {
    segments = parsed.pathname
      .split('/')
      .filter((segment) => segment.length > 0)
      .map((segment) => decodeURIComponent(segment));
  } catch {
    // Malformed percent-encoding (e.g. a lone "%").
    return null;
  }

  if (!segments.every(isSafeSegment)) return null;

  switch (host) {
    case 'community': {
      if (segments.length === 1) {
        const [communityId] = segments;
        return isUuid(communityId) ? { type: 'community', communityId } : null;
      }
      if (segments.length === 3 && segments[1] === 'channel') {
        const [communityId, , channelId] = segments;
        return isUuid(communityId) && isUuid(channelId)
          ? { type: 'channel', communityId, channelId }
          : null;
      }
      return null;
    }
    case 'direct-messages': {
      if (segments.length === 0) return { type: 'dm-inbox' };
      if (segments.length === 1) {
        const [dmGroupId] = segments;
        return isUuid(dmGroupId) ? { type: 'dm', dmGroupId } : null;
      }
      return null;
    }
    case 'join': {
      if (segments.length === 1) {
        const [inviteCode] = segments;
        return isInviteCode(inviteCode) ? { type: 'invite', inviteCode } : null;
      }
      return null;
    }
    default:
      return null;
  }
}

/**
 * Scan a process argv array (cold-start `process.argv`, or the argv handed
 * to the `second-instance` event) for candidate deep-link URLs. This is a
 * cheap prefix filter, not validation — every match still goes through
 * `parseDeepLink` before being acted on.
 */
export function extractDeepLinkUrls(argv: readonly string[]): string[] {
  return argv.filter(
    (arg): arg is string => typeof arg === 'string' && arg.startsWith(DEEP_LINK_PREFIX)
  );
}
