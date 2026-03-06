# Kubernetes Quick Start Guide

Get Semaphore Chat running in Kubernetes in under 10 minutes!

## Prerequisites

- Kubernetes cluster running (minikube, kind, GKE, EKS, etc.)
- `kubectl` configured
- `helm` 3.8+ installed
- A LiveKit server URL and credentials

## Step 1: Install NGINX Ingress (if not already installed)

```bash
helm upgrade --install ingress-nginx ingress-nginx \
  --repo https://kubernetes.github.io/ingress-nginx \
  --namespace ingress-nginx \
  --create-namespace
```

## Step 2: Update Configuration

Before deploying, update these placeholders in the Helm command below:

- `YOUR-GITHUB-USERNAME` - Your GitHub username
- `semaphore.yourdomain.com` - Your domain name
- `wss://livekit.example.com` - Your LiveKit server URL
- `LIVEKIT_KEY` - Your LiveKit API key
- `LIVEKIT_SECRET` - Your LiveKit API secret

## Step 3: Install Semaphore Chat

```bash
helm install semaphore-chat oci://ghcr.io/YOUR-GITHUB-USERNAME/charts/semaphore-chat \
  --create-namespace \
  --namespace semaphore-chat \
  --set ingress.hosts[0].host=semaphore-chat.yourdomain.com \
  --set livekit.url=wss://livekit.example.com \
  --set livekit.apiKey=LIVEKIT_KEY \
  --set livekit.apiSecret=LIVEKIT_SECRET \
  --set secrets.jwtSecret="$(openssl rand -base64 32)" \
  --set secrets.jwtRefreshSecret="$(openssl rand -base64 32)" \
  --set postgresql.auth.postgresPassword="$(openssl rand -base64 24)" \
  --set redis.auth.password="$(openssl rand -base64 24)"
```

## Step 4: Wait for Pods to Start

```bash
# Watch pods starting up
kubectl get pods -n semaphore-chat --watch

# Should see all pods Running within 2-3 minutes
```

## Step 5: Access Your Application

### Option A: Via Ingress (if DNS is configured)

1. Point your domain's DNS to the ingress load balancer:
   ```bash
   kubectl get ingress -n semaphore-chat
   ```

2. Visit `https://semaphore-chat.yourdomain.com` (or `http://` if TLS not configured)

### Option B: Via Port Forward (for testing)

```bash
# Forward frontend port
kubectl port-forward -n semaphore-chat svc/semaphore-chat-frontend 8080:5173

# Visit http://localhost:8080
```

## Step 6: Verify Everything Works

```bash
# Check all pods are running
kubectl get pods -n semaphore-chat

# Check backend logs
kubectl logs -n semaphore-chat -l app.kubernetes.io/component=backend

# Check frontend logs
kubectl logs -n semaphore-chat -l app.kubernetes.io/component=frontend
```

## Next Steps

### Enable HTTPS with cert-manager

```bash
# 1. Install cert-manager
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.14.0/cert-manager.yaml

# 2. Create Let's Encrypt issuer
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

# 3. Upgrade Semaphore Chat to use cert-manager
helm upgrade semaphore-chat oci://ghcr.io/YOUR-GITHUB-USERNAME/charts/semaphore-chat \
  --namespace semaphore-chat \
  --reuse-values \
  --set ingress.tls.mode=cert-manager \
  --set ingress.tls.certManager.enabled=true
```

### Enable Autoscaling

```bash
# Install metrics-server if not already installed
kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml

# Enable autoscaling
helm upgrade semaphore-chat oci://ghcr.io/YOUR-GITHUB-USERNAME/charts/semaphore-chat \
  --namespace semaphore-chat \
  --reuse-values \
  --set backend.autoscaling.enabled=true \
  --set frontend.autoscaling.enabled=true
```

### Use External PostgreSQL/Redis

```bash
helm upgrade semaphore-chat oci://ghcr.io/YOUR-GITHUB-USERNAME/charts/semaphore-chat \
  --namespace semaphore-chat \
  --reuse-values \
  --set postgresql.bundled=false \
  --set postgresql.external.uri="postgresql://user:pass@your-postgres-host:5432/semaphore" \
  --set redis.bundled=false \
  --set redis.external.host=your-redis-host
```

## Troubleshooting

### Pods Not Starting

```bash
# Describe pod to see errors
kubectl describe pod -n semaphore-chat <pod-name>

# Check events
kubectl get events -n semaphore-chat --sort-by='.lastTimestamp'
```

### Can't Access via Ingress

```bash
# Check ingress
kubectl get ingress -n semaphore-chat
kubectl describe ingress -n semaphore-chat

# Check NGINX logs
kubectl logs -n ingress-nginx -l app.kubernetes.io/component=controller
```

### Database Connection Errors

```bash
# Check PostgreSQL is running
kubectl get pods -n semaphore-chat -l app.kubernetes.io/name=postgresql

# View PostgreSQL logs
kubectl logs -n semaphore-chat semaphore-chat-postgresql-0
```

## Uninstall

```bash
# Remove Semaphore Chat
helm uninstall semaphore-chat -n semaphore-chat

# Optional: Delete all data (PVCs)
kubectl delete pvc -n semaphore-chat --all

# Optional: Delete namespace
kubectl delete namespace semaphore-chat
```

## Full Documentation

- **Helm Chart README**: [helm/semaphore-chat/README.md](./helm/semaphore-chat/README.md)
- **Kubernetes Guide**: [docs.semaphorechat.app/deployment/kubernetes](https://docs.semaphorechat.app/deployment/kubernetes/)
- **Deployment Summary**: [DEPLOYMENT.md](./DEPLOYMENT.md)

## Getting Help

- **Issues**: https://github.com/semaphore-chat/semaphore-chat/issues
- **Discussions**: https://github.com/semaphore-chat/semaphore-chat/discussions

---

**Tip**: For local testing with minikube or kind, you can use port-forwarding instead of setting up ingress!
