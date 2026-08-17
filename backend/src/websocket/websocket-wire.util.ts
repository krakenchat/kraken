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
 * event ever carries binary data (`Buffer`/`ArrayBuffer`/`Uint8Array` —
 * socket.io extracts those as binary attachments instead of JSON-encoding
 * them), the roundtrip would corrupt it into `{type:'Buffer',data:[...]}`.
 * No current event in the shared payload map carries binary; exempt such a
 * payload from this normalization if one is ever added.
 *
 * Fixes #440.
 */
export function toWirePayload<T>(payload: T): T {
  if (payload === null || typeof payload !== 'object') return payload;
  return JSON.parse(JSON.stringify(payload)) as T;
}
