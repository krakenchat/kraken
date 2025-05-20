import { useGetMessagesByChannelQuery } from "../../features/messages/messagesApiSlice";
import MessageComponent from "../Message/MessageComponent";
import { Typography } from "@mui/material";

interface ChannelMessageContainerProps {
  channelId: string;
}

const ChannelMessageContainer: React.FC<ChannelMessageContainerProps> = ({
  channelId,
}) => {
  const { data, error, isLoading } = useGetMessagesByChannelQuery({
    channelId,
  });

  if (isLoading) return <Typography>Loading messages...</Typography>;
  if (error)
    return <Typography color="error">Error loading messages</Typography>;
  if (!data || !data.messages || data.messages.length === 0) {
    return <Typography>No messages found.</Typography>;
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column-reverse",
        gap: 0,
        height: "100%",
        overflowY: "auto",
      }}
    >
      {data.messages.map((msg) => (
        <MessageComponent key={msg.id} message={msg} />
      ))}
    </div>
  );
};

export default ChannelMessageContainer;
