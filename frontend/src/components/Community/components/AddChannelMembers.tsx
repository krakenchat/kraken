import React, { useMemo } from "react";
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  CircularProgress,
  Divider,
  Alert,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { PersonAdd as PersonAddIcon } from "@mui/icons-material";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { channelMembershipControllerCreateMutation } from "../../../api-client/@tanstack/react-query.gen";
import { invalidateChannelMembershipQueries } from "../../../utils/queryInvalidation";
import { logger } from "../../../utils/logger";
import { type ChannelMember } from "./ChannelMembersList";
import UserAvatar from "../../Common/UserAvatar";

interface AddChannelMembersProps {
  channelId: string;
  channelName: string;
  communityMembers?: ChannelMember[];
  channelMembers?: ChannelMember[];
  isLoadingCommunityMembers: boolean;
  communityMembersError: unknown;
}

export const AddChannelMembers: React.FC<AddChannelMembersProps> = ({
  channelId,
  channelName,
  communityMembers,
  channelMembers,
  isLoadingCommunityMembers,
  communityMembersError,
}) => {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const { mutateAsync: createChannelMembership, isPending: isAdding } = useMutation({
    ...channelMembershipControllerCreateMutation(),
    onSuccess: () => invalidateChannelMembershipQueries(queryClient),
  });

  const currentChannelMemberIds = useMemo(() => 
    new Set(channelMembers?.map(member => member.userId) || []),
    [channelMembers]
  );

  const availableMembers = useMemo(() => 
    communityMembers?.filter(member => !currentChannelMemberIds.has(member.userId)) || [],
    [communityMembers, currentChannelMemberIds]
  );

  const handleAddMember = async (userId: string) => {
    try {
      await createChannelMembership({
        body: { userId, channelId },
      });
    } catch (error) {
      logger.error("Failed to add member to channel:", error);
    }
  };

  if (isLoadingCommunityMembers) {
    return (
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Add Community Members
          </Typography>
          <Divider sx={{ mb: 2 }} />
          <Box display="flex" justifyContent="center" p={2}>
            <CircularProgress />
          </Box>
        </CardContent>
      </Card>
    );
  }

  if (communityMembersError) {
    return (
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Add Community Members
          </Typography>
          <Divider sx={{ mb: 2 }} />
          <Alert severity="error">
            Failed to load community members. Please try again.
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Add Community Members to #{channelName}
        </Typography>
        <Divider sx={{ mb: 2 }} />
        
        {availableMembers.length > 0 ? (
          <Box display="flex" flexDirection="column" gap={1}>
            {availableMembers.map((member) => (
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
                  <UserAvatar user={member.user} size="medium" />
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
                <Box display="flex" alignItems="center" gap={1}>
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<PersonAddIcon />}
                    onClick={() => handleAddMember(member.userId)}
                    disabled={isAdding}
                  >
                    {isAdding ? <CircularProgress size={16} /> : "Add"}
                  </Button>
                </Box>
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
              All community members are already in this channel
            </Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

export default AddChannelMembers;
