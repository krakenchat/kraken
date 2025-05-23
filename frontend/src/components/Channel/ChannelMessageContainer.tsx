import { useGetMessagesByChannelQuery } from "../../features/messages/messagesApiSlice";
import MessageComponent from "../Message/MessageComponent";
import { Typography } from "@mui/material";
import MessageSkeleton from "../Message/MessageSkeleton";
import MessageInput from "../Message/MessageInput";
import { useProfileQuery } from "../../features/users/usersSlice";

interface ChannelMessageContainerProps {
  channelId: string;
}

const ChannelMessageContainer: React.FC<ChannelMessageContainerProps> = ({
  channelId,
}) => {
  const { data, error, isLoading } = useGetMessagesByChannelQuery({
    channelId,
  });
  const { data: user } = useProfileQuery();
  const authorId = user?.id || "";

  if (isLoading) {
    // Estimate how many skeletons to fill the viewport (e.g., 18px+8px per message, 100vh)
    // We'll use 24 as a safe default for most screens
    const skeletonCount = 24;
    return (
      <div
        className="channel-message-container"
        style={{
          display: "flex",
          flexDirection: "column-reverse",
          gap: 0,
          height: "100%",
          width: "100%",
          overflow: "hidden", // Prevent scrollbars while loading
        }}
      >
        {Array.from({ length: skeletonCount }).map((_, i) => (
          <MessageSkeleton key={i} />
        ))}
      </div>
    );
  }
  if (error)
    return <Typography color="error">Error loading messages</Typography>;
  if (!data || !data.messages || data.messages.length === 0) {
    return <Typography>No messages found.</Typography>;
  }

  return (
    <>
      <div
        className="channel-message-container"
        style={{
          display: "flex",
          flexDirection: "column-reverse",
          gap: 0,
          height: "100%",
          width: "100%",
          overflowY: "auto",
        }}
      >
        {data.messages.map((msg) => (
          <MessageComponent key={msg.id} message={msg} />
        ))}
      </div>
      <MessageInput channelId={channelId} authorId={authorId} />
    </>
  );
};

export default ChannelMessageContainer;
