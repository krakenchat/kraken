/**
 * OptimisticMessageActions
 *
 * Retry / Delete affordance for a message whose optimistic send failed
 * (`sendStatus === 'failed'`). Always rendered (not hover-gated like
 * MessageToolbar) so the actions are visible and keyboard-reachable without
 * discovery — matching the always-focusable button pattern from #428.
 */

import React from "react";
import { Box, Button, Typography } from "@mui/material";
import ReplayIcon from "@mui/icons-material/Replay";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import { useOptimisticMessageRetry } from "../../hooks/useOptimisticSendMessage";
import type { Message } from "../../types/message.type";

interface OptimisticMessageActionsProps {
  message: Message;
}

export const OptimisticMessageActions: React.FC<OptimisticMessageActionsProps> = ({ message }) => {
  const { retry, remove } = useOptimisticMessageRetry(message);
  const [isRetrying, setIsRetrying] = React.useState(false);
  // Guards the finally-block setState below: `retry` awaits a socket
  // round-trip (up to the 10s send timeout), and this row can unmount
  // before that settles (e.g. the message list re-renders past it, or the
  // whole view is torn down). Without this, React warns about a state
  // update on an unmounted component.
  const mountedRef = React.useRef(true);
  React.useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const handleRetry = async () => {
    setIsRetrying(true);
    try {
      await retry();
    } finally {
      if (mountedRef.current) setIsRetrying(false);
    }
  };

  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 0.5 }}>
      <Typography variant="caption" color="error.main">
        Failed to send
      </Typography>
      <Button
        size="small"
        disabled={isRetrying}
        startIcon={<ReplayIcon fontSize="small" />}
        onClick={() => void handleRetry()}
        aria-label="Retry sending message"
      >
        Retry
      </Button>
      <Button
        size="small"
        color="error"
        startIcon={<DeleteOutlineIcon fontSize="small" />}
        onClick={remove}
        aria-label="Delete message"
      >
        Delete
      </Button>
    </Box>
  );
};

export default OptimisticMessageActions;
