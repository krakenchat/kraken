import React, { useState } from "react";
import {
  Box,
  Card,
  CardContent,
  Typography,
  Avatar,
  CircularProgress,
  Alert,
  Button,
  Paper,
  IconButton,
  Tooltip,
  Snackbar,
} from "@mui/material";
import {
  PersonAdd as PersonAddIcon,
  ContentCopy as CopyIcon,
  Settings as SettingsIcon,
} from "@mui/icons-material";
import { useTheme, alpha } from "@mui/material/styles";
import { Link } from "react-router-dom";
import { useProfileQuery } from "../features/users/usersSlice";
import { useUserPermissions } from "../features/roles/useUserPermissions";
import { useCreateInviteMutation } from "../features/invite/inviteApiSlice";
import { useMyCommunitiesQuery } from "../features/community/communityApiSlice";
import { CreateInviteDto } from "../types/invite.type";
import { useResponsive } from "../hooks/useResponsive";
import { useAuthenticatedImage } from "../hooks/useAuthenticatedFile";

const HomePage: React.FC = () => {
  const { isMobile } = useResponsive();

  // Mobile version is handled by MobileLayout with panel navigation
  if (isMobile) {
    return null;
  }

  // Desktop version below
  return <DesktopHomePage />;
};

const DesktopHomePage: React.FC = () => {
  const theme = useTheme();
  const { data, isLoading, isError } = useProfileQuery(undefined);
  const { data: communities = [] } = useMyCommunitiesQuery();
  const [createInvite, { isLoading: creatingInvite }] =
    useCreateInviteMutation();
  const [lastCreatedInvite, setLastCreatedInvite] = useState<string | null>(
    null
  );
  const [snackbarOpen, setSnackbarOpen] = useState(false);

  const { hasPermissions: canCreateInvites } = useUserPermissions({
    resourceType: "INSTANCE",
    actions: ["CREATE_INSTANCE_INVITE"],
  });

  const { hasPermissions: canViewInvites } = useUserPermissions({
    resourceType: "INSTANCE",
    actions: ["READ_INSTANCE_INVITE"],
  });

  const { blobUrl: avatarUrl } = useAuthenticatedImage(data?.avatarUrl || null);

  const handleQuickInvite = async () => {
    try {
      // Auto-select communities (prefer "default" community if it exists, otherwise all communities)
      const defaultCommunity = communities.find(
        (c) => c.name.toLowerCase() === "default"
      );
      const selectedCommunities = defaultCommunity
        ? [defaultCommunity.id]
        : communities.map((c) => c.id);

      const createInviteDto: CreateInviteDto = {
        communityIds: selectedCommunities,
        maxUses: 10,
        validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      };

      const newInvite = await createInvite(createInviteDto).unwrap();
      setLastCreatedInvite(newInvite.code);

      // Auto-copy the invite link
      const inviteUrl = `${window.location.origin}/#/join/${newInvite.code}`;
      await navigator.clipboard.writeText(inviteUrl);
      setSnackbarOpen(true);
    } catch (error) {
      console.error("Failed to create invite:", error);
    }
  };

  const handleCopyInvite = async () => {
    if (lastCreatedInvite) {
      const inviteUrl = `${window.location.origin}/#/join/${lastCreatedInvite}`;
      await navigator.clipboard.writeText(inviteUrl);
      setSnackbarOpen(true);
    }
  };

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "500px",
        padding: 2,
        gap: 3,
      }}
    >
      {isLoading && <CircularProgress />}
      {isError && (
        <Alert severity="error" sx={{ width: "100%", maxWidth: 400 }}>
          Error loading profile!
        </Alert>
      )}

      {/* Quick Invite Section */}
      {data && canCreateInvites && (
        <Paper
          sx={{
            p: 3,
            width: "100%",
            maxWidth: 500,
            borderRadius: 2,
            background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
            color: "white",
          }}
        >
          <Box display="flex" alignItems="center" gap={2} mb={2}>
            <PersonAddIcon sx={{ fontSize: 32 }} />
            <Box>
              <Typography variant="h6" fontWeight="bold">
                Invite Users to Kraken
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.9 }}>
                Share your instance with others
              </Typography>
            </Box>
          </Box>

          <Box display="flex" gap={2} flexWrap="wrap">
            <Button
              variant="contained"
              onClick={handleQuickInvite}
              disabled={creatingInvite}
              sx={{
                bgcolor: "rgba(255, 255, 255, 0.2)",
                "&:hover": { bgcolor: "rgba(255, 255, 255, 0.3)" },
                color: "white",
                backdropFilter: "blur(10px)",
              }}
            >
              {creatingInvite ? (
                <CircularProgress size={20} color="inherit" />
              ) : (
                "Quick Invite"
              )}
            </Button>

            {lastCreatedInvite && (
              <Box display="flex" alignItems="center" gap={1}>
                <Typography variant="body2" sx={{ fontFamily: "monospace" }}>
                  {lastCreatedInvite}
                </Typography>
                <Tooltip title="Copy invite link">
                  <IconButton
                    onClick={handleCopyInvite}
                    sx={{ color: "white", bgcolor: "rgba(255, 255, 255, 0.1)" }}
                    size="small"
                  >
                    <CopyIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>
            )}

            {canViewInvites && (
              <Button
                component={Link}
                to="/admin/invites"
                variant="outlined"
                sx={{
                  borderColor: "rgba(255, 255, 255, 0.5)",
                  color: "white",
                  "&:hover": {
                    borderColor: "white",
                    bgcolor: "rgba(255, 255, 255, 0.1)",
                  },
                }}
                startIcon={<SettingsIcon />}
              >
                Manage Invites
              </Button>
            )}
          </Box>
        </Paper>
      )}

      {data && (
        <Card
          sx={{
            width: "100%",
            maxWidth: 400,
            borderRadius: 3,
            overflow: "hidden",
          }}
        >
          {/* Gradient Banner */}
          <Box
            sx={{
              height: 80,
              background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
            }}
          />
          <CardContent
            sx={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              mt: -5,
              pb: 3,
            }}
          >
            <Avatar
              src={avatarUrl}
              alt={`${data.displayName}'s avatar`}
              sx={{
                width: 80,
                height: 80,
                marginBottom: 2,
                backgroundColor: "#1976d2",
                fontSize: 32,
                border: 4,
                borderColor: "background.paper",
              }}
            >
              {!avatarUrl && data.displayName?.charAt(0).toUpperCase()}
            </Avatar>
            <Typography variant="h5" component="h1" fontWeight={600}>
              {data.displayName}
            </Typography>
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ mb: 1 }}
            >
              @{data.username}
            </Typography>
            <Box
              sx={{
                display: "inline-flex",
                px: 2,
                py: 0.5,
                borderRadius: 2,
                bgcolor: (theme) =>
                  theme.palette.mode === "dark"
                    ? "rgba(255, 255, 255, 0.08)"
                    : "rgba(0, 0, 0, 0.04)",
              }}
            >
              <Typography
                variant="caption"
                fontWeight={600}
                color="primary"
              >
                {data.role}
              </Typography>
            </Box>
          </CardContent>
        </Card>
      )}

      {/* Snackbar for copy feedback */}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={3000}
        onClose={() => setSnackbarOpen(false)}
        message="Invite link copied to clipboard!"
      />
    </Box>
  );
};

export default HomePage;
