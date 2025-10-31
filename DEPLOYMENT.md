# Kraken Deployment Summary

This document provides an overview of all deployment-related files and configurations created for Kraken.

## 📁 File Structure

```
kraken/
├── backend/
│   ├── Dockerfile.prod                    # Production backend Dockerfile
│   └── .env.sample                        # Backend environment variables
├── frontend/
│   ├── Dockerfile.prod                    # Production frontend Dockerfile
│   ├── nginx.conf                         # Nginx configuration for production
│   └── .env.sample                        # Frontend environment variables
├── .github/workflows/
│   ├── docker-publish.yml                 # Docker image publishing workflow
│   └── helm-publish.yml                   # Helm chart publishing workflow
├── helm/kraken/
│   ├── Chart.yaml                         # Helm chart metadata
│   ├── values.yaml                        # Default configuration values
│   ├── .helmignore                        # Helm ignore patterns
│   ├── README.md                          # Chart documentation
│   └── templates/
│       ├── _helpers.tpl                   # Template helper functions
│       ├── serviceaccount.yaml            # Service account
│       ├── ingress.yaml                   # Ingress resource
│       ├── backend/
│       │   ├── deployment.yaml            # Backend deployment
│       │   ├── service.yaml               # Backend service
│       │   ├── configmap.yaml             # Backend config
│       │   ├── secret.yaml                # Backend secrets
│       │   └── hpa.yaml                   # Backend autoscaler
│       └── frontend/
│           ├── deployment.yaml            # Frontend deployment
│           ├── service.yaml               # Frontend service
│           └── hpa.yaml                   # Frontend autoscaler
├── docs/deployment/
│   └── kubernetes.md                      # Kubernetes deployment guide
├── README.md                              # Updated with K8s section
└── DEPLOYMENT.md                          # This file
```

## 🐳 Docker Images

### Production Dockerfiles Created

#### Backend (`backend/Dockerfile.prod`)
- **Multi-stage build**: Builder stage + production runtime
- **Base image**: `node:22-alpine` for minimal size
- **Security**: Non-root user (nestjs:1001)
- **Optimizations**: Production dependencies only, Prisma generated
- **Health checks**: Built-in `/api/health` endpoint
- **OCI labels**: Proper GHCR integration

#### Frontend (`frontend/Dockerfile.prod`)
- **Multi-stage build**: Vite build stage + Nginx runtime
- **Base image**: `nginx:1.27-alpine`
- **Features**:
  - SPA routing support
  - API proxy to backend
  - WebSocket support for Socket.IO
  - Environment variable substitution
  - Security headers
  - Gzip compression
- **Health check**: `/api/health` endpoint

### Building Locally

```bash
# Build backend
docker build -f backend/Dockerfile.prod -t kraken-backend:local ./backend

# Build frontend
docker build -f frontend/Dockerfile.prod -t kraken-frontend:local ./frontend

# Test locally
docker run -p 3000:3000 kraken-backend:local
docker run -p 5173:5173 -e BACKEND_URL=http://localhost:3000 kraken-frontend:local
```

## 🚀 GitHub Actions Workflows

### Docker Publishing (`.github/workflows/docker-publish.yml`)

**Triggers:**
- Push to `main` branch
- Version tags (`v*.*.*`)
- Manual dispatch

**Features:**
- Builds both backend and frontend images
- Multi-architecture: AMD64 + ARM64
- Publishes to GHCR (GitHub Container Registry)
- Semantic versioning with tags
- Build caching for faster builds
- SBOM and provenance attestation
- Security scanning

**Image Tags Generated:**
- `latest` - Latest from main branch
- `v1.2.3` - Semver tags
- `main-sha123abc` - Branch + commit SHA

### Helm Chart Publishing (`.github/workflows/helm-publish.yml`)

**Triggers:**
- Push to `main` (when helm/ changes)
- Version tags
- Manual dispatch

**Features:**
- Updates Chart.yaml with repository info
- Updates Helm dependencies (MongoDB, Redis)
- Packages and publishes to GHCR as OCI artifact
- Automatic versioning

**Chart Location:**
```
oci://ghcr.io/YOUR-USERNAME/charts/kraken
```

## ⎈ Helm Chart

### Key Features

1. **Flexible Dependencies**
   - Bundled MongoDB (Bitnami) - optional
   - Bundled Redis (Bitnami) - optional
   - Or use external services

2. **Ingress Options**
   - NGINX Ingress Controller support
   - Optional TLS via cert-manager (automatic Let's Encrypt)
   - Manual TLS certificate support
   - No TLS option

3. **Autoscaling**
   - Horizontal Pod Autoscaler for backend
   - Horizontal Pod Autoscaler for frontend
   - CPU and memory-based scaling

4. **Security**
   - Non-root containers
   - Pod security contexts
   - Secret management
   - Network policies (optional)

5. **Production-Ready**
   - Health checks (liveness, readiness)
   - Resource limits
   - Rolling updates
   - Pod disruption budgets

### Installation Examples

**Quick Start:**
```bash
helm install kraken oci://ghcr.io/YOUR-USERNAME/charts/kraken \
  --set ingress.hosts[0].host=kraken.local \
  --set livekit.url=wss://livekit.example.com \
  --set livekit.apiKey=key \
  --set livekit.apiSecret=secret
```

**Production:**
```bash
helm install kraken oci://ghcr.io/YOUR-USERNAME/charts/kraken \
  --values production-values.yaml \
  --set secrets.jwtSecret="$(openssl rand -base64 32)" \
  --set secrets.jwtRefreshSecret="$(openssl rand -base64 32)"
```

**With External Database:**
```bash
helm install kraken oci://ghcr.io/YOUR-USERNAME/charts/kraken \
  --set mongodb.bundled=false \
  --set mongodb.external.uri="mongodb+srv://..." \
  --set redis.bundled=false \
  --set redis.external.host=redis.cloud.example.com
```

## 🔐 Security Considerations

### Secrets Management

**Never commit these values:**
- JWT secrets
- Database passwords
- LiveKit API credentials
- Redis passwords

**Generate strong secrets:**
```bash
# JWT secrets
openssl rand -base64 32

# Passwords
openssl rand -base64 24
```

**Use external secrets (recommended for production):**
```bash
# Create Kubernetes secret manually
kubectl create secret generic kraken-secrets \
  --from-literal=JWT_SECRET="..." \
  --from-literal=JWT_REFRESH_SECRET="..." \
  --from-literal=LIVEKIT_API_SECRET="..."

# Reference in Helm
--set secrets.existingSecret=kraken-secrets
```

### Container Images

**Current state:**
- Images are **private** by default on GHCR
- Only you can pull them (requires authentication)

**When open-sourcing:**
1. Make repository public on GitHub
2. Manually make packages public:
   - Go to `github.com/YOUR-USERNAME/kraken/pkgs/container/kraken-backend`
   - Settings → Change visibility → Public
   - Repeat for `kraken-frontend`

## 📋 Pre-Deployment Checklist

### Before First Deployment

- [ ] Update `Chart.yaml` with your repository info
- [ ] Update `values.yaml` image repositories
- [ ] Update GitHub workflows with your username
- [ ] Set up LiveKit server (self-hosted or cloud)
- [ ] Generate strong secrets for JWT, MongoDB, Redis
- [ ] Configure DNS for your domain
- [ ] Install NGINX Ingress Controller in cluster
- [ ] Optional: Install cert-manager for automatic TLS
- [ ] Test with `helm install --dry-run --debug`

### After Deployment

- [ ] Verify all pods are running
- [ ] Check ingress is configured correctly
- [ ] Test TLS certificate (if enabled)
- [ ] Create admin user
- [ ] Test WebSocket connections
- [ ] Test file uploads
- [ ] Test voice/video calls
- [ ] Set up monitoring (Prometheus/Grafana)
- [ ] Configure backups for MongoDB
- [ ] Set up logging aggregation
- [ ] Load test the application

## 🔄 CI/CD Pipeline Flow

### On Every Push to Main

1. **Docker Workflow** triggers
2. Builds backend and frontend images
3. Pushes to GHCR with `latest` tag
4. **Helm Workflow** triggers (if helm/ changed)
5. Updates dependencies
6. Packages chart
7. Pushes chart to GHCR

### On Version Tag (v1.2.3)

1. **Docker Workflow** triggers
2. Builds images with tags: `v1.2.3`, `v1.2`, `v1`, `latest`
3. Pushes all tags to GHCR
4. **Helm Workflow** triggers
5. Packages chart with version
6. Pushes to GHCR

## 📖 Documentation Index

1. **[README.md](./README.md)** - Main project README with K8s section
2. **[helm/kraken/README.md](./helm/kraken/README.md)** - Complete Helm chart documentation
3. **[docs/deployment/kubernetes.md](./docs/deployment/kubernetes.md)** - Detailed deployment guide
4. **[DEPLOYMENT.md](./DEPLOYMENT.md)** - This file

## 🆘 Getting Help

### Common Issues

**Q: Images won't pull**
A: Make sure images are public or configure image pull secrets

**Q: Pods crash with database errors**
A: Verify MongoDB connection string and credentials

**Q: Ingress not working**
A: Check NGINX Ingress Controller is installed and DNS is configured

**Q: WebSocket connection fails**
A: Verify ingress annotations for WebSocket support

### Resources

- **Helm Documentation**: https://helm.sh/docs/
- **Kubernetes Docs**: https://kubernetes.io/docs/
- **NGINX Ingress**: https://kubernetes.github.io/ingress-nginx/
- **cert-manager**: https://cert-manager.io/docs/
- **LiveKit**: https://docs.livekit.io/

## 🎉 Next Steps

1. **Test locally**: Build and test Docker images
2. **Push to GitHub**: Commit all changes, workflows will run
3. **Verify workflows**: Check Actions tab for successful builds
4. **Install in cluster**: Use Helm to deploy to your Kubernetes cluster
5. **Monitor**: Set up Prometheus/Grafana for production monitoring
6. **Scale**: Enable autoscaling for production traffic
7. **Secure**: Implement network policies and pod security standards

## 📝 Notes

- All workflows use GitHub's `GITHUB_TOKEN` - no manual secrets needed
- Images remain private until you explicitly make them public
- Helm chart can be used immediately after pushing
- Update `YOUR-USERNAME` placeholders with your actual GitHub username
- Chart version is independent of app version (can be different)

---

**Generated**: 2025-10-27
**Maintainer**: Kraken Team
