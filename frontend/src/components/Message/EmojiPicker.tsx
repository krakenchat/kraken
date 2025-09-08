import React, { useState } from 'react';
import { IconButton, Popover, Box, Typography } from '@mui/material';
import { AddReaction as AddReactionIcon } from '@mui/icons-material';

const COMMON_EMOJIS = [
  '👍', '👎', '❤️', '😂', '😮', '😢', '😡', '👏',
  '🎉', '🔥', '💯', '⭐', '❓', '❗', '✅', '❌'
];

interface EmojiPickerProps {
  onEmojiSelect: (emoji: string) => void;
}

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
        <Box p={2} maxWidth={240}>
          <Typography variant="subtitle2" gutterBottom>
            Add Reaction
          </Typography>
          <Box display="grid" gridTemplateColumns="repeat(8, 1fr)" gap={0.5}>
            {COMMON_EMOJIS.map((emoji) => (
              <IconButton
                key={emoji}
                size="small"
                onClick={() => handleEmojiClick(emoji)}
                sx={{
                  fontSize: '18px',
                  padding: '4px',
                  '&:hover': {
                    backgroundColor: 'action.hover',
                  }
                }}
              >
                {emoji}
              </IconButton>
            ))}
          </Box>
        </Box>
      </Popover>
    </>
  );
};