import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Alert,
  IconButton,
  InputAdornment,
  Typography,
  CircularProgress,
} from '@mui/material';
import {
  Visibility,
  VisibilityOff,
  Autorenew as GenerateIcon,
} from '@mui/icons-material';
import { useMutation } from '@tanstack/react-query';
import { userControllerSetUserPasswordMutation } from '../../api-client/@tanstack/react-query.gen';
import type { AdminUserEntity as AdminUser } from '../../api-client/types.gen';

// Unambiguous characters only (no 0/O, 1/l/I) so generated passwords are easy
// to read out or transcribe when handed to the user
const PASSWORD_CHARSET =
  'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*';

function generatePassword(length = 16): string {
  const values = new Uint32Array(length);
  crypto.getRandomValues(values);
  return Array.from(
    values,
    (v) => PASSWORD_CHARSET[v % PASSWORD_CHARSET.length],
  ).join('');
}

interface ResetPasswordDialogProps {
  user: AdminUser | null;
  onClose: () => void;
}

/**
 * Admin password override dialog: sets a new password for a user and
 * signs them out of all sessions.
 */
const ResetPasswordDialog: React.FC<ResetPasswordDialogProps> = ({
  user,
  onClose,
}) => {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const { mutateAsync: setUserPassword, isPending } = useMutation(
    userControllerSetUserPasswordMutation(),
  );

  const handleClose = () => {
    setPassword('');
    setConfirm('');
    setShowPassword(false);
    setError(null);
    setSuccess(false);
    onClose();
  };

  const handleGenerate = () => {
    const generated = generatePassword();
    setPassword(generated);
    setConfirm(generated);
    setShowPassword(true);
  };

  const tooShort = password.length > 0 && password.length < 8;
  const mismatch = confirm.length > 0 && password !== confirm;
  const canSubmit =
    password.length >= 8 && password === confirm && !isPending && !success;

  const handleSubmit = async () => {
    if (!user) return;
    setError(null);
    try {
      await setUserPassword({ path: { id: user.id }, body: { password } });
      setSuccess(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to reset password',
      );
    }
  };

  return (
    <Dialog open={!!user} onClose={handleClose} maxWidth="xs" fullWidth>
      <DialogTitle>
        Reset Password for {user?.displayName || user?.username}
      </DialogTitle>
      <DialogContent>
        {success ? (
          <Alert severity="success" sx={{ mt: 1 }}>
            Password updated. The user has been signed out of all sessions
            and can log in with the new password.
          </Alert>
        ) : (
          <>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Set a new password for this user. They will be signed out of
              all sessions and must log in with the new password.
            </Typography>
            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}
            <TextField
              label="New password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              fullWidth
              size="small"
              margin="dense"
              error={tooShort}
              helperText={tooShort ? 'Must be at least 8 characters' : ' '}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      aria-label={
                        showPassword ? 'Hide password' : 'Show password'
                      }
                      onClick={() => setShowPassword(!showPassword)}
                      edge="end"
                      size="small"
                    >
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
            <TextField
              label="Confirm password"
              type={showPassword ? 'text' : 'password'}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              fullWidth
              size="small"
              margin="dense"
              error={mismatch}
              helperText={mismatch ? 'Passwords do not match' : ' '}
            />
            <Button
              startIcon={<GenerateIcon />}
              onClick={handleGenerate}
              size="small"
            >
              Generate password
            </Button>
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>{success ? 'Close' : 'Cancel'}</Button>
        {!success && (
          <Button
            variant="contained"
            onClick={handleSubmit}
            disabled={!canSubmit}
          >
            {isPending ? <CircularProgress size={20} /> : 'Reset Password'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default ResetPasswordDialog;
