import { describe, it, expect, afterEach } from 'vitest';
import {
  setMessageContext,
  getMessageContext,
  removeMessageContext,
  indexMessages,
  clearContextIndex,
} from '../../utils/messageIndex';

// Clean up the module-scoped Map between tests
afterEach(() => {
  clearContextIndex('channel-1');
  clearContextIndex('channel-2');
  clearContextIndex('dm-1');
});

describe('setMessageContext / getMessageContext', () => {
  it('stores and retrieves a context', () => {
    setMessageContext('msg-1', 'channel-1');
    expect(getMessageContext('msg-1')).toBe('channel-1');
  });

  it('returns undefined for unknown message', () => {
    expect(getMessageContext('nonexistent')).toBeUndefined();
  });

  it('overwrites previous context', () => {
    setMessageContext('msg-1', 'channel-1');
    setMessageContext('msg-1', 'channel-2');
    expect(getMessageContext('msg-1')).toBe('channel-2');
  });
});

describe('removeMessageContext', () => {
  it('removes a stored context', () => {
    setMessageContext('msg-1', 'channel-1');
    removeMessageContext('msg-1');
    expect(getMessageContext('msg-1')).toBeUndefined();
  });

  it('is a no-op for unknown message', () => {
    expect(() => removeMessageContext('nonexistent')).not.toThrow();
  });
});

describe('indexMessages', () => {
  it('indexes an array of messages', () => {
    const messages = [{ id: 'msg-1' }, { id: 'msg-2' }, { id: 'msg-3' }];
    indexMessages(messages, 'channel-1');

    expect(getMessageContext('msg-1')).toBe('channel-1');
    expect(getMessageContext('msg-2')).toBe('channel-1');
    expect(getMessageContext('msg-3')).toBe('channel-1');
  });

  it('handles empty array', () => {
    expect(() => indexMessages([], 'channel-1')).not.toThrow();
  });
});

describe('clearContextIndex', () => {
  it('removes all entries for a given context', () => {
    indexMessages([{ id: 'a' }, { id: 'b' }], 'channel-1');
    indexMessages([{ id: 'c' }], 'channel-2');

    clearContextIndex('channel-1');

    expect(getMessageContext('a')).toBeUndefined();
    expect(getMessageContext('b')).toBeUndefined();
    expect(getMessageContext('c')).toBe('channel-2');
  });

  it('is a no-op for unknown context', () => {
    expect(() => clearContextIndex('nonexistent')).not.toThrow();
  });
});
