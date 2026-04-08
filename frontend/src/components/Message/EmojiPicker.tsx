import React, { useState, useMemo } from 'react';
import { IconButton, Popover, Box, Typography, TextField, InputAdornment } from '@mui/material';
import { AddReaction as AddReactionIcon, Search as SearchIcon, Clear as ClearIcon } from '@mui/icons-material';

// Emoji names for search functionality
export const EMOJI_NAMES: Record<string, string[]> = {
  '👍': ['thumbs up', 'like', 'yes', 'good', 'ok', 'approve'],
  '👎': ['thumbs down', 'dislike', 'no', 'bad', 'disapprove'],
  '❤️': ['heart', 'love', 'red heart'],
  '😂': ['laugh', 'lol', 'joy', 'crying laughing', 'tears'],
  '😮': ['surprised', 'wow', 'shocked', 'omg'],
  '😢': ['sad', 'cry', 'crying'],
  '😡': ['angry', 'mad', 'rage'],
  '👏': ['clap', 'applause', 'bravo'],
  '🎉': ['party', 'celebrate', 'tada', 'celebration'],
  '🔥': ['fire', 'hot', 'lit', 'flames'],
  '💯': ['hundred', 'perfect', '100'],
  '⭐': ['star', 'favorite'],
  '✅': ['check', 'done', 'complete', 'yes'],
  '❌': ['x', 'no', 'wrong', 'cancel', 'cross'],
  '🤔': ['thinking', 'hmm', 'think'],
  '😍': ['love eyes', 'heart eyes', 'adore'],
  '😀': ['grin', 'happy', 'smile'],
  '😊': ['blush', 'happy', 'smile'],
  '😭': ['sob', 'crying hard', 'tears'],
  '🥳': ['party face', 'celebrate'],
  '😎': ['cool', 'sunglasses'],
  '🤣': ['rofl', 'rolling'],
  '😱': ['scream', 'fear', 'scared'],
  '🙏': ['pray', 'please', 'thanks', 'hope'],
  '💪': ['muscle', 'strong', 'flex'],
  '🤝': ['handshake', 'deal', 'agree'],
  '🙌': ['raise hands', 'hooray', 'praise'],
  '💎': ['diamond', 'gem'],
  '🔔': ['bell', 'notification', 'alert'],
  '🎂': ['cake', 'birthday'],
  '🎁': ['gift', 'present'],
  '🎈': ['balloon', 'party'],
  '✨': ['sparkle', 'magic', 'shine'],
  '🌟': ['glowing star', 'shine'],
  '💥': ['boom', 'explosion'],
  '💫': ['dizzy', 'star'],
  '🐶': ['dog', 'puppy'],
  '🐱': ['cat', 'kitty'],
  '🐻': ['bear', 'teddy'],
  '🦊': ['fox'],
  '🐼': ['panda'],
  '🦁': ['lion'],
  '🐯': ['tiger'],
  '🍕': ['pizza'],
  '🍔': ['burger', 'hamburger'],
  '🍟': ['fries', 'french fries'],
  '🍦': ['ice cream'],
  '🍰': ['cake', 'slice'],
  '☕': ['coffee', 'tea'],
  '🍺': ['beer'],
  '🍷': ['wine'],
  '⚽': ['soccer', 'football'],
  '🏀': ['basketball'],
  '🏈': ['football', 'american football'],
  '⚾': ['baseball'],
  '🎮': ['game', 'controller', 'gaming'],
  '🎬': ['movie', 'film', 'action'],
  '🎵': ['music', 'note'],
  '🎧': ['headphones', 'music'],
  '💻': ['computer', 'laptop'],
  '📱': ['phone', 'mobile'],
  '🏆': ['trophy', 'winner', 'champion'],
  '🥇': ['gold', 'first', 'medal'],
  '🥈': ['silver', 'second'],
  '🥉': ['bronze', 'third'],
};

export const EMOJI_CATEGORIES: Record<string, string[]> = {
  'Frequently Used': [
    '👍', '👎', '❤️', '😂', '😮', '😢', '😡', '👏',
    '🎉', '🔥', '💯', '⭐', '✅', '❌', '🤔', '😍'
  ],
  'Smileys & People': [
    '😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂',
    '🙂', '🙃', '😉', '😊', '😇', '🥰', '😍', '🤩',
    '😘', '😗', '😚', '😙', '😋', '😛', '😜', '🤪',
    '😝', '🤑', '🤗', '🤭', '🤫', '🤔', '🤐', '🤨',
    '😐', '😑', '😶', '😏', '😒', '🙄', '😬', '🤥',
    '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕', '🤢',
    '🤮', '🤧', '🥵', '🥶', '🥴', '😵', '🤯', '🤠',
    '🥳', '😎', '🤓', '🧐', '😕', '😟', '🙁', '☹️',
    '😮', '😯', '😲', '😳', '🥺', '😦', '😧', '😨',
    '😰', '😥', '😢', '😭', '😱', '😖', '😣', '😞',
    '😓', '😩', '😫', '🥱', '😤', '😡', '😠', '🤬',
    '👍', '👎', '👏', '🙌', '🤝', '💪', '🙏', '✌️'
  ],
  'Animals & Nature': [
    '🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼',
    '🐨', '🐯', '🦁', '🐮', '🐷', '🐽', '🐸', '🐵',
    '🙈', '🙉', '🙊', '🐒', '🐔', '🐧', '🐦', '🐤',
    '🐣', '🐥', '🦆', '🦅', '🦉', '🦇', '🐺', '🐗',
    '🐴', '🦄', '🐝', '🐛', '🦋', '🐌', '🐞', '🐜',
    '🦟', '🦗', '🕷️', '🐢', '🐍', '🦎', '🦖', '🦕',
    '🐙', '🦑', '🦐', '🦞', '🦀', '🐡', '🐠', '🐟',
    '🐬', '🐳', '🐋', '🦈', '🐊', '🐅', '🐆', '🦓',
    '🦍', '🦧', '🐘', '🦏', '🦛', '🐪', '🐫', '🦒',
    '🦘', '🐃', '🐂', '🐄', '🐎', '🐖', '🐏', '🐑'
  ],
  'Food & Drink': [
    '🍎', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🍈',
    '🍒', '🍑', '🥭', '🍍', '🥥', '🥝', '🍅', '🍆',
    '🥑', '🥦', '🥬', '🥒', '🌶️', '🌽', '🥕', '🧄',
    '🧅', '🥔', '🍠', '🥐', '🍞', '🥖', '🥨', '🧀',
    '🥚', '🍳', '🧈', '🥞', '🧇', '🥓', '🥩', '🍗',
    '🍖', '🦴', '🌭', '🍔', '🍟', '🍕', '🥪', '🥙',
    '🌮', '🌯', '🥗', '🥘', '🥫', '🍝', '🍜', '🍲',
    '🍛', '🍣', '🍱', '🥟', '🦪', '🍤', '🍙', '🍚',
    '🍘', '🍥', '🥠', '🥮', '🍢', '🍡', '🍧', '🍨',
    '🍦', '🥧', '🧁', '🍰', '🎂', '🍮', '🍭', '🍬'
  ],
  'Activities & Sports': [
    '⚽', '🏀', '🏈', '⚾', '🥎', '🎾', '🏐', '🏉',
    '🥏', '🎱', '🪀', '🏓', '🏸', '🏒', '🏑', '🥍',
    '🏏', '🪃', '🥅', '⛳', '🪁', '🏹', '🎣', '🤿',
    '🥊', '🥋', '🎽', '🛹', '🛷', '⛸️', '🥌', '🎿',
    '⛷️', '🏂', '🪂', '🏋️', '🤼', '🤸', '⛹️', '🤺',
    '🏊', '🏄', '🚣', '🧗', '🚵', '🚴', '🏇', '🏆',
    '🥇', '🥈', '🥉', '🏅', '🎖️', '🏵️', '🎗️', '🎫',
    '🎟️', '🎪', '🤹', '🎭', '🩰', '🎨', '🎬', '🎤',
    '🎧', '🎼', '🎵', '🎶', '🥁', '🪘', '🎷', '🎺'
  ],
  'Objects & Symbols': [
    '💘', '💝', '💖', '💗', '💓', '💞', '💕', '💟',
    '❣️', '💔', '❤️', '🧡', '💛', '💚', '💙', '💜',
    '🤎', '🖤', '🤍', '💯', '💢', '💥', '💫', '💦',
    '💨', '🕳️', '💣', '💬', '🗨️', '🗯️', '💭', '💤',
    '👋', '🤚', '🖐️', '✋', '🖖', '👌', '🤌', '🤏',
    '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆',
    '🖕', '👇', '☝️', '👍', '👎', '👊', '✊', '🤛',
    '🤜', '👏', '🙌', '👐', '🤲', '🤝', '🙏', '✍️',
    '⭐', '🌟', '✨', '🎊', '🎉', '🎀', '🎁', '🎈',
    '🎂', '🎄', '🎃', '🎆', '🎇', '🧨', '💎', '🔔'
  ]
};

/**
 * Shared emoji grid content used by both EmojiPicker and EmojiPickerPopover.
 * Renders the search field and scrollable emoji grid.
 */
const EmojiPickerContent: React.FC<{
  onEmojiClick: (emoji: string) => void;
}> = ({ onEmojiClick }) => {
  const [searchQuery, setSearchQuery] = useState('');

  // Filter emojis based on search query
  const filteredCategories = useMemo(() => {
    if (!searchQuery.trim()) {
      return EMOJI_CATEGORIES;
    }

    const query = searchQuery.toLowerCase().trim();
    const results: Record<string, string[]> = {};

    // Search through all categories
    Object.entries(EMOJI_CATEGORIES).forEach(([category, emojis]) => {
      const matchedEmojis = emojis.filter((emoji) => {
        // Check if emoji itself contains the query (for searching by emoji)
        if (emoji.includes(query)) return true;

        // Check if any of the emoji's names match the query
        const names = EMOJI_NAMES[emoji];
        if (names) {
          return names.some((name) => name.toLowerCase().includes(query));
        }
        return false;
      });

      if (matchedEmojis.length > 0) {
        results[category] = matchedEmojis;
      }
    });

    return results;
  }, [searchQuery]);

  const hasResults = Object.keys(filteredCategories).length > 0;

  return (
    <Box sx={{
      width: '300px',
      height: '400px',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Header with Search */}
      <Box
        sx={{
          p: 1.5,
          pb: 1,
          borderBottom: '1px solid',
          borderColor: 'divider',
          flexShrink: 0,
        }}
      >
        <TextField
          size="small"
          placeholder="Search emojis..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          autoFocus
          fullWidth
          sx={{
            '& .MuiOutlinedInput-root': {
              fontSize: '0.85rem',
              borderRadius: '8px',
              backgroundColor: 'action.hover',
              '& fieldset': {
                border: 'none',
              },
              '&:hover fieldset': {
                border: 'none',
              },
              '&.Mui-focused fieldset': {
                border: '1px solid',
                borderColor: 'primary.main',
              },
            },
            '& .MuiOutlinedInput-input': {
              padding: '8px 12px',
            },
          }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ fontSize: '1rem', color: 'text.disabled' }} />
              </InputAdornment>
            ),
            endAdornment: searchQuery && (
              <InputAdornment position="end">
                <IconButton
                  size="small"
                  onClick={() => setSearchQuery('')}
                  sx={{ p: 0.5 }}
                >
                  <ClearIcon sx={{ fontSize: '0.9rem' }} />
                </IconButton>
              </InputAdornment>
            ),
          }}
        />
      </Box>

      {/* Scrollable Content */}
      <Box
        sx={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
          px: 1.5,
          py: 1,
          // Custom scrollbar styling
          '&::-webkit-scrollbar': {
            width: '6px',
          },
          '&::-webkit-scrollbar-track': {
            backgroundColor: 'transparent',
          },
          '&::-webkit-scrollbar-thumb': {
            backgroundColor: 'rgba(255, 255, 255, 0.2)',
            borderRadius: '3px',
            '&:hover': {
              backgroundColor: 'rgba(255, 255, 255, 0.3)',
            }
          },
        }}
      >
        {hasResults ? (
          Object.entries(filteredCategories).map(([categoryName, emojis], index) => (
            <Box key={categoryName} sx={{ mb: 1.5 }}>
              {/* Category Header */}
              <Typography
                variant="caption"
                sx={{
                  display: 'block',
                  mb: 0.75,
                  mt: index === 0 ? 0 : 1,
                  fontSize: '0.7rem',
                  fontWeight: 500,
                  color: 'text.disabled',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}
              >
                {searchQuery ? `${categoryName} (${emojis.length})` : categoryName}
              </Typography>

              {/* Emoji Grid */}
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(8, 1fr)',
                  gap: '2px',
                  width: '100%',
                }}
              >
                {emojis.map((emoji) => (
                  <IconButton
                    key={`${categoryName}-${emoji}`}
                    size="small"
                    onClick={() => onEmojiClick(emoji)}
                    sx={{
                      fontSize: '16px',
                      padding: '4px',
                      borderRadius: '4px',
                      aspectRatio: '1',
                      minWidth: 'unset',
                      width: '100%',
                      height: 'auto',
                      transition: 'all 0.12s cubic-bezier(0.4, 0, 0.2, 1)',
                      '&:hover': {
                        backgroundColor: 'rgba(88, 101, 242, 0.12)',
                        transform: 'scale(1.1)',
                      },
                      '&:active': {
                        transform: 'scale(0.95)',
                        transition: 'all 0.05s ease',
                      }
                    }}
                  >
                    {emoji}
                  </IconButton>
                ))}
              </Box>
            </Box>
          ))
        ) : (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              py: 4,
              color: 'text.disabled',
            }}
          >
            <Typography variant="body2">No emojis found</Typography>
            <Typography variant="caption" sx={{ mt: 0.5 }}>
              Try a different search term
            </Typography>
          </Box>
        )}
      </Box>
    </Box>
  );
};

export interface EmojiPickerPopoverProps {
  open: boolean;
  anchorPosition: { top: number; left: number } | null;
  onClose: () => void;
  onEmojiSelect: (emoji: string) => void;
}

/**
 * Controlled emoji picker popover positioned at anchorPosition.
 * Used by MessageContextMenu to show emoji picker at arbitrary screen positions.
 */
export const EmojiPickerPopover: React.FC<EmojiPickerPopoverProps> = ({
  open,
  anchorPosition,
  onClose,
  onEmojiSelect,
}) => {
  const handleEmojiClick = (emoji: string) => {
    onEmojiSelect(emoji);
    onClose();
  };

  return (
    <Popover
      open={open}
      anchorReference="anchorPosition"
      anchorPosition={anchorPosition ?? undefined}
      onClose={onClose}
      transformOrigin={{
        vertical: 'top',
        horizontal: 'left',
      }}
    >
      <EmojiPickerContent onEmojiClick={handleEmojiClick} />
    </Popover>
  );
};

interface EmojiPickerProps {
  onEmojiSelect: (emoji: string) => void;
}

/**
 * Self-contained emoji picker with its own trigger button.
 * Used in the message hover toolbar.
 */
export const EmojiPicker: React.FC<EmojiPickerProps> = ({ onEmojiSelect }) => {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleEmojiClick = (emoji: string) => {
    onEmojiSelect(emoji);
    handleClose();
  };

  const open = Boolean(anchorEl);

  return (
    <>
      <IconButton size="small" onClick={handleClick}>
        <AddReactionIcon fontSize="small" />
      </IconButton>
      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{
          vertical: 'top',
          horizontal: 'left',
        }}
        transformOrigin={{
          vertical: 'bottom',
          horizontal: 'left',
        }}
      >
        <EmojiPickerContent onEmojiClick={handleEmojiClick} />
      </Popover>
    </>
  );
};