import React from "react";
import {
  Box,
  Card,
  CardContent,
  Typography,
  Avatar,
  CircularProgress,
  Alert,
} from "@mui/material";
import { useProfileQuery } from "../features/users/usersSlice";

const HomePage: React.FC = () => {
  const { data, isLoading, isError } = useProfileQuery(undefined);

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "400px",
        backgroundColor: "#f5f5f5",
        padding: 2,
      }}
    >
      {isLoading && <CircularProgress />}
      {isError && (
        <Alert severity="error" sx={{ width: "100%", maxWidth: 400 }}>
          Error loading profile!
        </Alert>
      )}
      {data && (
        <Card
          sx={{
            width: "100%",
            maxWidth: 400,
            padding: 2,
            borderRadius: 2,
            boxShadow: 3,
          }}
        >
          <CardContent
            sx={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
            }}
          >
            <Avatar
              sx={{
                width: 80,
                height: 80,
                marginBottom: 2,
                backgroundColor: "#1976d2",
                fontSize: 32,
              }}
            >
              {data.avatarUrl ? (
                <img
                  src={data.avatarUrl}
                  alt={`${data.displayName}'s avatar`}
                  style={{ width: "100%", height: "100%", borderRadius: "50%" }}
                />
              ) : (
                data.displayName?.charAt(0).toUpperCase()
              )}
            </Avatar>
            <Typography variant="h5" component="h1" sx={{ marginBottom: 1 }}>
              {data.displayName}
            </Typography>
            <Typography
              variant="body1"
              color="textSecondary"
              sx={{ marginBottom: 1 }}
            >
              @{data.username}
            </Typography>
            <Typography
              variant="body2"
              color="textSecondary"
              sx={{ marginBottom: 1 }}
            >
              Role: {data.role}
            </Typography>
            <Typography variant="body2" color="textSecondary">
              Last Seen:{" "}
              {data.lastSeen ? new Date(data.lastSeen).toLocaleString() : "N/A"}
            </Typography>
          </CardContent>
        </Card>
      )}
    </Box>
  );
};

export default HomePage;
