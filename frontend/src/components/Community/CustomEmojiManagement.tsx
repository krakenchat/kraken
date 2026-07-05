import React, { useState, useCallback, useRef } from "react";
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Alert,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  TextField,
  Tooltip,
  Stack,
} from "@mui/material";
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  UploadFile as UploadFileIcon,
} from "@mui/icons-material";
import { useUserPermissions } from "../../features/roles/useUserPermissions";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  customEmojiControllerListCommunityEmojisOptions,
  customEmojiControllerListCommunityEmojisQueryKey,
  customEmojiControllerCreateEmojiMutation,
  customEmojiControllerDeleteEmojiMutation,
} from "../../api-client/@tanstack/react-query.gen";
import type { CustomEmojiDto } from "../../api-client/types.gen";
import { useFileUpload } from "../../hooks/useFileUpload";
import { getFileUrl } from "../../utils/fileHelpers";
import ConfirmDialog from "../Common/ConfirmDialog";

interface CustomEmojiManagementProps {
  communityId: string;
}

const NAME_REGEX = /^(?=.*[a-z])[a-z0-9_]{2,32}$/;

const CustomEmojiManagement: React.FC<CustomEmojiManagementProps> = ({ communityId }) => {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [emojiToDelete, setEmojiToDelete] = useState<CustomEmojiDto | null>(null);

  const { hasPermissions: canManage } = useUserPermissions({
    resourceType: "COMMUNITY",
    resourceId: communityId,
    actions: ["MANAGE_EMOJIS"],
  });

  const {
    data: emojis,
    isLoading,
    error: listError,
  } = useQuery(
    customEmojiControllerListCommunityEmojisOptions({ path: { communityId } }),
  );

  const invalidate = useCallback(
    () =>
      queryClient.invalidateQueries({
        queryKey: customEmojiControllerListCommunityEmojisQueryKey({
          path: { communityId },
        }),
      }),
    [queryClient, communityId],
  );

  const { uploadFile, isUploading } = useFileUpload();
  const { mutateAsync: createEmoji, isPending: creating } = useMutation({
    ...customEmojiControllerCreateEmojiMutation(),
    onSuccess: invalidate,
  });
  const { mutateAsync: deleteEmoji, isPending: deleting } = useMutation({
    ...customEmojiControllerDeleteEmojiMutation(),
    onSuccess: invalidate,
  });

  const resetForm = () => {
    setName("");
    setFile(null);
    setFormError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleCreate = useCallback(async () => {
    setFormError(null);
    if (!NAME_REGEX.test(name)) {
      setFormError(
        "Name must be 2-32 characters of lowercase letters, numbers, or underscores, and include at least one letter.",
      );
      return;
    }
    if (!file) {
      setFormError("Choose an image file (PNG, GIF, or WebP, max 256KB).");
      return;
    }
    try {
      const uploaded = await uploadFile(file, {
        resourceType: "CUSTOM_EMOJI",
        resourceId: communityId,
      });
      await createEmoji({
        path: { communityId },
        body: { name, fileId: uploaded.id },
      });
      resetForm();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to add emoji.");
    }
  }, [name, file, uploadFile, createEmoji, communityId]);

  const handleConfirmDelete = useCallback(async () => {
    if (!emojiToDelete) return;
    try {
      await deleteEmoji({
        path: { communityId, emojiId: emojiToDelete.id },
      });
      setEmojiToDelete(null);
    } catch {
      // surfaced via mutation error state
    }
  }, [emojiToDelete, deleteEmoji, communityId]);

  if (!canManage) {
    return (
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Custom Emoji
          </Typography>
          <Alert severity="info">
            You don't have permission to manage custom emojis in this community.
          </Alert>
        </CardContent>
      </Card>
    );
  }

  const submitting = isUploading || creating;

  return (
    <>
      <Card>
        <CardContent>
          <Box mb={3}>
            <Typography variant="h6">Custom Emoji</Typography>
            <Typography variant="body2" color="text.secondary">
              Upload small images (PNG, GIF, or WebP, max 256KB) and give them a
              <code> :shortcode: </code> name. Members can use them in messages and
              as reactions.
            </Typography>
          </Box>

          {/* Upload form */}
          <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ sm: "center" }}>
              <Button
                variant="outlined"
                component="label"
                startIcon={<UploadFileIcon />}
              >
                {file ? "Change image" : "Choose image"}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/gif,image/webp"
                  hidden
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
              </Button>
              {file && (
                <Typography variant="caption" color="text.secondary" sx={{ maxWidth: 160 }} noWrap>
                  {file.name}
                </Typography>
              )}
              <TextField
                size="small"
                label="Shortcode"
                placeholder="party_blob"
                value={name}
                onChange={(e) => setName(e.target.value.toLowerCase())}
                InputProps={{
                  startAdornment: <Box component="span" sx={{ color: "text.disabled", mr: 0.5 }}>:</Box>,
                  endAdornment: <Box component="span" sx={{ color: "text.disabled", ml: 0.5 }}>:</Box>,
                }}
              />
              <Button
                variant="contained"
                startIcon={submitting ? <CircularProgress size={16} /> : <AddIcon />}
                onClick={handleCreate}
                disabled={submitting}
              >
                Add Emoji
              </Button>
            </Stack>
            {formError && (
              <Alert severity="error" sx={{ mt: 2 }}>
                {formError}
              </Alert>
            )}
          </Paper>

          {listError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              Failed to load custom emojis. Please try again.
            </Alert>
          )}

          {isLoading ? (
            <Box display="flex" justifyContent="center" p={2}>
              <CircularProgress />
            </Box>
          ) : emojis && emojis.length > 0 ? (
            <TableContainer component={Paper} variant="outlined">
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Preview</TableCell>
                    <TableCell>Shortcode</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {emojis.map((emoji) => (
                    <TableRow key={emoji.id}>
                      <TableCell>
                        <img
                          src={getFileUrl(emoji.fileId) ?? undefined}
                          alt={`:${emoji.name}:`}
                          style={{ height: 28, width: "auto", objectFit: "contain" }}
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontFamily: "monospace" }}>
                          :{emoji.name}:
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Tooltip title="Delete emoji">
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => setEmojiToDelete(emoji)}
                          >
                            <DeleteIcon />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          ) : (
            <Box
              display="flex"
              flexDirection="column"
              alignItems="center"
              justifyContent="center"
              py={4}
            >
              <Typography variant="h6" color="text.secondary" gutterBottom>
                No custom emojis yet
              </Typography>
              <Typography variant="body2" color="text.secondary" align="center">
                Upload an image above to add your first custom emoji.
              </Typography>
            </Box>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={!!emojiToDelete}
        title="Delete Custom Emoji"
        description={
          <>
            Are you sure you want to delete <strong>:{emojiToDelete?.name}:</strong>?
            Existing messages will fall back to showing the shortcode text.
          </>
        }
        confirmLabel="Delete"
        confirmColor="error"
        isLoading={deleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setEmojiToDelete(null)}
      />
    </>
  );
};

export default CustomEmojiManagement;
