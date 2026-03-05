# Project Setup & Configuration Guide

This document outlines the prerequisites, configurations, and secrets required to run and deploy the RentMate Production project.

## 🛠 Prerequisites

### Local Development
- **Node.js**: v20.x (LTS)
- **Docker**: Desktop or Engine (for containerization)
- **AWS CLI**: Configured with appropriate IAM permissions
- **Terraform**: v1.5+ (for Infrastructure as Code)
- **kubectl**: For managing the EKS cluster

### Cloud Services
- **AWS Account**: With permissions to manage EKS, EC2, S3, and IAM.
- **GitHub Account**: For CI/CD and GHCR (GitHub Container Registry).
- **Slack**: For deployment notifications (optional).

## 🔐 Configuration & Secrets

### GitHub Actions Secrets
The following secrets must be configured in your GitHub repository (**Settings > Secrets and variables > Actions**):

| Secret Name | Description |
| ----------- | ----------- |
| `AWS_STAGING_ROLE_ARN` | IAM Role ARN for Staging OIDC authentication |
| `AWS_PROD_ROLE_ARN` | IAM Role ARN for Production OIDC authentication |
| `SLACK_WEBHOOK_URL` | Webhook URL for Slack deployment notifications |

### Environment Variables (.env)
Copy `rental-roommate-finder/.env.example` to `.env` and fill in the values:

- `DATABASE_URL`: PostgreSQL connection string.
- `REDIS_URL`: Redis connection string.
- `JWT_SECRET`: Secret key for token signing.
- `NODE_ENV`: `development`, `test`, or `production`.

## 🚀 OIDC Authentication Setup
This project uses **GitHub Actions OIDC** to authenticate with AWS without long-lived keys.
1. Create an IAM Identity Provider for `token.actions.githubusercontent.com`.
2. Create IAM Roles for Staging/Production with trust relationships for your repository.
3. Assign necessary permissions (AmazonEKSClusterPolicy, etc.) to these roles.

## 📦 Infrastructure Configuration (Terraform)
Navigate to `rental-roommate-finder/terraform` to manage cloud resources.
Ensure you have a backend configured (e.g., S3 bucket) for storing the Terraform state file.
