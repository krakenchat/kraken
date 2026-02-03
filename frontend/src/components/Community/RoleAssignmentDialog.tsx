import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  CircularProgress,
  Alert,
  FormGroup,
  FormControlLabel,
  Checkbox,
  Box,
  Chip,
  Divider,
} from "@mui/material";
import {
  useGetCommunityRolesQuery,
  useGetUserRolesForCommunityQuery,
  useAssignRoleToUserMutation,
  useRemoveRoleFromUserMutation,
} from "../../features/roles/rolesApiSlice";
import { logger } from "../../utils/logger";

interface RoleAssignmentDialogProps {
  open: boolean;
  onClose: () => void;
  communityId: string;
  userId: string;
  userName: string;
}

const RoleAssignmentDialog: React.FC<RoleAssignmentDialogProps> = ({
  open,
  onClose,
  communityId,
  userId,
  userName,
}) => {
  const [selectedRoles, setSelectedRoles] = useState<Set<string>>(new Set());
  const [originalRoles, setOriginalRoles] = useState<Set<string>>(new Set());

  const {
    data: communityRoles,
    isLoading: loadingRoles,
    error: rolesError,
  } = useGetCommunityRolesQuery(communityId, {
    skip: !open,
  });

  const {
    data: userRoles,
    isLoading: loadingUserRoles,
    error: userRolesError,
  } = useGetUserRolesForCommunityQuery(
    { userId, communityId },
    {
      skip: !open,
    }
  );

  const [assignRole, { isLoading: assigning }] = useAssignRoleToUserMutation();
  const [removeRole, { isLoading: removing }] = useRemoveRoleFromUserMutation();

  // Update selected roles when user roles load
  useEffect(() => {
    if (userRoles?.roles) {
      const roleIds = new Set(userRoles.roles.map(role => role.id));
      setSelectedRoles(roleIds);
      setOriginalRoles(roleIds);
    }
  }, [userRoles]);

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setSelectedRoles(new Set());
      setOriginalRoles(new Set());
    }
  }, [open]);

  const handleRoleToggle = (roleId: string) => {
    setSelectedRoles(prev => {
      const newSet = new Set(prev);
      if (newSet.has(roleId)) {
        newSet.delete(roleId);
      } else {
        newSet.add(roleId);
      }
      return newSet;
    });
  };

  const handleSave = async () => {
    const rolesToAdd = Array.from(selectedRoles).filter(roleId => !originalRoles.has(roleId));
    const rolesToRemove = Array.from(originalRoles).filter(roleId => !selectedRoles.has(roleId));

    try {
      // Add new roles
      for (const roleId of rolesToAdd) {
        await assignRole({
          communityId,
          data: { userId, roleId },
        }).unwrap();
      }

      // Remove old roles
      for (const roleId of rolesToRemove) {
        await removeRole({
          communityId,
          userId,
          roleId,
        }).unwrap();
      }

      onClose();
    } catch (error) {
      // Error handled by RTK Query
      logger.error("Failed to update user roles:", error);
    }
  };

  const hasChanges = 
    selectedRoles.size !== originalRoles.size ||
    !Array.from(selectedRoles).every(roleId => originalRoles.has(roleId));

  const isLoading = loadingRoles || loadingUserRoles;
  const error = rolesError || userRolesError;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
    >
      <DialogTitle>
        Manage Roles for {userName}
      </DialogTitle>
      
      <DialogContent>
        {isLoading ? (
          <Box display="flex" justifyContent="center" py={4}>
            <CircularProgress />
          </Box>
        ) : error ? (
          <Alert severity="error">
            Failed to load role information. Please try again.
          </Alert>
        ) : (
          <Box>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Select which roles this user should have in the community:
            </Typography>

            <Box display="flex" gap={1} mb={2} flexWrap="wrap">
              <Chip
                label={`${selectedRoles.size} role${selectedRoles.size !== 1 ? 's' : ''} selected`}
                color={selectedRoles.size > 0 ? "primary" : "default"}
                size="small"
              />
            </Box>

            <Divider sx={{ mb: 2 }} />

            {communityRoles?.roles && communityRoles.roles.length > 0 ? (
              <FormGroup>
                {communityRoles.roles.map(role => {
                  const isSelected = selectedRoles.has(role.id);
                  const wasOriginallySelected = originalRoles.has(role.id);
                  
                  return (
                    <Box key={role.id} mb={1}>
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={isSelected}
                            onChange={() => handleRoleToggle(role.id)}
                          />
                        }
                        label={
                          <Box>
                            <Box display="flex" alignItems="center" gap={1}>
                              <Typography variant="body2" fontWeight="medium">
                                {role.name}
                              </Typography>
                              {wasOriginallySelected && (
                                <Chip
                                  label="Current"
                                  size="small"
                                  color="primary"
                                  variant="outlined"
                                />
                              )}
                            </Box>
                            <Typography variant="caption" color="text.secondary">
                              {role.actions.length} permission{role.actions.length !== 1 ? 's' : ''} 
                              {role.actions.length > 0 && (
                                <>
                                  {' '}• {role.actions.slice(0, 2).join(", ")}
                                  {role.actions.length > 2 && ` +${role.actions.length - 2} more`}
                                </>
                              )}
                            </Typography>
                          </Box>
                        }
                      />
                    </Box>
                  );
                })}
              </FormGroup>
            ) : (
              <Typography color="text.secondary">
                No roles available in this community.
              </Typography>
            )}
          </Box>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          variant="contained"
          disabled={!hasChanges || isLoading || assigning || removing}
        >
          {assigning || removing ? (
            <>
              <CircularProgress size={16} sx={{ mr: 1 }} />
              Updating...
            </>
          ) : (
            "Save Changes"
          )}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default RoleAssignmentDialog;