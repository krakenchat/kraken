import React from 'react';
import { Box, Typography } from '@mui/material';
import { useTypingUsers } from '../../hooks/useTypingUsers';

interface TypingIndicatorProps {
  channelId?: string;
  directMessageGroupId?: string;
  currentUserId?: string;
  /** Map of userId → display name for resolving typing user IDs */
  userNames?: Map<string, string>;
}

const TypingIndicator: React.FC<TypingIndicatorProps> = ({
  channelId,
  directMessageGroupId,
  currentUserId,
  userNames = new Map(),
}) => {
  const typingUserIds = useTypingUsers({ channelId, directMessageGroupId, currentUserId });

  if (typingUserIds.length === 0) return null;

  const getName = (id: string) => userNames.get(id) || 'Someone';

  let text: string;
  if (typingUserIds.length === 1) {
    text = `${getName(typingUserIds[0])} is typing...`;
  } else if (typingUserIds.length === 2) {
    text = `${getName(typingUserIds[0])} and ${getName(typingUserIds[1])} are typing...`;
  } else {
    text = `${getName(typingUserIds[0])} and ${typingUserIds.length - 1} others are typing...`;
  }

  return (
    <Box sx={{ px: 2, py: 0.25, minHeight: 20 }}>
      <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>
        {text}
      </Typography>
    </Box>
  );
};

export default TypingIndicator;
