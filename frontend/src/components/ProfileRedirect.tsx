import { Navigate } from "react-router-dom";
import { CircularProgress, Box } from "@mui/material";
import { useCurrentUser } from "../hooks/useCurrentUser";

/** Redirects bare `/profile` to the current user's profile. */
export const ProfileRedirect: React.FC = () => {
  const { user, isLoading } = useCurrentUser();
  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }
  if (user?.id) {
    return <Navigate to={`/profile/${user.id}`} replace />;
  }
  return <Navigate to="/" replace />;
};

export default ProfileRedirect;
