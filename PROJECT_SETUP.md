# Project Setup & Configuration Guide

Complete step-by-step guide to set up the RentMate project from scratch, configure AWS infrastructure, and get CI/CD pipelines running.

---

## Prerequisites

### Tools Required (Local Machine)

- **Node.js** v20.x (LTS)
- **Docker** Desktop or Engine
- **AWS CLI** v2 configured (`aws configure`)
- **Terraform** v1.5.7+
- **kubectl** for Kubernetes management
- **helm** (optional, for cert-manager/ingress)

### Accounts Required

- **AWS Account** with permissions for EKS, EC2, RDS, S3, IAM
- **GitHub Account** for Actions and OIDC
- **Docker Hub Account** for container image registry
- **SonarCloud Account** for code quality scanning

---

## Step 1: AWS OIDC Setup (Keyless Auth)

This project uses GitHub OIDC to authenticate to AWS - no static AWS keys needed.

```bash
# After running terraform apply, get role ARNs:
cd rental-roommate-finder/terraform
terraform init
terraform apply -var-file=environments/staging.tfvars -var="db_password=YourPassword"

# Get outputs
terraform output github_staging_role_arn   # -> AWS_STAGING_ROLE_ARN
terraform output github_production_role_arn # -> AWS_PROD_ROLE_ARN
terraform output github_terraform_role_arn  # -> AWS_TERRAFORM_ROLE_ARN
```

---

## Step 2: GitHub Secrets Configuration

Go to: `Repository Settings > Secrets and variables > Actions > New repository secret`

| Secret Name | Value | Used In |
|---|---|---|
| `AWS_TERRAFORM_ROLE_ARN` | IAM role ARN from terraform output | `terraform-cicd.yml` |
| `AWS_STAGING_ROLE_ARN` | IAM role ARN from terraform output | `cd-staging.yml` |
| `AWS_PROD_ROLE_ARN` | IAM role ARN from terraform output | `cd-production.yml` |
| `DOCKERHUB_USERNAME` | Your Docker Hub username | `cd-staging.yml`, `cd-production.yml`, `pr-validation.yml` |
| `DOCKERHUB_TOKEN` | Docker Hub access token (not password) | `cd-staging.yml`, `cd-production.yml`, `pr-validation.yml` |
| `TF_DB_PASSWORD` | RDS PostgreSQL master password | `terraform-cicd.yml` |
| `SONAR_TOKEN` | SonarCloud project token | `ci-testing.yml` |

### How to create Docker Hub token:
1. Login to hub.docker.com
2. Account Settings > Security > New Access Token
3. Give it Read/Write permission
4. Copy token and add as `DOCKERHUB_TOKEN` secret

### How to create SonarCloud token:
1. Login to sonarcloud.io
2. My Account > Security > Generate Token
3. Copy token and add as `SONAR_TOKEN` secret

---

## Step 3: GitHub Environments Setup

Go to: `Repository Settings > Environments`

Create two environments:

### `staging` environment
- No protection rules needed
- Auto-deploys on push to main

### `production` environment
- Enable **Required reviewers** (add yourself)
- This creates manual approval gate before production deploy
- Enable **Wait timer**: 5 minutes (optional)

---

## Step 4: Terraform State Backend Setup

Before running Terraform, create the S3 bucket and DynamoDB table for state:

```bash
# Create S3 bucket for Terraform state
aws s3api create-bucket \
  --bucket rentmate-terraform-state \
  --region us-east-1

# Enable versioning
aws s3api put-bucket-versioning \
  --bucket rentmate-terraform-state \
  --versioning-configuration Status=Enabled

# Create DynamoDB table for state locking
aws dynamodb create-table \
  --table-name rentmate-terraform-locks \
  --attribute-definitions AttributeName=LockID,AttributeType=S \
  --key-schema AttributeName=LockID,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region us-east-1
```

---

## Step 5: Deploy Infrastructure

```bash
cd rental-roommate-finder/terraform

# Initialize (downloads providers, connects to S3 backend)
terraform init

# Plan staging
terraform plan -var-file=environments/staging.tfvars -var="db_password=YourStagingPass123"

# Apply staging
terraform apply -var-file=environments/staging.tfvars -var="db_password=YourStagingPass123"

# Apply production (after staging works)
terraform apply -var-file=environments/prod.tfvars -var="db_password=YourProdPass456"
```

---

## Step 6: Configure kubectl for EKS

```bash
# Update kubeconfig for staging cluster
aws eks update-kubeconfig --name rental-staging-cluster --region us-east-1

# Update kubeconfig for production cluster
aws eks update-kubeconfig --name rental-prod-cluster --region us-east-1

# Verify connection
kubectl get nodes
```

---

## Step 7: Apply Kubernetes Manifests

```bash
cd rental-roommate-finder/k8s

# Apply all manifests in order
kubectl apply -f 00-namespace-configmap.yaml
kubectl apply -f 01-secrets.yaml
kubectl apply -f 02-postgres.yaml
kubectl apply -f 03-infra-redis-rabbitmq-kafka.yaml
kubectl apply -f 04-services.yaml
kubectl apply -f 05-ingress.yaml
kubectl apply -f 06-network-policy.yaml
kubectl apply -f 07-pdb-external-secrets.yaml

# OR apply all at once
kubectl apply -f .

# Verify pods are running
kubectl get pods -n rentmate
```

---

## Workflow Triggers Reference

| Workflow | Trigger Condition |
|---|---|
| `ci-testing.yml` | PR opened/updated to `main` or `develop` (backend/frontend changes) |
| `pr-validation.yml` | PR opened/updated to `main` or `develop` (backend/frontend changes) |
| `cd-staging.yml` | Push/merge to `main` (backend/frontend/k8s changes) |
| `cd-production.yml` | Push/merge to `main` (backend/frontend/k8s changes) |
| `terraform-cicd.yml` | PR or push to `main` (terraform/ changes only) |

---

## Docker Hub Image Naming

Images are pushed to Docker Hub with this naming convention:

```
{DOCKERHUB_USERNAME}/rentmate-{service}:{git-sha}
{DOCKERHUB_USERNAME}/rentmate-{service}:latest
```

Example:
```
manikant/rentmate-auth-service:abc123
manikant/rentmate-auth-service:latest
manikant/rentmate-frontend:abc123
```

Services: `auth-service`, `listing-service`, `roommate-service`, `notification-service`, `api-gateway`, `frontend`

---

## Environment Variables Reference

See `.env.example` for the full list. Key variables:

```bash
# JWT
JWT_SECRET=your-super-secret-jwt-key-min-32-chars
JWT_REFRESH_SECRET=your-refresh-secret-key-min-32-chars

# AWS
AWS_S3_BUCKET=rental-listings-images
AWS_REGION=us-east-1

# Email (SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
```

---

## Troubleshooting

### Workflow fails on AWS credentials
- Check `AWS_*_ROLE_ARN` secrets are set correctly
- Verify the OIDC provider was created in AWS (check `iam-oidc.tf` was applied)
- Ensure the IAM role trust policy includes your repo: `repo:manikant-git/Rental_roomate_production:*`

### kubectl deploy fails - pods pending
- Check node group is running: `kubectl get nodes`
- Check pod events: `kubectl describe pod {pod-name} -n rentmate`
- Check resource limits vs node capacity

### Terraform state lock error
- Check DynamoDB table exists: `aws dynamodb list-tables`
- Force unlock if needed: `terraform force-unlock {LOCK_ID}`
