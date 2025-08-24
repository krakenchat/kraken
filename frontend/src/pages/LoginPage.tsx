import React, { useState } from "react";
import {
  Box,
  Button,
  TextField,
  Typography,
  CircularProgress,
  Alert,
} from "@mui/material";
import { LockOutlined } from "@mui/icons-material";
import { useLazyLoginQuery } from "../features/auth/authSlice";
import { useNavigate } from "react-router-dom";

const LoginPage: React.FC = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [login, { isLoading, error }] = useLazyLoginQuery();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      const accessToken = await login({ username, password }).unwrap();
      // Store the token in localStorage
      localStorage.setItem('accessToken', JSON.stringify(accessToken));
      navigate("/");
    } catch (err) {
      console.error("Login failed:", err);
    }
  };

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 2,
      }}
    >
      <Box
        component="form"
        onSubmit={handleSubmit}
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          padding: 4,
          borderRadius: 2,
          boxShadow: 3,
          maxWidth: 400,
        }}
        aria-labelledby="login-title"
      >
        <LockOutlined
          sx={{ fontSize: 40, color: "#1976d2", marginBottom: 2 }}
          aria-hidden="true"
        />
        <Typography
          id="login-title"
          variant="h5"
          component="h1"
          sx={{ marginBottom: 2 }}
        >
          Login
        </Typography>
        {error && (
          <Alert
            severity="error"
            sx={{ width: "100%", marginBottom: 2 }}
            role="alert"
          >
            {"Login failed. Please try again."}
          </Alert>
        )}
        <TextField
          id="username"
          label="Username"
          variant="outlined"
          fullWidth
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          sx={{ marginBottom: 2 }}
          required
        />
        <TextField
          id="password"
          label="Password"
          type="password"
          variant="outlined"
          fullWidth
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          sx={{ marginBottom: 2 }}
          required
        />
        <Button
          type="submit"
          variant="contained"
          color="primary"
          fullWidth
          disabled={isLoading}
          sx={{ marginBottom: 2 }}
        >
          {isLoading ? <CircularProgress size={24} color="inherit" /> : "Login"}
        </Button>
        <Typography variant="body2" color="textSecondary">
          Don't have an account?{" "}
          <a href="/register" aria-label="Register for an account">
            Register here
          </a>
        </Typography>
      </Box>
    </Box>
  );
};

export default LoginPage;
