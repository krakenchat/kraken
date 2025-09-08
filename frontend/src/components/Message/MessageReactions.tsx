import React from 'react';
import { Box, Chip, Tooltip } from '@mui/material';
import type { Reaction } from '../../types/message.type';
import { useProfileQuery } from '../../features/users/usersSlice';

interface MessageReactionsProps {
  messageId: string;
  reactions: Reaction[];
  onReactionClick: (emoji: string) => void;
}

export const MessageReactions: React.FC<MessageReactionsProps> = ({ 
  reactions, 
  onReactionClick 
}) => {
  const { data: currentUser } = useProfileQuery();

  if (reactions.length === 0) return null;

  return (
    <Box display="flex" gap={0.5} mt={0.5} flexWrap="wrap">
      {reactions.map((reaction) => {
        const userHasReacted = currentUser ? reaction.userIds.includes(currentUser.id) : false;
        const count = reaction.userIds.length;

        return (
          <Tooltip 
            key={reaction.emoji}
            title={`${count} ${count === 1 ? 'person' : 'people'} reacted`}
          >
            <Chip
              label={`${reaction.emoji} ${count}`}
              size="small"
              variant={userHasReacted ? "filled" : "outlined"}
              color={userHasReacted ? "primary" : "default"}
              onClick={() => onReactionClick(reaction.emoji)}
              sx={{
                height: '24px',
                fontSize: '12px',
                cursor: 'pointer',
                '&:hover': {
                  backgroundColor: userHasReacted ? 'primary.dark' : 'action.hover',
                }
              }}
            />
          </Tooltip>
        );
      })}
    </Box>
  );
};