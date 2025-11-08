import React from "react";
import {
  Box,
  Button,
  CircularProgress,
  Alert,
  styled,
} from "@mui/material";

const FormContainer = styled(Box)(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  gap: theme.spacing(3),
  maxWidth: 600,
}));

const ActionButtons = styled(Box)(({ theme }) => ({
  display: "flex",
  gap: theme.spacing(2),
  justifyContent: "flex-end",
  marginTop: theme.spacing(3),
}));

interface CommunitySettingsFormProps {
  onSubmit: (event: React.FormEvent) => void;
  error?: unknown;
  errorMessage: string;
  isLoading: boolean;
  isFormValid: boolean;
  submitButtonText: string;
  loadingText: string;
  children: React.ReactNode;
  showCancelButton?: boolean;
  onCancel?: () => void;
}

const CommunitySettingsForm: React.FC<CommunitySettingsFormProps> = ({
  onSubmit,
  error,
  errorMessage,
  isLoading,
  isFormValid,
  submitButtonText,
  loadingText,
  children,
  showCancelButton = false,
  onCancel,
}) => {
  return (
    <FormContainer>
      {Boolean(error) && (
        <Alert severity="error">
          {errorMessage}
        </Alert>
      )}

      <form onSubmit={onSubmit}>
        {children}
        
        <ActionButtons>
          {showCancelButton && onCancel && (
            <Button
              variant="outlined"
              onClick={onCancel}
              disabled={isLoading}
            >
              Cancel
            </Button>
          )}
          <Button
            type="submit"
            variant="contained"
            disabled={isLoading || !isFormValid}
            startIcon={isLoading && <CircularProgress size={16} />}
          >
            {isLoading ? loadingText : submitButtonText}
          </Button>
        </ActionButtons>
      </form>
    </FormContainer>
  );
};

export default CommunitySettingsForm;
