import React from "react";
import { Box, TextField, styled } from "@mui/material";

const FormFields = styled(Box)(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  gap: theme.spacing(3),
}));

interface FormErrors {
  name?: string;
  description?: string;
}

interface CommunityFormFieldsProps {
  name: string;
  description: string;
  onNameChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onDescriptionChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  errors: FormErrors;
}

const CommunityFormFields: React.FC<CommunityFormFieldsProps> = ({
  name,
  description,
  onNameChange,
  onDescriptionChange,
  errors,
}) => {
  return (
    <FormFields>
      <TextField
        label="Community Name"
        variant="outlined"
        value={name}
        onChange={onNameChange}
        error={!!errors.name}
        helperText={errors.name}
        required
        fullWidth
        autoFocus
      />

      <TextField
        label="Description"
        variant="outlined"
        value={description}
        onChange={onDescriptionChange}
        multiline
        rows={3}
        fullWidth
        placeholder="Tell people what your community is about..."
      />
    </FormFields>
  );
};

export default CommunityFormFields;
