# Kraken Helm Chart

A production-ready Helm chart for deploying Kraken - a self-hosted voice and text chat application with video calling support.

## Prerequisites

- Kubernetes 1.24+
- Helm 3.8+ (for OCI registry support)
- NGINX Ingress Controller (if using ingress)
- LiveKit server (external)
- Optional: cert-manager (for automatic TLS)

## Quick Start

### Install with Default Configuration

This will deploy Kraken with bundled PostgreSQL and Redis:

```bash
helm install kraken oci://ghcr.io/krakenchat/charts/kraken \
  --set ingress.hosts[0].host=kraken.local \
  --set livekit.url=wss://your-livekit-server.com \
  --set livekit.apiKey=YOUR_LIVEKIT_API_KEY \
  --set livekit.apiSecret=YOUR_LIVEKIT_API_SECRET \
  --set secrets.jwtSecret="$(openssl rand -base64 32)" \
  --set secrets.jwtRefreshSecret="$(openssl rand -base64 32)"
```

### Upgrade an Existing Release

```bash
helm upgrade kraken oci://ghcr.io/krakenchat/charts/kraken \
  --reuse-values \
  --set backend.image.tag=v1.2.3
```

### Uninstall

```bash
helm uninstall kraken
```

## Configuration

### Image Configuration

| Parameter | Description | Default |
|-----------|-------------|---------|
| `backend.image.repository` | Backend Docker image repository | `ghcr.io/user/kraken-backend` |
| `backend.image.tag` | Backend image tag | `latest` |
| `backend.image.pullPolicy` | Image pull policy | `IfNotPresent` |
| `frontend.image.repository` | Frontend Docker image repository | `ghcr.io/user/kraken-frontend` |
| `frontend.image.tag` | Frontend image tag | `latest` |
| `global.imagePullSecrets` | Image pull secrets for private registries | `[]` |

### Deployment Configuration

| Parameter | Description | Default |
|-----------|-------------|---------|
| `backend.replicaCount` | Number of backend pods | `2` |
| `frontend.replicaCount` | Number of frontend pods | `2` |
| `backend.resources` | Backend resource limits/requests | See values.yaml |
| `frontend.resources` | Frontend resource limits/requests | See values.yaml |

### Autoscaling

| Parameter | Description | Default |
|-----------|-------------|---------|
| `backend.autoscaling.enabled` | Enable backend HPA | `false` |
| `backend.autoscaling.minReplicas` | Minimum backend replicas | `2` |
| `backend.autoscaling.maxReplicas` | Maximum backend replicas | `10` |
| `backend.autoscaling.targetCPUUtilizationPercentage` | Target CPU utilization | `70` |

### Ingress Configuration

| Parameter | Description | Default |
|-----------|-------------|---------|
| `ingress.enabled` | Enable ingress | `true` |
| `ingress.className` | Ingress class name | `nginx` |
| `ingress.hosts` | Ingress hostnames and paths | See values.yaml |
| `ingress.tls.mode` | TLS mode: `none`, `cert-manager`, `manual` | `none` |
| `ingress.tls.certManager.issuer` | cert-manager issuer name | `letsencrypt-prod` |
| `ingress.tls.secretName` | Manual TLS secret name | `""` |

### PostgreSQL Configuration

| Parameter | Description | Default |
|-----------|-------------|---------|
| `postgresql.bundled` | Deploy PostgreSQL with chart | `true` |
| `postgresql.auth.username` | PostgreSQL username | `kraken` |
| `postgresql.auth.password` | PostgreSQL password | `""` (set via --set or secrets) |
| `postgresql.auth.database` | PostgreSQL database name | `kraken` |
| `postgresql.primary.persistence.size` | PostgreSQL PVC size | `10Gi` |
| `postgresql.external.uri` | External PostgreSQL URI (if bundled=false) | `""` |

### Redis Configuration

| Parameter | Description | Default |
|-----------|-------------|---------|
| `redis.bundled` | Deploy Redis with chart | `true` |
| `redis.auth.password` | Redis password | `changeme-redis-password` |
| `redis.master.persistence.size` | Redis PVC size | `8Gi` |
| `redis.external.host` | External Redis host (if bundled=false) | `""` |

### LiveKit Configuration

| Parameter | Description | Default |
|-----------|-------------|---------|
| `livekit.url` | LiveKit WebSocket URL | `wss://livekit.example.com` |
| `livekit.apiKey` | LiveKit API key | Required |
| `livekit.apiSecret` | LiveKit API secret | Required |

### Secrets Configuration

| Parameter | Description | Default |
|-----------|-------------|---------|
| `secrets.jwtSecret` | JWT signing secret | `CHANGE-ME-...` |
| `secrets.jwtRefreshSecret` | JWT refresh token secret | `CHANGE-ME-...` |
| `secrets.existingSecret` | Use existing Kubernetes secret | `""` |

## Deployment Scenarios

### Scenario 1: Quick Start (Development)

Everything bundled, minimal configuration:

```bash
helm install kraken oci://ghcr.io/krakenchat/charts/kraken \
  --set ingress.hosts[0].host=kraken.local \
  --set livekit.url=wss://livekit.example.com \
  --set livekit.apiKey=key \
  --set livekit.apiSecret=secret
```

Add to `/etc/hosts`:
```
127.0.0.1 kraken.local
```

Access via port-forward:
```bash
kubectl port-forward svc/kraken-frontend 8080:5173
```

### Scenario 2: Production with cert-manager

Automatic HTTPS with Let's Encrypt:

```bash
# First, install cert-manager
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.14.0/cert-manager.yaml

# Create a ClusterIssuer
kubectl apply -f - <<EOF
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: your-email@example.com
    privateKeySecretRef:
      name: letsencrypt-prod
    solvers:
    - http01:
        ingress:
          class: nginx
EOF

# Install Kraken with TLS
helm install kraken oci://ghcr.io/krakenchat/charts/kraken \
  --set ingress.hosts[0].host=kraken.yourdomain.com \
  --set ingress.tls.mode=cert-manager \
  --set ingress.tls.certManager.enabled=true \
  --set ingress.tls.certManager.issuer=letsencrypt-prod \
  --set livekit.url=wss://livekit.yourdomain.com \
  --set livekit.apiKey=$LIVEKIT_API_KEY \
  --set livekit.apiSecret=$LIVEKIT_API_SECRET \
  --set secrets.jwtSecret="$(openssl rand -base64 32)" \
  --set secrets.jwtRefreshSecret="$(openssl rand -base64 32)" \
  --set backend.autoscaling.enabled=true \
  --set frontend.autoscaling.enabled=true
```

### Scenario 3: External Database & Redis

Use your own managed PostgreSQL and Redis:

```bash
helm install kraken oci://ghcr.io/krakenchat/charts/kraken \
  --set postgresql.bundled=false \
  --set postgresql.external.uri="postgresql://user:pass@postgres.example.com:5432/kraken" \
  --set redis.bundled=false \
  --set redis.external.host=redis.example.com \
  --set redis.external.port=6379 \
  --set redis.external.password="your-redis-password" \
  --set ingress.hosts[0].host=kraken.yourdomain.com \
  --set livekit.url=wss://livekit.yourdomain.com \
  --set livekit.apiKey=$LIVEKIT_API_KEY \
  --set livekit.apiSecret=$LIVEKIT_API_SECRET \
  --set secrets.jwtSecret="$(openssl rand -base64 32)" \
  --set secrets.jwtRefreshSecret="$(openssl rand -base64 32)"
```

### Scenario 4: Manual TLS Certificates

Bring your own certificates:

```bash
# Create TLS secret
kubectl create secret tls kraken-tls \
  --cert=path/to/tls.crt \
  --key=path/to/tls.key

# Install with manual TLS
helm install kraken oci://ghcr.io/krakenchat/charts/kraken \
  --set ingress.tls.mode=manual \
  --set ingress.tls.secretName=kraken-tls \
  --set ingress.hosts[0].host=kraken.yourdomain.com \
  --set livekit.url=wss://livekit.yourdomain.com \
  --set livekit.apiKey=$LIVEKIT_API_KEY \
  --set livekit.apiSecret=$LIVEKIT_API_SECRET
```

## Managing Secrets

### Using External Secrets

Instead of passing secrets via values, create them manually:

```bash
kubectl create secret generic kraken-secrets \
  --from-literal=JWT_SECRET="$(openssl rand -base64 32)" \
  --from-literal=JWT_REFRESH_SECRET="$(openssl rand -base64 32)" \
  --from-literal=LIVEKIT_API_SECRET="your-livekit-secret"

helm install kraken oci://ghcr.io/krakenchat/charts/kraken \
  --set secrets.existingSecret=kraken-secrets \
  --set livekit.apiKey=$LIVEKIT_API_KEY
```

### Generating Strong Secrets

```bash
# Generate random secrets
openssl rand -base64 32
openssl rand -hex 32

# Or use a password manager
```

## Upgrading

### Updating Dependencies

When updating PostgreSQL or Redis subchart versions:

```bash
cd helm/kraken
helm dependency update
```

### Rolling Updates

Update images with zero downtime:

```bash
helm upgrade kraken oci://ghcr.io/krakenchat/charts/kraken \
  --reuse-values \
  --set backend.image.tag=v1.2.3 \
  --set frontend.image.tag=v1.2.3
```

## Monitoring

### Check Pod Status

```bash
kubectl get pods -l app.kubernetes.io/instance=kraken
```

### View Logs

```bash
# Backend logs
kubectl logs -l app.kubernetes.io/component=backend -f

# Frontend logs
kubectl logs -l app.kubernetes.io/component=frontend -f

# PostgreSQL logs
kubectl logs -l app.kubernetes.io/name=postgresql -f
```

### Access PostgreSQL

```bash
kubectl run --namespace default kraken-postgresql-client --rm --tty -i --restart='Never' \
  --env="PGPASSWORD=$(kubectl get secret --namespace default kraken-postgresql -o jsonpath="{.data.postgres-password}" | base64 -d)" \
  --image docker.io/bitnami/postgresql:16 --command -- psql -h kraken-postgresql -U kraken
```

## Troubleshooting

### Pods Not Starting

```bash
# Check pod status
kubectl describe pod -l app.kubernetes.io/instance=kraken

# Check events
kubectl get events --sort-by='.lastTimestamp'
```

### Database Connection Issues

```bash
# Verify PostgreSQL is running
kubectl get pods -l app.kubernetes.io/name=postgresql

# Check PostgreSQL logs
kubectl logs -l app.kubernetes.io/name=postgresql

# Test PostgreSQL connection from backend pod
kubectl exec -it deploy/kraken-backend -- sh -c 'psql "$DATABASE_URL"'
```

### Ingress Not Working

```bash
# Check ingress status
kubectl get ingress

# Check ingress controller logs
kubectl logs -n ingress-nginx -l app.kubernetes.io/component=controller
```

## Backup and Restore

### Backup PostgreSQL

```bash
# Create a backup job
kubectl run postgresql-backup --rm -i --tty --restart=Never \
  --image=bitnami/postgresql:16 \
  --env="PGPASSWORD=your-password" \
  -- pg_dump -h kraken-postgresql -U kraken -d kraken -Fc -f /backup.dump
```

### Restore PostgreSQL

```bash
# Restore from backup
kubectl run postgresql-restore --rm -i --tty --restart=Never \
  --image=bitnami/postgresql:16 \
  --env="PGPASSWORD=your-password" \
  -- pg_restore -h kraken-postgresql -U kraken -d kraken /backup.dump
```

## Security Best Practices

1. **Change Default Passwords**: Always set custom passwords for PostgreSQL, Redis, and JWT secrets
2. **Use TLS**: Enable TLS/HTTPS in production with cert-manager or manual certificates
3. **Limit Resource**: Configure resource limits to prevent resource exhaustion
4. **Network Policies**: Consider enabling network policies for pod-to-pod communication
5. **Regular Updates**: Keep images and dependencies updated
6. **External Secrets**: Use a secrets manager (Vault, External Secrets Operator) for production

## Support

- **Issues**: https://github.com/user/kraken/issues
- **Documentation**: https://github.com/user/kraken
- **Chart Version**: Check with `helm show chart oci://ghcr.io/krakenchat/charts/kraken`

## License

AGPL-3.0-only
