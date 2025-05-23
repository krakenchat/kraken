import React from "react";
import { Box, Skeleton } from "@mui/material";

// MessageSkeleton: visually matches a message row (avatar + lines)
const MessageSkeleton: React.FC = () => (
  <Box
    sx={{
      display: "flex",
      alignItems: "flex-start",
      width: "100%",
      padding: (theme) => theme.spacing(0.5, 2),
      marginBottom: 1,
    }}
  >
    <Skeleton
      variant="circular"
      width={32}
      height={32}
      sx={{ marginRight: 1 }}
    />
    <Box sx={{ flex: 1 }}>
      <Skeleton
        variant="text"
        width="30%"
        height={18}
        sx={{ marginBottom: 0.5 }}
      />
      <Skeleton variant="text" width="80%" height={16} />
    </Box>
  </Box>
);

export default MessageSkeleton;
