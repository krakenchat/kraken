# Release Process

Kraken uses a tag-based release workflow with support for full releases, component hotfixes, and manual builds.

## Tag Patterns

| Tag Pattern | What it Triggers |
|-------------|------------------|
| `v*.*.*` | Full release: Electron + Docker + Helm + GitHub Release |
| `electron-v*.*.*` | Electron builds + GitHub Release only |
| `docker-v*.*.*` | Docker images to GHCR only |
| `helm-v*.*.*` | Helm chart to GHCR only |

## Creating a Release

### Full Release

```bash
git checkout main
git pull origin main

# Update CHANGELOG.md, commit
git add CHANGELOG.md
git commit -m "docs: update changelog for v1.0.0"

# Tag and push
git tag v1.0.0
git push origin main
git push origin v1.0.0
```

This triggers:

- Electron builds for Windows (.exe) and Linux (.AppImage, .deb, .rpm)
- Docker images published to GHCR (backend + frontend)
- Helm chart published to GHCR
- GitHub Release created with all Electron artifacts
- Auto-update manifests uploaded (latest.yml, latest-linux.yml)

### Component Hotfixes

```bash
# Electron only
git tag electron-v1.0.1 && git push origin electron-v1.0.1

# Docker images only
git tag docker-v1.0.1 && git push origin docker-v1.0.1

# Helm chart only
git tag helm-v1.0.1 && git push origin helm-v1.0.1
```

### Manual Build

Go to GitHub Actions, select the workflow, click "Run workflow", optionally specify a version.

## Release Artifacts

### GitHub Release (Electron)

| Artifact | Description |
|----------|-------------|
| `Kraken-Setup-X.X.X.exe` | Windows NSIS installer |
| `Kraken-X.X.X.AppImage` | Linux universal binary |
| `kraken_X.X.X_amd64.deb` | Debian/Ubuntu package |
| `kraken-X.X.X.x86_64.rpm` | Fedora/RHEL package |
| `latest.yml` / `latest-linux.yml` | Auto-update manifests |

### Docker Images (GHCR)

```
ghcr.io/OWNER/kraken-backend:1.0.0
ghcr.io/OWNER/kraken-frontend:1.0.0
```

Tags: `1.0.0`, `1.0`, `1`, `latest`

### Helm Chart (GHCR OCI)

```bash
helm install kraken oci://ghcr.io/OWNER/kraken/charts/kraken --version 1.0.0
```

## Electron Auto-Update

The desktop app checks for updates on startup (3s delay) and every hour. Uses GitHub Releases as the update source.

**Requirements**: `latest.yml` must exist in the release, release must not be draft/prerelease.

## Version Management

Versions are injected from git tags during CI -- no need to manually update `package.json` or `Chart.yaml`.

Follow [Semantic Versioning](https://semver.org/): MAJOR (breaking), MINOR (features), PATCH (fixes).

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Auto-update not working | Verify `latest.yml` exists in release, not draft/prerelease |
| Build failures | Check Actions logs, verify Node.js v20 compat |
| Version mismatch | Verify tag format matches expected patterns |
