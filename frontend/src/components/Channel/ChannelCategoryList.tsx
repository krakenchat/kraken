import React, { useMemo, useState } from "react";
import {
  Box,
  Typography,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Collapse,
  IconButton,
} from "@mui/material";
import {
  ExpandLess,
  ExpandMore,
  Tag as TagIcon,
  VolumeUp as VoiceIcon,
  Lock as LockIcon,
} from "@mui/icons-material";
import { ChannelType } from "../../types/channel.type";
import type { Channel } from "../../types/channel.type";

interface ChannelCategoryListProps {
  channels: Channel[];
  onChannelSelect: (channelId: string) => void;
  selectedChannelId?: string;
  /** Denser layout for tablet sidebar */
  compact?: boolean;
  /** Minimum touch target height (px) for mobile/tablet */
  touchTargetHeight?: number;
}

/**
 * Shared channel list grouped into collapsible Text/Voice categories.
 * Sorts channels by position. Used by MobileChannelsPanel and TabletSidebar.
 */
const ChannelCategoryList: React.FC<ChannelCategoryListProps> = ({
  channels,
  onChannelSelect,
  selectedChannelId,
  compact = false,
  touchTargetHeight,
}) => {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(["Text Channels", "Voice Channels"])
  );

  const { textChannels, voiceChannels } = useMemo(() => {
    const text = channels
      .filter((c) => c.type === ChannelType.TEXT)
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));

    const voice = channels
      .filter((c) => c.type === ChannelType.VOICE)
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));

    return { textChannels: text, voiceChannels: voice };
  }, [channels]);

  const toggleCategory = (category: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  if (channels.length === 0) {
    return (
      <Box sx={{ px: 2, py: 4, textAlign: "center" }}>
        <Typography variant="body2" color="text.secondary">
          No channels yet
        </Typography>
      </Box>
    );
  }

  const itemSx = {
    pl: compact ? 2 : 4,
    py: compact ? 0.75 : undefined,
    ...(touchTargetHeight ? { minHeight: touchTargetHeight } : {}),
    ...(selectedChannelId
      ? { "&.Mui-selected": { backgroundColor: "action.selected" } }
      : {}),
  };

  const headerFontSize = compact ? "0.6875rem" : undefined;
  const itemFontSize = compact ? "0.875rem" : "0.9375rem";
  const iconMinWidth = compact ? 28 : 36;
  const iconFontSize = compact ? "1.125rem" : "small";

  const renderCategory = (
    label: string,
    items: Channel[],
    Icon: typeof TagIcon
  ) => {
    if (items.length === 0) return null;

    return (
      <React.Fragment key={label}>
        <ListItem
          disablePadding
          secondaryAction={
            <IconButton
              edge="end"
              size="small"
              onClick={() => toggleCategory(label)}
            >
              {expandedCategories.has(label) ? (
                <ExpandLess fontSize={compact ? "small" : "medium"} />
              ) : (
                <ExpandMore fontSize={compact ? "small" : "medium"} />
              )}
            </IconButton>
          }
        >
          <ListItemButton
            onClick={() => toggleCategory(label)}
            sx={compact ? { py: 0.5 } : undefined}
          >
            <ListItemText
              primary={label.toUpperCase()}
              primaryTypographyProps={{
                variant: "caption",
                fontWeight: 700,
                color: "text.secondary",
                ...(headerFontSize ? { fontSize: headerFontSize } : {}),
              }}
            />
          </ListItemButton>
        </ListItem>

        <Collapse in={expandedCategories.has(label)} timeout="auto">
          <List component="div" disablePadding>
            {items.map((channel) => (
              <ListItem key={channel.id} disablePadding>
                <ListItemButton
                  selected={selectedChannelId === channel.id}
                  onClick={() => onChannelSelect(channel.id)}
                  sx={itemSx}
                >
                  <ListItemIcon sx={{ minWidth: iconMinWidth }}>
                    <Icon sx={{ fontSize: iconFontSize }} />
                  </ListItemIcon>
                  <ListItemText
                    primary={channel.name}
                    primaryTypographyProps={{
                      fontSize: itemFontSize,
                      fontWeight:
                        selectedChannelId === channel.id ? 600 : 500,
                      noWrap: true,
                    }}
                  />
                  {channel.isPrivate && (
                    <LockIcon
                      sx={{
                        fontSize: compact ? "0.875rem" : "small",
                        color: "text.secondary",
                        ml: compact ? 0.5 : 1,
                      }}
                    />
                  )}
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        </Collapse>
      </React.Fragment>
    );
  };

  return (
    <List disablePadding={compact}>
      {renderCategory("Text Channels", textChannels, TagIcon)}
      {renderCategory("Voice Channels", voiceChannels, VoiceIcon)}
    </List>
  );
};

export default ChannelCategoryList;
