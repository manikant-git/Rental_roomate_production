# Rental Roommate Finder - CI/CD Project Setup Guide

## Overview
This project uses **GitHub Actions** for CI/CD with **Docker Hub** as the container registry and **AWS EKS** for Kubernetes deployment.

---

## Workflow Files Structure

```
.github/workflows/
├── pr-validation.yml      # Triggered on PR to main/develop → Lint, Test, Docker build validate
├── ci-testing.yml         # Triggered on PR → Unit tests + quality gate (matrix per service)
├── cd-staging.yml         # Triggered on push to develop → Build & push :staging tag to Docker Hub → Deploy to EKS staging
└── cd-production.yml      # Triggered on push to main → Build & push :sha + :latest to Docker Hub → Deploy to EKS prod
```

---

## Pipeline Flow (End to End)

```
Developer creates PR
        │
        ▼
pr-validation.yml + ci-testing.yml
  ├─ Lint all services
  ├─ Unit tests (matrix)
  └─ Docker build validate (no push)
        │
   PR Merged to develop
        │
        ▼
cd-staging.yml
  ├─ Login to Docker Hub
  ├─ Build images → push as :staging tag
  ├─ Update EKS kubeconfig (OIDC)
  └─ kubectl deploy → verify rollout
        │
   PR Merged to main
        │
        ▼
cd-production.yml
  ├─ Login to Docker Hub
  ├─ Build images → push :sha + :latest
  ├─ Update EKS kubeconfig (OIDC)
  ├─ kubectl deploy with SHA-pinned image
  ├─ Verify rollout
  └─ Auto-rollback on failure
```

---

## Docker Hub Image Tags

| Environment | Image Tag Format                              | Example                              |
|-------------|-----------------------------------------------|--------------------------------------|
| PR          | `username/rentmate-svc:pr-{PR_NUMBER}`        | `manikant/rentmate-auth-service:pr-12` |
| Staging     | `username/rentmate-svc:staging`               | `manikant/rentmate-auth-service:staging` |
| Production  | `username/rentmate-svc:{github.sha}`          | `manikant/rentmate-auth-service:abc1234` |
| Production  | `username/rentmate-svc:latest`                | `manikant/rentmate-auth-service:latest` |

---

## GitHub Secrets Required

Go to: **GitHub Repo → Settings → Secrets and variables → Actions → New repository secret**

### Docker Hub Secrets
| Secret Name           | Value                                      | Where to get |
|-----------------------|--------------------------------------------|--------------|
| `DOCKERHUB_USERNAME`  | Your Docker Hub username                   | hub.docker.com |
| `DOCKERHUB_TOKEN`     | Docker Hub Access Token (not password)     | hub.docker.com → Account Settings → Security → Access Tokens |

### AWS OIDC Secrets (No long-lived keys)
| Secret Name              | Value                                     | Where to get |
|--------------------------|-------------------------------------------|--------------|
| `AWS_STAGING_ROLE_ARN`   | `arn:aws:iam::ACCOUNT_ID:role/github-staging-role` | AWS IAM → Roles |
| `AWS_PROD_ROLE_ARN`      | `arn:aws:iam::ACCOUNT_ID:role/github-prod-role`    | AWS IAM → Roles |

---

## AWS Prerequisites

### 1. EKS Clusters
```bash
# Staging cluster
eksctl create cluster --name rental-staging-cluster --region us-east-1

# Production cluster
eksctl create cluster --name rental-prod-cluster --region us-east-1
```

### 2. GitHub OIDC Provider in AWS
```bash
# Add GitHub as OIDC provider
aws iam create-open-id-connect-provider \
  --url https://token.actions.githubusercontent.com \
  --client-id-list sts.amazonaws.com
```

### 3. IAM Role for GitHub Actions (example trust policy)
```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": {"Federated": "arn:aws:iam::ACCOUNT_ID:oidc-provider/token.actions.githubusercontent.com"},
    "Action": "sts:AssumeRoleWithWebIdentity",
    "Condition": {
      "StringEquals": {
        "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
        "token.actions.githubusercontent.com:sub": "repo:manikant-git/Rental_roomate_production:ref:refs/heads/main"
      }
    }
  }]
}
```

### 4. IAM Role Permissions Needed
- `eks:DescribeCluster`
- `eks:UpdateClusterConfig`
- `ec2:DescribeInstances`

---

## GitHub Environment Protection Rules

Go to: **Repo → Settings → Environments**

| Environment | Required Reviewers | Deployment Branches |
|-------------|-------------------|--------------------|
| `staging`   | None (auto-deploy) | `develop` only     |
| `production`| Team Lead approval | `main` only        |

---

## Microservices

| Service              | Port | Docker Hub Repo                         |
|----------------------|------|-----------------------------------------|
| auth-service         | 3001 | `{DOCKERHUB_USERNAME}/rentmate-auth-service`         |
| listing-service      | 3002 | `{DOCKERHUB_USERNAME}/rentmate-listing-service`      |
| roommate-service     | 3003 | `{DOCKERHUB_USERNAME}/rentmate-roommate-service`     |
| notification-service | 3004 | `{DOCKERHUB_USERNAME}/rentmate-notification-service` |
| api-gateway          | 8080 | `{DOCKERHUB_USERNAME}/rentmate-api-gateway`          |
| frontend             | 3000 | `{DOCKERHUB_USERNAME}/rentmate-frontend`             |
