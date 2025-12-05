/**
 * TimeoutDialog Component
 *
 * Dialog for timing out a user in a community.
 * User cannot send messages while timed out.
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
import { useTimeoutUserMutation } from "../../features/moderation/moderationApiSlice";

interface TimeoutDialogProps {
  open: boolean;
  onClose: () => void;
  communityId: string;
  userId: string;
  userName: string;
}

const DURATION_OPTIONS = [
  { label: "60 seconds", value: 60 },
  { label: "5 minutes", value: 5 * 60 },
  { label: "10 minutes", value: 10 * 60 },
  { label: "1 hour", value: 60 * 60 },
  { label: "1 day", value: 24 * 60 * 60 },
  { label: "1 week", value: 7 * 24 * 60 * 60 },
];

const TimeoutDialog: React.FC<TimeoutDialogProps> = ({
  open,
  onClose,
  communityId,
  userId,
  userName,
}) => {
  const [reason, setReason] = useState("");
  const [durationSeconds, setDurationSeconds] = useState(10 * 60); // Default 10 minutes
  const [error, setError] = useState<string | null>(null);

  const [timeoutUser, { isLoading }] = useTimeoutUserMutation();

  const handleSubmit = async () => {
    setError(null);
    try {
      await timeoutUser({
        communityId,
        userId,
        dto: {
          durationSeconds,
          reason: reason.trim() || undefined,
        },
      }).unwrap();

      handleClose();
    } catch (err: unknown) {
      const errorMessage = err && typeof err === "object" && "data" in err
        ? (err as { data?: { message?: string } }).data?.message || "Failed to timeout user"
        : "Failed to timeout user";
      setError(errorMessage);
    }
  };

  const handleClose = () => {
    setReason("");
    setDurationSeconds(10 * 60);
    setError(null);
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Timeout {userName}</DialogTitle>
      <DialogContent>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
          {error && (
            <Alert severity="error" onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          <Typography variant="body2" color="text.secondary">
            This user will be unable to send messages in this community for the
            selected duration.
          </Typography>

          <TextField
            label="Reason (optional)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            multiline
            rows={2}
            fullWidth
            placeholder="Reason for the timeout..."
          />

          <FormControl component="fieldset">
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Duration
            </Typography>
            <RadioGroup
              value={durationSeconds}
              onChange={(e) => setDurationSeconds(Number(e.target.value))}
            >
              {DURATION_OPTIONS.map((option) => (
                <FormControlLabel
                  key={option.value}
                  value={option.value}
                  control={<Radio />}
                  label={option.label}
                />
              ))}
            </RadioGroup>
          </FormControl>
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
          {isLoading ? "Timing out..." : "Timeout User"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default TimeoutDialog;
