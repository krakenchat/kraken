import React, { useState } from "react";
import {
  Box,
  Typography,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  TextField,
  InputAdornment,
  CircularProgress,
  Alert,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Tooltip,
  Avatar,
} from "@mui/material";
import {
  Search as SearchIcon,
  Delete as DeleteIcon,
  OpenInNew as OpenIcon,
} from "@mui/icons-material";
import { useNavigate } from "react-router-dom";
import {
  useGetAdminCommunitiesQuery,
  useForceDeleteCommunityMutation,
  AdminCommunity,
} from "../../features/admin/adminApiSlice";

const AdminCommunitiesPage: React.FC = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    community: AdminCommunity | null;
  }>({ open: false, community: null });

  const { data, isLoading, error, refetch } = useGetAdminCommunitiesQuery({
    search: search || undefined,
    limit: 100,
  });

  const [forceDeleteCommunity] = useForceDeleteCommunityMutation();

  const handleDelete = (community: AdminCommunity) => {
    setConfirmDialog({ open: true, community });
  };

  const handleConfirmDelete = async () => {
    if (!confirmDialog.community) return;

    try {
      await forceDeleteCommunity(confirmDialog.community.id).unwrap();
      refetch();
    } catch (error) {
      console.error("Failed to delete community:", error);
    }

    setConfirmDialog({ open: false, community: null });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  if (isLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: 400 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return <Alert severity="error">Failed to load communities. Please try again.</Alert>;
  }

  return (
    <Box>
      <Typography variant="h4" gutterBottom fontWeight="bold">
        Community Management
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
        View and manage all communities on this instance
      </Typography>

      {/* Search */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <TextField
            placeholder="Search communities..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
            sx={{ minWidth: 300 }}
            size="small"
          />
        </CardContent>
      </Card>

      {/* Communities Table */}
      <Card>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Community</TableCell>
                <TableCell align="right">Members</TableCell>
                <TableCell align="right">Channels</TableCell>
                <TableCell>Created</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data?.communities.map((community) => (
                <TableRow key={community.id} hover>
                  <TableCell>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                      <Avatar
                        src={community.avatar || undefined}
                        sx={{ width: 40, height: 40 }}
                      >
                        {community.name[0].toUpperCase()}
                      </Avatar>
                      <Box>
                        <Typography variant="body2" fontWeight="medium">
                          {community.name}
                        </Typography>
                        {community.description && (
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{
                              display: "-webkit-box",
                              WebkitLineClamp: 1,
                              WebkitBoxOrient: "vertical",
                              overflow: "hidden",
                              maxWidth: 300,
                            }}
                          >
                            {community.description}
                          </Typography>
                        )}
                      </Box>
                    </Box>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2">
                      {community.memberCount.toLocaleString()}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2">
                      {community.channelCount.toLocaleString()}
                    </Typography>
                  </TableCell>
                  <TableCell>{formatDate(community.createdAt)}</TableCell>
                  <TableCell align="right">
                    <Tooltip title="Open Community">
                      <IconButton
                        onClick={() => navigate(`/community/${community.id}`)}
                        size="small"
                      >
                        <OpenIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete Community">
                      <IconButton
                        onClick={() => handleDelete(community)}
                        size="small"
                        color="error"
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      {/* Empty State */}
      {data?.communities.length === 0 && (
        <Box sx={{ textAlign: "center", py: 4 }}>
          <Typography color="text.secondary">
            {search ? "No communities match your search" : "No communities found"}
          </Typography>
        </Box>
      )}

      {/* Confirmation Dialog */}
      <Dialog
        open={confirmDialog.open}
        onClose={() => setConfirmDialog({ open: false, community: null })}
      >
        <DialogTitle>Delete Community</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete{" "}
            <strong>{confirmDialog.community?.name}</strong>? This will permanently
            remove all channels, messages, and members from this community.
          </DialogContentText>
          <Typography color="error" sx={{ mt: 2 }}>
            This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDialog({ open: false, community: null })}>
            Cancel
          </Button>
          <Button onClick={handleConfirmDelete} color="error" variant="contained">
            Delete Community
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AdminCommunitiesPage;
