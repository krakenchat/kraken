import React, { useState, useEffect } from "react";
import {
  Box,
  Typography,
  Card,
  CardContent,
  TextField,
  Button,
  CircularProgress,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  SelectChangeEvent,
  Snackbar,
} from "@mui/material";
import {
  useGetInstanceSettingsQuery,
  useUpdateInstanceSettingsMutation,
} from "../../features/admin/adminApiSlice";

const AdminSettingsPage: React.FC = () => {
  const { data: settings, isLoading, error } = useGetInstanceSettingsQuery();
  const [updateSettings, { isLoading: isSaving }] = useUpdateInstanceSettingsMutation();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [registrationMode, setRegistrationMode] = useState<"OPEN" | "INVITE_ONLY" | "CLOSED">("INVITE_ONLY");
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  // Initialize form with current settings
  useEffect(() => {
    if (settings) {
      setName(settings.name);
      setDescription(settings.description || "");
      setRegistrationMode(settings.registrationMode);
    }
  }, [settings]);

  const handleSave = async () => {
    try {
      await updateSettings({
        name,
        description: description || undefined,
        registrationMode,
      }).unwrap();
      setSuccessMessage("Settings saved successfully");
    } catch (err) {
      setErrorMessage("Failed to save settings");
      console.error("Failed to save settings:", err);
    }
  };

  const hasChanges =
    settings &&
    (name !== settings.name ||
      description !== (settings.description || "") ||
      registrationMode !== settings.registrationMode);

  if (isLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: 400 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return <Alert severity="error">Failed to load settings. Please try again.</Alert>;
  }

  return (
    <Box>
      <Typography variant="h4" gutterBottom fontWeight="bold">
        Instance Settings
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
        Configure your instance settings
      </Typography>

      <Card sx={{ maxWidth: 600 }}>
        <CardContent>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <TextField
              label="Instance Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              fullWidth
              helperText="The name of your instance"
            />

            <TextField
              label="Description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              fullWidth
              multiline
              rows={3}
              helperText="A brief description of your instance (optional)"
            />

            <FormControl fullWidth>
              <InputLabel>Registration Mode</InputLabel>
              <Select
                value={registrationMode}
                label="Registration Mode"
                onChange={(e: SelectChangeEvent) =>
                  setRegistrationMode(e.target.value as "OPEN" | "INVITE_ONLY" | "CLOSED")
                }
              >
                <MenuItem value="OPEN">
                  <Box>
                    <Typography variant="body2">Open</Typography>
                    <Typography variant="caption" color="text.secondary">
                      Anyone can register
                    </Typography>
                  </Box>
                </MenuItem>
                <MenuItem value="INVITE_ONLY">
                  <Box>
                    <Typography variant="body2">Invite Only</Typography>
                    <Typography variant="caption" color="text.secondary">
                      Requires an invite code to register
                    </Typography>
                  </Box>
                </MenuItem>
                <MenuItem value="CLOSED">
                  <Box>
                    <Typography variant="body2">Closed</Typography>
                    <Typography variant="caption" color="text.secondary">
                      Registration is disabled
                    </Typography>
                  </Box>
                </MenuItem>
              </Select>
            </FormControl>

            <Box sx={{ display: "flex", justifyContent: "flex-end", pt: 2 }}>
              <Button
                variant="contained"
                onClick={handleSave}
                disabled={!hasChanges || isSaving}
              >
                {isSaving ? <CircularProgress size={24} /> : "Save Changes"}
              </Button>
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* Success Snackbar */}
      <Snackbar
        open={!!successMessage}
        autoHideDuration={3000}
        onClose={() => setSuccessMessage("")}
        message={successMessage}
      />

      {/* Error Snackbar */}
      <Snackbar
        open={!!errorMessage}
        autoHideDuration={5000}
        onClose={() => setErrorMessage("")}
      >
        <Alert severity="error" onClose={() => setErrorMessage("")}>
          {errorMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default AdminSettingsPage;
