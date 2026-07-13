import { ReactNode, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Box, Typography, Button } from '@mui/material';
import { ErrorBoundary } from './ErrorBoundary';

interface RouteErrorBoundaryProps {
  children: ReactNode;
}

interface RouteErrorFallbackProps {
  onRetry: () => void;
}

const RouteErrorFallback: React.FC<RouteErrorFallbackProps> = ({ onRetry }) => (
  <Box
    sx={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '50vh',
      width: '100%',
      p: 3,
      textAlign: 'center',
    }}
  >
    <Typography variant="body1" color="text.primary" gutterBottom>
      Something went wrong loading this page
    </Typography>
    <Button variant="outlined" color="primary" onClick={onRetry} sx={{ mt: 1 }}>
      Try again
    </Button>
  </Box>
);

/**
 * Wraps route content in an ErrorBoundary that:
 * - Automatically resets when the URL pathname changes, so navigating away
 *   from a crashed route recovers without a full page reload.
 * - Offers a "Try again" button to reset without navigating.
 *
 * Both cases are implemented by remounting the inner ErrorBoundary (and its
 * children) via a `key` that changes on pathname change or manual retry.
 */
export const RouteErrorBoundary: React.FC<RouteErrorBoundaryProps> = ({ children }) => {
  const location = useLocation();
  const [retryCount, setRetryCount] = useState(0);

  return (
    <ErrorBoundary
      key={`${location.pathname}:${retryCount}`}
      fallback={<RouteErrorFallback onRetry={() => setRetryCount((count) => count + 1)} />}
    >
      {children}
    </ErrorBoundary>
  );
};

export default RouteErrorBoundary;
