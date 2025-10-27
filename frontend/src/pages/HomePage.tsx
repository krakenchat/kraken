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
  Link as LinkIcon,
  Settings as SettingsIcon,
} from "@mui/icons-material";
import { Link } from "react-router-dom";
import { useProfileQuery } from "../features/users/usersSlice";
import { useUserPermissions } from "../features/roles/useUserPermissions";
import { useCreateInviteMutation } from "../features/invite/inviteApiSlice";
import { useMyCommunitiesQuery } from "../features/community/communityApiSlice";
import { CreateInviteDto } from "../types/invite.type";
import { useResponsive } from "../hooks/useResponsive";

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
  const { data, isLoading, isError } = useProfileQuery(undefined);
  const { data: communities = [] } = useMyCommunitiesQuery();
  const [createInvite, { isLoading: creatingInvite }] = useCreateInviteMutation();
  const [lastCreatedInvite, setLastCreatedInvite] = useState<string | null>(null);
  const [snackbarOpen, setSnackbarOpen] = useState(false);

  const { hasPermissions: canCreateInvites } = useUserPermissions({
    resourceType: "INSTANCE",
    actions: ["CREATE_INSTANCE_INVITE"],
  });

  const { hasPermissions: canViewInvites } = useUserPermissions({
    resourceType: "INSTANCE", 
    actions: ["READ_INSTANCE_INVITE"],
  });

  const handleQuickInvite = async () => {
    try {
      // Auto-select communities (prefer "default" community if it exists, otherwise all communities)
      const defaultCommunity = communities.find(c => c.name.toLowerCase() === 'default');
      const selectedCommunities = defaultCommunity ? [defaultCommunity.id] : communities.map(c => c.id);
      
      const createInviteDto: CreateInviteDto = {
        communityIds: selectedCommunities,
        maxUses: 10,
        validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      };
      
      const newInvite = await createInvite(createInviteDto).unwrap();
      setLastCreatedInvite(newInvite.code);
      
      // Auto-copy the invite link
      const inviteUrl = `${window.location.origin}/join/${newInvite.code}`;
      await navigator.clipboard.writeText(inviteUrl);
      setSnackbarOpen(true);
    } catch (error) {
      console.error("Failed to create invite:", error);
    }
  };

  const handleCopyInvite = async () => {
    if (lastCreatedInvite) {
      const inviteUrl = `${window.location.origin}/join/${lastCreatedInvite}`;
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
            background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
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
              {creatingInvite ? <CircularProgress size={20} color="inherit" /> : "Quick Invite"}
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
                    bgcolor: "rgba(255, 255, 255, 0.1)"
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
            padding: 2,
            borderRadius: 2,
            boxShadow: 3,
          }}
        >
          <CardContent
            sx={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
            }}
          >
            <Avatar
              sx={{
                width: 80,
                height: 80,
                marginBottom: 2,
                backgroundColor: "#1976d2",
                fontSize: 32,
              }}
            >
              {data.avatarUrl ? (
                <img
                  src={data.avatarUrl}
                  alt={`${data.displayName}'s avatar`}
                  style={{ width: "100%", height: "100%", borderRadius: "50%" }}
                />
              ) : (
                data.displayName?.charAt(0).toUpperCase()
              )}
            </Avatar>
            <Typography variant="h5" component="h1" sx={{ marginBottom: 1 }}>
              {data.displayName}
            </Typography>
            <Typography
              variant="body1"
              color="textSecondary"
              sx={{ marginBottom: 1 }}
            >
              @{data.username}
            </Typography>
            <Typography
              variant="body2"
              color="textSecondary"
              sx={{ marginBottom: 1 }}
            >
              Role: {data.role}
            </Typography>
            <Typography variant="body2" color="textSecondary">
              Last Seen:{" "}
              {data.lastSeen ? new Date(data.lastSeen).toLocaleString() : "N/A"}
            </Typography>
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
