import { describe, it, expect } from 'vitest';
import {
  prependMessageToInfinite,
  updateMessageInInfinite,
  deleteMessageFromInfinite,
  findMessageInInfinite,
  prependMessageToFlat,
  updateMessageInFlat,
  deleteMessageFromFlat,
  findMessageInFlat,
} from '../../utils/messageCacheUpdaters';
import {
  createMessage,
  createInfiniteData,
  createMultiPageInfiniteData,
  createFlatData,
} from '../test-utils';

// --- Infinite (Channel) updaters ---

describe('prependMessageToInfinite', () => {
  it('returns undefined when given undefined', () => {
    const result = prependMessageToInfinite(undefined, createMessage());
    expect(result).toBeUndefined();
  });

  it('prepends a message to the first page', () => {
    const existing = createMessage({ id: 'existing-1' });
    const data = createInfiniteData([existing]);
    const newMsg = createMessage({ id: 'new-1' });

    const result = prependMessageToInfinite(data, newMsg);

    expect(result!.pages[0].messages).toHaveLength(2);
    expect(result!.pages[0].messages[0]).toMatchObject({ id: 'new-1' });
    expect(result!.pages[0].messages[1]).toMatchObject({ id: 'existing-1' });
  });

  it('deduplicates — returns unchanged data when message already exists', () => {
    const msg = createMessage({ id: 'dup-1' });
    const data = createInfiniteData([msg]);

    const result = prependMessageToInfinite(data, createMessage({ id: 'dup-1' }));

    expect(result!.pages[0].messages).toHaveLength(1);
  });

  it('does not mutate the original data', () => {
    const existing = createMessage({ id: 'existing-1' });
    const data = createInfiniteData([existing]);
    const originalRef = data.pages[0].messages;

    prependMessageToInfinite(data, createMessage({ id: 'new-1' }));

    expect(data.pages[0].messages).toBe(originalRef);
    expect(data.pages[0].messages).toHaveLength(1);
  });

  it('handles empty first page', () => {
    const data = createInfiniteData([]);
    const result = prependMessageToInfinite(data, createMessage({ id: 'first' }));

    expect(result!.pages[0].messages).toHaveLength(1);
  });

  it('returns unchanged when pages array has no pages', () => {
    const data = { pages: [], pageParams: [] };
    const result = prependMessageToInfinite(data as never, createMessage());
    // No first page → returns data unchanged
    expect(result).toEqual(data);
  });
});

describe('updateMessageInInfinite', () => {
  it('returns undefined when given undefined', () => {
    expect(updateMessageInInfinite(undefined, createMessage())).toBeUndefined();
  });

  it('replaces the matching message in a single page', () => {
    const msg = createMessage({ id: 'msg-1', authorId: 'old-author' });
    const data = createInfiniteData([msg]);

    const updated = createMessage({ id: 'msg-1', authorId: 'new-author' });
    const result = updateMessageInInfinite(data, updated);

    expect(result!.pages[0].messages[0]).toMatchObject({ authorId: 'new-author' });
  });

  it('updates a message in the second page of multi-page data', () => {
    const page1Msg = createMessage({ id: 'p1-msg' });
    const page2Msg = createMessage({ id: 'p2-msg', authorId: 'old' });
    const data = createMultiPageInfiniteData([
      { messages: [page1Msg] },
      { messages: [page2Msg] },
    ]);

    const updated = createMessage({ id: 'p2-msg', authorId: 'new' });
    const result = updateMessageInInfinite(data, updated);

    expect(result!.pages[1].messages[0]).toMatchObject({ authorId: 'new' });
    // First page unchanged
    expect(result!.pages[0].messages[0]).toMatchObject({ id: 'p1-msg' });
  });

  it('leaves data unchanged when message ID not found', () => {
    const msg = createMessage({ id: 'msg-1' });
    const data = createInfiniteData([msg]);

    const result = updateMessageInInfinite(data, createMessage({ id: 'nonexistent' }));

    expect(result!.pages[0].messages).toHaveLength(1);
    expect(result!.pages[0].messages[0]).toMatchObject({ id: 'msg-1' });
  });
});

describe('deleteMessageFromInfinite', () => {
  it('returns undefined when given undefined', () => {
    expect(deleteMessageFromInfinite(undefined, 'any')).toBeUndefined();
  });

  it('removes the matching message', () => {
    const msg1 = createMessage({ id: 'keep' });
    const msg2 = createMessage({ id: 'remove' });
    const data = createInfiniteData([msg1, msg2]);

    const result = deleteMessageFromInfinite(data, 'remove');

    expect(result!.pages[0].messages).toHaveLength(1);
    expect(result!.pages[0].messages[0]).toMatchObject({ id: 'keep' });
  });

  it('removes from the correct page in multi-page data', () => {
    const data = createMultiPageInfiniteData([
      { messages: [createMessage({ id: 'p1' })] },
      { messages: [createMessage({ id: 'p2-keep' }), createMessage({ id: 'p2-remove' })] },
    ]);

    const result = deleteMessageFromInfinite(data, 'p2-remove');

    expect(result!.pages[0].messages).toHaveLength(1);
    expect(result!.pages[1].messages).toHaveLength(1);
    expect(result!.pages[1].messages[0]).toMatchObject({ id: 'p2-keep' });
  });

  it('leaves data unchanged when message ID not found', () => {
    const data = createInfiniteData([createMessage({ id: 'msg-1' })]);
    const result = deleteMessageFromInfinite(data, 'nonexistent');
    expect(result!.pages[0].messages).toHaveLength(1);
  });
});

describe('findMessageInInfinite', () => {
  it('returns undefined when given undefined', () => {
    expect(findMessageInInfinite(undefined, 'any')).toBeUndefined();
  });

  it('finds a message in the first page', () => {
    const msg = createMessage({ id: 'target' });
    const data = createInfiniteData([msg, createMessage({ id: 'other' })]);

    const result = findMessageInInfinite(data, 'target');
    expect(result).toMatchObject({ id: 'target' });
  });

  it('finds a message across pages', () => {
    const data = createMultiPageInfiniteData([
      { messages: [createMessage({ id: 'p1' })] },
      { messages: [createMessage({ id: 'target' })] },
    ]);

    const result = findMessageInInfinite(data, 'target');
    expect(result).toMatchObject({ id: 'target' });
  });

  it('returns undefined when message not found', () => {
    const data = createInfiniteData([createMessage({ id: 'msg-1' })]);
    expect(findMessageInInfinite(data, 'nonexistent')).toBeUndefined();
  });
});

// --- Flat (DM) updaters ---

describe('prependMessageToFlat', () => {
  it('returns undefined when given undefined', () => {
    expect(prependMessageToFlat(undefined, createMessage())).toBeUndefined();
  });

  it('prepends a message', () => {
    const existing = createMessage({ id: 'existing' });
    const data = createFlatData([existing]);
    const newMsg = createMessage({ id: 'new' });

    const result = prependMessageToFlat(data, newMsg);

    expect(result!.messages).toHaveLength(2);
    expect(result!.messages[0]).toMatchObject({ id: 'new' });
  });

  it('deduplicates', () => {
    const msg = createMessage({ id: 'dup' });
    const data = createFlatData([msg]);

    const result = prependMessageToFlat(data, createMessage({ id: 'dup' }));
    expect(result!.messages).toHaveLength(1);
  });

  it('does not mutate the original data', () => {
    const data = createFlatData([createMessage({ id: 'existing' })]);
    const originalRef = data.messages;

    prependMessageToFlat(data, createMessage({ id: 'new' }));

    expect(data.messages).toBe(originalRef);
    expect(data.messages).toHaveLength(1);
  });
});

describe('updateMessageInFlat', () => {
  it('returns undefined when given undefined', () => {
    expect(updateMessageInFlat(undefined, createMessage())).toBeUndefined();
  });

  it('replaces the matching message', () => {
    const msg = createMessage({ id: 'msg-1', authorId: 'old' });
    const data = createFlatData([msg]);

    const result = updateMessageInFlat(data, createMessage({ id: 'msg-1', authorId: 'new' }));
    expect(result!.messages[0]).toMatchObject({ authorId: 'new' });
  });
});

describe('deleteMessageFromFlat', () => {
  it('returns undefined when given undefined', () => {
    expect(deleteMessageFromFlat(undefined, 'any')).toBeUndefined();
  });

  it('removes the matching message', () => {
    const data = createFlatData([
      createMessage({ id: 'keep' }),
      createMessage({ id: 'remove' }),
    ]);

    const result = deleteMessageFromFlat(data, 'remove');

    expect(result!.messages).toHaveLength(1);
    expect(result!.messages[0]).toMatchObject({ id: 'keep' });
  });
});

describe('findMessageInFlat', () => {
  it('returns undefined when given undefined', () => {
    expect(findMessageInFlat(undefined, 'any')).toBeUndefined();
  });

  it('finds a message', () => {
    const msg = createMessage({ id: 'target' });
    const data = createFlatData([msg, createMessage({ id: 'other' })]);

    expect(findMessageInFlat(data, 'target')).toMatchObject({ id: 'target' });
  });

  it('returns undefined when not found', () => {
    const data = createFlatData([createMessage({ id: 'msg-1' })]);
    expect(findMessageInFlat(data, 'nonexistent')).toBeUndefined();
  });
});
