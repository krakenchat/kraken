import React, { useState } from "react";
import {
  Box,
  Card,
  CardContent,
  Typography,
  CircularProgress,
  Avatar,
  Divider,
  IconButton,
  Alert,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import ConfirmDialog from "../../Common/ConfirmDialog";
import { Delete as DeleteIcon } from "@mui/icons-material";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { channelMembershipControllerRemoveMutation } from "../../../api-client/@tanstack/react-query.gen";
import { invalidateChannelMembershipQueries } from "../../../utils/queryInvalidation";
import { logger } from "../../../utils/logger";

interface ChannelMember {
  id: string;
  userId: string;
  user?: {
    id: string;
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
  };
}

interface ChannelMembersListProps {
  channelId: string;
  channelName: string;
  members?: ChannelMember[];
  isLoading: boolean;
  error: unknown;
  canDeleteMembers: boolean;
}

export const ChannelMembersList: React.FC<ChannelMembersListProps> = ({
  channelId,
  channelName,
  members,
  isLoading,
  error,
  canDeleteMembers,
}) => {
  const theme = useTheme();
  const [confirmRemoveOpen, setConfirmRemoveOpen] = useState(false);
  const [userToRemove, setUserToRemove] = useState<{id: string, name: string} | null>(null);

  const queryClient = useQueryClient();
  const { mutateAsync: removeChannelMembership, isPending: isRemoving } = useMutation({
    ...channelMembershipControllerRemoveMutation(),
    onSuccess: () => invalidateChannelMembershipQueries(queryClient),
  });

  const handleRemoveMember = (userId: string, username: string) => {
    setUserToRemove({ id: userId, name: username });
    setConfirmRemoveOpen(true);
  };

  const confirmRemoveMember = async () => {
    if (!userToRemove) return;

    try {
      await removeChannelMembership({
        path: { userId: userToRemove.id, channelId },
      });
    } catch (error) {
      logger.error("Failed to remove member from channel:", error);
    } finally {
      setConfirmRemoveOpen(false);
      setUserToRemove(null);
    }
  };

  const cancelRemoveMember = () => {
    setConfirmRemoveOpen(false);
    setUserToRemove(null);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Current Channel Members
          </Typography>
          <Divider sx={{ mb: 2 }} />
          <Box display="flex" justifyContent="center" p={2}>
            <CircularProgress />
          </Box>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Current Channel Members
          </Typography>
          <Divider sx={{ mb: 2 }} />
          <Alert severity="error">
            Failed to load channel members. Please try again.
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Current Members of #{channelName} ({members?.length || 0})
          </Typography>
          <Divider sx={{ mb: 2 }} />
          
          {members && members.length > 0 ? (
            <Box display="flex" flexDirection="column" gap={1}>
              {members.map((member) => (
                <Box
                  key={member.id}
                  display="flex"
                  justifyContent="space-between"
                  alignItems="center"
                  p={2}
                  sx={{
                    border: 1,
                    borderColor: "divider",
                    borderRadius: 1,
                    "&:hover": {
                      bgcolor: theme.palette.semantic.overlay.light,
                    },
                  }}
                >
                  <Box display="flex" alignItems="center" gap={2}>
                    <Avatar 
                      src={member.user?.avatarUrl || ""} 
                      sx={{ width: 40, height: 40 }}
                    />
                    <Box>
                      <Typography variant="body1" fontWeight="medium">
                        {member.user?.username}
                      </Typography>
                      {member.user?.displayName && (
                        <Typography 
                          variant="body2" 
                          color="text.secondary"
                          sx={{ mt: -0.5 }}
                        >
                          {member.user.displayName}
                        </Typography>
                      )}
                    </Box>
                  </Box>
                  {canDeleteMembers && (
                    <IconButton
                      color="error"
                      onClick={() => handleRemoveMember(member.userId, member.user?.username || 'Unknown User')}
                      disabled={isRemoving}
                      sx={{ ml: 1 }}
                    >
                      <DeleteIcon />
                    </IconButton>
                  )}
                </Box>
              ))}
            </Box>
          ) : (
            <Box 
              display="flex" 
              justifyContent="center" 
              alignItems="center" 
              py={4}
            >
              <Typography variant="body2" color="text.secondary">
                No members in this channel
              </Typography>
            </Box>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={confirmRemoveOpen}
        title="Remove Member"
        description={<>Are you sure you want to remove <strong>{userToRemove?.name}</strong> from #{channelName}? This action cannot be undone.</>}
        confirmLabel="Remove Member"
        confirmColor="error"
        isLoading={isRemoving}
        onConfirm={confirmRemoveMember}
        onCancel={cancelRemoveMember}
      />
    </>
  );
};

export default ChannelMembersList;
