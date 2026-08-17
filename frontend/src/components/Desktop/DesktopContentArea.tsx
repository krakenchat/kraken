import React from "react";
import { Box } from "@mui/material";
import { Outlet } from "react-router-dom";
import { useVideoOverlay } from "../../contexts/VideoOverlayContext";
import { APPBAR_HEIGHT, SIDEBAR_WIDTH, VOICE_BAR_HEIGHT } from "../../constants/layout";
import { RouteErrorBoundary } from "../RouteErrorBoundary";

/** Content area that registers itself as the fallback video overlay container */
export const DesktopContentArea: React.FC<{ voiceConnected: boolean; isMenuExpanded: boolean }> = ({
  voiceConnected,
  isMenuExpanded,
}) => {
  const { setDefaultContainer } = useVideoOverlay();

  return (
    <Box
      ref={setDefaultContainer}
      sx={{
        position: "absolute",
        top: APPBAR_HEIGHT,
        left: isMenuExpanded ? 320 : SIDEBAR_WIDTH,
        right: 0,
        bottom: voiceConnected ? VOICE_BAR_HEIGHT : 0,
        overflow: "auto",
        transition: "left 0.3s cubic-bezier(0.4,0,0.2,1)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <Box sx={{ flex: 1, minHeight: "100%" }}>
        {/*
          Panel-level seam: wraps only the routed page content so a crash in
          any single page/panel leaves the AppBar, community sidebar, and
          voice bottom bar (siblings of LayoutContentArea, rendered below)
          mounted and functional. This is the boundary that keeps the desktop
          shell alive — see App.tsx for the outer RouteErrorBoundary that
          covers everything else (including Layout itself).
        */}
        <RouteErrorBoundary>
          <Outlet />
        </RouteErrorBoundary>
      </Box>
    </Box>
  );
};

export default DesktopContentArea;
