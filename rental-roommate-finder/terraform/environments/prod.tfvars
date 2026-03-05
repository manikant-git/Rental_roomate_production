# =============================================================
# PRODUCTION ENVIRONMENT VALUES
# Usage: terraform apply -var-file=environments/prod.tfvars
# =============================================================

aws_region  = "us-east-1"
environment = "production"

cluster_name    = "rental-prod-cluster"
cluster_version = "1.29"

# Separate CIDR from staging to avoid overlap
vpc_cidr           = "10.0.0.0/16"
private_subnets    = ["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"]
public_subnets     = ["10.0.101.0/24", "10.0.102.0/24", "10.0.103.0/24"]
availability_zones = ["us-east-1a", "us-east-1b", "us-east-1c"]

# Node group - larger ON_DEMAND (NEVER SPOT in production)
node_instance_type = "t3.large"
node_desired_count = 3
node_min_count     = 2
node_max_count     = 10
node_capacity_type = "ON_DEMAND"

# RDS - full HA, larger, 30-day backup for compliance
db_instance_class        = "db.t3.medium"
db_multi_az              = true
db_backup_retention_days = 30

github_org  = "manikant-git"
github_repo = "Rental_roomate_production"

tags = {
  Project     = "rentmate"
  Environment = "production"
  ManagedBy   = "terraform"
  Team        = "devops"
  CostCenter  = "engineering-prod"
}
