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

  // Mirror the backend DTO rule (8-128 chars) so the submit button state
  // matches what the API will accept
  const tooShort = password.length > 0 && password.length < 8;
  const tooLong = password.length > 128;
  const mismatch = confirm.length > 0 && password !== confirm;
  const canSubmit =
    password.length >= 8 &&
    !tooLong &&
    password === confirm &&
    !isPending &&
    !success;

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
            Password updated. The user can log in with the new password now;
            existing devices are signed out as their access tokens expire
            (up to 1 hour).
          </Alert>
        ) : (
          <>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Set a new password for this user. Their sessions are revoked;
              signed-in devices stay active for up to an hour, until their
              current access token expires.
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
              autoComplete="new-password"
              error={tooShort || tooLong}
              helperText={
                tooShort
                  ? 'Must be at least 8 characters'
                  : tooLong
                    ? 'Must be at most 128 characters'
                    : ' '
              }
              inputProps={{ maxLength: 128 }}
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
              autoComplete="new-password"
              error={mismatch}
              helperText={mismatch ? 'Passwords do not match' : ' '}
              inputProps={{ maxLength: 128 }}
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
