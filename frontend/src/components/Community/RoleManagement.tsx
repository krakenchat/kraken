import React, { useState } from "react";
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
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Tooltip,
} from "@mui/material";
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  People as PeopleIcon,
  Security as SecurityIcon,
} from "@mui/icons-material";
import { useUserPermissions } from "../../features/roles/useUserPermissions";
import {
  useGetCommunityRolesQuery,
  useCreateCommunityRoleMutation,
  useUpdateRoleMutation,
  useDeleteRoleMutation,
  useGetUsersForRoleQuery,
  RoleDto,
} from "../../features/roles/rolesApiSlice";
import RoleEditor from "./RoleEditor";
import { ACTION_LABELS } from "../../constants/rbacActions";

interface RoleManagementProps {
  communityId: string;
}

const RoleManagement: React.FC<RoleManagementProps> = ({ communityId }) => {
  const [editingRole, setEditingRole] = useState<RoleDto | null>(null);
  const [creatingRole, setCreatingRole] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [roleToDelete, setRoleToDelete] = useState<RoleDto | null>(null);
  const [viewingRoleUsers, setViewingRoleUsers] = useState<string | null>(null);

  const { hasPermissions: canReadRoles } = useUserPermissions({
    resourceType: "COMMUNITY",
    resourceId: communityId,
    actions: ["READ_ROLE"],
  });

  const { hasPermissions: canCreateRoles } = useUserPermissions({
    resourceType: "COMMUNITY",
    resourceId: communityId,
    actions: ["CREATE_ROLE"],
  });

  const { hasPermissions: canUpdateRoles } = useUserPermissions({
    resourceType: "COMMUNITY",
    resourceId: communityId,
    actions: ["UPDATE_ROLE"],
  });

  const { hasPermissions: canDeleteRoles } = useUserPermissions({
    resourceType: "COMMUNITY",
    resourceId: communityId,
    actions: ["DELETE_ROLE"],
  });

  const {
    data: communityRoles,
    isLoading: loadingRoles,
    error: rolesError,
  } = useGetCommunityRolesQuery(communityId, {
    skip: !canReadRoles,
  });

  const {
    data: roleUsers,
    isLoading: loadingRoleUsers,
  } = useGetUsersForRoleQuery(
    { roleId: viewingRoleUsers!, communityId },
    { skip: !viewingRoleUsers }
  );

  const [createRole, { isLoading: creatingRoleLoading, error: createRoleError }] =
    useCreateCommunityRoleMutation();

  const [updateRole, { isLoading: updatingRoleLoading, error: updateRoleError }] =
    useUpdateRoleMutation();

  const [deleteRole, { isLoading: deletingRoleLoading }] = useDeleteRoleMutation();

  const handleCreateRole = async (data: { name?: string; actions: string[] }) => {
    try {
      await createRole({
        communityId,
        data: {
          name: data.name!, // name is required for creating new roles
          actions: data.actions,
        },
      }).unwrap();
      setCreatingRole(false);
    } catch {
      // Error handled by RTK Query
    }
  };

  const handleUpdateRole = async (data: { name?: string; actions: string[] }) => {
    if (!editingRole) return;

    try {
      await updateRole({
        roleId: editingRole.id,
        data,
      }).unwrap();
      setEditingRole(null);
    } catch {
      // Error handled by RTK Query
    }
  };

  const handleDeleteRole = async () => {
    if (!roleToDelete) return;

    try {
      await deleteRole(roleToDelete.id).unwrap();
      setDeleteConfirmOpen(false);
      setRoleToDelete(null);
    } catch {
      // Error handled by RTK Query - will stay open to show error
    }
  };

  const isDefaultRole = (roleName: string) => {
    return ['Community Admin', 'Moderator', 'Member'].includes(roleName);
  };

  if (!canReadRoles) {
    return (
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Role Management
          </Typography>
          <Alert severity="info">
            You don't have permission to view roles in this community.
          </Alert>
        </CardContent>
      </Card>
    );
  }

  if (creatingRole || editingRole) {
    return (
      <RoleEditor
        role={editingRole || undefined}
        onSave={editingRole ? handleUpdateRole : handleCreateRole}
        onCancel={() => {
          setCreatingRole(false);
          setEditingRole(null);
        }}
        isLoading={creatingRoleLoading || updatingRoleLoading}
        error={
          createRoleError
            ? `Failed to create role: ${(createRoleError as { data?: { message?: string } })?.data?.message || 'Unknown error'}`
            : updateRoleError
            ? `Failed to update role: ${(updateRoleError as { data?: { message?: string } })?.data?.message || 'Unknown error'}`
            : undefined
        }
      />
    );
  }

  if (loadingRoles) {
    return (
      <Box display="flex" justifyContent="center" p={2}>
        <CircularProgress />
      </Box>
    );
  }

  if (rolesError) {
    return (
      <Alert severity="error">
        Failed to load roles. Please try again.
      </Alert>
    );
  }

  return (
    <>
      <Card>
        <CardContent>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
            <Typography variant="h6">
              Role Management
            </Typography>
            {canCreateRoles && (
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => setCreatingRole(true)}
              >
                Create Role
              </Button>
            )}
          </Box>

          {communityRoles && communityRoles.roles.length > 0 ? (
            <TableContainer component={Paper} variant="outlined">
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Role Name</TableCell>
                    <TableCell>Permissions</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell>Created</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {communityRoles.roles.map((role) => (
                    <TableRow key={role.id}>
                      <TableCell>
                        <Box display="flex" alignItems="center" gap={1}>
                          <SecurityIcon color="action" fontSize="small" />
                          <Typography variant="body2" fontWeight="medium">
                            {role.name}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Box display="flex" gap={0.5} flexWrap="wrap">
                          {role.actions.slice(0, 3).map((action) => (
                            <Chip
                              key={action}
                              label={ACTION_LABELS[action] || action}
                              size="small"
                              variant="outlined"
                            />
                          ))}
                          {role.actions.length > 3 && (
                            <Chip
                              label={`+${role.actions.length - 3} more`}
                              size="small"
                              variant="outlined"
                              color="primary"
                            />
                          )}
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={isDefaultRole(role.name) ? "Default" : "Custom"}
                          size="small"
                          color={isDefaultRole(role.name) ? "default" : "primary"}
                          variant={isDefaultRole(role.name) ? "filled" : "outlined"}
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {new Date(role.createdAt).toLocaleDateString()}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Box display="flex" gap={0.5}>
                          <Tooltip title="View assigned users">
                            <IconButton
                              size="small"
                              onClick={() => setViewingRoleUsers(role.id)}
                            >
                              <PeopleIcon />
                            </IconButton>
                          </Tooltip>
                          
                          {canUpdateRoles && (
                            <Tooltip title="Edit role">
                              <IconButton
                                size="small"
                                onClick={() => setEditingRole(role)}
                              >
                                <EditIcon />
                              </IconButton>
                            </Tooltip>
                          )}
                          
                          {canDeleteRoles && !isDefaultRole(role.name) && (
                            <Tooltip title="Delete role">
                              <IconButton
                                size="small"
                                color="error"
                                onClick={() => {
                                  setRoleToDelete(role);
                                  setDeleteConfirmOpen(true);
                                }}
                              >
                                <DeleteIcon />
                              </IconButton>
                            </Tooltip>
                          )}
                        </Box>
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
              <SecurityIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
              <Typography variant="h6" color="text.secondary" gutterBottom>
                No custom roles yet
              </Typography>
              <Typography variant="body2" color="text.secondary" align="center" mb={3}>
                Create custom roles to manage member permissions more granularly.
                Default roles (Admin, Moderator, Member) are created automatically.
              </Typography>
              {canCreateRoles && (
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={() => setCreatingRole(true)}
                >
                  Create Your First Role
                </Button>
              )}
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Delete Role</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete the role <strong>{roleToDelete?.name}</strong>?
            This action cannot be undone and will remove the role from all users who have it assigned.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirmOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleDeleteRole}
            color="error"
            variant="contained"
            disabled={deletingRoleLoading}
          >
            {deletingRoleLoading ? <CircularProgress size={20} /> : "Delete Role"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Role Users Dialog */}
      <Dialog
        open={Boolean(viewingRoleUsers)}
        onClose={() => setViewingRoleUsers(null)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Role Members: {communityRoles?.roles.find(r => r.id === viewingRoleUsers)?.name}
        </DialogTitle>
        <DialogContent>
          {loadingRoleUsers ? (
            <Box display="flex" justifyContent="center" p={2}>
              <CircularProgress />
            </Box>
          ) : roleUsers && roleUsers.length > 0 ? (
            <Box>
              {roleUsers.map((user) => (
                <Box
                  key={user.userId}
                  display="flex"
                  alignItems="center"
                  gap={2}
                  p={2}
                  sx={{
                    border: 1,
                    borderColor: "divider",
                    borderRadius: 1,
                    mb: 1,
                  }}
                >
                  <Typography variant="body1">{user.username}</Typography>
                  {user.displayName && (
                    <Typography variant="body2" color="text.secondary">
                      ({user.displayName})
                    </Typography>
                  )}
                </Box>
              ))}
            </Box>
          ) : (
            <Typography color="text.secondary">
              No users are currently assigned to this role.
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setViewingRoleUsers(null)}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default RoleManagement;
