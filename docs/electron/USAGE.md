# Kraken Desktop App - User Guide

This guide helps users install and use the Kraken desktop application.

## Installation

### Windows

1. Download `Kraken-Setup-1.0.0.exe` from the releases page
2. Double-click the installer
3. **You will see a Windows SmartScreen warning** - This is normal for new apps
4. Click "More info" → "Run anyway"
5. Follow the installation wizard
6. Choose installation directory (default: `C:\Program Files\Kraken`)
7. Create desktop shortcut (recommended)
8. Click "Install"

### macOS

1. Download `Kraken-1.0.0.dmg` from the releases page
2. Open the DMG file
3. Drag Kraken to Applications folder
4. **First launch**: Right-click Kraken → "Open" (to bypass Gatekeeper)
5. Click "Open" in the dialog

### Linux

**AppImage (Recommended - Universal)**:
1. Download `Kraken-1.0.0.AppImage`
2. Make it executable: `chmod +x Kraken-1.0.0.AppImage`
3. Run: `./Kraken-1.0.0.AppImage`
4. (Optional) Integrate with desktop: Right-click → "Integrate and run"

**Debian/Ubuntu**:
```bash
sudo dpkg -i kraken_1.0.0_amd64.deb
sudo apt-get install -f  # Install dependencies if needed
kraken
```

**Fedora/RedHat/SUSE**:
```bash
sudo rpm -i kraken-1.0.0.x86_64.rpm
kraken
```

**Arch Linux (via AUR - community maintained)**:
```bash
yay -S kraken-bin  # If available
```

## First Run Setup

### 1. Backend Configuration

On first launch, Kraken needs to connect to a backend server.

**Option A: Local Backend (Docker)**

If you're running the backend locally with Docker:

1. Start the backend:
   ```bash
   docker-compose up -d
   ```

2. The app will automatically connect to `http://localhost:3000`

**Option B: Remote Backend**

If connecting to a self-hosted or cloud backend:

1. You'll need to configure the backend URL
2. Edit the environment configuration (see Advanced Configuration below)

### 2. Account Setup

- **First Time Setup**: If this is a new instance, you'll see the onboarding page
  - Create admin account
  - Set instance name
  - Create default community (optional)

- **Existing Instance**: Log in with your username and password

## Features

### Voice Channels

1. Join a voice channel by clicking on it
2. Your microphone is muted by default
3. Controls appear at the bottom of the screen:
   - **Microphone**: Toggle mute/unmute
   - **Audio**: Toggle deafen (mute all incoming audio)
   - **Video**: Enable camera (if available)
   - **Screen Share**: Share your screen
   - **Disconnect**: Leave the voice channel

### Text Channels

- Click on a text channel to view messages
- Type in the message box at the bottom
- Press Enter to send
- Drag & drop files to upload (up to 500MB)
- @mention users by typing `@username`

### Direct Messages

1. Click "Direct Messages" in the sidebar
2. Click "+" to start a new DM or group DM
3. Select users to add
4. Start chatting!

### Communities (Servers)

- Click on community icons in the left sidebar
- Create new community: Click "+" at the bottom
- Edit community: Right-click community icon → "Edit Community"
- Invite others: Click "Invite" button to generate invite link

### User Profile

1. Click your avatar in the bottom-left
2. Click "Profile" to view your profile
3. Click "Edit Profile" to:
   - Change display name
   - Upload avatar
   - Upload banner
   - Update bio

## Auto-Updates

Kraken automatically checks for updates:

- **On Launch**: Checks within 3 seconds of starting
- **Hourly**: Checks every hour while running
- **Manual Check**: Settings → About → Check for Updates

### Update Process

1. **Update Available**: Notification appears at bottom-right
   - Update downloads automatically in the background
   - Progress bar shows download status

2. **Update Downloaded**: Notification changes to "Update Ready"
   - Click "Restart Now" to install
   - Or restart later - update installs on next launch

3. **Installing Update**: App restarts automatically
   - Takes 10-30 seconds
   - Your data is preserved

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| Ctrl/Cmd + K | Quick switcher |
| Ctrl/Cmd + / | Toggle sidebar |
| Ctrl/Cmd + E | Upload file |
| Ctrl/Cmd + Enter | Send message |
| Ctrl/Cmd + M | Toggle mute |
| Ctrl/Cmd + Shift + D | Toggle deafen |
| Ctrl/Cmd + Shift + V | Toggle video |

## Advanced Configuration

### Changing Backend URL

**Windows**:
1. Navigate to: `%APPDATA%\kraken\`
2. Create/edit `.env` file:
   ```env
   VITE_API_URL=https://your-server.com/api
   VITE_WS_URL=https://your-server.com
   ```
3. Restart Kraken

**macOS**:
1. Navigate to: `~/Library/Application Support/kraken/`
2. Create/edit `.env` file (same as above)
3. Restart Kraken

**Linux**:
1. Navigate to: `~/.config/kraken/`
2. Create/edit `.env` file (same as above)
3. Restart Kraken

### Logs and Debugging

**Log Locations**:
- Windows: `%APPDATA%\kraken\logs\main.log`
- macOS: `~/Library/Logs/kraken\main.log`
- Linux: `~/.config/kraken/logs/main.log`

**Enable DevTools** (for debugging):
- Press `Ctrl+Shift+I` (Windows/Linux) or `Cmd+Option+I` (macOS)

## Troubleshooting

### App Won't Start

1. **Check if backend is running**:
   - Open `http://localhost:3000/api/health` in browser
   - Should see: `{"status":"ok"}`

2. **Verify backend connection**:
   - Check logs for connection errors
   - Verify backend URL is correct

3. **Reset app data** (last resort):
   - Windows: Delete `%APPDATA%\kraken\`
   - macOS: Delete `~/Library/Application Support/kraken/`
   - Linux: Delete `~/.config/kraken/`

### Windows SmartScreen Warning

This is normal for self-signed apps. Two options:

1. **Bypass warning** (every install):
   - Click "More info"
   - Click "Run anyway"

2. **Get proper code signing** (recommended for distribution):
   - See [FUTURE_SIGNING.md](FUTURE_SIGNING.md)

### Voice/Video Not Working

1. **Check permissions**:
   - Windows: Settings → Privacy → Microphone/Camera
   - macOS: System Preferences → Security & Privacy → Microphone/Camera
   - Linux: Varies by distribution

2. **Check LiveKit connection**:
   - Verify backend has LiveKit configured
   - Check logs for WebRTC errors

3. **Firewall issues**:
   - Ensure UDP ports 50000-60000 are not blocked
   - Check if VPN/proxy is interfering

### Auto-Update Fails

- Check internet connection
- Verify GitHub releases page is accessible
- Check logs for specific error
- Manual update: Download latest installer and reinstall

### High CPU/Memory Usage

- Close unused communities/channels
- Disable video/screen share when not needed
- Restart app to clear cache
- Check for pending updates

## Uninstallation

### Windows

- Settings → Apps → Kraken → Uninstall
- Or use installer: `Kraken-Setup-x.x.x.exe` → Uninstall

**Remove all data**:
- Delete `%APPDATA%\kraken\`

### macOS

- Move Kraken from Applications to Trash
- Empty Trash

**Remove all data**:
- Delete `~/Library/Application Support/kraken/`
- Delete `~/Library/Logs/kraken/`

### Linux

**AppImage**:
- Delete the AppImage file

**Debian**:
```bash
sudo apt remove kraken
```

**Remove all data**:
- Delete `~/.config/kraken/`

## Support

- **Documentation**: https://github.com/YOUR_USERNAME/kraken/docs
- **Issues**: https://github.com/YOUR_USERNAME/kraken/issues
- **Community**: Join the official Kraken server

## Privacy & Security

- All data stored locally in app data directory
- Messages encrypted in transit (TLS)
- No telemetry or analytics
- Voice/video uses end-to-end encryption (LiveKit)
- Auto-updates verified with checksums

## System Requirements

### Minimum

- **OS**: Windows 10, macOS 10.13+, Ubuntu 18.04+
- **RAM**: 4GB
- **Disk**: 500MB free
- **Network**: Broadband internet connection

### Recommended

- **RAM**: 8GB
- **Disk**: 2GB free (for cache and media)
- **Network**: 10 Mbps upload (for voice/video)
