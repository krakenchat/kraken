# Desktop App

Kraken provides an Electron-based desktop app for Windows and Linux with native features like system tray integration, auto-updates, and enhanced screen sharing.

## Download

Download the latest release for your platform from **[GitHub Releases](https://github.com/krakenchat/kraken/releases)**.

| Platform | Format | File |
|----------|--------|------|
| **Windows** | NSIS installer | `Kraken-Setup-X.X.X.exe` |
| **Linux** | Universal binary | `Kraken-X.X.X.AppImage` |
| **Linux** | Debian/Ubuntu | `kraken_X.X.X_amd64.deb` |
| **Linux** | Fedora/RHEL | `kraken-X.X.X.x86_64.rpm` |

!!! note "macOS"
    macOS builds are not yet available. macOS support is planned for a future release.

## Install

=== "Windows"

    1. Download `Kraken-Setup-X.X.X.exe` from [Releases](https://github.com/krakenchat/kraken/releases)
    2. Run the installer — you can choose the install directory
    3. Launch Kraken from the Start Menu or desktop shortcut

=== "Linux (AppImage)"

    1. Download `Kraken-X.X.X.AppImage` from [Releases](https://github.com/krakenchat/kraken/releases)
    2. Make it executable and run:
        ```bash
        chmod +x Kraken-*.AppImage
        ./Kraken-*.AppImage
        ```

=== "Linux (Debian/Ubuntu)"

    ```bash
    sudo dpkg -i kraken_*_amd64.deb
    sudo apt-get install -f  # resolve any missing dependencies
    ```

=== "Linux (Fedora/RHEL)"

    ```bash
    sudo rpm -i kraken-*.x86_64.rpm
    ```

## Connect to your instance

On first launch, Kraken will prompt you to enter your server URL (e.g. `https://kraken.example.com`). This is the address where your self-hosted Kraken instance is running.

## Auto-updates

The desktop app checks for updates automatically on startup and periodically while running. When a new version is available, you'll see a notification with the option to install and restart.

Updates are served from GitHub Releases — no additional infrastructure required.

## Desktop-only features

The desktop app includes capabilities not available in the browser:

- **Screen source picker** — choose specific windows or monitors to share (on X11)
- **System audio capture** — share desktop audio during screen sharing (Windows)
- **System tray** — minimize to tray, quick access controls
- **Auto-start** — optionally launch Kraken on system startup
- **Native notifications** — OS-level notification integration
