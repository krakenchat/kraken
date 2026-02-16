/**
 * KickConfirmDialog Component
 *
 * Confirmation dialog for kicking a user from a community.
 * Unlike bans, kicked users can rejoin the community.
 */

import React, { useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Typography,
  Box,
  Alert,
  CircularProgress,
} from "@mui/material";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { moderationControllerKickUserMutation } from "../../api-client/@tanstack/react-query.gen";

interface KickConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  communityId: string;
  userId: string;
  userName: string;
}

const KickConfirmDialog: React.FC<KickConfirmDialogProps> = ({
  open,
  onClose,
  communityId,
  userId,
  userName,
}) => {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const queryClient = useQueryClient();
  const { mutateAsync: kickUser, isPending: isLoading } = useMutation({
    ...moderationControllerKickUserMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [{ _id: 'moderationControllerGetModerationLogs' }] });
      queryClient.invalidateQueries({ queryKey: [{ _id: 'membershipControllerFindAllForCommunity' }] });
      queryClient.invalidateQueries({ queryKey: [{ _id: 'membershipControllerFindAllForUser' }] });
      queryClient.invalidateQueries({ queryKey: [{ _id: 'membershipControllerFindMyMemberships' }] });
      queryClient.invalidateQueries({ queryKey: [{ _id: 'membershipControllerFindOne' }] });
      queryClient.invalidateQueries({ queryKey: [{ _id: 'membershipControllerSearchCommunityMembers' }] });
    },
  });

  const handleSubmit = async () => {
    setError(null);
    try {
      await kickUser({
        path: { communityId, userId },
        body: {
          reason: reason.trim() || undefined,
        },
      });

      handleClose();
    } catch (err: unknown) {
      const errorMessage = err && typeof err === "object" && "data" in err
        ? (err as { data?: { message?: string } }).data?.message || "Failed to kick user"
        : "Failed to kick user";
      setError(errorMessage);
    }
  };

  const handleClose = () => {
    setReason("");
    setError(null);
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Kick {userName}</DialogTitle>
      <DialogContent>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
          {error && (
            <Alert severity="error" onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          <Typography variant="body2" color="text.secondary">
            This user will be removed from the community but can rejoin if they
            have an invite link.
          </Typography>

          <TextField
            label="Reason (optional)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            multiline
            rows={2}
            fullWidth
            placeholder="Reason for the kick..."
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={isLoading}>
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          color="warning"
          disabled={isLoading}
          startIcon={isLoading ? <CircularProgress size={16} /> : undefined}
        >
          {isLoading ? "Kicking..." : "Kick User"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default KickConfirmDialog;
