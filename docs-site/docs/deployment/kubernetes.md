# Kubernetes Deployment

Deploy Kraken to a Kubernetes cluster using the official Helm chart.

## Prerequisites

1. **Kubernetes** (v1.24+) -- managed (GKE, EKS, AKS) or self-hosted (k3s, kubeadm)
2. **Helm** (v3.8+)
3. **kubectl** configured for your cluster
4. **NGINX Ingress Controller**
5. **LiveKit Server** -- [self-hosted](https://docs.livekit.io/deploy/) or [LiveKit Cloud](https://cloud.livekit.io)

Optional: **cert-manager** (automatic TLS), **metrics-server** (autoscaling)

## Installation

### 1. Create Values File

```yaml
# custom-values.yaml
backend:
  image:
    repository: ghcr.io/krakenchat/kraken-backend
    tag: "v1.0.0"
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
  tls:
    mode: cert-manager
    certManager:
      enabled: true
      issuer: letsencrypt-prod

mongodb:
  bundled: true
  replicaCount: 3
  auth:
    rootPassword: "CHANGE-ME"
    password: "CHANGE-ME"
  persistence:
    size: 50Gi

redis:
  bundled: true
  auth:
    password: "CHANGE-ME"
  master:
    persistence:
      size: 10Gi

livekit:
  url: "wss://livekit.yourdomain.com"
  apiKey: "YOUR-LIVEKIT-API-KEY"
  apiSecret: "YOUR-LIVEKIT-API-SECRET"

secrets:
  jwtSecret: "CHANGE-ME"
  jwtRefreshSecret: "CHANGE-ME"
```

### 2. Generate Secrets

```bash
export JWT_SECRET=$(openssl rand -base64 32)
export JWT_REFRESH_SECRET=$(openssl rand -base64 32)
export MONGO_ROOT_PASSWORD=$(openssl rand -base64 32)
export MONGO_PASSWORD=$(openssl rand -base64 32)
export REDIS_PASSWORD=$(openssl rand -base64 32)
```

### 3. Install

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

### 4. Verify

```bash
kubectl get pods -n kraken --watch
kubectl get all -n kraken
helm status kraken -n kraken
```

---

## Configuration

### External MongoDB

```yaml
mongodb:
  bundled: false
  external:
    uri: "mongodb+srv://user:password@cluster.mongodb.net/kraken?retryWrites=true&w=majority"
```

### External Redis

```yaml
redis:
  bundled: false
  external:
    host: "redis.example.com"
    port: 6379
    password: "your-redis-password"
```

### Resource Tuning

```yaml
backend:
  resources:
    requests: { cpu: 500m, memory: 1Gi }
    limits: { cpu: 2000m, memory: 2Gi }

frontend:
  resources:
    requests: { cpu: 100m, memory: 128Mi }
    limits: { cpu: 500m, memory: 512Mi }
```

---

## Scaling

### Autoscaling

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
  --values custom-values.yaml --reuse-values
```

### Manual

```bash
kubectl scale deployment kraken-backend -n kraken --replicas=5
```

---

## Monitoring

```bash
# Logs
kubectl logs -n kraken -l app.kubernetes.io/component=backend -f

# Metrics
kubectl top pods -n kraken
```

For production monitoring, install the Prometheus/Grafana stack:

```bash
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm install prometheus prometheus-community/kube-prometheus-stack \
  --namespace monitoring --create-namespace
```

---

## Backup & Recovery

### Backup MongoDB

```bash
kubectl exec -n kraken kraken-mongodb-0 -- \
  mongodump --uri="mongodb://localhost:27017/kraken" \
  --gzip --archive=/tmp/backup.gz

kubectl cp kraken/kraken-mongodb-0:/tmp/backup.gz ./backup.gz
```

### Restore

```bash
kubectl cp ./backup.gz kraken/kraken-mongodb-0:/tmp/backup.gz

kubectl exec -n kraken kraken-mongodb-0 -- \
  mongorestore --uri="mongodb://localhost:27017/kraken" \
  --gzip --archive=/tmp/backup.gz --drop
```

---

## Upgrading

```bash
helm upgrade kraken oci://ghcr.io/krakenchat/charts/kraken \
  --reuse-values \
  --set backend.image.tag=v1.1.0 \
  --set frontend.image.tag=v1.1.0 \
  --namespace kraken
```

### Rollback

```bash
helm history kraken -n kraken
helm rollback kraken -n kraken    # Previous version
helm rollback kraken 2 -n kraken  # Specific revision
```

---

## Troubleshooting

For WebSocket and LiveKit connectivity issues in Kubernetes, see the dedicated [WebSocket Troubleshooting](websocket-troubleshooting.md) guide.

### Pods Stuck in Pending

```bash
kubectl describe pod -n kraken <pod-name>
# Common: insufficient resources, PVC not bound, image pull errors
```

### Database Connection Errors

```bash
kubectl get pods -n kraken -l app.kubernetes.io/name=mongodb
kubectl exec -it -n kraken deploy/kraken-backend -- sh -c 'mongosh "$MONGODB_URL"'
```

### Ingress Not Working

```bash
kubectl describe ingress -n kraken
kubectl logs -n ingress-nginx -l app.kubernetes.io/component=controller
```

---

## Production Checklist

- [ ] All default passwords changed
- [ ] TLS/HTTPS enabled
- [ ] Resource limits configured
- [ ] Autoscaling enabled
- [ ] Monitoring set up
- [ ] Backup strategy implemented
- [ ] DNS configured correctly
- [ ] Load testing completed
- [ ] External database configured (recommended)
