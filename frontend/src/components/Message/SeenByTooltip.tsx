import React, { useState } from "react";
import { Box, Typography, Tooltip, Avatar, CircularProgress } from "@mui/material";
import { useLazyGetMessageReadersQuery } from "../../features/readReceipts/readReceiptsApiSlice";
import type { MessageReader } from "../../types/read-receipt.type";

interface SeenByTooltipProps {
  messageId: string;
  directMessageGroupId: string;
  children: React.ReactElement;
}

/**
 * Tooltip component that shows who has read a message (in DMs only).
 * Lazy-loads the readers on hover for performance.
 */
export const SeenByTooltip: React.FC<SeenByTooltipProps> = ({
  messageId,
  directMessageGroupId,
  children,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [trigger, { data: readers, isLoading, isFetching }] =
    useLazyGetMessageReadersQuery();

  const handleOpen = () => {
    setIsOpen(true);
    // Lazy fetch on first open
    trigger({ messageId, directMessageGroupId });
  };

  const handleClose = () => {
    setIsOpen(false);
  };

  const displayReaders = readers?.slice(0, 15) ?? [];
  const remainingCount = (readers?.length ?? 0) - displayReaders.length;

  const tooltipContent = (
    <Box sx={{ minWidth: 150, maxWidth: 250, p: 0.5 }}>
      <Typography
        variant="caption"
        sx={{
          fontWeight: 600,
          color: "text.secondary",
          display: "block",
          mb: 0.5,
        }}
      >
        Seen by
      </Typography>
      {isLoading || isFetching ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 1 }}>
          <CircularProgress size={16} />
        </Box>
      ) : displayReaders.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ fontSize: 12 }}>
          Not seen yet
        </Typography>
      ) : (
        <>
          {displayReaders.map((reader: MessageReader) => (
            <Box
              key={reader.userId}
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1,
                py: 0.25,
              }}
            >
              <Avatar
                src={reader.avatarUrl}
                sx={{ width: 18, height: 18, fontSize: 10 }}
              >
                {(reader.displayName || reader.username)?.[0]?.toUpperCase()}
              </Avatar>
              <Typography variant="body2" sx={{ fontSize: 12 }}>
                {reader.displayName || reader.username}
              </Typography>
            </Box>
          ))}
          {remainingCount > 0 && (
            <Typography
              variant="body2"
              sx={{
                fontSize: 12,
                fontStyle: "italic",
                color: "text.secondary",
                mt: 0.5,
              }}
            >
              +{remainingCount} more
            </Typography>
          )}
        </>
      )}
    </Box>
  );

  return (
    <Tooltip
      title={tooltipContent}
      placement="top"
      open={isOpen}
      onOpen={handleOpen}
      onClose={handleClose}
      componentsProps={{
        tooltip: {
          sx: {
            backgroundColor: "background.paper",
            color: "text.primary",
            boxShadow: 3,
            border: 1,
            borderColor: "divider",
            maxWidth: "none",
          },
        },
      }}
    >
      {children}
    </Tooltip>
  );
};

export default SeenByTooltip;
