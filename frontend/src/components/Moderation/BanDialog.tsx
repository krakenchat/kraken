/**
 * BanDialog Component
 *
 * Dialog for banning a user from a community.
 * Supports temporary (with expiry) and permanent bans.
 */

import React, { useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  FormControlLabel,
  Radio,
  RadioGroup,
  Typography,
  Box,
  Alert,
  CircularProgress,
} from "@mui/material";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { moderationControllerBanUserMutation } from "../../api-client/@tanstack/react-query.gen";

interface BanDialogProps {
  open: boolean;
  onClose: () => void;
  communityId: string;
  userId: string;
  userName: string;
}

const DURATION_OPTIONS = [
  { label: "1 hour", value: 60 * 60 },
  { label: "1 day", value: 24 * 60 * 60 },
  { label: "1 week", value: 7 * 24 * 60 * 60 },
  { label: "1 month", value: 30 * 24 * 60 * 60 },
  { label: "Permanent", value: 0 },
];

const BanDialog: React.FC<BanDialogProps> = ({
  open,
  onClose,
  communityId,
  userId,
  userName,
}) => {
  const [reason, setReason] = useState("");
  const [durationType, setDurationType] = useState<"temporary" | "permanent">("permanent");
  const [durationSeconds, setDurationSeconds] = useState(24 * 60 * 60); // Default 1 day
  const [error, setError] = useState<string | null>(null);

  const queryClient = useQueryClient();
  const { mutateAsync: banUser, isPending: isLoading } = useMutation({
    ...moderationControllerBanUserMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [{ _id: 'moderationControllerGetBanList' }] });
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
      const expiresAt = durationType === "temporary"
        ? new Date(Date.now() + durationSeconds * 1000).toISOString()
        : undefined;

      await banUser({
        path: { communityId, userId },
        body: {
          reason: reason.trim() || undefined,
          expiresAt,
        },
      });

      handleClose();
    } catch (err: unknown) {
      const errorMessage = err && typeof err === "object" && "data" in err
        ? (err as { data?: { message?: string } }).data?.message || "Failed to ban user"
        : "Failed to ban user";
      setError(errorMessage);
    }
  };

  const handleClose = () => {
    setReason("");
    setDurationType("permanent");
    setDurationSeconds(24 * 60 * 60);
    setError(null);
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Ban {userName}</DialogTitle>
      <DialogContent>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
          {error && (
            <Alert severity="error" onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          <Typography variant="body2" color="text.secondary">
            This user will be removed from the community and prevented from rejoining
            {durationType === "temporary" ? " until the ban expires" : ""}.
          </Typography>

          <TextField
            label="Reason (optional)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            multiline
            rows={2}
            fullWidth
            placeholder="Reason for the ban..."
          />

          <FormControl component="fieldset">
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Ban Duration
            </Typography>
            <RadioGroup
              value={durationType}
              onChange={(e) => setDurationType(e.target.value as "temporary" | "permanent")}
            >
              <FormControlLabel
                value="temporary"
                control={<Radio />}
                label="Temporary"
              />
              <FormControlLabel
                value="permanent"
                control={<Radio />}
                label="Permanent"
              />
            </RadioGroup>
          </FormControl>

          {durationType === "temporary" && (
            <FormControl component="fieldset">
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                Duration
              </Typography>
              <RadioGroup
                value={durationSeconds}
                onChange={(e) => setDurationSeconds(Number(e.target.value))}
              >
                {DURATION_OPTIONS.filter(opt => opt.value > 0).map((option) => (
                  <FormControlLabel
                    key={option.value}
                    value={option.value}
                    control={<Radio />}
                    label={option.label}
                  />
                ))}
              </RadioGroup>
            </FormControl>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={isLoading}>
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          color="error"
          disabled={isLoading}
          startIcon={isLoading ? <CircularProgress size={16} /> : undefined}
        >
          {isLoading ? "Banning..." : "Ban User"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default BanDialog;
