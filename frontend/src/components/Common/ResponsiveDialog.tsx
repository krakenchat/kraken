import React from 'react';
import {
  Dialog,
  DialogTitle,
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Slide,
  Box,
} from '@mui/material';
import type { DialogProps } from '@mui/material';
import type { TransitionProps } from '@mui/material/transitions';
import CloseIcon from '@mui/icons-material/Close';
import { useMobileBreakpoint } from '../../hooks/useResponsive';

/**
 * Slide-up transition used for the fullScreen (mobile) presentation.
 */
const SlideUpTransition = React.forwardRef(function SlideUpTransition(
  props: TransitionProps & { children: React.ReactElement },
  ref: React.Ref<unknown>,
) {
  return <Slide direction="up" ref={ref} {...props} />;
});

export interface ResponsiveDialogProps extends Omit<DialogProps, 'title'> {
  /** Dialog heading. Rendered in a DialogTitle on desktop and in an app-bar on mobile. */
  title?: React.ReactNode;
  /**
   * Optional element rendered alongside the title (e.g. an extra action
   * icon): on the right side of the `DialogTitle` on desktop, and before the
   * close button in the mobile app-bar title bar.
   */
  titleActions?: React.ReactNode;
  /**
   * The dialog body — typically a `<DialogContent>` followed by `<DialogActions>`.
   * The title is provided via the `title` prop, not as a child.
   */
  children?: React.ReactNode;
}

/**
 * ResponsiveDialog
 *
 * A thin wrapper around MUI's `Dialog` that becomes fullScreen (with a slide-up
 * transition and an app-bar-style title bar containing a close button) below the
 * phone breakpoint, while rendering an ordinary centered dialog on desktop.
 *
 * Desktop appearance is unchanged from a plain `<Dialog>` — pass `title` instead
 * of an explicit `<DialogTitle>` and it renders identically above the breakpoint.
 */
export const ResponsiveDialog: React.FC<ResponsiveDialogProps> = ({
  title,
  titleActions,
  children,
  onClose,
  fullScreen: fullScreenProp,
  TransitionComponent,
  PaperProps,
  ...dialogProps
}) => {
  const isMobile = useMobileBreakpoint();
  const fullScreen = fullScreenProp ?? isMobile;

  const handleCloseClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    onClose?.(event, 'escapeKeyDown');
  };

  // On mobile, honor top/bottom safe-area insets so the title bar clears the
  // notch/status bar and the action buttons clear the home indicator.
  const mobilePaperSx = fullScreen
    ? {
        '& .MuiDialogActions-root': {
          paddingBottom: 'calc(8px + env(safe-area-inset-bottom))',
        },
      }
    : undefined;

  return (
    <Dialog
      {...dialogProps}
      onClose={onClose}
      fullScreen={fullScreen}
      TransitionComponent={fullScreen ? SlideUpTransition : TransitionComponent}
      PaperProps={{
        ...PaperProps,
        sx: [
          mobilePaperSx,
          ...(Array.isArray(PaperProps?.sx) ? PaperProps.sx : [PaperProps?.sx]),
        ],
      }}
    >
      {fullScreen ? (
        <AppBar
          position="sticky"
          color="default"
          elevation={0}
          sx={{
            paddingTop: 'env(safe-area-inset-top)',
            borderBottom: 1,
            borderColor: 'divider',
            backgroundColor: 'background.paper',
          }}
        >
          <Toolbar>
            <Typography variant="h6" component="div" sx={{ flex: 1, minWidth: 0 }} noWrap>
              {title}
            </Typography>
            {titleActions}
            <IconButton
              edge="end"
              color="inherit"
              onClick={handleCloseClick}
              aria-label="close"
            >
              <CloseIcon />
            </IconButton>
          </Toolbar>
        </AppBar>
      ) : (
        (title != null || titleActions != null) && (
          <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box sx={{ flex: 1, minWidth: 0 }}>{title}</Box>
            {titleActions}
          </DialogTitle>
        )
      )}
      {children}
    </Dialog>
  );
};

export default ResponsiveDialog;
