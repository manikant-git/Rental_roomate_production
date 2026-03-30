# =============================================================
# TERRAFORM BACKEND CONFIGURATION - ORG STANDARD
# Real org standard: Remote state in S3 + DynamoDB lock
# WHY: Prevents two engineers running terraform apply at same
#      time and corrupting the state file
#
# KEY FIX: No hardcoded 'key' here.
# The state key is passed per-environment via -backend-config in CI/CD:
#   dev:     -backend-config="key=rentmate/dev/terraform.tfstate"
#   staging: -backend-config="key=rentmate/staging/terraform.tfstate"
#   prod:    -backend-config="key=rentmate/prod/terraform.tfstate"
# This gives each environment ISOLATED state - prod corruption cannot
# affect staging or dev state files.
# =============================================================

terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0" # allows 5.x only - compatible with EKS module
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.23"
    }
  }

  # PARTIAL BACKEND CONFIGURATION
  # Only shared values are here. Environment-specific 'key' is passed
  # at runtime via -backend-config in the CI/CD pipeline.
  # This is the HashiCorp recommended pattern for multi-environment setups.
  backend "s3" {
    bucket         = "rentmate-terraform-state-prod" # shared S3 bucket
    region         = "us-east-1"
    encrypt        = true               # AES-256 encryption at rest
    dynamodb_table = "rentmate-terraform-locks" # state locking table
    # 'key' is intentionally omitted here
    # It is passed per environment in GitHub Actions:
    # terraform init -backend-config="key=rentmate/<env>/terraform.tfstate"
  }
}

# =============================================================
# HOW TO CREATE THE S3 BUCKET AND DYNAMODB TABLE (one time)
# Run bootstrap.sh script BEFORE running terraform init:
#   chmod +x scripts/bootstrap.sh
#   ./scripts/bootstrap.sh
#
# HOW TO INIT LOCALLY PER ENVIRONMENT:
#   Dev:     terraform init -backend-config="key=rentmate/dev/terraform.tfstate"
#   Staging: terraform init -backend-config="key=rentmate/staging/terraform.tfstate"
#   Prod:    terraform init -backend-config="key=rentmate/prod/terraform.tfstate"
# =============================================================
