# Building Kraken Electron App

This guide covers how to build the Kraken desktop application using Electron.

## Prerequisites

- Node.js 18+ installed
- npm or yarn
- Git
- Windows 10+ (for Windows builds)
- ~2GB free disk space for build artifacts

## Architecture

The Electron build consists of:
- **Frontend**: React app built with Vite (static HTML/CSS/JS)
- **Main Process**: Electron main process (TypeScript compiled to CommonJS)
- **Preload Script**: Secure IPC bridge between renderer and main process
- **Backend**: Separate Docker backend (not bundled with Electron)

## Build Process

### 1. Install Dependencies

```bash
cd frontend
npm install
```

This installs:
- All frontend dependencies (React, Redux, Material-UI, etc.)
- Electron and electron-builder
- electron-updater for auto-updates
- Development tools

### 2. Configure Environment

Edit `frontend/.env.production` to set backend URLs:

```env
# Backend API URL
VITE_API_URL=http://localhost:3000/api

# WebSocket URL
VITE_WS_URL=http://localhost:3000
```

**Important**: Change these to match your backend deployment:
- For local Docker backend: Use `http://localhost:3000`
- For remote backend: Use your server URL (e.g., `https://kraken.example.com`)

### 3. Build Commands

#### Development Build (Test Locally)

```bash
npm run electron-dev
```

This starts:
- Vite dev server on port 5173
- Electron app in development mode
- Auto-reloads on code changes
- DevTools enabled

#### Production Package (Unpacked)

```bash
npm run package
```

Creates an unpacked directory in `frontend/release/` for testing without creating an installer.

#### Production Build (Windows)

```bash
npm run build:win
```

Creates:
- `frontend/release/Kraken-Setup-1.0.0.exe` - NSIS installer
- Takes ~5-10 minutes first time (downloads Electron binaries)

#### Production Build (macOS)

```bash
npm run build:mac
```

Creates:
- `frontend/release/Kraken-1.0.0.dmg` - DMG installer
- Requires macOS to build

#### Production Build (Linux)

```bash
npm run build:linux
```

Creates:
- `frontend/release/Kraken-1.0.0.AppImage` - AppImage (portable)
- `frontend/release/kraken_1.0.0_amd64.deb` - Debian package

### 4. Build Configuration

The build is configured in:
- `frontend/electron-builder.yml` - Main configuration
- `frontend/package.json` - Package metadata

## Build Artifacts

After building, check `frontend/release/` directory:

### Windows
```
release/
├── Kraken-Setup-1.0.0.exe          # Windows installer (NSIS)
├── Kraken-Setup-1.0.0.exe.blockmap # Update manifest
└── win-unpacked/                   # Unpacked app (for testing)
```

### Linux
```
release/
├── Kraken-1.0.0.AppImage           # Universal portable (recommended)
├── kraken_1.0.0_amd64.deb         # Debian/Ubuntu package
├── kraken-1.0.0.x86_64.rpm        # Fedora/RedHat package
├── latest-linux.yml               # Update manifest
└── linux-unpacked/                # Unpacked app (for testing)
```

### macOS
```
release/
├── Kraken-1.0.0.dmg               # macOS installer
├── Kraken-1.0.0.dmg.blockmap     # Update manifest
└── mac/                           # Unpacked app (for testing)
```

## Troubleshooting

### Build Fails with "Electron not found"

```bash
npm install electron --save-dev
```

### Build Fails with TypeScript Errors

```bash
cd frontend
npm run clean
npm install
npm run build:all
```

### Installer Size Too Large

Current size: ~150-200MB (includes Electron runtime)

To reduce:
- Remove unused dependencies
- Use `asar` archives (enabled by default)
- Compress better (already using `normal` compression)

### Windows Defender Blocks Installer

This is normal for unsigned apps. See `FUTURE_SIGNING.md` for code signing setup.

### Build Works But App Won't Start

1. Check if backend is running:
   ```bash
   docker-compose up -d
   ```

2. Verify backend URL in `.env.production`

3. Check Electron logs:
   - Windows: `%APPDATA%/kraken/logs/`
   - macOS: `~/Library/Logs/kraken/`
   - Linux: `~/.config/kraken/logs/`

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Build Electron App

on:
  push:
    tags:
      - 'v*'

jobs:
  build-windows:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - name: Install dependencies
        run: |
          cd frontend
          npm install
      - name: Build Windows app
        run: |
          cd frontend
          npm run build:win
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
      - name: Upload artifacts
        uses: actions/upload-artifact@v3
        with:
          name: windows-installer
          path: frontend/release/*.exe
```

## Build Scripts Explained

| Script | Purpose |
|--------|---------|
| `build` | Build frontend with Vite |
| `build-electron` | Compile Electron main process |
| `build-preload` | Compile preload script |
| `build:all` | Build everything (frontend + electron + preload) |
| `package` | Create unpacked app for testing |
| `build:win` | Build Windows installer (NSIS) |
| `build:mac` | Build macOS installer (DMG) |
| `build:linux` | Build all Linux formats (AppImage, deb, rpm) |
| `build:linux:appimage` | Build only AppImage (portable) |
| `build:linux:deb` | Build only Debian package |
| `build:linux:rpm` | Build only RPM package |
| `build:all-platforms` | Build for Windows, macOS, and Linux |
| `release` | Build and publish to GitHub Releases |

## Next Steps

- [User Guide](USAGE.md) - How to use the built app
- [Release Process](RELEASE.md) - Publishing releases with auto-update
- [Code Signing](FUTURE_SIGNING.md) - Setting up proper code signing

## FAQ

**Q: Can I build for macOS on Windows?**
A: No, you need macOS to build for macOS. Use GitHub Actions or a macOS machine.

**Q: How do I change the app icon?**
A: Place icon files in `frontend/build/`:
- `icon.ico` (Windows, 256x256)
- `icon.icns` (macOS)
- `icon.png` (Linux, 512x512)

**Q: How do I change the app name?**
A: Edit `productName` in `frontend/package.json`

**Q: Can I bundle the backend with Electron?**
A: Possible but complex. Current architecture uses separate backend. See architecture docs for details.

**Q: Where are app settings stored?**
A: In user data directory:
- Windows: `%APPDATA%/kraken/`
- macOS: `~/Library/Application Support/kraken/`
- Linux: `~/.config/kraken/`
