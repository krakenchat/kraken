import React from 'react';
import {
  Box,
  Paper,
  Typography,
  Avatar,
  CircularProgress,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  useTheme,
  alpha,
} from '@mui/material';
import {
  Notifications as NotificationIcon,
  Group as GroupIcon,
} from '@mui/icons-material';
import { MentionSuggestion } from '../../hooks/useMentionAutocomplete';
import UserAvatar from '../Common/UserAvatar';

interface MentionDropdownProps {
  suggestions: MentionSuggestion[];
  selectedIndex: number;
  isLoading: boolean;
  onSelectSuggestion: (index: number) => void;
  position?: { top?: number; bottom?: number; left: number };
}

export const MentionDropdown: React.FC<MentionDropdownProps> = ({
  suggestions,
  selectedIndex,
  isLoading,
  onSelectSuggestion,
  position = { bottom: 60, left: 20 },
}) => {
  const theme = useTheme();

  if (isLoading) {
    return (
      <Paper
        elevation={8}
        sx={{
          position: 'absolute',
          ...position,
          minWidth: 280,
          maxWidth: 360,
          zIndex: 2000,
          backgroundImage: `linear-gradient(145deg, ${alpha(theme.palette.background.paper, 0.95)}, ${alpha(theme.palette.background.paper, 0.85)})`,
          backdropFilter: 'blur(20px)',
          borderRadius: 3,
          border: `1px solid ${alpha(theme.palette.divider, 0.12)}`,
          boxShadow: `
            0 8px 32px ${alpha(theme.palette.common.black, 0.12)},
            0 2px 8px ${alpha(theme.palette.common.black, 0.08)},
            inset 0 1px 0 ${alpha(theme.palette.common.white, 0.05)}
          `,
          p: 3,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          '&::before': {
            content: '""',
            position: 'absolute',
            bottom: -8,
            left: 24,
            width: 0,
            height: 0,
            borderLeft: '8px solid transparent',
            borderRight: '8px solid transparent',
            borderTop: `8px solid ${alpha(theme.palette.background.paper, 0.95)}`,
            filter: `drop-shadow(0 2px 4px ${alpha(theme.palette.common.black, 0.1)})`,
          },
        }}
      >
        <CircularProgress size={20} thickness={4} />
        <Typography variant="body2" sx={{ ml: 2, color: 'text.secondary' }}>
          Searching...
        </Typography>
      </Paper>
    );
  }

  if (!suggestions || suggestions.length === 0) {
    return null;
  }

  return (
    <Paper
      elevation={8}
      sx={{
        position: 'absolute',
        ...position,
        minWidth: 280,
        maxWidth: 360,
        maxHeight: 320,
        overflow: 'hidden',
        zIndex: 2000,
        background: `linear-gradient(145deg, ${alpha(theme.palette.background.paper, 0.95)}, ${alpha(theme.palette.background.paper, 0.85)})`,
        backdropFilter: 'blur(20px)',
        borderRadius: 3,
        border: `1px solid ${alpha(theme.palette.divider, 0.12)}`,
        boxShadow: `
          0 8px 32px ${alpha(theme.palette.common.black, 0.12)},
          0 2px 8px ${alpha(theme.palette.common.black, 0.08)},
          inset 0 1px 0 ${alpha(theme.palette.common.white, 0.05)}
        `,
        '&::before': {
          content: '""',
          position: 'absolute',
          bottom: -8,
          left: 24,
          width: 0,
          height: 0,
          borderLeft: '8px solid transparent',
          borderRight: '8px solid transparent',
          borderTop: `8px solid ${alpha(theme.palette.background.paper, 0.95)}`,
          filter: `drop-shadow(0 2px 4px ${alpha(theme.palette.common.black, 0.1)})`,
        },
      }}
    >
      {/* Header */}
      <Box
        sx={{
          px: 2,
          py: 1.5,
          borderBottom: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
          background: alpha(theme.palette.primary.main, 0.02),
        }}
      >
        <Typography
          variant="caption"
          sx={{
            color: 'text.secondary',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
          }}
        >
          {(() => {
            const types = new Set(suggestions.map(s => s.type));
            if (types.size === 1) {
              if (types.has('user')) return 'Members';
              if (types.has('alias')) return 'Mention Groups';
              return 'Special Mentions';
            }
            return 'Suggestions';
          })()}
        </Typography>
      </Box>

      {/* Suggestions List */}
      <List
        sx={{
          p: 0.5,
          maxHeight: 260,
          overflow: 'auto',
          '&::-webkit-scrollbar': {
            width: 4,
          },
          '&::-webkit-scrollbar-track': {
            background: 'transparent',
          },
          '&::-webkit-scrollbar-thumb': {
            background: alpha(theme.palette.text.secondary, 0.2),
            borderRadius: 2,
          },
        }}
      >
        {suggestions.map((suggestion, index) => (
          <ListItem
            key={suggestion.id}
            onClick={() => onSelectSuggestion(index)}
            sx={{
              borderRadius: 2,
              mb: 0.25,
              cursor: 'pointer',
              transition: 'all 0.15s ease-in-out',
              backgroundImage: index === selectedIndex
                ? `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.08)}, ${alpha(theme.palette.primary.main, 0.04)})`
                : 'none',
              transform: index === selectedIndex ? 'translateX(2px)' : 'none',
              borderLeft: index === selectedIndex
                ? `3px solid ${theme.palette.primary.main}`
                : '3px solid transparent',
              '&:hover': {
                backgroundImage: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.06)}, ${alpha(theme.palette.primary.main, 0.03)})`,
                transform: 'translateX(1px)',
              },
              '&:active': {
                transform: 'translateX(3px) scale(0.98)',
              },
            }}
          >
            <ListItemAvatar
              sx={{
                minWidth: 40,
                mr: 1,
              }}
            >
              {suggestion.type === 'user' ? (
                <Box
                  sx={{
                    border: index === selectedIndex
                      ? `2px solid ${alpha(theme.palette.primary.main, 0.5)}`
                      : `2px solid ${alpha(theme.palette.divider, 0.1)}`,
                    transition: 'border 0.15s ease-in-out',
                    borderRadius: '50%',
                  }}
                >
                  <UserAvatar
                    user={{
                      avatarUrl: suggestion.avatar,
                      displayName: suggestion.displayName,
                      username: suggestion.displayName,
                    }}
                    size="small"
                  />
                </Box>
              ) : suggestion.type === 'alias' ? (
                <Avatar
                  sx={{
                    width: 32,
                    height: 32,
                    bgcolor: alpha(theme.palette.warning.main, 0.1),
                    color: 'warning.main',
                    border: index === selectedIndex
                      ? `2px solid ${alpha(theme.palette.warning.main, 0.5)}`
                      : `2px solid ${alpha(theme.palette.divider, 0.1)}`,
                    transition: 'all 0.15s ease-in-out',
                  }}
                >
                  <GroupIcon fontSize="small" />
                </Avatar>
              ) : (
                <Avatar
                  sx={{
                    width: 32,
                    height: 32,
                    bgcolor: alpha(theme.palette.success.main, 0.1),
                    color: 'success.main',
                    border: index === selectedIndex
                      ? `2px solid ${alpha(theme.palette.success.main, 0.5)}`
                      : `2px solid ${alpha(theme.palette.divider, 0.1)}`,
                    transition: 'all 0.15s ease-in-out',
                  }}
                >
                  <NotificationIcon fontSize="small" />
                </Avatar>
              )}
            </ListItemAvatar>
            <ListItemText
              primary={
                <Typography
                  variant="body2"
                  sx={{
                    fontWeight: index === selectedIndex ? 600 : 500,
                    color: index === selectedIndex
                      ? 'primary.main'
                      : 'text.primary',
                    transition: 'all 0.15s ease-in-out',
                  }}
                >
                  @{suggestion.displayName}
                </Typography>
              }
              secondary={
                suggestion.subtitle && (
                  <Typography
                    variant="caption"
                    sx={{
                      color: 'text.secondary',
                      opacity: 0.8,
                    }}
                  >
                    {suggestion.subtitle}
                  </Typography>
                )
              }
              sx={{
                '& .MuiListItemText-primary': {
                  lineHeight: 1.3,
                  mb: suggestion.subtitle ? 0.25 : 0,
                },
                '& .MuiListItemText-secondary': {
                  lineHeight: 1.2,
                },
              }}
            />
          </ListItem>
        ))}
      </List>

      {/* Footer hint */}
      <Box
        sx={{
          px: 2,
          py: 1,
          borderTop: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
          background: alpha(theme.palette.background.paper, 0.3),
        }}
      >
        <Typography
          variant="caption"
          sx={{
            color: 'text.secondary',
            fontSize: '0.7rem',
            opacity: 0.6,
          }}
        >
          ↑↓ Navigate • Enter/Tab Select • Esc Close
        </Typography>
      </Box>
    </Paper>
  );
};