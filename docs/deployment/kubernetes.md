# Kubernetes Deployment Guide

This guide provides comprehensive instructions for deploying Kraken to a Kubernetes cluster using Helm.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Pre-Installation Checklist](#pre-installation-checklist)
- [Installation](#installation)
- [Configuration](#configuration)
- [Post-Installation](#post-installation)
- [Scaling](#scaling)
- [Monitoring](#monitoring)
- [Backup and Recovery](#backup-and-recovery)
- [Troubleshooting](#troubleshooting)

## Prerequisites

### Required Components

1. **Kubernetes Cluster** (v1.24+)
   - Managed: GKE, EKS, AKS, or DigitalOcean Kubernetes
   - Self-hosted: kubeadm, k3s, or kind (for local development)

2. **Helm** (v3.8+)
   ```bash
   # Install Helm
   curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash

   # Verify installation
   helm version
   ```

3. **kubectl** configured to access your cluster
   ```bash
   kubectl cluster-info
   kubectl get nodes
   ```

4. **NGINX Ingress Controller**
   ```bash
   helm upgrade --install ingress-nginx ingress-nginx \
     --repo https://kubernetes.github.io/ingress-nginx \
     --namespace ingress-nginx --create-namespace
   ```

5. **LiveKit Server** (external)
   - Self-hosted: https://docs.livekit.io/deploy/
   - Cloud: https://cloud.livekit.io

### Optional Components

1. **cert-manager** (for automatic TLS)
   ```bash
   kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.14.0/cert-manager.yaml
   ```

2. **metrics-server** (for autoscaling)
   ```bash
   kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml
   ```

## Pre-Installation Checklist

- [ ] Kubernetes cluster is running and accessible
- [ ] Helm 3.8+ is installed
- [ ] NGINX Ingress Controller is deployed
- [ ] LiveKit server is deployed and accessible
- [ ] LiveKit API credentials are available
- [ ] Domain name is configured (for production)
- [ ] DNS records point to your cluster's load balancer
- [ ] TLS certificates are ready (if not using cert-manager)
- [ ] Storage class is available for persistent volumes

## Installation

### Step 1: Prepare Configuration

Create a `values.yaml` file with your custom configuration:

```yaml
# custom-values.yaml

# Image configuration (update with your registry)
backend:
  image:
    repository: ghcr.io/krakenchat/kraken-backend
    tag: "v1.0.0"

  # Enable autoscaling for production
  autoscaling:
    enabled: true
    minReplicas: 2
    maxReplicas: 10

frontend:
  image:
    repository: ghcr.io/krakenchat/kraken-frontend
    tag: "v1.0.0"

  autoscaling:
    enabled: true
    minReplicas: 2
    maxReplicas: 5

# Ingress configuration
ingress:
  enabled: true
  className: nginx
  hosts:
    - host: kraken.yourdomain.com
      paths:
        - path: /
          pathType: Prefix
          service: frontend
        - path: /api
          pathType: Prefix
          service: backend
        - path: /socket.io
          pathType: Prefix
          service: backend

  # TLS with cert-manager
  tls:
    mode: cert-manager
    certManager:
      enabled: true
      issuer: letsencrypt-prod

# MongoDB configuration
mongodb:
  bundled: true
  replicaCount: 3
  auth:
    rootPassword: "CHANGE-TO-STRONG-PASSWORD"
    password: "CHANGE-TO-STRONG-PASSWORD"
  persistence:
    size: 50Gi
    # storageClass: "fast-ssd"  # Optional: specify storage class

# Redis configuration
redis:
  bundled: true
  auth:
    password: "CHANGE-TO-STRONG-PASSWORD"
  master:
    persistence:
      size: 10Gi

# LiveKit configuration
livekit:
  url: "wss://livekit.yourdomain.com"
  apiKey: "YOUR-LIVEKIT-API-KEY"
  apiSecret: "YOUR-LIVEKIT-API-SECRET"

# Application secrets
secrets:
  jwtSecret: "CHANGE-TO-RANDOM-64-CHAR-STRING"
  jwtRefreshSecret: "CHANGE-TO-DIFFERENT-RANDOM-64-CHAR-STRING"
```

### Step 2: Generate Strong Secrets

**IMPORTANT**: Never use default passwords in production!

```bash
# Generate JWT secrets (base64 encoded 32 random bytes)
export JWT_SECRET=$(openssl rand -base64 32)
export JWT_REFRESH_SECRET=$(openssl rand -base64 32)

# Generate database passwords
export MONGO_ROOT_PASSWORD=$(openssl rand -base64 32)
export MONGO_PASSWORD=$(openssl rand -base64 32)
export REDIS_PASSWORD=$(openssl rand -base64 32)

# Display for verification (optional)
echo "JWT_SECRET: $JWT_SECRET"
echo "JWT_REFRESH_SECRET: $JWT_REFRESH_SECRET"
```

### Step 3: Install Kraken

**Option A: Install with values file**

```bash
helm install kraken oci://ghcr.io/krakenchat/charts/kraken \
  --values custom-values.yaml \
  --set secrets.jwtSecret="$JWT_SECRET" \
  --set secrets.jwtRefreshSecret="$JWT_REFRESH_SECRET" \
  --set mongodb.auth.rootPassword="$MONGO_ROOT_PASSWORD" \
  --set mongodb.auth.password="$MONGO_PASSWORD" \
  --set redis.auth.password="$REDIS_PASSWORD" \
  --namespace kraken \
  --create-namespace
```

**Option B: Install with inline values**

```bash
helm install kraken oci://ghcr.io/krakenchat/charts/kraken \
  --set ingress.hosts[0].host=kraken.yourdomain.com \
  --set livekit.url=wss://livekit.yourdomain.com \
  --set livekit.apiKey=YOUR_KEY \
  --set livekit.apiSecret=YOUR_SECRET \
  --set secrets.jwtSecret="$JWT_SECRET" \
  --set secrets.jwtRefreshSecret="$JWT_REFRESH_SECRET" \
  --namespace kraken \
  --create-namespace
```

### Step 4: Verify Installation

```bash
# Watch pods starting
kubectl get pods -n kraken --watch

# Check all resources
kubectl get all -n kraken

# View deployment status
helm status kraken -n kraken
```

Expected output:
```
NAME                                  READY   STATUS    RESTARTS   AGE
pod/kraken-backend-xxxxx-yyyyy        1/1     Running   0          2m
pod/kraken-backend-xxxxx-zzzzz        1/1     Running   0          2m
pod/kraken-frontend-xxxxx-yyyyy       1/1     Running   0          2m
pod/kraken-mongodb-0                  1/1     Running   0          2m
pod/kraken-mongodb-1                  1/1     Running   0          2m
pod/kraken-mongodb-2                  1/1     Running   0          2m
pod/kraken-redis-master-0             1/1     Running   0          2m
```

## Configuration

### Using External MongoDB

For production, you might want to use a managed MongoDB service (Atlas, AWS DocumentDB, etc.):

```yaml
mongodb:
  bundled: false
  external:
    uri: "mongodb+srv://user:password@cluster.mongodb.net/kraken?retryWrites=true&w=majority"
```

### Using External Redis

For production, consider managed Redis (AWS ElastiCache, Redis Cloud, etc.):

```yaml
redis:
  bundled: false
  external:
    host: "redis.example.com"
    port: 6379
    password: "your-redis-password"
```

### Resource Tuning

Adjust resources based on your expected load:

```yaml
backend:
  resources:
    requests:
      cpu: 500m
      memory: 1Gi
    limits:
      cpu: 2000m
      memory: 2Gi

frontend:
  resources:
    requests:
      cpu: 100m
      memory: 128Mi
    limits:
      cpu: 500m
      memory: 512Mi
```

### Custom Storage Classes

Specify storage classes for better performance:

```yaml
mongodb:
  persistence:
    storageClass: "fast-ssd"
    size: 100Gi

redis:
  master:
    persistence:
      storageClass: "fast-ssd"
      size: 20Gi
```

## Post-Installation

### Access the Application

1. **Get the Ingress IP/Hostname**
   ```bash
   kubectl get ingress -n kraken
   ```

2. **Update DNS**
   Point your domain to the ingress external IP

3. **Wait for TLS Certificate** (if using cert-manager)
   ```bash
   kubectl get certificate -n kraken
   kubectl describe certificate kraken-tls -n kraken
   ```

4. **Access the Application**
   Open https://kraken.yourdomain.com in your browser

### Create Admin User

```bash
# Port-forward to backend
kubectl port-forward -n kraken svc/kraken-backend 3000:3000

# Use the API or create directly in MongoDB
# (Refer to your application's admin user creation process)
```

### Configure Backups

Set up automated backups for MongoDB:

```bash
# Example: Create a CronJob for MongoDB backup
kubectl apply -f - <<EOF
apiVersion: batch/v1
kind: CronJob
metadata:
  name: mongodb-backup
  namespace: kraken
spec:
  schedule: "0 2 * * *"  # Daily at 2 AM
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: backup
            image: bitnami/mongodb:7.0
            command:
            - /bin/bash
            - -c
            - |
              mongodump --uri="\$MONGODB_URI" \
                --gzip \
                --archive=/backup/kraken-\$(date +%Y%m%d-%H%M%S).gz
            volumeMounts:
            - name: backup
              mountPath: /backup
            env:
            - name: MONGODB_URI
              valueFrom:
                configMapKeyRef:
                  name: kraken-backend-config
                  key: MONGODB_URL
          volumes:
          - name: backup
            persistentVolumeClaim:
              claimName: mongodb-backups
          restartPolicy: OnFailure
EOF
```

## Scaling

### Manual Scaling

```bash
# Scale backend
kubectl scale deployment kraken-backend -n kraken --replicas=5

# Scale frontend
kubectl scale deployment kraken-frontend -n kraken --replicas=3
```

### Enable Autoscaling

Update your values and upgrade:

```yaml
backend:
  autoscaling:
    enabled: true
    minReplicas: 2
    maxReplicas: 20
    targetCPUUtilizationPercentage: 70
    targetMemoryUtilizationPercentage: 80
```

```bash
helm upgrade kraken oci://ghcr.io/krakenchat/charts/kraken \
  --values custom-values.yaml \
  --reuse-values
```

### Verify Autoscaling

```bash
kubectl get hpa -n kraken
```

## Monitoring

### View Logs

```bash
# Backend logs
kubectl logs -n kraken -l app.kubernetes.io/component=backend -f

# Frontend logs
kubectl logs -n kraken -l app.kubernetes.io/component=frontend -f

# MongoDB logs
kubectl logs -n kraken -l app.kubernetes.io/name=mongodb -f

# All logs
stern -n kraken kraken
```

### Metrics

```bash
# Pod metrics
kubectl top pods -n kraken

# Node metrics
kubectl top nodes
```

### Recommended Monitoring Stack

Install Prometheus and Grafana:

```bash
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm install prometheus prometheus-community/kube-prometheus-stack \
  --namespace monitoring \
  --create-namespace
```

## Backup and Recovery

### Backup MongoDB

```bash
# Create backup
kubectl exec -n kraken kraken-mongodb-0 -- \
  mongodump --uri="mongodb://localhost:27017/kraken" \
  --gzip --archive=/tmp/backup.gz

# Copy backup locally
kubectl cp kraken/kraken-mongodb-0:/tmp/backup.gz ./backup.gz
```

### Restore MongoDB

```bash
# Copy backup to pod
kubectl cp ./backup.gz kraken/kraken-mongodb-0:/tmp/backup.gz

# Restore
kubectl exec -n kraken kraken-mongodb-0 -- \
  mongorestore --uri="mongodb://localhost:27017/kraken" \
  --gzip --archive=/tmp/backup.gz --drop
```

## Troubleshooting

### WebSocket and LiveKit Issues

**For Socket.IO WebSocket and LiveKit connectivity problems, see the dedicated guide:**
📖 **[WebSocket & LiveKit Troubleshooting Guide](./websocket-troubleshooting.md)**

Common symptoms:
- Messages not being delivered
- WebSocket connections failing
- LiveKit DataChannel errors
- Connection drops immediately

### Pods Stuck in Pending

```bash
# Check pod status
kubectl describe pod -n kraken <pod-name>

# Common issues:
# - Insufficient resources
# - PVC not bound
# - Image pull errors
```

### Database Connection Errors

```bash
# Verify MongoDB is running
kubectl get pods -n kraken -l app.kubernetes.io/name=mongodb

# Check MongoDB logs
kubectl logs -n kraken kraken-mongodb-0

# Test connection from backend pod
kubectl exec -it -n kraken deploy/kraken-backend -- sh
# Inside pod:
mongosh "$MONGODB_URL"
```

### Ingress Not Working

```bash
# Check ingress
kubectl describe ingress -n kraken

# Check NGINX logs
kubectl logs -n ingress-nginx -l app.kubernetes.io/component=controller

# Verify DNS
nslookup kraken.yourdomain.com
```

### Certificate Issues

```bash
# Check certificate status
kubectl get certificate -n kraken
kubectl describe certificate -n kraken kraken-tls

# Check cert-manager logs
kubectl logs -n cert-manager -l app=cert-manager
```

## Upgrading

### Update to New Version

```bash
# Update image tags
helm upgrade kraken oci://ghcr.io/krakenchat/charts/kraken \
  --reuse-values \
  --set backend.image.tag=v1.1.0 \
  --set frontend.image.tag=v1.1.0 \
  --namespace kraken
```

### Update Chart Version

```bash
helm upgrade kraken oci://ghcr.io/krakenchat/charts/kraken \
  --version 0.2.0 \
  --reuse-values \
  --namespace kraken
```

### Rollback

```bash
# List release history
helm history kraken -n kraken

# Rollback to previous version
helm rollback kraken -n kraken

# Rollback to specific revision
helm rollback kraken 2 -n kraken
```

## Uninstalling

```bash
# Uninstall the release
helm uninstall kraken -n kraken

# Optional: Delete persistent volumes (this deletes all data!)
kubectl delete pvc -n kraken --all

# Optional: Delete namespace
kubectl delete namespace kraken
```

## Production Checklist

- [ ] All default passwords changed
- [ ] TLS/HTTPS enabled
- [ ] Resource limits configured
- [ ] Autoscaling enabled
- [ ] Monitoring set up (Prometheus/Grafana)
- [ ] Backup strategy implemented
- [ ] DNS configured correctly
- [ ] Load testing completed
- [ ] Disaster recovery plan documented
- [ ] Security scanning enabled
- [ ] External database configured (recommended)
- [ ] High availability tested

## Additional Resources

- [Helm Chart README](../../helm/kraken/README.md)
- [Kubernetes Best Practices](https://kubernetes.io/docs/concepts/configuration/overview/)
- [NGINX Ingress Documentation](https://kubernetes.github.io/ingress-nginx/)
- [cert-manager Documentation](https://cert-manager.io/docs/)
- [LiveKit Deployment Guide](https://docs.livekit.io/deploy/)
