import React from "react";
import {
  Card,
  CardContent,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from "@mui/material";
import type { Channel } from "../../../types/channel.type";

interface ChannelSelectorProps {
  privateChannels: Channel[];
  selectedChannelId: string;
  onChannelSelect: (channelId: string) => void;
}

export const ChannelSelector: React.FC<ChannelSelectorProps> = ({
  privateChannels,
  selectedChannelId,
  onChannelSelect,
}) => {
  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Private Channel Membership
        </Typography>
        
        <FormControl fullWidth margin="normal">
          <InputLabel>Select Private Channel</InputLabel>
          <Select
            value={selectedChannelId}
            onChange={(e) => onChannelSelect(e.target.value)}
            label="Select Private Channel"
          >
            {privateChannels.map((channel) => (
              <MenuItem key={channel.id} value={channel.id}>
                #{channel.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </CardContent>
    </Card>
  );
};
