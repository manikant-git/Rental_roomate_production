# =============================================================
# STAGING ENVIRONMENT VALUES
# Usage: terraform apply -var-file=environments/staging.tfvars
# =============================================================

aws_region  = "us-east-1"
environment = "staging"

cluster_name    = "rental-staging-cluster"
cluster_version = "1.29"

# Separate CIDR from production to avoid overlap
vpc_cidr           = "10.1.0.0/16"
private_subnets    = ["10.1.1.0/24", "10.1.2.0/24", "10.1.3.0/24"]
public_subnets     = ["10.1.101.0/24", "10.1.102.0/24", "10.1.103.0/24"]
availability_zones = ["us-east-1a", "us-east-1b", "us-east-1c"]

# Node group - smaller + SPOT instances for cost saving
node_instance_type = "t3.medium"
node_desired_count = 2
node_min_count     = 1
node_max_count     = 4
node_capacity_type = "SPOT"

# RDS - no HA in staging
db_instance_class        = "db.t3.micro"
db_multi_az              = false
db_backup_retention_days = 3

github_org  = "manikant-git"
github_repo = "Rental_roomate_production"

tags = {
  Project     = "rentmate"
  Environment = "staging"
  ManagedBy   = "terraform"
  Team        = "devops"
  CostCenter  = "engineering-nonprod"
}
