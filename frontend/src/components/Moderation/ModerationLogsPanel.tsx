/**
 * ModerationLogsPanel Component
 *
 * Displays the audit log of all moderation actions in a community.
 * Supports filtering by action type and pagination.
 */

import React, { useState } from "react";
import {
  Box,
  Typography,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Skeleton,
  Alert,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Pagination,
} from "@mui/material";
import HistoryIcon from "@mui/icons-material/History";
import BlockIcon from "@mui/icons-material/Block";
import LockOpenIcon from "@mui/icons-material/LockOpen";
import PersonRemoveIcon from "@mui/icons-material/PersonRemove";
import TimerIcon from "@mui/icons-material/Timer";
import TimerOffIcon from "@mui/icons-material/TimerOff";
import DeleteIcon from "@mui/icons-material/Delete";
import PushPinIcon from "@mui/icons-material/PushPin";
import { alpha } from "@mui/material/styles";
import {
  useGetModerationLogsQuery,
  ModerationAction,
  ModerationLog,
} from "../../features/moderation/moderationApiSlice";
import { format } from "date-fns";

interface ModerationLogsPanelProps {
  communityId: string;
}

const PAGE_SIZE = 20;

const ACTION_CONFIG: Record<ModerationAction, { icon: React.ReactNode; label: string; color: string }> = {
  BAN_USER: { icon: <BlockIcon />, label: "Ban User", color: "error.main" },
  UNBAN_USER: { icon: <LockOpenIcon />, label: "Unban User", color: "success.main" },
  KICK_USER: { icon: <PersonRemoveIcon />, label: "Kick User", color: "warning.main" },
  TIMEOUT_USER: { icon: <TimerIcon />, label: "Timeout User", color: "warning.main" },
  REMOVE_TIMEOUT: { icon: <TimerOffIcon />, label: "Remove Timeout", color: "success.main" },
  DELETE_MESSAGE: { icon: <DeleteIcon />, label: "Delete Message", color: "error.main" },
  PIN_MESSAGE: { icon: <PushPinIcon />, label: "Pin Message", color: "primary.main" },
  UNPIN_MESSAGE: { icon: <PushPinIcon />, label: "Unpin Message", color: "text.secondary" },
};

const ModerationLogsPanel: React.FC<ModerationLogsPanelProps> = ({ communityId }) => {
  const [page, setPage] = useState(1);
  const [actionFilter, setActionFilter] = useState<ModerationAction | "">("");

  const { data, isLoading, error } = useGetModerationLogsQuery({
    communityId,
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
    action: actionFilter || undefined,
  });

  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 0;

  const handlePageChange = (_: React.ChangeEvent<unknown>, value: number) => {
    setPage(value);
  };

  const handleFilterChange = (value: ModerationAction | "") => {
    setActionFilter(value);
    setPage(1); // Reset to first page when filter changes
  };

  const getActionDisplay = (action: ModerationAction) => {
    return ACTION_CONFIG[action] || { icon: <HistoryIcon />, label: action, color: "text.primary" };
  };

  const formatLogEntry = (log: ModerationLog): string => {
    const parts: string[] = [];

    if (log.targetUserId) {
      parts.push(`Target: ${log.targetUserId.slice(0, 8)}...`);
    }
    if (log.targetMessageId) {
      parts.push(`Message: ${log.targetMessageId.slice(0, 8)}...`);
    }
    if (log.reason) {
      parts.push(`Reason: ${log.reason}`);
    }

    return parts.join(" • ") || "No additional details";
  };

  if (isLoading) {
    return (
      <Box sx={{ p: 2 }}>
        <Typography variant="h6" sx={{ mb: 2 }}>
          Moderation Logs
        </Typography>
        {[1, 2, 3, 4, 5].map((i) => (
          <Box key={i} sx={{ mb: 1 }}>
            <Skeleton variant="rectangular" height={64} sx={{ borderRadius: 1 }} />
          </Box>
        ))}
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 2 }}>
        <Alert severity="error">Failed to load moderation logs</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 2 }}>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2 }}>
        <Box sx={{ display: "flex", alignItems: "center" }}>
          <HistoryIcon sx={{ mr: 1, color: "primary.main" }} />
          <Typography variant="h6">
            Moderation Logs
          </Typography>
        </Box>

        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel>Filter by Action</InputLabel>
          <Select
            value={actionFilter}
            label="Filter by Action"
            onChange={(e) => handleFilterChange(e.target.value as ModerationAction | "")}
          >
            <MenuItem value="">All Actions</MenuItem>
            {Object.entries(ACTION_CONFIG).map(([action, config]) => (
              <MenuItem key={action} value={action}>
                {config.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      {!data?.logs || data.logs.length === 0 ? (
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            py: 4,
            px: 2,
            borderRadius: 1,
            backgroundColor: alpha("#000", 0.02),
          }}
        >
          <HistoryIcon sx={{ fontSize: 48, color: "text.disabled", mb: 2 }} />
          <Typography variant="body2" color="text.secondary" textAlign="center">
            No moderation logs found
          </Typography>
        </Box>
      ) : (
        <>
          <List disablePadding>
            {data.logs.map((log) => {
              const actionDisplay = getActionDisplay(log.action);
              return (
                <ListItem
                  key={log.id}
                  sx={{
                    mb: 1,
                    borderRadius: 1,
                    border: 1,
                    borderColor: "divider",
                    backgroundColor: alpha("#000", 0.02),
                  }}
                >
                  <ListItemIcon sx={{ color: actionDisplay.color }}>
                    {actionDisplay.icon}
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                        <Chip
                          label={actionDisplay.label}
                          size="small"
                          sx={{
                            backgroundColor: alpha(actionDisplay.color, 0.1),
                            color: actionDisplay.color,
                          }}
                        />
                        <Typography variant="caption" color="text.secondary">
                          by {log.moderatorId.slice(0, 8)}...
                        </Typography>
                      </Box>
                    }
                    secondary={
                      <Box>
                        <Typography variant="body2" color="text.secondary">
                          {formatLogEntry(log)}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {format(new Date(log.createdAt), "MMM d, yyyy 'at' h:mm:ss a")}
                        </Typography>
                      </Box>
                    }
                  />
                </ListItem>
              );
            })}
          </List>

          {totalPages > 1 && (
            <Box sx={{ display: "flex", justifyContent: "center", mt: 2 }}>
              <Pagination
                count={totalPages}
                page={page}
                onChange={handlePageChange}
                color="primary"
              />
            </Box>
          )}
        </>
      )}
    </Box>
  );
};

export default ModerationLogsPanel;
