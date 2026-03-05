#!/usr/bin/env bash
# =============================================================
# RentMate - Bootstrap Script (Run ONCE before terraform init)
# Creates S3 bucket + DynamoDB table for Terraform remote state
#
# WHY THIS EXISTS:
#   Terraform cannot create its own backend. The S3 bucket must
#   exist BEFORE terraform init runs. This is a Terraform design
#   limitation - every company solves it with a bootstrap script.
#
# Usage:
#   chmod +x scripts/bootstrap.sh
#   ./scripts/bootstrap.sh
#
# After this script succeeds, run:
#   terraform init
#   terraform apply -var="db_password=YOUR_PASSWORD"
# =============================================================

set -euo pipefail

# ---- Config (must match backend.tf exactly) ----
BUCKET_NAME="rentmate-terraform-state-prod"
DYNAMODB_TABLE="rentmate-terraform-locks"
REGION="us-east-1"

# ---- Colors ----
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m'

echo ""
echo -e "${BLUE}${BOLD}================================================${NC}"
echo -e "${BLUE}${BOLD}  RentMate Terraform Bootstrap${NC}"
echo -e "${BLUE}${BOLD}  Creates S3 + DynamoDB for remote state${NC}"
echo -e "${BLUE}${BOLD}================================================${NC}"
echo ""

# ---- Step 0: Verify AWS CLI is configured ----
echo -e "${BOLD}[0/4] Checking AWS credentials...${NC}"
if ! aws sts get-caller-identity --region "$REGION" &>/dev/null; then
  echo "ERROR: AWS CLI is not configured or no permissions."
  echo "Run: aws configure"
  exit 1
fi
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
echo -e "  ${GREEN}OK${NC} - AWS Account: ${ACCOUNT_ID}, Region: ${REGION}"
echo ""

# ---- Step 1: Create S3 bucket ----
echo -e "${BOLD}[1/4] Creating S3 bucket: ${BUCKET_NAME}${NC}"
if aws s3api head-bucket --bucket "$BUCKET_NAME" --region "$REGION" 2>/dev/null; then
  echo -e "  ${YELLOW}SKIP${NC} - Bucket already exists. Nothing to do."
else
  aws s3api create-bucket \
    --bucket "$BUCKET_NAME" \
    --region "$REGION"
  echo -e "  ${GREEN}CREATED${NC} - S3 bucket: ${BUCKET_NAME}"
fi
echo ""

# ---- Step 2: Enable versioning ----
echo -e "${BOLD}[2/4] Enabling versioning on S3 bucket...${NC}"
aws s3api put-bucket-versioning \
  --bucket "$BUCKET_NAME" \
  --versioning-configuration Status=Enabled
echo -e "  ${GREEN}OK${NC} - Versioning enabled (state history is protected)"
echo ""

# ---- Step 3: Enable AES-256 encryption ----
echo -e "${BOLD}[3/4] Enabling AES-256 encryption on S3 bucket...${NC}"
aws s3api put-bucket-encryption \
  --bucket "$BUCKET_NAME" \
  --server-side-encryption-configuration \
  '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}'
echo -e "  ${GREEN}OK${NC} - Encryption enabled (state file is encrypted at rest)"
echo ""

# ---- Step 4: Create DynamoDB table for state locking ----
echo -e "${BOLD}[4/4] Creating DynamoDB table: ${DYNAMODB_TABLE}${NC}"
if aws dynamodb describe-table --table-name "$DYNAMODB_TABLE" --region "$REGION" &>/dev/null; then
  echo -e "  ${YELLOW}SKIP${NC} - DynamoDB table already exists. Nothing to do."
else
  aws dynamodb create-table \
    --table-name "$DYNAMODB_TABLE" \
    --attribute-definitions AttributeName=LockID,AttributeType=S \
    --key-schema AttributeName=LockID,KeyType=HASH \
    --billing-mode PAY_PER_REQUEST \
    --region "$REGION"

  echo -e "  ${GREEN}CREATED${NC} - DynamoDB table: ${DYNAMODB_TABLE}"
  echo -e "  ${BLUE}INFO${NC}   - Waiting for table to become active..."
  aws dynamodb wait table-exists \
    --table-name "$DYNAMODB_TABLE" \
    --region "$REGION"
  echo -e "  ${GREEN}OK${NC} - DynamoDB table is active"
fi
echo ""

# ---- Done ----
echo -e "${GREEN}${BOLD}================================================${NC}"
echo -e "${GREEN}${BOLD}  Bootstrap complete! Run terraform now:${NC}"
echo -e "${GREEN}${BOLD}================================================${NC}"
echo ""
echo -e "  cd rental-roommate-finder/terraform"
echo -e "  terraform init"
echo -e "  terraform apply -var=\"db_password=YOUR_SECURE_PASSWORD\""
echo ""
echo -e "${BLUE}NOTE:${NC} This script is safe to run multiple times."
echo -e "      If bucket/table already exists, it skips creation."
echo ""
