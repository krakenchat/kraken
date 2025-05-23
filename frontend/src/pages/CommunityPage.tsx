import React from "react";
import { useParams } from "react-router-dom";
import { useGetCommunityByIdQuery } from "../features/community/communityApiSlice";
import { Avatar, Box, Typography, Paper } from "@mui/material";
import ChannelList from "../components/Channel/ChannelList";
import ChannelMessageContainer from "../components/Channel/ChannelMessageContainer";
import { styled } from "@mui/material/styles";
import { useCommunityJoin } from "../hooks/useCommunityJoin";

const Root = styled(Box)({
  display: "flex",
  height: "100%",
  width: "100%",
  position: "absolute",
  top: 0,
  left: 0,
  bottom: 0,
  right: 0,
});

const Sidebar = styled(Paper)(({ theme }) => ({
  position: "absolute",
  top: 0,
  left: 0,
  bottom: 0,
  width: 280,
  minWidth: 220,
  maxWidth: 320,
  display: "flex",
  flexDirection: "column",
  alignItems: "stretch",
  borderRadius: 0,
  boxShadow: "none",
  borderRight: `1px solid ${theme.palette.divider}`,
  padding: theme.spacing(2, 0, 0, 0),
  overflowY: "auto",
  zIndex: 2,
}));

const CommunityHeader = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: theme.spacing(1.5),
  padding: theme.spacing(0, 2, 2, 2),
  borderBottom: `1px solid ${theme.palette.divider}`,
}));

const Content = styled(Box)(() => ({
  flex: 1,
  display: "flex",
  flexDirection: "column-reverse",
  alignItems: "center",
  justifyContent: "flex-start",
  overflowY: "auto",
  marginLeft: 280, // match Sidebar width
  height: "100%",
}));

const CommunityPage: React.FC = () => {
  const { communityId, channelId } = useParams<{
    communityId: string;
    channelId: string;
  }>();

  const { data, error, isLoading } = useGetCommunityByIdQuery(communityId!, {
    skip: !communityId,
  });

  useCommunityJoin(communityId);

  if (!communityId) return <div>Community ID is required</div>;
  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error loading community data</div>;
  if (!data) return <div>No community data found</div>;

  return (
    <Root>
      <Sidebar>
        <CommunityHeader>
          <Avatar
            src={data.avatar || ""}
            alt={`${data.name} logo`}
            sx={{ width: 40, height: 40 }}
          />
          <Typography variant="h6" noWrap sx={{ fontWeight: 700 }}>
            {data.name}
          </Typography>
        </CommunityHeader>
        <ChannelList communityId={communityId} />
      </Sidebar>
      <Content>
        {channelId && (
          <Box sx={{ width: "100%" }}>
            <ChannelMessageContainer channelId={channelId} />
          </Box>
        )}
      </Content>
    </Root>
  );
};

export default CommunityPage;
