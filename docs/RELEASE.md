# Release Process

This document describes how to create releases for Kraken.

## Overview

Kraken uses a tag-based release workflow with support for:
- **Full releases** (`v1.0.0`) - Build and release everything
- **Component hotfixes** - Release specific components independently
- **Manual builds** - One-off builds without creating releases

## Tag Patterns

| Tag Pattern | What it Triggers |
|-------------|------------------|
| `v*.*.*` | Full release: Electron + Docker + Helm + GitHub Release |
| `electron-v*.*.*` | Electron builds + GitHub Release only |
| `docker-v*.*.*` | Docker images to GHCR only |
| `helm-v*.*.*` | Helm chart to GHCR only |

## Creating a Release

### Full Release (Everything)

```bash
# 1. Ensure main is clean and tested
git checkout main
git pull origin main

# 2. Update CHANGELOG.md with release notes
# 3. Commit the changelog update
git add CHANGELOG.md
git commit -m "docs: update changelog for v1.0.0"

# 4. Create and push the tag
git tag v1.0.0
git push origin main
git push origin v1.0.0
```

**What happens:**
- Electron builds for Windows (.exe) and Linux (.AppImage, .deb, .rpm)
- Docker images published to GHCR (backend + frontend)
- Helm chart published to GHCR
- GitHub Release created with all Electron artifacts
- Auto-update manifests uploaded (latest.yml, latest-linux.yml)

### Electron Hotfix Only

```bash
git tag electron-v1.0.1
git push origin electron-v1.0.1
```

**What happens:**
- Electron builds + GitHub Release
- No Docker images or Helm chart

### Docker Images Only

```bash
git tag docker-v1.0.1
git push origin docker-v1.0.1
```

**What happens:**
- Docker images published to GHCR
- No GitHub Release

### Helm Chart Only

```bash
git tag helm-v1.0.1
git push origin helm-v1.0.1
```

**What happens:**
- Helm chart published to GHCR
- No GitHub Release

### Manual Build (No Release)

1. Go to GitHub Actions
2. Select the workflow (Electron, Docker, or Helm)
3. Click "Run workflow"
4. Optionally specify a version
5. For Electron, check "Create GitHub Release" if needed

## Release Artifacts

### GitHub Release (Electron)

| Artifact | Description |
|----------|-------------|
| `Kraken-Setup-X.X.X.exe` | Windows NSIS installer |
| `Kraken-Setup-X.X.X.exe.blockmap` | Windows delta update data |
| `latest.yml` | Windows auto-update manifest |
| `Kraken-X.X.X.AppImage` | Linux universal binary |
| `kraken_X.X.X_amd64.deb` | Debian/Ubuntu package |
| `kraken-X.X.X.x86_64.rpm` | Fedora/RHEL package |
| `latest-linux.yml` | Linux auto-update manifest |

### Docker Images (GHCR)

```
ghcr.io/OWNER/kraken-backend:1.0.0
ghcr.io/OWNER/kraken-backend:1.0
ghcr.io/OWNER/kraken-backend:1
ghcr.io/OWNER/kraken-backend:latest

ghcr.io/OWNER/kraken-frontend:1.0.0
ghcr.io/OWNER/kraken-frontend:1.0
ghcr.io/OWNER/kraken-frontend:1
ghcr.io/OWNER/kraken-frontend:latest
```

### Helm Chart (GHCR OCI)

```bash
helm install kraken oci://ghcr.io/OWNER/kraken/charts/kraken --version 1.0.0
```

## Electron Auto-Update

The Electron app automatically checks for updates:
- On startup (after 3-second delay)
- Every hour while running

Users see update notifications and can choose when to install. The auto-updater uses GitHub Releases as the update source.

**Requirements for auto-update to work:**
- `latest.yml` must be present in the release (Windows)
- `latest-linux.yml` must be present in the release (Linux)
- Release must NOT be marked as draft or prerelease

## Version Management

Versions are automatically injected from git tags during CI builds:
- Tag `v1.2.3` sets version `1.2.3` in all components
- Tag `electron-v1.2.3` sets version `1.2.3` in Electron only
- etc.

This means you don't need to manually update package.json or Chart.yaml versions before releasing.

## Semantic Versioning

Follow [Semantic Versioning](https://semver.org/):
- **MAJOR** (1.0.0 → 2.0.0): Breaking changes
- **MINOR** (1.0.0 → 1.1.0): New features (backward compatible)
- **PATCH** (1.0.0 → 1.0.1): Bug fixes (backward compatible)

## Code Signing (Future)

### Windows Code Signing

To enable Windows code signing and remove "Unknown Publisher" warnings:

1. Obtain an EV Code Signing Certificate from a trusted CA
2. Add to GitHub Secrets:
   - `WINDOWS_CERTIFICATE` - Base64-encoded PFX file
   - `WINDOWS_CERT_PASSWORD` - Certificate password
3. Update `frontend/electron-builder.yml`:
   ```yaml
   win:
     certificateFile: ${env.WINDOWS_CERTIFICATE}
     certificatePassword: ${env.WINDOWS_CERT_PASSWORD}
   ```

### macOS Code Signing

To enable macOS builds and notarization:

1. Enroll in Apple Developer Program ($99/year)
2. Create signing certificates and provisioning profiles
3. Add to GitHub Secrets:
   - `APPLE_ID` - Apple ID email
   - `APPLE_ID_PASSWORD` - App-specific password
   - `APPLE_TEAM_ID` - Team ID
   - `CSC_LINK` - Base64-encoded .p12 certificate
   - `CSC_KEY_PASSWORD` - Certificate password
4. Update `frontend/electron-builder.yml` to uncomment macOS config

## Troubleshooting

### Auto-update not working

1. Verify `latest.yml` (Windows) or `latest-linux.yml` (Linux) exists in the GitHub Release
2. Ensure the release is not marked as draft or prerelease
3. Check the app isn't running in development mode
4. Look for errors in the Electron console (DevTools)

### Build failures

1. Check GitHub Actions logs for specific errors
2. Verify Node.js version compatibility (currently v20)
3. Ensure package-lock.json is committed and up to date
4. For Electron builds, check native module compatibility

### Version mismatch

If versions appear incorrect:
1. Verify the tag format matches expected patterns
2. Check that version injection step ran in CI logs
3. For hotfix tags, ensure the prefix is correct (e.g., `electron-v` not `electron/v`)
