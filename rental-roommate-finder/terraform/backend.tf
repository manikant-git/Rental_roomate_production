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
      version = "~> 5.0"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.23"
    }
  }

  # S3 backend — state file stored here, NOT on local machine
  # Every engineer on the team reads/writes to this same file
  backend "s3" {
    bucket         = "rentmate-terraform-state-prod"  # create this bucket first
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
# Run these AWS CLI commands BEFORE running terraform init
# =============================================================
#
# aws s3api create-bucket \
#   --bucket rentmate-terraform-state-prod \
#   --region us-east-1
#
# aws s3api put-bucket-versioning \
#   --bucket rentmate-terraform-state-prod \
#   --versioning-configuration Status=Enabled
#
# aws s3api put-bucket-encryption \
#   --bucket rentmate-terraform-state-prod \
#   --server-side-encryption-configuration \
#   '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}'
#
# aws dynamodb create-table \
#   --table-name rentmate-terraform-locks \
#   --attribute-definitions AttributeName=LockID,AttributeType=S \
#   --key-schema AttributeName=LockID,KeyType=HASH \
#   --billing-mode PAY_PER_REQUEST \
#   --region us-east-1
