import { ReactNode, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { Box, Typography, Button } from '@mui/material';
import { ErrorBoundary } from './ErrorBoundary';

interface RouteErrorBoundaryProps {
  children: ReactNode;
}

interface RouteErrorFallbackProps {
  reset: () => void;
}

/**
 * Rendered ONLY while the boundary is in the errored state (it's the
 * `fallback` render-prop output, not a sibling of the healthy children). It
 * captures the pathname that was active when it mounted — i.e. the crashed
 * route's pathname — and watches for navigation away from it, calling
 * `reset()` automatically. Because this component only exists during the
 * errored state, none of this navigation-watching logic runs during normal
 * (healthy) operation: navigating between healthy routes never mounts this
 * component and never touches `useLocation` here at all.
 */
const RouteErrorFallback: React.FC<RouteErrorFallbackProps> = ({ reset }) => {
  const location = useLocation();
  const crashedPathnameRef = useRef(location.pathname);

  useEffect(() => {
    if (location.pathname !== crashedPathnameRef.current) {
      reset();
    }
  }, [location.pathname, reset]);

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        width: '100%',
        p: 3,
        textAlign: 'center',
      }}
    >
      <Typography variant="body1" color="text.primary" gutterBottom>
        Something went wrong loading this page
      </Typography>
      <Button variant="outlined" color="primary" onClick={reset} sx={{ mt: 1 }}>
        Try again
      </Button>
    </Box>
  );
};

/**
 * Wraps route content in an ErrorBoundary that:
 * - Automatically resets when the URL pathname changes away from the
 *   pathname that was active at crash time, so navigating away from a
 *   crashed route recovers without a full page reload.
 * - Offers a "Try again" button to reset without navigating.
 *
 * Deliberately does NOT key the inner ErrorBoundary (or its children) by
 * `location.pathname`. During healthy operation this component renders
 * `children` completely unmodified — no keying, no location-derived remount
 * — so ordinary navigation never unmounts/remounts anything beneath it
 * (providers, sockets, voice connections, etc. all survive route changes).
 * Reset-on-navigation only happens while errored, via the `RouteErrorFallback`
 * above, which is the only place that reads `location`.
 */
export const RouteErrorBoundary: React.FC<RouteErrorBoundaryProps> = ({ children }) => {
  return (
    <ErrorBoundary fallback={(_error, reset) => <RouteErrorFallback reset={reset} />}>
      {children}
    </ErrorBoundary>
  );
};

export default RouteErrorBoundary;
