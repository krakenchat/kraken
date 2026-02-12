/** Module-scoped index: messageId → contextId (channelId or dmGroupId) */
const index = new Map<string, string>();

export function setMessageContext(messageId: string, contextId: string) {
  index.set(messageId, contextId);
}

export function getMessageContext(messageId: string): string | undefined {
  return index.get(messageId);
}

export function removeMessageContext(messageId: string) {
  index.delete(messageId);
}

/** Bulk-index an array of messages for a context */
export function indexMessages(messages: Array<{ id: string }>, contextId: string) {
  for (const msg of messages) {
    index.set(msg.id, contextId);
  }
}

/** Remove all entries for a given context (used on unmount/cleanup) */
export function clearContextIndex(contextId: string) {
  const toDelete: string[] = [];
  for (const [msgId, ctxId] of index) {
    if (ctxId === contextId) toDelete.push(msgId);
  }
  for (const msgId of toDelete) {
    index.delete(msgId);
  }
}
