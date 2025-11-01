import React, { useState } from "react";
import {
  Box,
  Button,
  TextField,
  Typography,
  Alert,
  CircularProgress,
} from "@mui/material";
import { styled } from "@mui/system";
import { useLazyRegisterQuery } from "../features/users/usersSlice";
import { useNavigate } from "react-router-dom";
import { useLazyLoginQuery } from "../features/auth/authSlice";

const FormContainer = styled(Box)({
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  padding: "16px",
});

const FormBox = styled(Box)({
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  padding: "32px",
  borderRadius: "8px",
  boxShadow: "0px 4px 10px rgba(0, 0, 0, 0.1)",
  width: "100%",
  maxWidth: "400px",
});

const RegisterPage: React.FC = () => {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [register, { isLoading, error }] = useLazyRegisterQuery();
  const [login, { isLoading: isLoginLoading }] = useLazyLoginQuery();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await register({ username, email, password, code }).unwrap();
      const response = await login({ username, password }).unwrap();
      localStorage.setItem('accessToken', JSON.stringify(response.accessToken));
      if (response.refreshToken) {
        localStorage.setItem('refreshToken', response.refreshToken);
      }
      navigate("/");
    } catch (err) {
      console.error("Registration failed:", err);
    }
  };

  return (
    <FormContainer>
      <FormBox
        as="form"
        onSubmit={handleSubmit}
        aria-labelledby="register-title"
      >
        <Typography
          id="register-title"
          variant="h5"
          component="h1"
          sx={{ marginBottom: 2 }}
        >
          Register
        </Typography>
        {error && (
          <Alert
            severity="error"
            sx={{ width: "100%", marginBottom: 2 }}
            role="alert"
          >
            Registration failed. Please try again.
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
          id="email"
          label="Email"
          type="email"
          variant="outlined"
          fullWidth
          value={email}
          onChange={(e) => setEmail(e.target.value)}
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
        <TextField
          id="code"
          label="Code"
          variant="outlined"
          fullWidth
          value={code}
          onChange={(e) => setCode(e.target.value)}
          sx={{ marginBottom: 2 }}
          required
        />
        <Button
          type="submit"
          variant="contained"
          color="primary"
          fullWidth
          disabled={isLoading}
        >
          {isLoading || isLoginLoading ? (
            <CircularProgress size={24} color="inherit" />
          ) : (
            "Register"
          )}
        </Button>
        <Typography variant="body2" color="textSecondary" sx={{ marginTop: 2 }}>
          Already have an account?{" "}
          <a href="/login" aria-label="Go to login page">
            Login here
          </a>
        </Typography>
      </FormBox>
    </FormContainer>
  );
};

export default RegisterPage;
