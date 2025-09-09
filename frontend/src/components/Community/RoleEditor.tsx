import React, { useState, useCallback } from "react";
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Checkbox,
  FormControlLabel,
  FormGroup,
  Alert,
  CircularProgress,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Chip,
  Divider,
} from "@mui/material";
import {
  ExpandMore as ExpandMoreIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
} from "@mui/icons-material";
import { PERMISSION_GROUPS, ACTION_LABELS, RbacAction } from "../../constants/rbacActions";
import { RoleDto } from "../../features/roles/rolesApiSlice";

interface RoleEditorProps {
  role?: RoleDto; // undefined for creating new role
  onSave: (data: { name: string; actions: string[] }) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
  error?: string;
}

const RoleEditor: React.FC<RoleEditorProps> = ({
  role,
  onSave,
  onCancel,
  isLoading = false,
  error,
}) => {
  const [name, setName] = useState(role?.name || "");
  const [selectedActions, setSelectedActions] = useState<Set<string>>(
    new Set(role?.actions || [])
  );
  const [nameError, setNameError] = useState("");

  const isEditing = !!role;

  const handleNameChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newName = event.target.value;
    setName(newName);
    
    if (newName.trim().length === 0) {
      setNameError("Role name is required");
    } else if (newName.length > 50) {
      setNameError("Role name must not exceed 50 characters");
    } else {
      setNameError("");
    }
  };

  const handleActionToggle = useCallback((action: string) => {
    setSelectedActions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(action)) {
        newSet.delete(action);
      } else {
        newSet.add(action);
      }
      return newSet;
    });
  }, []);

  const handleGroupToggle = useCallback((groupActions: string[]) => {
    const allSelected = groupActions.every(action => selectedActions.has(action));
    
    setSelectedActions(prev => {
      const newSet = new Set(prev);
      if (allSelected) {
        // Deselect all in group
        groupActions.forEach(action => newSet.delete(action));
      } else {
        // Select all in group
        groupActions.forEach(action => newSet.add(action));
      }
      return newSet;
    });
  }, [selectedActions]);

  const handleSave = async () => {
    if (name.trim().length === 0) {
      setNameError("Role name is required");
      return;
    }

    if (selectedActions.size === 0) {
      return; // Should show error in UI
    }

    try {
      await onSave({
        name: name.trim(),
        actions: Array.from(selectedActions),
      });
    } catch {
      // Error handled by parent component
    }
  };

  const isFormValid = name.trim().length > 0 && selectedActions.size > 0 && !nameError;

  return (
    <Card>
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Typography variant="h6">
            {isEditing ? `Edit Role: ${role.name}` : "Create New Role"}
          </Typography>
          <Box display="flex" gap={1}>
            <Button
              variant="outlined"
              onClick={onCancel}
              startIcon={<CancelIcon />}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              variant="contained"
              onClick={handleSave}
              startIcon={isLoading ? <CircularProgress size={16} /> : <SaveIcon />}
              disabled={!isFormValid || isLoading}
            >
              {isLoading ? "Saving..." : "Save Role"}
            </Button>
          </Box>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        <Box mb={4}>
          <TextField
            label="Role Name"
            value={name}
            onChange={handleNameChange}
            fullWidth
            error={!!nameError}
            helperText={nameError || "Enter a descriptive name for this role"}
            disabled={isLoading}
            inputProps={{ maxLength: 50 }}
          />
        </Box>

        <Typography variant="h6" gutterBottom>
          Permissions
        </Typography>
        
        {selectedActions.size === 0 && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            Role must have at least one permission
          </Alert>
        )}

        <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
          <Typography variant="body2" color="text.secondary">
            Selected: {selectedActions.size} permissions
          </Typography>
          <Chip 
            label={`${selectedActions.size} selected`}
            size="small"
            color={selectedActions.size > 0 ? "primary" : "default"}
          />
        </Box>

        <Box>
          {Object.entries(PERMISSION_GROUPS).map(([groupName, actions]) => {
            const selectedCount = actions.filter(action => selectedActions.has(action)).length;
            const allSelected = selectedCount === actions.length;
            const someSelected = selectedCount > 0 && selectedCount < actions.length;

            return (
              <Accordion key={groupName} defaultExpanded>
                <AccordionSummary
                  expandIcon={<ExpandMoreIcon />}
                  sx={{
                    backgroundColor: someSelected ? 'action.hover' : 'inherit',
                  }}
                >
                  <Box display="flex" alignItems="center" width="100%">
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={allSelected}
                          indeterminate={someSelected}
                          onChange={() => handleGroupToggle(actions)}
                          onClick={(e) => e.stopPropagation()}
                          disabled={isLoading}
                        />
                      }
                      label={
                        <Box display="flex" alignItems="center" gap={1}>
                          <Typography variant="subtitle2">{groupName}</Typography>
                          <Chip
                            label={`${selectedCount}/${actions.length}`}
                            size="small"
                            color={selectedCount > 0 ? "primary" : "default"}
                          />
                        </Box>
                      }
                      sx={{ flex: 1 }}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </Box>
                </AccordionSummary>
                <AccordionDetails>
                  <FormGroup>
                    {actions.map((action) => (
                      <FormControlLabel
                        key={action}
                        control={
                          <Checkbox
                            checked={selectedActions.has(action)}
                            onChange={() => handleActionToggle(action)}
                            size="small"
                            disabled={isLoading}
                          />
                        }
                        label={
                          <Box>
                            <Typography variant="body2">
                              {ACTION_LABELS[action as RbacAction] || action}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {action}
                            </Typography>
                          </Box>
                        }
                        sx={{ ml: 2 }}
                      />
                    ))}
                  </FormGroup>
                </AccordionDetails>
              </Accordion>
            );
          })}
        </Box>

        <Divider sx={{ my: 3 }} />

        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="body2" color="text.secondary">
            {isEditing ? "Changes will take effect immediately" : "Role will be available for assignment after creation"}
          </Typography>
          <Box display="flex" gap={1}>
            <Button
              variant="outlined"
              onClick={onCancel}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              variant="contained"
              onClick={handleSave}
              disabled={!isFormValid || isLoading}
            >
              {isLoading ? <CircularProgress size={20} /> : (isEditing ? "Update Role" : "Create Role")}
            </Button>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
};

export default RoleEditor;