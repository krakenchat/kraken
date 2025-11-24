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
  Chip,
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
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Tooltip,
  FormControl,
  InputLabel,
  Select,
  SelectChangeEvent,
} from "@mui/material";
import {
  Search as SearchIcon,
  MoreVert as MoreIcon,
  Block as BanIcon,
  CheckCircle as UnbanIcon,
  Delete as DeleteIcon,
  Star as OwnerIcon,
  Person as UserIcon,
} from "@mui/icons-material";
import {
  useGetAdminUsersQuery,
  useUpdateUserRoleMutation,
  useSetBanStatusMutation,
  useDeleteUserMutation,
  AdminUser,
} from "../../features/admin/adminApiSlice";
import UserAvatar from "../../components/Common/UserAvatar";

const AdminUsersPage: React.FC = () => {
  const [search, setSearch] = useState("");
  const [bannedFilter, setBannedFilter] = useState<string>("all");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    action: "ban" | "unban" | "delete" | "promote" | "demote";
    user: AdminUser | null;
  }>({ open: false, action: "ban", user: null });

  const { data, isLoading, error, refetch } = useGetAdminUsersQuery({
    search: search || undefined,
    banned: bannedFilter === "all" ? undefined : bannedFilter === "banned",
    role: roleFilter === "all" ? undefined : (roleFilter as "OWNER" | "USER"),
    limit: 100,
  });

  const [updateRole] = useUpdateUserRoleMutation();
  const [setBanStatus] = useSetBanStatusMutation();
  const [deleteUser] = useDeleteUserMutation();

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, user: AdminUser) => {
    setMenuAnchor(event.currentTarget);
    setSelectedUser(user);
  };

  const handleMenuClose = () => {
    setMenuAnchor(null);
    setSelectedUser(null);
  };

  const handleAction = (action: typeof confirmDialog.action) => {
    if (selectedUser) {
      setConfirmDialog({ open: true, action, user: selectedUser });
    }
    handleMenuClose();
  };

  const handleConfirmAction = async () => {
    const { action, user } = confirmDialog;
    if (!user) return;

    try {
      switch (action) {
        case "ban":
          await setBanStatus({ userId: user.id, banned: true }).unwrap();
          break;
        case "unban":
          await setBanStatus({ userId: user.id, banned: false }).unwrap();
          break;
        case "delete":
          await deleteUser(user.id).unwrap();
          break;
        case "promote":
          await updateRole({ userId: user.id, role: "OWNER" }).unwrap();
          break;
        case "demote":
          await updateRole({ userId: user.id, role: "USER" }).unwrap();
          break;
      }
      refetch();
    } catch (error) {
      console.error("Failed to perform action:", error);
    }

    setConfirmDialog({ open: false, action: "ban", user: null });
  };

  const getActionText = (action: typeof confirmDialog.action) => {
    switch (action) {
      case "ban":
        return "ban this user";
      case "unban":
        return "unban this user";
      case "delete":
        return "permanently delete this user";
      case "promote":
        return "promote this user to Owner";
      case "demote":
        return "demote this user to regular User";
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "Never";
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
    return <Alert severity="error">Failed to load users. Please try again.</Alert>;
  }

  return (
    <Box>
      <Typography variant="h4" gutterBottom fontWeight="bold">
        User Management
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
        Manage instance users, roles, and bans
      </Typography>

      {/* Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
            <TextField
              placeholder="Search users..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
              }}
              sx={{ minWidth: 250 }}
              size="small"
            />
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>Status</InputLabel>
              <Select
                value={bannedFilter}
                label="Status"
                onChange={(e: SelectChangeEvent) => setBannedFilter(e.target.value)}
              >
                <MenuItem value="all">All</MenuItem>
                <MenuItem value="active">Active</MenuItem>
                <MenuItem value="banned">Banned</MenuItem>
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>Role</InputLabel>
              <Select
                value={roleFilter}
                label="Role"
                onChange={(e: SelectChangeEvent) => setRoleFilter(e.target.value)}
              >
                <MenuItem value="all">All</MenuItem>
                <MenuItem value="OWNER">Owner</MenuItem>
                <MenuItem value="USER">User</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>User</TableCell>
                <TableCell>Role</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Created</TableCell>
                <TableCell>Last Seen</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data?.users.map((user) => (
                <TableRow key={user.id} hover>
                  <TableCell>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                      <UserAvatar user={user} size="small" />
                      <Box>
                        <Typography variant="body2" fontWeight="medium">
                          {user.displayName || user.username}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          @{user.username}
                        </Typography>
                      </Box>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Chip
                      icon={user.role === "OWNER" ? <OwnerIcon /> : <UserIcon />}
                      label={user.role}
                      size="small"
                      color={user.role === "OWNER" ? "primary" : "default"}
                      variant={user.role === "OWNER" ? "filled" : "outlined"}
                    />
                  </TableCell>
                  <TableCell>
                    {user.banned ? (
                      <Chip label="Banned" size="small" color="error" />
                    ) : (
                      <Chip label="Active" size="small" color="success" variant="outlined" />
                    )}
                  </TableCell>
                  <TableCell>{formatDate(user.createdAt)}</TableCell>
                  <TableCell>{formatDate(user.lastSeen)}</TableCell>
                  <TableCell align="right">
                    <Tooltip title="Actions">
                      <IconButton onClick={(e) => handleMenuOpen(e, user)}>
                        <MoreIcon />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      {/* Actions Menu */}
      <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={handleMenuClose}>
        {selectedUser && !selectedUser.banned && selectedUser.role !== "OWNER" && (
          <MenuItem onClick={() => handleAction("ban")}>
            <ListItemIcon>
              <BanIcon fontSize="small" color="error" />
            </ListItemIcon>
            <ListItemText>Ban User</ListItemText>
          </MenuItem>
        )}
        {selectedUser?.banned && (
          <MenuItem onClick={() => handleAction("unban")}>
            <ListItemIcon>
              <UnbanIcon fontSize="small" color="success" />
            </ListItemIcon>
            <ListItemText>Unban User</ListItemText>
          </MenuItem>
        )}
        {selectedUser?.role === "USER" && (
          <MenuItem onClick={() => handleAction("promote")}>
            <ListItemIcon>
              <OwnerIcon fontSize="small" color="primary" />
            </ListItemIcon>
            <ListItemText>Promote to Owner</ListItemText>
          </MenuItem>
        )}
        {selectedUser?.role === "OWNER" && (
          <MenuItem onClick={() => handleAction("demote")}>
            <ListItemIcon>
              <UserIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Demote to User</ListItemText>
          </MenuItem>
        )}
        {selectedUser?.role !== "OWNER" && (
          <MenuItem onClick={() => handleAction("delete")}>
            <ListItemIcon>
              <DeleteIcon fontSize="small" color="error" />
            </ListItemIcon>
            <ListItemText>Delete User</ListItemText>
          </MenuItem>
        )}
      </Menu>

      {/* Confirmation Dialog */}
      <Dialog open={confirmDialog.open} onClose={() => setConfirmDialog({ ...confirmDialog, open: false })}>
        <DialogTitle>Confirm Action</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to {getActionText(confirmDialog.action)}
            {confirmDialog.user && (
              <strong> {confirmDialog.user.displayName || confirmDialog.user.username}</strong>
            )}
            ?
            {confirmDialog.action === "delete" && (
              <Typography color="error" sx={{ mt: 1 }}>
                This action cannot be undone.
              </Typography>
            )}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDialog({ ...confirmDialog, open: false })}>Cancel</Button>
          <Button
            onClick={handleConfirmAction}
            color={confirmDialog.action === "delete" || confirmDialog.action === "ban" ? "error" : "primary"}
            variant="contained"
          >
            Confirm
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AdminUsersPage;
