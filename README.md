# RentMate: Production-Grade Rental & Roommate Finder

> A high-availability, scalable microservices application built with production DevOps practices — automated CI/CD pipelines, Kubernetes on AWS EKS, Terraform IaC, and Docker Hub image registry.

---

## Architecture Overview

Microservices architecture with a centralized API Gateway. All services are containerized, deployed on AWS EKS, and managed via Kubernetes manifests.

```
[Client] --> [NGINX Ingress] --> [API Gateway]
                                      |
              ┌───────────────────────┼──────────────────────┐
              |               |              |               |
         [Auth Svc]   [Listing Svc]  [Roommate Svc]  [Notification Svc]
              |               |              |               |
         [PostgreSQL]     [Redis]       [RabbitMQ/Kafka]
```

### Backend Services

| Service | Responsibility |
|---|---|
| **api-gateway** | Routes all client requests, auth middleware |
| **auth-service** | JWT auth, user registration & login |
| **listing-service** | Property listings, search, image upload (S3) |
| **roommate-service** | Roommate profiles & matching logic |
| **notification-service** | Event-driven email/push alerts via RabbitMQ/Kafka |
| **frontend** | React.js user interface |

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Backend** | Node.js, Express |
| **Frontend** | React.js |
| **Database** | PostgreSQL (AWS RDS multi-AZ), Redis |
| **Messaging** | RabbitMQ, Kafka |
| **Container Registry** | Docker Hub |
| **Orchestration** | Kubernetes (AWS EKS) |
| **IaC** | Terraform (modular: VPC, EKS, RDS) |
| **CI/CD** | GitHub Actions |
| **Security** | AWS IAM OIDC (keyless auth), External Secrets Operator |
| **Code Quality** | SonarCloud |

---

## CI/CD Pipeline

Five GitHub Actions workflows covering the full software delivery lifecycle:

| Workflow | Trigger | Purpose |
|---|---|---|
| `ci-testing.yml` | PR to main/develop | SonarCloud scan + npm lint + test |
| `pr-validation.yml` | PR to main/develop | Docker build validation (no push) |
| `cd-staging.yml` | Push to main | Build & push to Docker Hub → deploy to EKS staging |
| `cd-production.yml` | Push to main | Build & push to Docker Hub → deploy to EKS production (with rollback) |
| `terraform-cicd.yml` | PR/Push affecting terraform/ | Plan on PR (comment output), Apply on merge |

### Pipeline Flow

```
PR Opened
  └── ci-testing.yml    → SonarCloud + unit tests
  └── pr-validation.yml → Docker build check + Terraform plan comment

Merged to main
  └── cd-staging.yml    → Docker Hub push → EKS staging deploy
  └── cd-production.yml → Docker Hub push → EKS production deploy → rollback on failure
  └── terraform-cicd.yml (apply) → Staging apply → Production apply (manual approval)
```

---

## Infrastructure (Terraform)

```
terraform/
├── main.tf              # Calls VPC, EKS, RDS modules
├── variables.tf         # Typed, environment-aware variables
├── outputs.tf           # Exports EKS endpoint, RDS endpoint, OIDC ARN
├── backend.tf           # S3 state + DynamoDB lock
├── iam-oidc.tf          # GitHub OIDC provider + least-privilege IAM roles
├── modules/
│   ├── vpc/             # VPC, subnets, NAT gateway
│   ├── eks/             # EKS cluster + managed node groups
│   └── rds/             # Multi-AZ PostgreSQL with encryption
└── environments/
    ├── staging.tfvars   # SPOT nodes, single-AZ RDS (cost-optimized)
    └── prod.tfvars      # ON_DEMAND nodes, multi-AZ RDS (HA)
```

**Authentication**: GitHub Actions authenticates to AWS via **OIDC** (no long-lived AWS keys stored in secrets).

---

## Kubernetes Manifests

```
k8s/
├── 00-namespace-configmap.yaml   # Namespace + ConfigMaps
├── 01-secrets.yaml               # Kubernetes Secrets (use External Secrets in prod)
├── 02-postgres.yaml              # PostgreSQL StatefulSet
├── 03-infra-redis-rabbitmq-kafka.yaml  # Infra services
├── 04-services.yaml              # Deployments + ClusterIP Services
├── 05-ingress.yaml               # NGINX Ingress with TLS
├── 06-network-policy.yaml        # Zero-trust network policies (default deny)
└── 07-pdb-external-secrets.yaml  # PodDisruptionBudgets + External Secrets Operator
```

**Production HA features**: Multi-replica deployments, PodDisruptionBudgets, anti-affinity rules, liveness/readiness probes, HPA.

---

## Required GitHub Secrets

| Secret | Description |
|---|---|
| `AWS_TERRAFORM_ROLE_ARN` | IAM role ARN for Terraform (OIDC) |
| `AWS_STAGING_ROLE_ARN` | IAM role ARN for staging deploys (OIDC) |
| `AWS_PROD_ROLE_ARN` | IAM role ARN for production deploys (OIDC) |
| `DOCKERHUB_USERNAME` | Docker Hub account username |
| `DOCKERHUB_TOKEN` | Docker Hub access token |
| `TF_DB_PASSWORD` | RDS PostgreSQL master password |
| `SONAR_TOKEN` | SonarCloud authentication token |

---

## Quick Start (Local Development)

```bash
# Clone
git clone https://github.com/manikant-git/Rental_roomate_production.git
cd Rental_roomate_production/rental-roommate-finder

# Copy env file
cp .env.example .env
# Fill in your values in .env

# Apply k8s manifests to your cluster
kubectl apply -f k8s/

# OR deploy via Terraform
cd terraform
terraform init
terraform plan -var-file=environments/staging.tfvars
terraform apply -var-file=environments/staging.tfvars
```

---

## Repository Structure

```
rental-roommate-finder/
├── .github/workflows/     # 5 GitHub Actions CI/CD workflows
├── backend/
│   ├── api-gateway/
│   ├── auth-service/
│   ├── listing-service/
│   ├── roommate-service/
│   └── notification-service/
├── frontend/              # React.js app
├── k8s/                   # Kubernetes manifests (00-07)
├── terraform/             # IaC - VPC, EKS, RDS modules
├── scripts/               # DB init scripts
└── .env.example           # Environment variable template
```

---

Maintained by [@manikant-git](https://github.com/manikant-git)
