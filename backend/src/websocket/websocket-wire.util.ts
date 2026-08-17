/**
 * JSON-roundtrip normalization: makes the payload the `@socket.io/redis-adapter`
 * relays between replicas byte-equivalent to what socket.io's default JSON
 * encoding already delivers to same-node clients (Date -> ISO string via
 * `toJSON`, `undefined` object fields dropped, etc).
 *
 * Why this is needed: the Redis adapter uses notepack (msgpack) to relay
 * events between replicas, and notepack has no Date codec — raw `Date`
 * fields on a payload arrive at clients connected to OTHER replicas as `{}`.
 * Same-node clients never touch the adapter, so they get socket.io's
 * default JSON-based encoding instead, where Dates already serialize
 * correctly. This normalizes the payload to that same JSON wire form
 * *before* it reaches the adapter, so both delivery paths agree.
 *
 * Keep this JSON-roundtrip semantics exactly — do not hand-roll a partial
 * recursive Date walk. `JSON.parse(JSON.stringify(...))` is byte-equivalent
 * to the same-node path by construction, since that's the same conversion
 * socket.io's own encoder performs.
 *
 * Caveat: this equivalence holds only for JSON-serializable payloads. If an
 * event ever carries binary data (`Buffer`/`ArrayBuffer`/typed arrays —
 * socket.io extracts those as binary attachments instead of JSON-encoding
 * them), the roundtrip would corrupt it into `{type:'Buffer',data:[...]}`.
 * No current event in the shared payload map carries binary, and this
 * function THROWS if it ever encounters one (anywhere in the payload, at
 * any depth). WebsocketService's emit wrappers catch that throw, log the
 * error, and skip the emit entirely — so the first binary event fails
 * closed (loud error log, nothing delivered) instead of shipping corrupted
 * data unnoticed. If a binary-carrying event is ever added, exempt its
 * payload from this normalization at the emit site.
 *
 * Fixes #440.
 */
export function toWirePayload<T>(payload: T): T {
  if (payload === null || typeof payload !== 'object') return payload;
  return JSON.parse(
    JSON.stringify(payload, function (key, value: unknown) {
      // `this` is the holder object, so `this[key]` is the ORIGINAL value —
      // before JSON.stringify applied its `toJSON` (Buffer.toJSON would have
      // already disguised a Buffer as `{type:'Buffer',data:[...]}` by the
      // time `value` reaches this replacer).
      const original = (this as Record<string, unknown>)[key];
      if (ArrayBuffer.isView(original) || original instanceof ArrayBuffer) {
        throw new TypeError(
          `toWirePayload: WS payload field "${key}" carries binary data ` +
            `(${original.constructor.name}). JSON wire normalization would ` +
            `corrupt it — exempt this event's payload from normalization at ` +
            `the emit site (see websocket-wire.util doc comment).`,
        );
      }
      return value;
    }),
  ) as T;
}
