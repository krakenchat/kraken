import React from 'react';
import { Box, Fade, Paper } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { dockZoneRects, hitTestDockZone, type Point, type Viewport } from '../../utils/pipPosition';

interface DockZonesOverlayProps {
  viewport: Viewport;
  pointerPosition: Point | null;
}

/**
 * Four translucent corner targets shown while the FloatCard header is being
 * dragged, so the user can see where dropping will dock the card. Mounted by
 * FloatCard only for the duration of the drag gesture.
 */
export const DockZonesOverlay: React.FC<DockZonesOverlayProps> = ({ viewport, pointerPosition }) => {
  const theme = useTheme();
  const zones = dockZoneRects(viewport);
  const activeZone = pointerPosition ? hitTestDockZone(pointerPosition, viewport) : null;

  return (
    <Fade in appear>
      <Box
        sx={{
          position: 'fixed',
          inset: 0,
          zIndex: 1199,
          pointerEvents: 'none',
        }}
      >
        {zones.map((zone) => (
          <Paper
            key={zone.anchor}
            data-testid={`dock-zone-${zone.anchor}`}
            elevation={0}
            sx={{
              position: 'fixed',
              left: zone.x,
              top: zone.y,
              width: zone.width,
              height: zone.height,
              borderRadius: 2,
              border: `2px dashed ${theme.palette.primary.main}`,
              backgroundColor: alpha(theme.palette.primary.main, zone.anchor === activeZone ? 0.35 : 0.12),
              transition: 'background-color 0.15s ease',
            }}
          />
        ))}
      </Box>
    </Fade>
  );
};

export default DockZonesOverlay;
