import React, { useState, useCallback } from "react";
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  TextField,
  FormControlLabel,
  Switch,
  Alert,
  CircularProgress,
  IconButton,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from "@mui/material";
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  KeyboardArrowUp as ArrowUpIcon,
  KeyboardArrowDown as ArrowDownIcon,
} from "@mui/icons-material";
import { ChannelType } from "../../types/channel.type";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  channelsControllerFindAllForCommunityOptions,
  channelsControllerCreateMutation,
  channelsControllerUpdateMutation,
  channelsControllerRemoveMutation,
  channelsControllerMoveUpMutation,
  channelsControllerMoveDownMutation,
} from "../../api-client/@tanstack/react-query.gen";
import { invalidateByIds, INVALIDATION_GROUPS } from "../../utils/queryInvalidation";
import { useUserPermissions } from "../../features/roles/useUserPermissions";
import type { Channel } from "../../types/channel.type";
import { logger } from "../../utils/logger";

interface ChannelManagementProps {
  communityId: string;
}

interface ChannelFormData {
  name: string;
  type: "TEXT" | "VOICE";
  description: string;
  isPrivate: boolean;
}

const ChannelManagement: React.FC<ChannelManagementProps> = ({ communityId }) => {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [editingChannel, setEditingChannel] = useState<Channel | null>(null);
  const [channelToDelete, setChannelToDelete] = useState<{id: string, name: string} | null>(null);
  const [formData, setFormData] = useState<ChannelFormData>({
    name: "",
    description: "",
    type: "TEXT",
    isPrivate: false,
  });

  const queryClient = useQueryClient();

  const {
    data: channels,
    isLoading: loadingChannels,
    error: channelsError,
  } = useQuery(channelsControllerFindAllForCommunityOptions({ path: { communityId } }));

  const { mutateAsync: createChannel, isPending: creatingChannel } = useMutation({
    ...channelsControllerCreateMutation(),
    onSuccess: () => invalidateByIds(queryClient, INVALIDATION_GROUPS.channel),
  });
  const { mutateAsync: updateChannel, isPending: updatingChannel } = useMutation({
    ...channelsControllerUpdateMutation(),
    onSuccess: () => invalidateByIds(queryClient, INVALIDATION_GROUPS.channel),
  });
  const { mutateAsync: deleteChannel, isPending: deletingChannel } = useMutation({
    ...channelsControllerRemoveMutation(),
    onSuccess: () => invalidateByIds(queryClient, INVALIDATION_GROUPS.channel),
  });
  const { mutateAsync: moveUp, isPending: movingUp } = useMutation({
    ...channelsControllerMoveUpMutation(),
    onSuccess: () => invalidateByIds(queryClient, INVALIDATION_GROUPS.channel),
  });
  const { mutateAsync: moveDown, isPending: movingDown } = useMutation({
    ...channelsControllerMoveDownMutation(),
    onSuccess: () => invalidateByIds(queryClient, INVALIDATION_GROUPS.channel),
  });

  // Sort channels by type (TEXT first) then by position
  const sortedChannels = React.useMemo(() => {
    if (!channels) return [];
    return [...channels].sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === ChannelType.TEXT ? -1 : 1;
      }
      return (a.position ?? 0) - (b.position ?? 0);
    });
  }, [channels]);

  // Get channels by type for determining first/last
  const textChannels = sortedChannels.filter((c) => c.type === ChannelType.TEXT);
  const voiceChannels = sortedChannels.filter((c) => c.type === ChannelType.VOICE);

  const { hasPermissions: canCreateChannels } = useUserPermissions({
    resourceType: "COMMUNITY",
    resourceId: communityId,
    actions: ["CREATE_CHANNEL"],
  });

  const { hasPermissions: canUpdateChannels } = useUserPermissions({
    resourceType: "COMMUNITY",
    resourceId: communityId,
    actions: ["UPDATE_CHANNEL"],
  });

  const { hasPermissions: canDeleteChannels } = useUserPermissions({
    resourceType: "COMMUNITY",
    resourceId: communityId,
    actions: ["DELETE_CHANNEL"],
  });

  const canManageChannels = canCreateChannels || canUpdateChannels || canDeleteChannels;

  const handleCreateChannel = useCallback(async () => {
    if (!formData.name.trim()) return;

    try {
      await createChannel({
        body: {
          name: formData.name.trim(),
          description: formData.description.trim() || undefined,
          type: formData.type,
          communityId,
          isPrivate: formData.isPrivate,
        },
      });

      setCreateDialogOpen(false);
      setFormData({
        name: "",
        description: "",
        type: "TEXT",
        isPrivate: false,
      });
    } catch (error) {
      logger.error("Failed to create channel:", error);
    }
  }, [formData, communityId, createChannel]);

  const handleEditChannel = useCallback((channel: Channel) => {
    setEditingChannel(channel);
    setFormData({
      name: channel.name,
      type: channel.type,
      description: channel.description || "",
      isPrivate: channel.isPrivate,
    });
    setEditDialogOpen(true);
  }, []);

  const handleUpdateChannel = useCallback(async () => {
    if (!editingChannel || !formData.name.trim()) return;

    try {
      await updateChannel({
        path: { id: editingChannel.id },
        body: {
          name: formData.name.trim(),
          description: formData.description.trim() || undefined,
          isPrivate: formData.isPrivate,
        },
      });

      setEditDialogOpen(false);
      setEditingChannel(null);
      setFormData({
        name: "",
        description: "",
        type: "TEXT",
        isPrivate: false,
      });
    } catch (error) {
      logger.error("Failed to update channel:", error);
    }
  }, [editingChannel, formData, updateChannel]);

  const handleDeleteChannel = useCallback((channelId: string, channelName: string) => {
    setChannelToDelete({ id: channelId, name: channelName });
    setConfirmDeleteOpen(true);
  }, []);

  const confirmDeleteChannel = useCallback(async () => {
    if (!channelToDelete) return;

    try {
      await deleteChannel({ path: { id: channelToDelete.id } });
    } catch (error) {
      logger.error("Failed to delete channel:", error);
    } finally {
      setConfirmDeleteOpen(false);
      setChannelToDelete(null);
    }
  }, [channelToDelete, deleteChannel]);

  const cancelDeleteChannel = useCallback(() => {
    setConfirmDeleteOpen(false);
    setChannelToDelete(null);
  }, []);

  const handleMoveUp = useCallback(
    async (channelId: string) => {
      try {
        await moveUp({ path: { id: channelId }, body: { communityId } });
      } catch (error) {
        logger.error("Failed to move channel up:", error);
      }
    },
    [moveUp, communityId]
  );

  const handleMoveDown = useCallback(
    async (channelId: string) => {
      try {
        await moveDown({ path: { id: channelId }, body: { communityId } });
      } catch (error) {
        logger.error("Failed to move channel down:", error);
      }
    },
    [moveDown, communityId]
  );

  const handleCloseCreateDialog = useCallback(() => {
    setCreateDialogOpen(false);
    setFormData({
      name: "",
      description: "",
      type: "TEXT",
      isPrivate: false,
    });
  }, []);

  const handleCloseEditDialog = useCallback(() => {
    setEditDialogOpen(false);
    setEditingChannel(null);
    setFormData({
      name: "",
      description: "",
      type: "TEXT",
      isPrivate: false,
    });
  }, []);

  if (loadingChannels) {
    return (
      <Box display="flex" justifyContent="center" p={2}>
        <CircularProgress />
      </Box>
    );
  }

  if (channelsError) {
    return (
      <Alert severity="error">
        Failed to load channels. Please try again.
      </Alert>
    );
  }

  return (
    <Card>
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6">Channels</Typography>
          {canManageChannels && canCreateChannels && (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setCreateDialogOpen(true)}
            >
              Create Channel
            </Button>
          )}
        </Box>

        {/* Text Channels */}
        {textChannels.length > 0 && (
          <Box mb={2}>
            <Typography variant="subtitle2" color="text.secondary" mb={1}>
              Text Channels
            </Typography>
            <Box display="flex" flexDirection="column" gap={1}>
              {textChannels.map((channel, index) => {
                const isFirst = index === 0;
                const isLast = index === textChannels.length - 1;
                return (
                  <Box
                    key={channel.id}
                    display="flex"
                    justifyContent="space-between"
                    alignItems="center"
                    p={1}
                    border={1}
                    borderColor="divider"
                    borderRadius={1}
                  >
                    <Box display="flex" alignItems="center" gap={1}>
                      <Typography variant="body2" fontWeight="medium">
                        {channel.name}
                      </Typography>
                      {channel.isPrivate && (
                        <Chip label="Private" size="small" color="warning" />
                      )}
                      {channel.description && (
                        <Typography variant="caption" color="text.secondary">
                          {channel.description}
                        </Typography>
                      )}
                    </Box>

                    {canManageChannels && (
                      <Box display="flex" gap={0.5}>
                        {canUpdateChannels && (
                          <>
                            <IconButton
                              size="small"
                              onClick={() => handleMoveUp(channel.id)}
                              disabled={isFirst || movingUp || movingDown}
                              title="Move up"
                            >
                              <ArrowUpIcon fontSize="small" />
                            </IconButton>
                            <IconButton
                              size="small"
                              onClick={() => handleMoveDown(channel.id)}
                              disabled={isLast || movingUp || movingDown}
                              title="Move down"
                            >
                              <ArrowDownIcon fontSize="small" />
                            </IconButton>
                            <IconButton
                              size="small"
                              onClick={() => handleEditChannel(channel)}
                              title="Edit channel"
                            >
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </>
                        )}
                        {canDeleteChannels && channel.name !== "general" && (
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => handleDeleteChannel(channel.id, channel.name)}
                            disabled={deletingChannel}
                            title="Delete channel"
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        )}
                      </Box>
                    )}
                  </Box>
                );
              })}
            </Box>
          </Box>
        )}

        {/* Voice Channels */}
        {voiceChannels.length > 0 && (
          <Box>
            <Typography variant="subtitle2" color="text.secondary" mb={1}>
              Voice Channels
            </Typography>
            <Box display="flex" flexDirection="column" gap={1}>
              {voiceChannels.map((channel, index) => {
                const isFirst = index === 0;
                const isLast = index === voiceChannels.length - 1;
                return (
                  <Box
                    key={channel.id}
                    display="flex"
                    justifyContent="space-between"
                    alignItems="center"
                    p={1}
                    border={1}
                    borderColor="divider"
                    borderRadius={1}
                  >
                    <Box display="flex" alignItems="center" gap={1}>
                      <Typography variant="body2" fontWeight="medium">
                        {channel.name}
                      </Typography>
                      {channel.isPrivate && (
                        <Chip label="Private" size="small" color="warning" />
                      )}
                      {channel.description && (
                        <Typography variant="caption" color="text.secondary">
                          {channel.description}
                        </Typography>
                      )}
                    </Box>

                    {canManageChannels && (
                      <Box display="flex" gap={0.5}>
                        {canUpdateChannels && (
                          <>
                            <IconButton
                              size="small"
                              onClick={() => handleMoveUp(channel.id)}
                              disabled={isFirst || movingUp || movingDown}
                              title="Move up"
                            >
                              <ArrowUpIcon fontSize="small" />
                            </IconButton>
                            <IconButton
                              size="small"
                              onClick={() => handleMoveDown(channel.id)}
                              disabled={isLast || movingUp || movingDown}
                              title="Move down"
                            >
                              <ArrowDownIcon fontSize="small" />
                            </IconButton>
                            <IconButton
                              size="small"
                              onClick={() => handleEditChannel(channel)}
                              title="Edit channel"
                            >
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </>
                        )}
                        {canDeleteChannels && channel.name !== "general" && (
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => handleDeleteChannel(channel.id, channel.name)}
                            disabled={deletingChannel}
                            title="Delete channel"
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        )}
                      </Box>
                    )}
                  </Box>
                );
              })}
            </Box>
          </Box>
        )}

        {/* Create Channel Dialog */}
        <Dialog
          open={createDialogOpen}
          onClose={handleCloseCreateDialog}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>Create New Channel</DialogTitle>
          <DialogContent>
            <TextField
              autoFocus
              label="Channel Name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              fullWidth
              margin="normal"
              placeholder="general, announcements, etc."
            />
            <FormControl fullWidth margin="normal">
              <InputLabel>Channel Type</InputLabel>
              <Select
                value={formData.type}
                label="Channel Type"
                onChange={(e) => setFormData({ ...formData, type: e.target.value as "TEXT" | "VOICE" })}
              >
                <MenuItem value="TEXT">Text Channel</MenuItem>
                <MenuItem value="VOICE">Voice Channel</MenuItem>
              </Select>
            </FormControl>
            <TextField
              label="Description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              fullWidth
              margin="normal"
              multiline
              rows={2}
              placeholder="What is this channel about?"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={formData.isPrivate}
                  onChange={(e) => setFormData({ ...formData, isPrivate: e.target.checked })}
                />
              }
              label="Private Channel"
            />
            <Typography variant="caption" color="text.secondary" display="block" mt={1}>
              Private channels require explicit membership management
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseCreateDialog}>Cancel</Button>
            <Button
              onClick={handleCreateChannel}
              variant="contained"
              disabled={!formData.name.trim() || creatingChannel}
            >
              {creatingChannel ? <CircularProgress size={20} /> : "Create Channel"}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Edit Channel Dialog */}
        <Dialog
          open={editDialogOpen}
          onClose={handleCloseEditDialog}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>Edit Channel</DialogTitle>
          <DialogContent>
            <TextField
              autoFocus
              label="Channel Name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              fullWidth
              margin="normal"
            />
            <TextField
              label="Description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              fullWidth
              margin="normal"
              multiline
              rows={2}
            />
            <FormControlLabel
              control={
                <Switch
                  checked={formData.isPrivate}
                  onChange={(e) => setFormData({ ...formData, isPrivate: e.target.checked })}
                />
              }
              label="Private Channel"
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseEditDialog}>Cancel</Button>
            <Button
              onClick={handleUpdateChannel}
              variant="contained"
              disabled={!formData.name.trim() || updatingChannel}
            >
              {updatingChannel ? <CircularProgress size={20} /> : "Update Channel"}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog
          open={confirmDeleteOpen}
          onClose={cancelDeleteChannel}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>Delete Channel</DialogTitle>
          <DialogContent>
            <DialogContentText>
              Are you sure you want to delete the channel <strong>"{channelToDelete?.name}"</strong>? 
              This action cannot be undone and all messages in this channel will be permanently lost.
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={cancelDeleteChannel}>
              Cancel
            </Button>
            <Button 
              onClick={confirmDeleteChannel} 
              color="error" 
              variant="contained"
              disabled={deletingChannel}
            >
              {deletingChannel ? <CircularProgress size={20} /> : "Delete Channel"}
            </Button>
          </DialogActions>
        </Dialog>
      </CardContent>
    </Card>
  );
};

export default ChannelManagement;
