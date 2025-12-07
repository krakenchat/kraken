import React from "react";
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  CircularProgress,
  Alert,
} from "@mui/material";
import {
  People as PeopleIcon,
  Groups as CommunitiesIcon,
  Chat as ChannelsIcon,
  Message as MessagesIcon,
  Link as InvitesIcon,
  Block as BannedIcon,
} from "@mui/icons-material";
import { useTheme } from "@mui/material/styles";
import { useGetInstanceStatsQuery } from "../../features/admin/adminApiSlice";

interface StatCardProps {
  title: string;
  value: number;
  icon: React.ReactNode;
  color: string;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, icon, color }) => (
  <Card
    sx={{
      height: "100%",
      position: "relative",
      overflow: "hidden",
      transition: "transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out",
      "&:hover": {
        transform: "translateY(-2px)",
      },
    }}
  >
    {/* Subtle gradient accent at top */}
    <Box
      sx={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        height: 4,
        background: `linear-gradient(90deg, ${color} 0%, ${color}88 100%)`,
      }}
    />
    <CardContent sx={{ pt: 3 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
        <Box
          sx={{
            p: 1.5,
            borderRadius: 2,
            background: `linear-gradient(135deg, ${color}25 0%, ${color}15 100%)`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {React.cloneElement(icon as React.ReactElement, {
            sx: { fontSize: 28, color },
          })}
        </Box>
        <Box>
          <Typography variant="h4" fontWeight="bold">
            {value.toLocaleString()}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {title}
          </Typography>
        </Box>
      </Box>
    </CardContent>
  </Card>
);

const AdminDashboard: React.FC = () => {
  const theme = useTheme();
  const { data: stats, isLoading, error } = useGetInstanceStatsQuery();

  if (isLoading) {
    return (
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          minHeight: 400,
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error">
        Failed to load instance statistics. Please try again.
      </Alert>
    );
  }

  return (
    <Box>
      <Typography variant="h4" gutterBottom fontWeight="bold">
        Dashboard
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
        Overview of your instance statistics
      </Typography>

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <StatCard
            title="Total Users"
            value={stats?.totalUsers ?? 0}
            icon={<PeopleIcon />}
            color={theme.palette.info.main}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <StatCard
            title="Communities"
            value={stats?.totalCommunities ?? 0}
            icon={<CommunitiesIcon />}
            color={theme.palette.success.main}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <StatCard
            title="Channels"
            value={stats?.totalChannels ?? 0}
            icon={<ChannelsIcon />}
            color={theme.palette.warning.main}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <StatCard
            title="Messages"
            value={stats?.totalMessages ?? 0}
            icon={<MessagesIcon />}
            color={theme.palette.secondary.main}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <StatCard
            title="Active Invites"
            value={stats?.activeInvites ?? 0}
            icon={<InvitesIcon />}
            color={theme.palette.primary.main}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <StatCard
            title="Banned Users"
            value={stats?.bannedUsers ?? 0}
            icon={<BannedIcon />}
            color={theme.palette.error.main}
          />
        </Grid>
      </Grid>
    </Box>
  );
};

export default AdminDashboard;
