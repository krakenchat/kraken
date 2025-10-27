import React from "react";
import { Box, Typography, IconButton, Divider } from "@mui/material";
import { ArrowBack } from "@mui/icons-material";
import { DMVoiceControls } from "../DirectMessage/DMVoiceControls";

interface DMChatHeaderProps {
  dmGroupId: string;
  dmGroupName: string;
  showBackButton?: boolean;
  onBack?: () => void;
}

export const DMChatHeader: React.FC<DMChatHeaderProps> = ({
  dmGroupId,
  dmGroupName,
  showBackButton = false,
  onBack,
}) => {
  return (
    <>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          px: 2,
          py: 1.5,
          borderBottom: 1,
          borderColor: "divider",
          backgroundColor: "background.paper",
          minHeight: 64,
        }}
      >
        {/* Left side: Back button + Name */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flex: 1 }}>
          {showBackButton && onBack && (
            <IconButton onClick={onBack} size="small" edge="start">
              <ArrowBack />
            </IconButton>
          )}
          <Typography variant="h6" noWrap sx={{ fontWeight: 600 }}>
            {dmGroupName}
          </Typography>
        </Box>

        {/* Right side: Voice controls */}
        <DMVoiceControls dmGroupId={dmGroupId} dmGroupName={dmGroupName} />
      </Box>
    </>
  );
};
