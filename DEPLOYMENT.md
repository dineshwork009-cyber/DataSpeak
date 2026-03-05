# DataSpeak — Azure AKS Deployment Guide

## Prerequisites
- Azure CLI (`az`)
- kubectl
- Docker / docker buildx
- Helm 3

---

## Step 1 — Create Azure Resources

```bash
# Variables
RG=dataspeak-rg
LOCATION=eastus
ACR=dataspeakacr
AKS=dataspeak-aks
PG_SERVER=dataspeak-pg
REDIS_NAME=dataspeak-redis

# Resource group
az group create --name $RG --location $LOCATION

# Azure Container Registry
az acr create --resource-group $RG --name $ACR --sku Standard --admin-enabled true

# AKS cluster (with AGIC for ingress + ACR integration)
az aks create \
  --resource-group $RG \
  --name $AKS \
  --node-count 3 \
  --node-vm-size Standard_D2s_v3 \
  --enable-addons ingress-appgw \
  --appgw-name dataspeak-gateway \
  --appgw-subnet-cidr 10.226.0.0/16 \
  --attach-acr $ACR \
  --generate-ssh-keys \
  --enable-managed-identity

# Azure Database for PostgreSQL Flexible Server
az postgres flexible-server create \
  --resource-group $RG \
  --name $PG_SERVER \
  --sku-name Standard_D2s_v3 \
  --tier GeneralPurpose \
  --version 16 \
  --admin-user dataspeak_admin \
  --admin-password "CHANGE_ME_STRONG_PASSWORD" \
  --public-access 0.0.0.0

az postgres flexible-server db create \
  --resource-group $RG \
  --server-name $PG_SERVER \
  --database-name dataspeak

# Azure Cache for Redis
az redis create \
  --resource-group $RG \
  --name $REDIS_NAME \
  --location $LOCATION \
  --sku Standard \
  --vm-size c1
```

---

## Step 2 — Build and Push Docker Images

```bash
# Login to ACR
az acr login --name $ACR

# Build and push API
docker build -t $ACR.azurecr.io/dataspeak-api:latest ./backend
docker push $ACR.azurecr.io/dataspeak-api:latest

# Build and push Frontend
docker build -t $ACR.azurecr.io/dataspeak-frontend:latest ./frontend
docker push $ACR.azurecr.io/dataspeak-frontend:latest
```

---

## Step 3 — Configure kubectl

```bash
az aks get-credentials --resource-group $RG --name $AKS
kubectl get nodes  # verify
```

---

## Step 4 — Create Namespace and Secrets

```bash
kubectl apply -f k8s/namespace.yaml

# Create ACR pull secret
kubectl create secret docker-registry acr-pull-secret \
  --docker-server=$ACR.azurecr.io \
  --docker-username=$(az acr credential show --name $ACR --query username -o tsv) \
  --docker-password=$(az acr credential show --name $ACR --query passwords[0].value -o tsv) \
  --namespace dataspeak

# Create application secrets (use Azure Key Vault in production)
kubectl create secret generic dataspeak-secrets \
  --from-literal=DB_PASSWORD="your-db-password" \
  --from-literal=JWT_SECRET_KEY="your-jwt-secret-min-32-chars" \
  --from-literal=CLAUDE_API_KEY="sk-ant-your-key" \
  --from-literal=ENCRYPTION_MASTER_KEY="your-32-char-master-key" \
  --namespace dataspeak
```

---

## Step 5 — Apply Kubernetes Manifests

```bash
# Update image references in deployments
sed -i "s|your-acr.azurecr.io|$ACR.azurecr.io|g" k8s/api-deployment.yaml
sed -i "s|your-acr.azurecr.io|$ACR.azurecr.io|g" k8s/frontend-deployment.yaml

# Apply in order
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/services.yaml
kubectl apply -f k8s/api-deployment.yaml
kubectl apply -f k8s/frontend-deployment.yaml
kubectl apply -f k8s/hpa.yaml
kubectl apply -f k8s/ingress.yaml

# Verify rollout
kubectl rollout status deployment/dataspeak-api      -n dataspeak
kubectl rollout status deployment/dataspeak-frontend -n dataspeak
```

---

## Step 6 — Initialize the Database

```bash
# Run schema from local machine (replace with your PG Flexible Server FQDN)
psql "host=$PG_SERVER.postgres.database.azure.com \
      dbname=dataspeak \
      user=dataspeak_admin \
      sslmode=require" \
  -f database/schema.sql
```

---

## Step 7 — Configure TLS / Custom Domain

```bash
# Get the Application Gateway public IP
kubectl get ingress -n dataspeak

# Point your DNS A record → AGIC public IP
# Then issue a cert via cert-manager (optional):
helm repo add jetstack https://charts.jetstack.io
helm install cert-manager jetstack/cert-manager \
  --namespace cert-manager --create-namespace \
  --set installCRDs=true

# Or use Azure-managed certificates with App Gateway
```

---

## Step 8 — Production Checklist

| Item | Status |
|---|---|
| Secrets stored in Azure Key Vault (not K8s Secrets) | ⬜ |
| PostgreSQL private endpoint enabled | ⬜ |
| Redis private endpoint enabled | ⬜ |
| HTTPS enforced via AGIC redirect | ⬜ |
| HPA configured (min 2 replicas each) | ✅ |
| Liveness / readiness probes active | ✅ |
| Structured logging → Azure Monitor | ⬜ |
| Container vulnerability scanning (ACR + Defender) | ⬜ |
| Network Policy (deny-all then allow-list) | ⬜ |
| Azure AD Workload Identity (replace service principal) | ⬜ |

---

## Step 9 — CI/CD (GitHub Actions skeleton)

```yaml
# .github/workflows/deploy.yml
name: Deploy to AKS

on:
  push:
    branches: [main]

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: azure/login@v2
        with:
          creds: ${{ secrets.AZURE_CREDENTIALS }}

      - uses: azure/docker-login@v2
        with:
          login-server: ${{ secrets.ACR_SERVER }}
          username:     ${{ secrets.ACR_USERNAME }}
          password:     ${{ secrets.ACR_PASSWORD }}

      - name: Build & push API
        run: |
          docker build -t ${{ secrets.ACR_SERVER }}/dataspeak-api:${{ github.sha }} ./backend
          docker push ${{ secrets.ACR_SERVER }}/dataspeak-api:${{ github.sha }}

      - name: Build & push Frontend
        run: |
          docker build -t ${{ secrets.ACR_SERVER }}/dataspeak-frontend:${{ github.sha }} ./frontend
          docker push ${{ secrets.ACR_SERVER }}/dataspeak-frontend:${{ github.sha }}

      - uses: azure/aks-set-context@v4
        with:
          resource-group: dataspeak-rg
          cluster-name:   dataspeak-aks

      - name: Deploy
        run: |
          kubectl set image deployment/dataspeak-api \
            api=${{ secrets.ACR_SERVER }}/dataspeak-api:${{ github.sha }} -n dataspeak
          kubectl set image deployment/dataspeak-frontend \
            frontend=${{ secrets.ACR_SERVER }}/dataspeak-frontend:${{ github.sha }} -n dataspeak
          kubectl rollout status deployment/dataspeak-api      -n dataspeak
          kubectl rollout status deployment/dataspeak-frontend -n dataspeak
```

---

## Step 10 — Local Development

```bash
# Clone + setup
cp .env.example .env
# Fill in .env (DB_PASSWORD, JWT_SECRET_KEY, CLAUDE_API_KEY, ENCRYPTION_MASTER_KEY)

# Start all services
docker compose up --build

# Services:
#   Frontend  → http://localhost:4200
#   API       → http://localhost:5000
#   Swagger   → http://localhost:5000/swagger
#   PG Admin  → postgresql://localhost:5432/dataspeak
```
