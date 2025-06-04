import React from "react";
import { IconButton, Tooltip } from "@mui/material";
import { Settings } from "@mui/icons-material";
import { useNavigate } from "react-router-dom";
import { useCanPerformAction } from "../../features/roles/useUserPermissions";

interface EditCommunityButtonProps {
  communityId: string;
}

/**
 * A conditional button that only renders if the user has UPDATE_COMMUNITY permissions
 */
export const EditCommunityButton: React.FC<EditCommunityButtonProps> = ({
  communityId,
}) => {
  const navigate = useNavigate();
  const canEdit = useCanPerformAction(
    "COMMUNITY",
    communityId,
    "UPDATE_COMMUNITY"
  );

  const handleEditClick = () => {
    navigate(`/community/${communityId}/edit`);
  };

  if (!canEdit) {
    console.log("User does not have permissions to edit community");
    return null; // Don't render if user doesn't have permissions
  }

  return (
    <Tooltip title="Edit Community" placement="right">
      <IconButton
        onClick={handleEditClick}
        size="small"
        sx={{
          color: "text.secondary",
          "&:hover": {
            color: "primary.main",
            backgroundColor: "action.hover",
          },
        }}
      >
        <Settings fontSize="small" />
      </IconButton>
    </Tooltip>
  );
};

export default EditCommunityButton;
