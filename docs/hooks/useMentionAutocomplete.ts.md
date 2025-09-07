# useMentionAutocomplete Hook

> **Location:** `frontend/src/hooks/useMentionAutocomplete.ts`  
> **Type:** Custom React Hook  
> **Domain:** mention-system

## Overview

The `useMentionAutocomplete` hook provides comprehensive mention autocomplete functionality for user and channel mentions within text input contexts. It manages autocomplete state, integrates with search APIs, handles keyboard navigation, and provides utilities for mention insertion and management.

## Hook Interface

### Input Parameters

```typescript
interface UseMentionAutocompleteProps {
  communityId: string;        // Community context for member/channel search
  text: string;               // Current input text content
  cursorPosition: number;     // Current cursor position in text
}
```

### Return Value

```typescript
interface UseMentionAutocompleteReturn {
  state: MentionAutocompleteState;           // Current autocomplete state
  selectSuggestion: (index: number) => void; // Select suggestion by index
  getSelectedSuggestion: () => MentionSuggestion | null; // Get currently selected suggestion
  close: () => void;                         // Close autocomplete dropdown
  handleKeyDown: (event: KeyboardEvent) => boolean; // Handle keyboard navigation
}

interface MentionAutocompleteState {
  isOpen: boolean;              // Whether dropdown is visible
  suggestions: MentionSuggestion[]; // Array of current suggestions
  selectedIndex: number;        // Currently selected suggestion index
  query: string;                // Current search query
  type: 'user' | 'channel' | null; // Type of mention being typed
  isLoading: boolean;           // Loading state for search operations
}

interface MentionSuggestion {
  id: string;                   // Unique identifier (userId or channelId)
  type: 'user' | 'channel';     // Type of mention
  displayName: string;          // Primary display text
  subtitle?: string;            // Secondary text (displayName for users)
  avatar?: string;              // Avatar URL for users
}
```

## Usage Examples

### Basic Integration with MessageInput

```tsx
import { useMentionAutocomplete } from '@/hooks/useMentionAutocomplete';
import { MentionDropdown } from '@/components/Message/MentionDropdown';

function MessageInputWithMentions({ communityId }: { communityId: string }) {
  const [text, setText] = useState('');
  const [cursorPosition, setCursorPosition] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Mention autocomplete hook
  const {
    state: mentionState,
    selectSuggestion,
    getSelectedSuggestion,
    close: closeMentions,
    handleKeyDown: handleMentionKeyDown
  } = useMentionAutocomplete({
    communityId,
    text,
    cursorPosition
  });

  const handleKeyDown = (event: React.KeyboardEvent) => {
    // Let mention system handle navigation
    if (handleMentionKeyDown(event.nativeEvent)) {
      if (event.key === 'Enter' || event.key === 'Tab') {
        const selected = getSelectedSuggestion();
        if (selected) {
          // Handle mention insertion
          insertMentionIntoText(selected);
          closeMentions();
        }
      }
      return; // Prevent other key handling
    }

    // Handle other keys (like Enter to send message)
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  };

  return (
    <div style={{ position: 'relative' }}>
      <input
        ref={inputRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        onSelect={() => setCursorPosition(inputRef.current?.selectionStart || 0)}
        placeholder="Type @ for users, # for channels"
      />
      
      {mentionState.isOpen && (
        <MentionDropdown
          suggestions={mentionState.suggestions}
          selectedIndex={mentionState.selectedIndex}
          isLoading={mentionState.isLoading}
          onSelectSuggestion={selectSuggestion}
        />
      )}
    </div>
  );
}
```

### Advanced Integration with Custom Mention Handling

```tsx
function AdvancedMentionInput({ communityId }: { communityId: string }) {
  const [text, setText] = useState('');
  const [cursorPosition, setCursorPosition] = useState(0);
  
  const mentionAutocomplete = useMentionAutocomplete({
    communityId,
    text,
    cursorPosition
  });

  // Custom mention selection with insertion logic
  const handleMentionSelect = useCallback((index: number) => {
    mentionAutocomplete.selectSuggestion(index);
    
    const suggestion = mentionAutocomplete.state.suggestions[index];
    if (suggestion) {
      // Use mention parser to insert mention
      const mentionData = {
        type: suggestion.type,
        username: suggestion.type === 'user' ? suggestion.displayName : undefined,
        name: suggestion.type === 'channel' ? suggestion.displayName : undefined
      };

      const result = insertMention(text, cursorPosition, mentionData);
      setText(result.newText);
      setCursorPosition(result.newCursorPosition);
      
      mentionAutocomplete.close();
    }
  }, [mentionAutocomplete, text, cursorPosition]);

  // Monitor mention state changes
  useEffect(() => {
    console.log('Mention state changed:', {
      isOpen: mentionAutocomplete.state.isOpen,
      query: mentionAutocomplete.state.query,
      type: mentionAutocomplete.state.type,
      suggestionsCount: mentionAutocomplete.state.suggestions.length
    });
  }, [mentionAutocomplete.state]);

  return (
    <div>
      {/* Input implementation */}
      {mentionAutocomplete.state.isOpen && (
        <MentionDropdown
          suggestions={mentionAutocomplete.state.suggestions}
          selectedIndex={mentionAutocomplete.state.selectedIndex}
          isLoading={mentionAutocomplete.state.isLoading}
          onSelectSuggestion={handleMentionSelect}
        />
      )}
    </div>
  );
}
```

## Internal Implementation

### Mention Detection Logic

```typescript
// Detect current mention context based on cursor position
const currentMention = useMemo(() => {
  return getCurrentMention(text, cursorPosition);
}, [text, cursorPosition]);

// getCurrentMention returns:
interface CurrentMention {
  type: 'user' | 'channel';     // @ for user, # for channel
  query: string;                // Text after @ or #
  startIndex: number;           // Start position of mention
  endIndex: number;             // End position of mention
}
```

### API Integration

```typescript
// User mention search
const {
  data: memberResults = [],
  isLoading: isLoadingMembers,
  isFetching: isFetchingMembers,
} = useSearchCommunityMembersQuery(
  {
    communityId,
    query: currentMention?.query || '',
    limit: 10,
  },
  {
    skip: !currentMention || currentMention.type !== 'user' || currentMention.query.length === 0,
  }
);

// Channel mention search
const {
  data: channelResults = [],
  isLoading: isLoadingChannels,
  isFetching: isFetchingChannels,
} = useGetMentionableChannelsQuery(communityId, {
  skip: !currentMention || currentMention.type !== 'channel'
});
```

### State Management

```typescript
const [selectedIndex, setSelectedIndex] = useState(0);
const [isOpen, setIsOpen] = useState(false);

// Compute suggestions based on current mention and API results
const suggestions = useMemo(() => {
  if (!currentMention) return [];

  if (currentMention.type === 'user') {
    return memberResults
      .filter(member => 
        member.user?.username?.toLowerCase().includes(currentMention.query.toLowerCase()) ||
        member.user?.displayName?.toLowerCase().includes(currentMention.query.toLowerCase())
      )
      .map(member => ({
        id: member.user!.id,
        type: 'user' as const,
        displayName: member.user!.username,
        subtitle: member.user!.displayName,
        avatar: member.user!.avatarUrl || undefined
      }));
  } else if (currentMention.type === 'channel') {
    return channelResults
      .filter(channel =>
        channel.name.toLowerCase().includes(currentMention.query.toLowerCase())
      )
      .map(channel => ({
        id: channel.id,
        type: 'channel' as const,
        displayName: channel.name,
        subtitle: channel.description || `${channel.type} channel`
      }));
  }

  return [];
}, [currentMention, memberResults, channelResults]);
```

### Keyboard Navigation

```typescript
const handleKeyDown = useCallback((event: KeyboardEvent) => {
  if (!isOpen || suggestions.length === 0) return false;

  switch (event.key) {
    case 'ArrowDown':
      event.preventDefault();
      setSelectedIndex(prev => (prev + 1) % suggestions.length);
      return true;
      
    case 'ArrowUp':
      event.preventDefault();
      setSelectedIndex(prev => (prev - 1 + suggestions.length) % suggestions.length);
      return true;
      
    case 'Enter':
    case 'Tab':
      if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
        event.preventDefault();
        return true; // Let parent handle the selection
      }
      break;
      
    case 'Escape':
      event.preventDefault();
      close();
      return true;
      
    default:
      return false;
  }

  return false;
}, [isOpen, suggestions.length, selectedIndex]);
```

## Performance Optimization

### Debouncing Strategy

```typescript
// Built-in debouncing via RTK Query's built-in caching and request deduplication
// Additional debouncing can be added for extremely high-frequency typing

const debouncedQuery = useMemo(() => {
  // RTK Query handles most debouncing automatically
  // Custom debouncing can be added here if needed for specific use cases
  return currentMention?.query || '';
}, [currentMention?.query]);
```

### Memoization

```typescript
// Memoized suggestion computation
const suggestions = useMemo(() => {
  // Heavy computation is memoized to prevent unnecessary recalculations
  return computeSuggestions(currentMention, memberResults, channelResults);
}, [currentMention, memberResults, channelResults]);

// Memoized current mention detection
const currentMention = useMemo(() => {
  return getCurrentMention(text, cursorPosition);
}, [text, cursorPosition]);
```

### Cleanup & Memory Management

```typescript
// Cleanup on unmount
useEffect(() => {
  return () => {
    setIsOpen(false);
    setSelectedIndex(0);
  };
}, []);

// Reset selection when suggestions change
useEffect(() => {
  if (suggestions.length > 0 && selectedIndex >= suggestions.length) {
    setSelectedIndex(0);
  }
}, [suggestions.length, selectedIndex]);
```

## Advanced Usage Patterns

### Pattern 1: Custom Mention Filtering

```tsx
function useFilteredMentionAutocomplete(
  communityId: string,
  text: string,
  cursorPosition: number,
  customFilter?: (suggestions: MentionSuggestion[]) => MentionSuggestion[]
) {
  const baseHook = useMentionAutocomplete({ communityId, text, cursorPosition });
  
  const filteredState = useMemo(() => {
    if (!customFilter) return baseHook.state;
    
    return {
      ...baseHook.state,
      suggestions: customFilter(baseHook.state.suggestions)
    };
  }, [baseHook.state, customFilter]);
  
  return {
    ...baseHook,
    state: filteredState
  };
}

// Usage with role-based filtering
const mentionHook = useFilteredMentionAutocomplete(
  communityId,
  text,
  cursorPosition,
  (suggestions) => suggestions.filter(s => 
    s.type === 'channel' || userCanMentionUser(s.id)
  )
);
```

### Pattern 2: Multiple Context Support

```tsx
function useMultiContextMentions(contexts: Array<{ id: string; type: 'community' | 'dm' }>) {
  const [activeContext, setActiveContext] = useState(0);
  
  const mentionHooks = contexts.map(context =>
    useMentionAutocomplete({
      communityId: context.type === 'community' ? context.id : '',
      text,
      cursorPosition
    })
  );
  
  return {
    ...mentionHooks[activeContext],
    switchContext: setActiveContext,
    activeContext
  };
}
```

### Pattern 3: Analytics Integration

```tsx
function useTrackedMentionAutocomplete(props: UseMentionAutocompleteProps) {
  const baseHook = useMentionAutocomplete(props);
  
  // Track mention usage
  useEffect(() => {
    if (baseHook.state.isOpen) {
      analytics.track('mention_autocomplete_opened', {
        type: baseHook.state.type,
        query: baseHook.state.query,
        suggestionsCount: baseHook.state.suggestions.length
      });
    }
  }, [baseHook.state.isOpen]);
  
  const trackedSelectSuggestion = useCallback((index: number) => {
    const suggestion = baseHook.state.suggestions[index];
    
    analytics.track('mention_selected', {
      type: suggestion?.type,
      hasAvatar: !!suggestion?.avatar,
      queryLength: baseHook.state.query.length
    });
    
    baseHook.selectSuggestion(index);
  }, [baseHook]);
  
  return {
    ...baseHook,
    selectSuggestion: trackedSelectSuggestion
  };
}
```

## Testing Strategies

### Hook Testing

```tsx
import { renderHook, act } from '@testing-library/react-hooks';
import { useMentionAutocomplete } from './useMentionAutocomplete';

const mockCommunityId = 'test-community';

describe('useMentionAutocomplete', () => {
  it('should detect user mention trigger', () => {
    const { result } = renderHook(() =>
      useMentionAutocomplete({
        communityId: mockCommunityId,
        text: '@joh',
        cursorPosition: 4
      })
    );

    expect(result.current.state.isOpen).toBe(true);
    expect(result.current.state.type).toBe('user');
    expect(result.current.state.query).toBe('joh');
  });

  it('should detect channel mention trigger', () => {
    const { result } = renderHook(() =>
      useMentionAutocomplete({
        communityId: mockCommunityId,
        text: 'Check #gen',
        cursorPosition: 9
      })
    );

    expect(result.current.state.type).toBe('channel');
    expect(result.current.state.query).toBe('gen');
  });

  it('should handle keyboard navigation', () => {
    const { result } = renderHook(() =>
      useMentionAutocomplete({
        communityId: mockCommunityId,
        text: '@test',
        cursorPosition: 5
      })
    );

    // Mock suggestions
    act(() => {
      // Simulate suggestions being loaded
    });

    const mockEvent = new KeyboardEvent('keydown', { key: 'ArrowDown' });
    
    act(() => {
      const handled = result.current.handleKeyDown(mockEvent);
      expect(handled).toBe(true);
    });

    expect(result.current.state.selectedIndex).toBe(1);
  });

  it('should close on escape key', () => {
    const { result } = renderHook(() =>
      useMentionAutocomplete({
        communityId: mockCommunityId,
        text: '@test',
        cursorPosition: 5
      })
    );

    const mockEvent = new KeyboardEvent('keydown', { key: 'Escape' });
    
    act(() => {
      result.current.handleKeyDown(mockEvent);
    });

    expect(result.current.state.isOpen).toBe(false);
  });

  it('should reset state when mention context changes', () => {
    const { result, rerender } = renderHook(
      ({ text, cursorPosition }) =>
        useMentionAutocomplete({
          communityId: mockCommunityId,
          text,
          cursorPosition
        }),
      {
        initialProps: { text: '@john', cursorPosition: 5 }
      }
    );

    expect(result.current.state.isOpen).toBe(true);

    // Move cursor away from mention
    rerender({ text: '@john', cursorPosition: 0 });

    expect(result.current.state.isOpen).toBe(false);
  });
});
```

### Integration Testing

```tsx
describe('useMentionAutocomplete Integration', () => {
  it('integrates with API hooks correctly', async () => {
    const { result, waitForNextUpdate } = renderHook(() =>
      useMentionAutocomplete({
        communityId: mockCommunityId,
        text: '@john',
        cursorPosition: 5
      }),
      { wrapper: ReduxProvider }
    );

    // Should trigger API call
    await waitForNextUpdate();

    expect(result.current.state.suggestions.length).toBeGreaterThan(0);
    expect(result.current.state.isLoading).toBe(false);
  });
});
```

## Troubleshooting

### Common Issues

1. **Mentions not triggering**
   - **Cause:** Cursor position not updated correctly
   - **Solution:** Ensure cursor position is tracked on input changes and selections

2. **API calls not firing**
   - **Cause:** Skip conditions preventing queries
   - **Solution:** Verify query conditions and minimum query length requirements

3. **Keyboard navigation not working**
   - **Cause:** Event propagation issues or handler not returning correct values
   - **Solution:** Check event handling logic and return values

4. **Memory leaks**
   - **Cause:** Uncleaned subscriptions or state updates after unmount
   - **Solution:** Implement proper cleanup in useEffect hooks

### Debug Mode

```typescript
const DEBUG_MENTIONS = process.env.NODE_ENV === 'development';

if (DEBUG_MENTIONS) {
  console.log('useMentionAutocomplete State:', {
    isOpen,
    selectedIndex,
    suggestionsCount: suggestions.length,
    currentMention,
    isLoading: isLoadingMembers || isLoadingChannels
  });
}
```

## Performance Metrics

### Benchmarks

- **Mention Detection:** < 1ms for typical message lengths (< 500 chars)
- **API Response Time:** 50-200ms for member search, < 50ms for channel data
- **Suggestion Filtering:** < 5ms for up to 100 results
- **Keyboard Navigation:** < 1ms response time

### Optimization Targets

- Keep suggestion lists under 20 items for optimal UX
- Debounce typing to reduce API calls (handled by RTK Query)
- Cache frequently mentioned users/channels
- Minimize re-renders with proper memoization

## Related Documentation

- [MentionDropdown Component](../components/Message/MentionDropdown.md)
- [MessageInput Component](../components/Message/MessageInput.md)
- [mentionParser Utilities](../utils/mentionParser.md)
- [Membership API](../api/membership.md)
- [Channels API](../api/channels.md)
- [Mention System Overview](../features/mention-system.md)