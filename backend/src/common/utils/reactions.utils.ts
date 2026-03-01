/**
 * Groups flat MessageReaction rows into the { emoji, userIds[] } format
 * expected by the frontend and WebSocket payloads.
 */
export function groupReactions(
  reactions: { emoji: string; userId: string }[],
): { emoji: string; userIds: string[] }[] {
  const map = new Map<string, string[]>();
  for (const r of reactions) {
    if (!map.has(r.emoji)) map.set(r.emoji, []);
    map.get(r.emoji)!.push(r.userId);
  }
  return Array.from(map, ([emoji, userIds]) => ({ emoji, userIds }));
}
