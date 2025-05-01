import React from "react";
import { useMyCommunitiesQuery } from "../../features/community/communityApiSlice";
import Drawer from "@mui/material/Drawer";
import Box from "@mui/material/Box";
import Avatar from "@mui/material/Avatar";
import Tooltip from "@mui/material/Tooltip";
import { styled } from "@mui/system";
import IconButton from "@mui/material/IconButton";
import MenuOpenIcon from "@mui/icons-material/MenuOpen";
import MenuIcon from "@mui/icons-material/Menu";
import Typography from "@mui/material/Typography";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";

export interface Community {
  id: string;
  name: string;
  avatar?: string | null;
  banner?: string | null;
  description?: string | null;
  createdAt: Date;
}

interface CommunityToggleProps {
  appBarHeight: number;
}

const COLLAPSED_WIDTH = 80;
const EXPANDED_WIDTH = 320;

const Sidebar = styled(Drawer, {
  shouldForwardProp: (prop) =>
    prop !== "appBarHeight" && prop !== "expanded" && prop !== "isMobile",
})<{
  appBarHeight: number;
  expanded: boolean;
  isMobile: boolean;
}>(({ appBarHeight, expanded, isMobile, theme }) => ({
  width: expanded ? (isMobile ? "100vw" : EXPANDED_WIDTH) : COLLAPSED_WIDTH,
  flexShrink: 0,
  zIndex: 1200,
  "& .MuiDrawer-paper": {
    width: expanded ? (isMobile ? "100vw" : EXPANDED_WIDTH) : COLLAPSED_WIDTH,
    boxSizing: "border-box",
    borderRight: `1px solid ${theme.palette.divider}`,
    display: "flex",
    alignItems: "center",
    paddingTop: 16,
    paddingBottom: 16,
    top: appBarHeight,
    height: `calc(100vh - ${appBarHeight}px)`,
    transition: "width 0.3s cubic-bezier(0.4,0,0.2,1)",
    // Remove explicit background, let theme handle it
    overflowX: "hidden",
  },
  "&.MuiDrawer-root": {
    top: appBarHeight,
    height: `calc(100vh - ${appBarHeight}px)`,
  },
}));

const CommunityList = styled(Box, {
  shouldForwardProp: (prop) => prop !== "expanded",
})<{ expanded: boolean }>(({ expanded }) => ({
  display: "flex",
  flexDirection: "column",
  alignItems: expanded ? "stretch" : "center",
  gap: 12,
  width: "100%",
  paddingLeft: expanded ? 12 : 0,
  paddingRight: expanded ? 12 : 0,
}));

// Deterministic hash to color function
function stringToColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  // Generate color in HSL for better distribution
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 65%, 55%)`;
}

const CommunityToggle: React.FC<CommunityToggleProps> = ({ appBarHeight }) => {
  const { data: communities, isLoading, error } = useMyCommunitiesQuery();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const [expanded, setExpanded] = React.useState(false);

  const getCommunityAvatar = (community: Community) => {
    return (
      community.avatar ||
      community.name
        .split(" ")
        .slice(0, 2)
        .map((char) => char[0].toUpperCase())
        .join("")
    );
  };

  return (
    <Sidebar
      variant="permanent"
      anchor="left"
      appBarHeight={appBarHeight}
      expanded={expanded}
      isMobile={isMobile}
    >
      <Box
        sx={{
          width: "100%",
          display: "flex",
          justifyContent: expanded ? "flex-end" : "center",
          mb: 2,
        }}
      >
        <IconButton
          size="small"
          onClick={() => setExpanded((e) => !e)}
          sx={{
            // Remove explicit color/background, let theme handle it
            mb: 1,
          }}
        >
          {expanded ? <MenuOpenIcon /> : <MenuIcon />}
        </IconButton>
      </Box>
      <CommunityList expanded={expanded}>
        {isLoading && <Box color="grey.500">Loading...</Box>}
        {error && <Box color="error.main">Error loading</Box>}
        {communities && communities.length > 0
          ? communities.map((community: Community) => {
              const content = (
                <Box
                  key={community.id}
                  sx={{
                    position: "relative",
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    borderRadius: 2,
                    overflow: "hidden",
                    minHeight: 56,
                    // Remove explicit background, let theme handle it
                    mb: 1,
                    cursor: "pointer",
                    transition: "background 0.2s",
                  }}
                >
                  <Avatar
                    sx={{
                      width: 48,
                      height: 48,
                      bgcolor: !community.avatar
                        ? stringToColor(community.id)
                        : undefined,
                      fontWeight: 700,
                      fontSize: 24,
                      border: "2px solid transparent",
                      ml: expanded ? 0 : "auto",
                      mr: expanded ? 2 : "auto",
                      zIndex: 1,
                      transition: "box-shadow 0.2s",
                      "&:hover": {
                        boxShadow: "0 0 0 2px #5865f2",
                      },
                      cursor: "pointer",
                    }}
                    src={community.avatar || undefined}
                    alt={community.name}
                  >
                    {getCommunityAvatar(community)}
                  </Avatar>
                  {expanded && (
                    <Box sx={{ flex: 1, minWidth: 0, zIndex: 1 }}>
                      <Typography
                        variant="subtitle1"
                        noWrap
                        sx={{ fontWeight: 600 }}
                      >
                        {community.name}
                      </Typography>
                      {community.description && (
                        <Typography
                          variant="body2"
                          noWrap
                          sx={{ opacity: 0.8, fontSize: 13 }}
                        >
                          {community.description}
                        </Typography>
                      )}
                    </Box>
                  )}
                  {community.banner && expanded && (
                    <Box
                      sx={{
                        position: "absolute",
                        inset: 0,
                        zIndex: 0,
                        background: `linear-gradient(90deg, rgba(24,25,28,0.7) 60%, rgba(24,25,28,0.2) 100%)`,
                      }}
                    />
                  )}
                </Box>
              );
              return expanded ? (
                content
              ) : (
                <Tooltip
                  title={community.name}
                  placement="right"
                  key={community.id}
                  arrow
                >
                  {content}
                </Tooltip>
              );
            })
          : !isLoading && (
              <Box color="grey.500" fontSize={12}>
                No communities
              </Box>
            )}
      </CommunityList>
    </Sidebar>
  );
};

export default CommunityToggle;
