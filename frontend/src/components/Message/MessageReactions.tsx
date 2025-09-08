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
              variant="filled"
              onClick={() => onReactionClick(reaction.emoji)}
              sx={{
                height: '26px',
                fontSize: '13px',
                fontWeight: 500,
                cursor: 'pointer',
                backgroundColor: userHasReacted 
                  ? 'rgba(88, 101, 242, 0.15)' // Discord-like blue
                  : 'rgba(255, 255, 255, 0.08)', // Subtle background
                color: userHasReacted 
                  ? 'rgb(88, 101, 242)' // Discord blue
                  : 'text.primary',
                border: userHasReacted 
                  ? '1px solid rgba(88, 101, 242, 0.3)'
                  : '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: '12px',
                transition: 'all 0.15s ease',
                '&:hover': {
                  backgroundColor: userHasReacted 
                    ? 'rgba(88, 101, 242, 0.25)'
                    : 'rgba(255, 255, 255, 0.12)',
                  borderColor: userHasReacted 
                    ? 'rgba(88, 101, 242, 0.5)'
                    : 'rgba(255, 255, 255, 0.25)',
                  transform: 'scale(1.05)',
                },
                '&:active': {
                  transform: 'scale(0.95)',
                },
                '& .MuiChip-label': {
                  padding: '0 8px',
                  fontSize: '13px',
                  fontWeight: userHasReacted ? 600 : 500,
                }
              }}
            />
          </Tooltip>
        );
      })}
    </Box>
  );
};