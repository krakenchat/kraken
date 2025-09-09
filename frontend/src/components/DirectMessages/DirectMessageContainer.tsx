import React, { useEffect, useRef, useState, useCallback } from "react";
import { useGetDmMessagesQuery } from "../../features/directMessages/directMessagesApiSlice";
import MessageComponent from "../Message/MessageComponent";
import { Typography, Fab } from "@mui/material";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import MessageSkeleton from "../Message/MessageSkeleton";
import DirectMessageInput from "./DirectMessageInput";
import { useProfileQuery } from "../../features/users/usersSlice";
import { useDirectMessageWebSocket } from "../../hooks/useDirectMessageWebSocket";
import { useSelector } from "react-redux";
import {
  makeSelectMessagesByChannel,
} from "../../features/messages/messagesSlice";
import type { RootState } from "../../app/store";
import type { Message } from "../../types/message.type";

interface DirectMessageContainerProps {
  dmGroupId: string;
}

const DirectMessageContainer: React.FC<DirectMessageContainerProps> = ({
  dmGroupId,
}) => {
  const { data: dmMessagesData, error, isLoading } = useGetDmMessagesQuery(dmGroupId);
  const { data: user } = useProfileQuery();
  const authorId = user?.id || "";
  const channelRef = useRef<HTMLDivElement>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [showJumpToBottom, setShowJumpToBottom] = useState(false);

  // Use DM-specific WebSocket hook
  const { sendDirectMessage, joinDmGroup, leaveDmGroup } = useDirectMessageWebSocket();

  // Get messages from the API query result and WebSocket updates from Redux
  const selectMessagesByChannel = React.useMemo(
    makeSelectMessagesByChannel,
    []
  );
  
  // Get WebSocket messages from Redux state
  const wsMessages = useSelector((state: RootState) =>
    selectMessagesByChannel(state, dmGroupId)
  );
  
  // Combine API messages with WebSocket messages, removing duplicates
  const messages = React.useMemo(() => {
    const apiMessages = dmMessagesData?.messages || [];
    const allMessages = [...apiMessages];
    
    // Add WebSocket messages that aren't already in API messages
    if (wsMessages) {
      wsMessages.forEach(wsMessage => {
        if (!allMessages.find(msg => msg.id === wsMessage.id)) {
          allMessages.push(wsMessage);
        }
      });
    }
    
    // Sort by sentAt to maintain chronological order
    return allMessages.sort((a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime());
  }, [dmMessagesData?.messages, wsMessages]);

  const continuationToken = dmMessagesData?.continuationToken;

  const scrollToBottom = useCallback(() => {
    if (channelRef.current) {
      channelRef.current.scrollTo({
        top: channelRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, []);

  const handleScroll = useCallback(() => {
    const scrollElement = channelRef.current;
    if (scrollElement) {
      const { scrollTop, scrollHeight, clientHeight } = scrollElement;
      const isAtBottom = scrollHeight - scrollTop <= clientHeight + 100;
      setShowJumpToBottom(!isAtBottom);
    }
  }, []);

  useEffect(() => {
    const scrollElement = channelRef.current;
    if (scrollElement) {
      scrollElement.addEventListener("scroll", handleScroll);
      return () => scrollElement.removeEventListener("scroll", handleScroll);
    }
  }, [handleScroll]);

  useEffect(() => {
    // Auto-scroll to bottom when new messages arrive
    if (!showJumpToBottom) {
      scrollToBottom();
    }
  }, [messages?.length, scrollToBottom, showJumpToBottom]);

  useEffect(() => {
    // Join DM group when component mounts
    joinDmGroup(dmGroupId);
    
    return () => {
      // Leave DM group when component unmounts
      leaveDmGroup(dmGroupId);
    };
  }, [dmGroupId, joinDmGroup, leaveDmGroup]);

  const handleSendMessage = (messageContent: string, spans: any[]) => {
    console.log("[DirectMessageContainer] Received message to send:", { messageContent, spans, dmGroupId });
    // Send direct message via WebSocket
    console.log("[DirectMessageContainer] Calling sendDirectMessage...");
    sendDirectMessage(dmGroupId, spans);
    console.log("[DirectMessageContainer] sendDirectMessage called");
  };

  if (isLoading) {
    return (
      <div
        style={{
          height: "100%",
          display: "flex",
          flexDirection: "column",
          padding: "16px",
        }}
      >
        {Array.from({ length: 10 }, (_, i) => (
          <MessageSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "16px",
        }}
      >
        <Typography color="error">Error loading messages</Typography>
      </div>
    );
  }

  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        position: "relative",
      }}
    >
      <div
        ref={channelRef}
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "16px",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {messages && messages.length > 0 ? (
          <>
            {/* Reverse the messages to show newest at bottom */}
            {[...messages].reverse().map((message) => (
              <MessageComponent
                key={message.id}
                message={message}
                isAuthor={message.authorId === authorId}
              />
            ))}
          </>
        ) : (
          <div
            style={{
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Typography color="text.secondary">
              No messages yet. Start the conversation!
            </Typography>
          </div>
        )}
      </div>

      {showJumpToBottom && (
        <Fab
          size="small"
          onClick={scrollToBottom}
          sx={{
            position: "absolute",
            bottom: 80,
            right: 16,
            backgroundColor: "primary.main",
            "&:hover": { backgroundColor: "primary.dark" },
          }}
        >
          <KeyboardArrowDownIcon />
        </Fab>
      )}

      <DirectMessageInput
        dmGroupId={dmGroupId}
        onSendMessage={handleSendMessage}
        placeholder="Type a direct message..."
      />
    </div>
  );
};

export default DirectMessageContainer;