import React from "react";
import { useNavigate } from "react-router-dom";
import { Box, Paper, Typography } from "@mui/material";
import { styled } from "@mui/material/styles";
import { FriendsPanel } from "../components/Friends";

const Root = styled(Box)({
  display: "flex",
  height: "100%",
  width: "100%",
  position: "absolute",
  top: 0,
  left: 0,
  bottom: 0,
  right: 0,
  justifyContent: "center",
  alignItems: "flex-start",
  paddingTop: 32,
});

const Container = styled(Paper)(({ theme }) => ({
  width: "100%",
  maxWidth: 800,
  height: "calc(100% - 64px)",
  display: "flex",
  flexDirection: "column",
  borderRadius: theme.shape.borderRadius * 2,
  overflow: "hidden",
}));

const FriendsPage: React.FC = () => {
  const navigate = useNavigate();

  const handleSelectDmGroup = (dmGroupId: string) => {
    // Navigate to DM page with the selected group
    navigate(`/dm?group=${dmGroupId}`);
  };

  return (
    <Root>
      <Container elevation={3}>
        <FriendsPanel onSelectDmGroup={handleSelectDmGroup} />
      </Container>
    </Root>
  );
};

export default FriendsPage;
