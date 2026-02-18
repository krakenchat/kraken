/**
 * MessageInputStyles
 *
 * Shared styled components for MessageInput components.
 * Provides consistent styling across channel and DM message inputs.
 */

import { Paper, TextField } from "@mui/material";
import { styled } from "@mui/material/styles";

export const StyledPaper = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(2),
  display: "flex",
  alignItems: "flex-end",
  gap: theme.spacing(1),
  background: theme.palette.background.paper,
}));

export const StyledTextField = styled(TextField)(({ theme }) => ({
  "& .MuiOutlinedInput-notchedOutline": {
    borderColor: theme.palette.divider,
  },
  "& .MuiInputBase-root.Mui-focused .MuiOutlinedInput-notchedOutline": {
    borderColor: theme.palette.primary.main,
  },
}));
