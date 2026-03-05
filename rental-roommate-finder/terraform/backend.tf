# =============================================================
# TERRAFORM BACKEND CONFIGURATION
# Real org standard: Remote state in S3 + DynamoDB lock
# WHY: Prevents two engineers running terraform apply at same
#      time and corrupting the state file
# =============================================================

terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"   # allows 5.x only - compatible with EKS module
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.23"
    }
  }

  # S3 backend - state file stored here, NOT on local machine
  # Every engineer on the team reads/writes to this same file
  backend "s3" {
    bucket         = "rentmate-terraform-state-prod"  # created by bootstrap.sh
    key            = "rentmate/eks/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true  # AES-256 encryption at rest

    # DynamoDB table for state locking
    # Prevents simultaneous applies from two people/pipelines
    dynamodb_table = "rentmate-terraform-locks"
  }
}

# =============================================================
# HOW TO CREATE THE S3 BUCKET AND DYNAMODB TABLE (one time)
# Run bootstrap.sh script BEFORE running terraform init:
#   chmod +x scripts/bootstrap.sh
#   ./scripts/bootstrap.sh
# =============================================================
