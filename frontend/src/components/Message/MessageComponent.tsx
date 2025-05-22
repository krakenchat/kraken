import Avatar from "@mui/material/Avatar";
import { styled, Typography } from "@mui/material";
import type { Message as MessageType, Span } from "../../types/message.type";
import { SpanType } from "../../types/message.type";
import { useGetUserByIdWithCacheQuery } from "../../features/users/usersSlice";

interface MessageProps {
  message: MessageType;
}

function renderSpan(span: Span, idx: number) {
  switch (span.type) {
    case SpanType.USER_MENTION:
      return (
        <span key={idx} style={{ color: "#1976d2", fontWeight: 600 }}>
          @{span.text || span.userId}
        </span>
      );
    case SpanType.SPECIAL_MENTION:
      return (
        <span key={idx} style={{ color: "#388e3c", fontWeight: 600 }}>
          @{span.text || span.specialKind}
        </span>
      );
    case SpanType.CHANNEL_MENTION:
      return (
        <span key={idx} style={{ color: "#7b1fa2", fontWeight: 600 }}>
          #{span.text || span.channelId}
        </span>
      );
    case SpanType.COMMUNITY_MENTION:
      return (
        <span key={idx} style={{ color: "#0288d1", fontWeight: 600 }}>
          @{span.text || span.communityId}
        </span>
      );
    case SpanType.ALIAS_MENTION:
      return (
        <span key={idx} style={{ color: "#fbc02d", fontWeight: 600 }}>
          @{span.text || span.aliasId}
        </span>
      );
    case SpanType.PLAINTEXT:
    default:
      return <span key={idx}>{span.text}</span>;
  }
}

const Container = styled("div")(({ theme }) => ({
  padding: theme.spacing(0.5, 2),
  display: "flex",
  alignItems: "flex-start",
  width: "100%",
  marginBottom: theme.spacing(1),
  "&:hover": {
    backgroundColor: theme.palette.action.hover,
  },
}));

function MessageComponent({ message }: MessageProps) {
  const { data: author } = useGetUserByIdWithCacheQuery(message.authorId);

  return (
    <Container>
      <div style={{ marginRight: 12, marginTop: 4 }}>
        {author?.avatarUrl ? (
          <Avatar
            src={author.avatarUrl}
            alt={author.displayName || author.username}
            sx={{ width: 32, height: 32 }}
          />
        ) : (
          <Avatar sx={{ width: 32, height: 32 }}>
            {author?.displayName?.[0] || author?.username?.[0] || "?"}
          </Avatar>
        )}
      </div>
      <div>
        <Typography variant="body2" sx={{ fontWeight: 700 }}>
          {author?.displayName || author?.username || message.authorId}
          <Typography
            sx={{ marginLeft: "6px" }}
            variant="caption"
            color="text.secondary"
          >
            {new Date(message.sentAt).toLocaleString()}
          </Typography>
        </Typography>
        <Typography variant="body1">
          {message.spans.map((span, idx) => renderSpan(span, idx))}
        </Typography>
      </div>
    </Container>
  );
}

export default MessageComponent;
