# First Run

After [installing](docker-compose.md) Kraken, follow these steps to set up your instance.

## 1. Register your account

Open [http://localhost:5173](http://localhost:5173) and create a new account. The first user registered on a fresh instance can be promoted to instance admin.

## 2. Create a community

1. Click the **+** button in the sidebar
2. Enter a community name and optional description
3. Click **Create**

Your new community appears in the sidebar — similar to a Discord server.

## 3. Create channels

Inside your community:

1. Click the **+** next to the channel list
2. Choose a channel type:
    - **Text** — for messaging
    - **Voice** — for voice and video calls (requires [LiveKit configuration](configuration.md#livekit-voicevideo))
3. Name the channel and click **Create**

## 4. Invite others

1. Open your community settings
2. Go to the **Invites** section
3. Create an invite link
4. Share the link with others — they can register and join your community

## 5. Start chatting

- Send messages in text channels with mentions, reactions, and file attachments
- Join voice channels for real-time audio and video (if LiveKit is configured)
- Use direct messages for private conversations

## Optional: Set up voice and video

If you haven't configured LiveKit yet, voice channels will be visible but non-functional. See the [LiveKit setup instructions](docker-compose.md#connecting-your-livekit-server) to enable voice and video calls, including screen sharing and replay buffer features.

## Next steps

- [Configuration](configuration.md) — Tune environment variables
- [Contributing](../contributing/index.md) — Help improve Kraken
