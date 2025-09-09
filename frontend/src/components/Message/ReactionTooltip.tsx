import React, { useMemo } from 'react';
import { Box, Typography, Tooltip } from '@mui/material';
import { useGetUserByIdWithCacheQuery } from '../../features/users/usersSlice';

interface ReactionTooltipProps {
  userIds: string[];
  children: React.ReactElement;
}

// Individual user name fetcher component
const UserName: React.FC<{ userId: string }> = ({ userId }) => {
  const { data: user, isLoading } = useGetUserByIdWithCacheQuery(userId);
  
  if (isLoading) return <Typography variant="body2" sx={{ fontSize: '12px' }}>Loading...</Typography>;
  
  const displayName = user?.displayName || user?.username || `User ${userId.slice(-4)}`;
  
  return (
    <Typography variant="body2" sx={{ fontSize: '12px' }}>
      {displayName}
    </Typography>
  );
};

export const ReactionTooltip: React.FC<ReactionTooltipProps> = ({ userIds, children }) => {
  const displayUserIds = useMemo(() => userIds.slice(0, 15), [userIds]);
  const remainingCount = userIds.length - displayUserIds.length;
  
  const tooltipContent = (
    <Box sx={{ maxWidth: 200 }}>
      {displayUserIds.map((userId) => (
        <UserName key={userId} userId={userId} />
      ))}
      {remainingCount > 0 && (
        <Typography variant="body2" sx={{ fontSize: '12px', fontStyle: 'italic', mt: 0.5 }}>
          +{remainingCount} more
        </Typography>
      )}
    </Box>
  );
  
  return (
    <Tooltip 
      title={tooltipContent} 
      placement="top"
      componentsProps={{
        tooltip: {
          sx: {
            backgroundColor: 'rgba(0, 0, 0, 0.9)',
            maxWidth: 'none'
          }
        }
      }}
    >
      {children}
    </Tooltip>
  );
};