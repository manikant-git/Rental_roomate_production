# RentMate - Production-Grade Rental & Roommate Platform

> **Organisation-level production project** | Built by a DevOps Engineer thinking like a Lead Architect

[![CI/CD Pipeline](https://github.com/manikant-git/Rental_roomate_production/actions/workflows/ci-cd.yml/badge.svg)](https://github.com/manikant-git/Rental_roomate_production/actions)

---

## Architecture Overview

```
                           [Internet]
                               |
                    [Route 53 DNS / ALB]
                               |
                   [NGINX Ingress Controller]
                    /          |           \
             [Frontend]  [/api/* -> API Gateway]
                                    |
              +----------+---------+---------+----------+
              |          |         |         |          |
        [Auth Svc]  [Listing Svc] [Roommate] [Notif Svc]
              |          |         |         |
         [PostgreSQL RDS Multi-AZ] [Redis Cluster]
                    |                    |
              [RabbitMQ]         [AWS Secrets Manager]
```

---

## Project Structure

```
rental-roommate-finder/
├── .github/
│   └── workflows/
│       └── ci-cd.yml             # 5-stage production CI/CD pipeline
├── backend/
│   ├── api-gateway/              # Entry point - routes to microservices
│   ├── auth-service/             # JWT auth, refresh tokens
│   ├── listing-service/          # Rental listings CRUD, search
│   ├── roommate-service/         # Roommate profiles & matching
│   └── notification-service/     # Email/push via RabbitMQ
├── frontend/                     # React.js application
├── k8s/
│   ├── 00-namespace-configmap.yaml
│   ├── 01-secrets.yaml           # REPLACED by External Secrets Operator
│   ├── 02-postgres.yaml          # Dev only - prod uses RDS
│   ├── 03-infra-redis-rabbitmq.yaml
│   ├── 04-services.yaml          # All service deployments + HPA
│   ├── 05-ingress.yaml           # NGINX ingress + cert-manager TLS
│   ├── 06-network-policy.yaml    # Zero-trust network policies
│   └── 07-pdb-external-secrets.yaml  # PDB + ESO for AWS SSM
├── terraform/
│   ├── main.tf                   # Root module calling all sub-modules
│   ├── variables.tf              # Input variables
│   ├── outputs.tf                # Exported values
│   └── modules/
│       ├── eks/main.tf           # EKS cluster + IRSA + OIDC
│       ├── vpc/main.tf           # 3-AZ VPC + NAT HA + flow logs
│       └── rds/main.tf           # Multi-AZ RDS + Secrets Manager
└── scripts/                      # Helper deployment scripts
```

---

## Microservices

| Service | Port | Responsibility |
|---|---|---|
| `api-gateway` | 3000 | Route requests, auth middleware, rate limiting |
| `auth-service` | 3001 | JWT login/register/refresh |
| `listing-service` | 3002 | Property listings, search, filters |
| `roommate-service` | 3003 | Roommate matching & profiles |
| `notification-service` | 3004 | Email/push via RabbitMQ consumers |
| `frontend` | 80 | React SPA served via NGINX |

---

## CI/CD Pipeline (5 Stages)

```
PR / Push
   |
   v
[1. Test] --> Lint + Unit Tests per service (parallel matrix)
   |
   v
[2. Build] --> Docker multi-stage build + push to GHCR (sha tags)
   |
   v
[3. Security] --> Trivy CRITICAL/HIGH scan - fails pipeline if found
   |
   +----> develop branch: [4. Staging Deploy] --> Smoke Tests
   |
   +----> main branch:    [5. Production Deploy] --> Health Verify
                                  --> Slack Notification
                                  --> Auto-rollback on failure
                                  --> Git tag with version
```

**Key Security Improvement:** No stored AWS credentials. Uses **GitHub OIDC** to assume IAM roles (`AWS_PROD_ROLE_ARN`) — zero long-lived secrets in GitHub.

---

## Infrastructure (Terraform)

### How to Deploy Infrastructure

```bash
cd rental-roommate-finder/terraform

# Initialize with remote state backend (S3 + DynamoDB)
terraform init \
  -backend-config="bucket=rentmate-terraform-state" \
  -backend-config="key=production/terraform.tfstate" \
  -backend-config="region=us-east-1"

# Plan and review
terraform plan -var="db_password=$DB_PASS" -var="environment=production"

# Apply (creates VPC, EKS, RDS)
terraform apply -var="db_password=$DB_PASS" -var="environment=production"
```

### What Gets Created

| Resource | Details |
|---|---|
| **VPC** | 3-AZ, public + private subnets, HA NAT gateways, VPC Flow Logs |
| **EKS** | v1.28, managed node groups (t3.medium, 2-10 nodes), OIDC enabled |
| **RDS** | PostgreSQL 15, Multi-AZ, encrypted at rest, 7-day backups |
| **IAM** | IRSA roles for External Secrets, cluster + node roles |

---

## Kubernetes Deployment

### Prerequisites

```bash
# 1. Install NGINX Ingress Controller
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
helm install ingress-nginx ingress-nginx/ingress-nginx -n ingress-nginx --create-namespace

# 2. Install cert-manager for TLS
helm repo add jetstack https://charts.jetstack.io
helm install cert-manager jetstack/cert-manager -n cert-manager --create-namespace \
  --set installCRDs=true

# 3. Install External Secrets Operator
helm repo add external-secrets https://charts.external-secrets.io
helm install external-secrets external-secrets/external-secrets -n external-secrets --create-namespace
```

### Deploy Application

```bash
# Get kubeconfig from EKS
aws eks update-kubeconfig --name rental-prod-cluster --region us-east-1

# Apply all manifests in order
kubectl apply -f k8s/00-namespace-configmap.yaml
kubectl apply -f k8s/03-infra-redis-rabbitmq.yaml
kubectl apply -f k8s/04-services.yaml
kubectl apply -f k8s/05-ingress.yaml
kubectl apply -f k8s/06-network-policy.yaml
kubectl apply -f k8s/07-pdb-external-secrets.yaml

# Verify all pods are Running
kubectl get pods -n rental-app
kubectl get ingress -n rental-app
```

---

## GitHub Secrets Required

| Secret | Description |
|---|---|
| `AWS_PROD_ROLE_ARN` | IAM role ARN for production deploy (OIDC) |
| `AWS_STAGING_ROLE_ARN` | IAM role ARN for staging deploy (OIDC) |
| `SLACK_WEBHOOK_URL` | Slack incoming webhook for deploy alerts |

---

## Production Standards

| Standard | Status | Implementation |
|---|---|---|
| Zero-downtime deploys | Done | Rolling updates, maxUnavailable: 0 |
| Auto-scaling | Done | HPA on CPU/Memory for all services |
| High Availability | Done | Multi-replica + Multi-AZ RDS + HA NAT |
| Secret Management | Done | External Secrets Operator + AWS SSM |
| TLS/SSL | Done | cert-manager + Let's Encrypt |
| Zero-Trust Networking | Done | K8s NetworkPolicies, default deny |
| Container Security | Done | Non-root user, multi-stage builds |
| IaC | Done | Full Terraform modules |
| Security Scanning | Done | Trivy in CI/CD (blocks on CRITICAL) |
| Observability | Configured | Prometheus + Grafana + CloudWatch Logs |
| Disaster Recovery | Done | Multi-AZ RDS + 7-day backups |

---

*Maintained by [manikant-git](https://github.com/manikant-git) | DevOps Engineer*
