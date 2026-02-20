import { Navigate } from "react-router-dom";
import { getAccessToken, isTokenExpired } from "../utils/tokenService";

/**
 * Wrapper for public routes (/login, /register) that redirects
 * already-authenticated users to the home page.
 */
export function PublicRoute({ children }: { children: React.ReactNode }) {
  const token = getAccessToken();

  if (token && !isTokenExpired(token)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

export default PublicRoute;
