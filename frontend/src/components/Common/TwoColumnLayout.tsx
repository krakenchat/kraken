import React from "react";
import { Box, Paper } from "@mui/material";
import { styled } from "@mui/material/styles";

interface TwoColumnLayoutProps {
  sidebar: React.ReactNode;
  sidebarWidth?: number;
  children: React.ReactNode;
  /** ref callback for the content area (used by VideoOverlayContext) */
  contentRef?: React.Ref<HTMLDivElement>;
  /** Optional sx overrides for the content area */
  contentSx?: React.ComponentProps<typeof Box>["sx"];
}

const TwoColumnLayout: React.FC<TwoColumnLayoutProps> = ({
  sidebar,
  sidebarWidth = 280,
  children,
  contentRef,
  contentSx,
}) => {
  return (
    <Root>
      <SidebarContainer sx={{ width: sidebarWidth, minWidth: 220, maxWidth: 320 }}>
        {sidebar}
      </SidebarContainer>
      <ContentContainer ref={contentRef} sx={{ marginLeft: `${sidebarWidth}px`, ...contentSx }}>
        {children}
      </ContentContainer>
    </Root>
  );
};

const Root = styled(Box)({
  display: "flex",
  height: "100%",
  width: "100%",
  position: "absolute",
  top: 0,
  left: 0,
  bottom: 0,
  right: 0,
});

const SidebarContainer = styled(Paper)(({ theme }) => ({
  position: "absolute",
  top: 0,
  left: 0,
  bottom: 0,
  display: "flex",
  flexDirection: "column",
  alignItems: "stretch",
  borderRadius: 0,
  padding: theme.spacing(2, 0, 0, 0),
  overflowY: "auto",
  zIndex: 2,
}));

const ContentContainer = styled(Box)({
  flex: 1,
  display: "flex",
  flexDirection: "column",
  alignItems: "stretch",
  justifyContent: "flex-start",
  overflowY: "auto",
  height: "100%",
});

export default TwoColumnLayout;
