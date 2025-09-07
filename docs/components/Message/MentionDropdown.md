# MentionDropdown Component

> **Location:** `frontend/src/components/Message/MentionDropdown.tsx`  
> **Type:** Autocomplete Dropdown Component  
> **Feature:** mention-system

## Overview

The MentionDropdown component provides a sophisticated autocomplete interface for user and channel mentions within messages. It features elegant Material-UI styling with glassmorphism effects, keyboard navigation, loading states, and responsive design optimized for the mention autocomplete workflow.

## Props Interface

```typescript
interface MentionDropdownProps {
  suggestions: MentionSuggestion[];         // Array of mention suggestions to display
  selectedIndex: number;                    // Currently selected suggestion index
  isLoading: boolean;                       // Loading state for search operations
  onSelectSuggestion: (index: number) => void; // Callback when suggestion is selected
  position?: {                              // Dropdown positioning options
    top?: number;
    bottom?: number;
    left: number;
  };
}

interface MentionSuggestion {
  id: string;                               // Unique identifier (userId or channelId)
  type: 'user' | 'channel';                // Type of mention
  displayName: string;                      // Primary display text (username or channel name)
  subtitle?: string;                        // Secondary text (displayName for users)
  avatar?: string;                          // Avatar URL for users
}
```

## Usage Examples

### Basic Integration with useMentionAutocomplete

```tsx
import { MentionDropdown } from '@/components/Message/MentionDropdown';
import { useMentionAutocomplete } from '@/hooks/useMentionAutocomplete';

function MessageInputWithMentions({ channelId, communityId }: {
  channelId: string;
  communityId: string;
}) {
  const [text, setText] = useState('');
  const [cursorPosition, setCursorPosition] = useState(0);

  // Mention autocomplete hook integration
  const {
    state: mentionState,
    selectSuggestion,
    close: closeMentions
  } = useMentionAutocomplete({
    communityId,
    text,
    cursorPosition
  });

  const handleMentionSelect = (index: number) => {
    selectSuggestion(index);
    // Additional logic for inserting mention into text
    const selected = mentionState.suggestions[index];
    if (selected) {
      // Insert mention and update text/cursor position
      insertMentionIntoText(selected);
      closeMentions();
    }
  };

  return (
    <div className="message-input-container" style={{ position: 'relative' }}>
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Type @ for users, # for channels"
      />
      
      {/* Mention dropdown */}
      {mentionState.isOpen && (
        <MentionDropdown
          suggestions={mentionState.suggestions}
          selectedIndex={mentionState.selectedIndex}
          isLoading={mentionState.isLoading}
          onSelectSuggestion={handleMentionSelect}
          position={{ bottom: 60, left: 20 }}
        />
      )}
    </div>
  );
}
```

### Custom Positioning

```tsx
// Position above input (bottom positioning)
<MentionDropdown
  suggestions={suggestions}
  selectedIndex={selectedIndex}
  isLoading={isLoading}
  onSelectSuggestion={handleSelect}
  position={{ bottom: 60, left: 20 }}
/>

// Position below input (top positioning)
<MentionDropdown
  suggestions={suggestions}
  selectedIndex={selectedIndex}
  isLoading={isLoading}
  onSelectSuggestion={handleSelect}
  position={{ top: 40, left: 20 }}
/>
```

## Styling & Theming

### Design System Features

- **Glassmorphism Effects:** Modern backdrop blur with translucent backgrounds
- **Material-UI Integration:** Consistent with app theme and design tokens
- **Responsive Design:** Adapts to different screen sizes and input contexts
- **Smooth Animations:** CSS transitions for hover states and interactions
- **Elevation Shadows:** Multi-layer shadow system for visual depth

### Theme Integration

```tsx
const theme = useTheme();

// Dynamic background with glassmorphism
background: `linear-gradient(145deg, 
  ${alpha(theme.palette.background.paper, 0.95)}, 
  ${alpha(theme.palette.background.paper, 0.85)})`

// Backdrop filter for blur effect
backdropFilter: 'blur(20px)'

// Interactive hover states
'&:hover': {
  background: `linear-gradient(135deg, 
    ${alpha(theme.palette.primary.main, 0.06)}, 
    ${alpha(theme.palette.primary.main, 0.03)})`
}
```

### Key Styled Components

```tsx
// Main container with glassmorphism
<Paper
  elevation={8}
  sx={{
    position: 'absolute',
    minWidth: 280,
    maxWidth: 360,
    maxHeight: 320,
    background: `linear-gradient(145deg, ${alpha(theme.palette.background.paper, 0.95)}, ${alpha(theme.palette.background.paper, 0.85)})`,
    backdropFilter: 'blur(20px)',
    borderRadius: 3,
    border: `1px solid ${alpha(theme.palette.divider, 0.12)}`,
    boxShadow: `
      0 8px 32px ${alpha(theme.palette.common.black, 0.12)},
      0 2px 8px ${alpha(theme.palette.common.black, 0.08)},
      inset 0 1px 0 ${alpha(theme.palette.common.white, 0.05)}
    `
  }}
/>

// Interactive list items with selection states
<ListItem
  sx={{
    background: index === selectedIndex
      ? `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.08)}, ${alpha(theme.palette.primary.main, 0.04)})`
      : 'transparent',
    transform: index === selectedIndex ? 'translateX(2px)' : 'none',
    borderLeft: index === selectedIndex
      ? `3px solid ${theme.palette.primary.main}`
      : '3px solid transparent'
  }}
/>
```

## Component Architecture

### State Management

- **External State Control:** Component is fully controlled by parent via props
- **No Internal State:** All state management handled by `useMentionAutocomplete` hook
- **Reactive Updates:** Responds to changes in suggestions, selection, and loading states

### Accessibility Features

```tsx
// ARIA labels and keyboard navigation support
<Typography
  variant="caption"
  sx={{
    color: 'text.secondary',
    fontSize: '0.7rem',
    opacity: 0.6,
  }}
>
  ↑↓ Navigate • Enter/Tab Select • Esc Close
</Typography>

// Screen reader friendly avatars
<Avatar
  src={suggestion.avatar}
  sx={{ width: 32, height: 32 }}
>
  <PersonIcon fontSize="small" />
</Avatar>
```

### Loading States

```tsx
// Elegant loading indicator
{isLoading && (
  <Paper sx={{ /* glassmorphism styling */ }}>
    <CircularProgress size={20} thickness={4} />
    <Typography variant="body2" sx={{ ml: 2, color: 'text.secondary' }}>
      Searching...
    </Typography>
  </Paper>
)}
```

## Integration Patterns

### Pattern 1: Complete Mention Flow

```tsx
function CompleteMentionExample({ communityId }: { communityId: string }) {
  const [text, setText] = useState('');
  const [cursorPosition, setCursorPosition] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const {
    state: mentionState,
    selectSuggestion,
    handleKeyDown: handleMentionKeyDown,
    close: closeMentions
  } = useMentionAutocomplete({
    communityId,
    text,
    cursorPosition
  });

  const handleMentionSelect = useCallback((index: number) => {
    const suggestion = mentionState.suggestions[index];
    if (suggestion) {
      // Insert mention using mentionParser utility
      const mentionData = {
        type: suggestion.type,
        username: suggestion.type === 'user' ? suggestion.displayName : undefined,
        name: suggestion.type === 'channel' ? suggestion.displayName : undefined
      };

      const result = insertMention(text, cursorPosition, mentionData);
      setText(result.newText);

      // Update cursor position after mention insertion
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.setSelectionRange(
            result.newCursorPosition,
            result.newCursorPosition
          );
        }
      }, 0);

      closeMentions();
    }
  }, [mentionState.suggestions, text, cursorPosition, closeMentions]);

  const handleKeyDown = (event: React.KeyboardEvent) => {
    // Let mention system handle its navigation keys
    if (handleMentionKeyDown(event.nativeEvent)) {
      if (event.key === 'Enter' || event.key === 'Tab') {
        // Handle mention selection with current selected index
        const selectedSuggestion = mentionState.suggestions[mentionState.selectedIndex];
        if (selectedSuggestion) {
          handleMentionSelect(mentionState.selectedIndex);
        }
      }
      return;
    }

    // Handle other keys (Enter to send message, etc.)
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <Box sx={{ position: 'relative', width: '100%' }}>
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
          onSelectSuggestion={handleMentionSelect}
        />
      )}
    </Box>
  );
}
```

### Pattern 2: Custom Suggestion Rendering

```tsx
// The component automatically handles user vs channel rendering
// but you can customize the suggestion data transformation:

function useCustomMentionSuggestions(communityId: string) {
  const { data: memberData = [] } = useGetMembersForCommunityQuery(communityId);
  const { data: channelData = [] } = useGetMentionableChannelsQuery(communityId);

  return useMemo(() => {
    // Custom user mention formatting
    const userMentions = memberData.map(member => ({
      id: member.user.id,
      type: 'user' as const,
      displayName: `@${member.user.username}`,  // Custom prefix
      subtitle: member.user.displayName 
        ? `${member.user.displayName} • Joined ${formatDate(member.joinedAt)}`
        : `Joined ${formatDate(member.joinedAt)}`,
      avatar: member.user.avatarUrl
    }));

    // Custom channel mention formatting
    const channelMentions = channelData.map(channel => ({
      id: channel.id,
      type: 'channel' as const,
      displayName: `#${channel.name}`,  // Custom prefix
      subtitle: channel.description || `${channel.type} channel`
    }));

    return { userMentions, channelMentions };
  }, [memberData, channelData]);
}
```

### Pattern 3: Dropdown Positioning Logic

```tsx
function useSmartDropdownPosition(inputRef: React.RefObject<HTMLInputElement>) {
  const [position, setPosition] = useState({ bottom: 60, left: 20 });

  useEffect(() => {
    if (inputRef.current) {
      const rect = inputRef.current.getBoundingClientRect();
      const windowHeight = window.innerHeight;
      const spaceBelow = windowHeight - rect.bottom;
      const spaceAbove = rect.top;

      // Position dropdown based on available space
      if (spaceBelow < 300 && spaceAbove > 300) {
        // Position above input
        setPosition({ bottom: rect.height + 8, left: 0 });
      } else {
        // Position below input
        setPosition({ top: rect.height + 8, left: 0 });
      }
    }
  }, [inputRef]);

  return position;
}
```

## Performance Considerations

### Optimization Strategies

- **React.memo:** Not implemented but could benefit from memoization
- **Virtualization:** For large suggestion lists (>50 items), consider react-window
- **Lazy Loading:** Images loaded lazily with fallback avatars
- **Debounced Updates:** Parent component should debounce search queries

### Memory Management

```tsx
// Efficient suggestion filtering in parent component
const filteredSuggestions = useMemo(() => {
  return suggestions.filter(suggestion => 
    suggestion.displayName.toLowerCase().includes(query.toLowerCase())
  ).slice(0, 10); // Limit to prevent performance issues
}, [suggestions, query]);
```

## Testing Strategies

### Component Testing

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { MentionDropdown } from './MentionDropdown';

const mockSuggestions = [
  {
    id: 'user-1',
    type: 'user',
    displayName: 'john_doe',
    subtitle: 'John Doe',
    avatar: '/avatar.jpg'
  },
  {
    id: 'channel-1',
    type: 'channel',
    displayName: 'general',
    subtitle: 'General discussion'
  }
];

test('renders suggestions correctly', () => {
  render(
    <MentionDropdown
      suggestions={mockSuggestions}
      selectedIndex={0}
      isLoading={false}
      onSelectSuggestion={jest.fn()}
    />
  );

  expect(screen.getByText('john_doe')).toBeInTheDocument();
  expect(screen.getByText('John Doe')).toBeInTheDocument();
  expect(screen.getByText('general')).toBeInTheDocument();
});

test('handles selection correctly', () => {
  const mockOnSelect = jest.fn();
  
  render(
    <MentionDropdown
      suggestions={mockSuggestions}
      selectedIndex={0}
      isLoading={false}
      onSelectSuggestion={mockOnSelect}
    />
  );

  fireEvent.click(screen.getByText('john_doe'));
  expect(mockOnSelect).toHaveBeenCalledWith(0);
});

test('shows loading state', () => {
  render(
    <MentionDropdown
      suggestions={[]}
      selectedIndex={0}
      isLoading={true}
      onSelectSuggestion={jest.fn()}
    />
  );

  expect(screen.getByText('Searching...')).toBeInTheDocument();
  expect(screen.getByRole('progressbar')).toBeInTheDocument();
});
```

### Integration Testing

```tsx
test('integrates with mention autocomplete hook', () => {
  // Test complete mention flow with actual hook integration
  const { result } = renderHook(() => useMentionAutocomplete({
    communityId: 'test-community',
    text: '@joh',
    cursorPosition: 4
  }));

  render(
    <MentionDropdown
      suggestions={result.current.state.suggestions}
      selectedIndex={result.current.state.selectedIndex}
      isLoading={result.current.state.isLoading}
      onSelectSuggestion={result.current.selectSuggestion}
    />
  );

  // Test that suggestions are displayed and selectable
});
```

## Accessibility Support

### Keyboard Navigation

- **Arrow Keys:** Navigate through suggestions (handled by parent hook)
- **Enter/Tab:** Select current suggestion
- **Escape:** Close dropdown
- **Screen Reader:** ARIA labels and semantic structure

### Focus Management

```tsx
// Dropdown doesn't trap focus - managed by parent input
// Selection updates are announced via aria-live regions in parent
<div aria-live="polite" aria-label="Mention suggestions">
  {/* Dropdown content */}
</div>
```

## Troubleshooting

### Common Issues

1. **Dropdown not positioning correctly**
   - **Cause:** Parent container missing `position: relative`
   - **Solution:** Ensure parent has relative positioning for absolute dropdown

2. **Mentions not displaying**
   - **Cause:** Empty suggestions array or incorrect data structure
   - **Solution:** Verify `MentionSuggestion` interface compatibility

3. **Performance lag with many suggestions**
   - **Cause:** Too many DOM elements rendering simultaneously  
   - **Solution:** Implement virtualization or limit suggestion count

4. **Styling conflicts**
   - **Cause:** CSS specificity issues with Material-UI
   - **Solution:** Use `sx` prop instead of CSS classes for styling

### Debug Utilities

```tsx
// Debug version with logging
function DebugMentionDropdown(props: MentionDropdownProps) {
  console.log('MentionDropdown render:', {
    suggestionsCount: props.suggestions.length,
    selectedIndex: props.selectedIndex,
    isLoading: props.isLoading
  });

  return <MentionDropdown {...props} />;
}
```

## Recent Changes

- **Current:** Full mention autocomplete with user and channel support
- **Recent:** Added glassmorphism styling and improved animations
- **Future:** Consider adding emoji reactions, custom mention types, and improved virtualization

## Related Documentation

- [useMentionAutocomplete Hook](../../hooks/useMentionAutocomplete.md)
- [MessageInput Component](./MessageInput.md)
- [mentionParser Utilities](../../utils/mentionParser.md)
- [Mention System Overview](../../features/mention-system.md)
- [Channel API](../../api/channels.md)
- [Membership API](../../api/membership.md)