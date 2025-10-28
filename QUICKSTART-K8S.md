# Kubernetes Quick Start Guide

Get Kraken running in Kubernetes in under 10 minutes!

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
- `kraken.yourdomain.com` - Your domain name
- `wss://livekit.example.com` - Your LiveKit server URL
- `LIVEKIT_KEY` - Your LiveKit API key
- `LIVEKIT_SECRET` - Your LiveKit API secret

## Step 3: Install Kraken

```bash
helm install kraken oci://ghcr.io/YOUR-GITHUB-USERNAME/charts/kraken \
  --create-namespace \
  --namespace kraken \
  --set ingress.hosts[0].host=kraken.yourdomain.com \
  --set livekit.url=wss://livekit.example.com \
  --set livekit.apiKey=LIVEKIT_KEY \
  --set livekit.apiSecret=LIVEKIT_SECRET \
  --set secrets.jwtSecret="$(openssl rand -base64 32)" \
  --set secrets.jwtRefreshSecret="$(openssl rand -base64 32)" \
  --set mongodb.auth.rootPassword="$(openssl rand -base64 24)" \
  --set mongodb.auth.password="$(openssl rand -base64 24)" \
  --set redis.auth.password="$(openssl rand -base64 24)"
```

## Step 4: Wait for Pods to Start

```bash
# Watch pods starting up
kubectl get pods -n kraken --watch

# Should see all pods Running within 2-3 minutes
```

## Step 5: Access Your Application

### Option A: Via Ingress (if DNS is configured)

1. Point your domain's DNS to the ingress load balancer:
   ```bash
   kubectl get ingress -n kraken
   ```

2. Visit `https://kraken.yourdomain.com` (or `http://` if TLS not configured)

### Option B: Via Port Forward (for testing)

```bash
# Forward frontend port
kubectl port-forward -n kraken svc/kraken-frontend 8080:5173

# Visit http://localhost:8080
```

## Step 6: Verify Everything Works

```bash
# Check all pods are running
kubectl get pods -n kraken

# Check backend logs
kubectl logs -n kraken -l app.kubernetes.io/component=backend

# Check frontend logs
kubectl logs -n kraken -l app.kubernetes.io/component=frontend
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

# 3. Upgrade Kraken to use cert-manager
helm upgrade kraken oci://ghcr.io/YOUR-GITHUB-USERNAME/charts/kraken \
  --namespace kraken \
  --reuse-values \
  --set ingress.tls.mode=cert-manager \
  --set ingress.tls.certManager.enabled=true
```

### Enable Autoscaling

```bash
# Install metrics-server if not already installed
kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml

# Enable autoscaling
helm upgrade kraken oci://ghcr.io/YOUR-GITHUB-USERNAME/charts/kraken \
  --namespace kraken \
  --reuse-values \
  --set backend.autoscaling.enabled=true \
  --set frontend.autoscaling.enabled=true
```

### Use External MongoDB/Redis

```bash
helm upgrade kraken oci://ghcr.io/YOUR-GITHUB-USERNAME/charts/kraken \
  --namespace kraken \
  --reuse-values \
  --set mongodb.bundled=false \
  --set mongodb.external.uri="your-mongodb-connection-string" \
  --set redis.bundled=false \
  --set redis.external.host=your-redis-host
```

## Troubleshooting

### Pods Not Starting

```bash
# Describe pod to see errors
kubectl describe pod -n kraken <pod-name>

# Check events
kubectl get events -n kraken --sort-by='.lastTimestamp'
```

### Can't Access via Ingress

```bash
# Check ingress
kubectl get ingress -n kraken
kubectl describe ingress -n kraken

# Check NGINX logs
kubectl logs -n ingress-nginx -l app.kubernetes.io/component=controller
```

### Database Connection Errors

```bash
# Check MongoDB is running
kubectl get pods -n kraken -l app.kubernetes.io/name=mongodb

# View MongoDB logs
kubectl logs -n kraken kraken-mongodb-0
```

## Uninstall

```bash
# Remove Kraken
helm uninstall kraken -n kraken

# Optional: Delete all data (PVCs)
kubectl delete pvc -n kraken --all

# Optional: Delete namespace
kubectl delete namespace kraken
```

## Full Documentation

- **Helm Chart README**: [helm/kraken/README.md](./helm/kraken/README.md)
- **Kubernetes Guide**: [docs/deployment/kubernetes.md](./docs/deployment/kubernetes.md)
- **Deployment Summary**: [DEPLOYMENT.md](./DEPLOYMENT.md)

## Getting Help

- **Issues**: https://github.com/YOUR-USERNAME/kraken/issues
- **Discussions**: https://github.com/YOUR-USERNAME/kraken/discussions

---

**Tip**: For local testing with minikube or kind, you can use port-forwarding instead of setting up ingress!
