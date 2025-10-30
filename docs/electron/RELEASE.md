# Releasing Kraken Desktop App

This guide covers how to publish new versions of the Kraken desktop app with auto-update support.

## Overview

The release process:
1. Update version number
2. Build installers for all platforms
3. Create GitHub Release
4. Upload installers as release assets
5. Users receive automatic updates

## Prerequisites

- GitHub repository set up
- GitHub Personal Access Token (PAT) with `repo` scope
- Version tag follows semver (e.g., `v1.0.0`)
- All changes committed and pushed

## Version Numbering

Follow [Semantic Versioning](https://semver.org/):

- **Major** (1.0.0 → 2.0.0): Breaking changes
- **Minor** (1.0.0 → 1.1.0): New features, backwards compatible
- **Patch** (1.0.0 → 1.0.1): Bug fixes, backwards compatible

## Release Process

### Step 1: Update Version

Edit `frontend/package.json`:

```json
{
  "version": "1.0.1"
}
```

Commit the change:

```bash
git add frontend/package.json
git commit -m "chore: bump version to 1.0.1"
git push
```

### Step 2: Create Git Tag

```bash
# Create annotated tag
git tag -a v1.0.1 -m "Release v1.0.1"

# Push tag to GitHub
git push origin v1.0.1
```

### Step 3: Configure GitHub Token

Set the `GH_TOKEN` environment variable:

**Windows (PowerShell)**:
```powershell
$env:GH_TOKEN = "ghp_your_token_here"
```

**macOS/Linux**:
```bash
export GH_TOKEN=ghp_your_token_here
```

**GitHub Token Setup**:
1. Go to GitHub Settings → Developer settings → Personal access tokens
2. Generate new token (classic)
3. Select scopes: `repo` (all)
4. Copy token (you won't see it again!)

### Step 4: Configure Repository Info

Edit `frontend/electron-builder.yml`:

```yaml
publish:
  provider: github
  owner: YOUR_GITHUB_USERNAME
  repo: kraken
```

Or set environment variables:

```bash
export GITHUB_OWNER=YOUR_GITHUB_USERNAME
export GITHUB_REPO=kraken
```

### Step 5: Build and Release

#### Automated Release (Recommended)

```bash
cd frontend
npm run release
```

This will:
1. Clean previous builds
2. Build frontend, electron main, and preload
3. Create installers for current platform
4. Upload to GitHub Releases
5. Publish with auto-update manifests

#### Manual Release (Multi-Platform)

**On Windows machine**:
```bash
cd frontend
npm run build:win
```

**On macOS machine**:
```bash
cd frontend
npm run build:mac
```

**On Linux machine**:
```bash
cd frontend
npm run build:linux
```

Then manually upload all installers to GitHub Release.

### Step 6: Create Release Notes

After uploading, edit the GitHub Release to add:

```markdown
## What's New

- Feature: Added user presence indicators
- Feature: Improved voice quality settings
- Fix: Resolved connection issues on slow networks
- Fix: Fixed avatar upload bug

## Installation

**Windows**: Download `Kraken-Setup-1.0.1.exe`
**macOS**: Download `Kraken-1.0.1.dmg`
**Linux**: Download `Kraken-1.0.1.AppImage` or `.deb`

See [Installation Guide](https://github.com/YOUR_USERNAME/kraken/docs/electron/USAGE.md) for details.

## Auto-Update

Existing users will receive this update automatically within 1 hour.

## Changelog

**Full Changelog**: https://github.com/YOUR_USERNAME/kraken/compare/v1.0.0...v1.0.1
```

### Step 7: Publish Release

1. Go to GitHub Releases page
2. Find your draft release
3. Review release notes
4. Click "Publish release"

Done! Users will receive the update automatically.

## Auto-Update Process

### How It Works

1. **App launches**: Checks for updates after 3 seconds
2. **Hourly checks**: Checks every hour while running
3. **Update found**: Downloads automatically in background
4. **Download complete**: Notifies user to restart
5. **User restarts**: Update installs seamlessly

### Update Manifest

electron-updater checks these files:

- `latest.yml` (Windows)
- `latest-mac.yml` (macOS)
- `latest-linux.yml` (Linux)

These are automatically created and uploaded by electron-builder.

### Update Channels

Currently using single channel (latest). To add beta channel:

```yaml
# electron-builder.yml
publish:
  - provider: github
    channel: latest
  - provider: github
    channel: beta
```

## CI/CD Automation

### GitHub Actions Workflow

Create `.github/workflows/release.yml`:

```yaml
name: Release

on:
  push:
    tags:
      - 'v*'

jobs:
  release:
    runs-on: ${{ matrix.os }}

    strategy:
      matrix:
        os: [windows-latest, macos-latest, ubuntu-latest]

    steps:
      - name: Checkout code
        uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: |
          cd frontend
          npm install

      - name: Build and release
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          cd frontend
          npm run release

      - name: Upload artifacts
        uses: actions/upload-artifact@v3
        with:
          name: ${{ matrix.os }}-installer
          path: frontend/release/*Setup*.exe
          path: frontend/release/*.dmg
          path: frontend/release/*.AppImage
```

### Triggering Release

```bash
git tag v1.0.1
git push origin v1.0.1
```

GitHub Actions automatically builds and publishes for all platforms!

## Rollback Procedure

If a release has critical bugs:

### Option 1: Quick Fix

1. Fix the bug
2. Increment patch version (e.g., 1.0.1 → 1.0.2)
3. Release new version immediately
4. Users auto-update to fixed version

### Option 2: Delete Release (Not Recommended)

1. Delete GitHub Release
2. Delete git tag:
   ```bash
   git tag -d v1.0.1
   git push origin :refs/tags/v1.0.1
   ```
3. Users won't receive the bad update
4. Already-installed users must manually downgrade

## Testing Releases

### Test Auto-Update Locally

1. Build version 1.0.0:
   ```bash
   npm run build:win
   ```

2. Install the 1.0.0 version

3. Create a test release on GitHub:
   - Tag: `v1.0.1-test`
   - Mark as "Pre-release"
   - Upload build artifacts

4. Update your installed app's backend to point to test release

5. Verify update downloads and installs

### Testing Checklist

Before public release:

- [ ] App launches successfully after update
- [ ] All features work (voice, video, messages)
- [ ] Backend connection works
- [ ] User data preserved after update
- [ ] No console errors
- [ ] Performance is acceptable
- [ ] Auto-updater finds next version
- [ ] Installer works on fresh install
- [ ] Uninstaller works

## Release Checklist

- [ ] Version number updated in package.json
- [ ] CHANGELOG updated
- [ ] All tests passing
- [ ] Code reviewed and merged to main
- [ ] Git tag created and pushed
- [ ] GitHub token configured
- [ ] Build succeeds without errors
- [ ] Installers tested on all platforms
- [ ] Release notes written
- [ ] GitHub Release published
- [ ] Auto-update verified
- [ ] Documentation updated
- [ ] Community notified

## Troubleshooting

### "No GitHub token found"

Set GH_TOKEN environment variable:
```bash
export GH_TOKEN=ghp_your_token_here
```

### "Version mismatch"

Ensure package.json version matches git tag:
- package.json: `"version": "1.0.1"`
- git tag: `v1.0.1`

### Upload Fails

- Check GitHub token has `repo` scope
- Verify repository owner/name in electron-builder.yml
- Check internet connection
- Try manual upload

### Auto-Update Not Working

- Verify latest.yml uploaded to GitHub Release
- Check app version < release version
- Verify release is not marked as "Pre-release"
- Check app can reach api.github.com
- Review electron logs for update errors

## Best Practices

1. **Never skip versions**: Don't jump from 1.0.0 to 1.0.2 without releasing 1.0.1

2. **Test in staging**: Use pre-releases for testing

3. **Gradual rollout**: Release to beta channel first

4. **Monitor errors**: Check logs after release

5. **Communicate**: Announce releases to users

6. **Keep artifacts**: Don't delete old releases (users might need to downgrade)

7. **Changelog**: Always document changes

## Security

- **Never commit** GitHub tokens to git
- Use environment variables for secrets
- Review code before releasing
- Consider code signing (see FUTURE_SIGNING.md)

## Support

After release, monitor:
- GitHub Issues for bug reports
- Community feedback
- Crash reports
- Update adoption rate

## Next Steps

- Set up automated CI/CD releases
- Configure code signing
- Add release announcement bot
- Set up error tracking (Sentry, etc.)
