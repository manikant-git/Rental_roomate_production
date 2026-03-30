# =============================================================
# DEV ENVIRONMENT VALUES
# Usage: terraform apply -var-file=environments/dev.tfvars
# WHY SEPARATE FROM STAGING:
#   - Dev uses smallest/cheapest resources (t3.small, SPOT)
#   - Dev has no HA, no backups - it is disposable
#   - Dev uses separate CIDR to avoid VPC peering conflicts
#   - Dev state is isolated: rentmate/dev/terraform.tfstate
# =============================================================

aws_region  = "us-east-1"
environment = "dev"

cluster_name    = "rental-dev-cluster"
cluster_version = "1.29"

# Separate CIDR from staging (10.1.x) and prod (10.0.x)
vpc_cidr            = "10.2.0.0/16"
private_subnets     = ["10.2.1.0/24", "10.2.2.0/24", "10.2.3.0/24"]
public_subnets      = ["10.2.101.0/24", "10.2.102.0/24", "10.2.103.0/24"]
availability_zones  = ["us-east-1a", "us-east-1b", "us-east-1c"]

# Node group - smallest + SPOT for maximum cost saving in dev
node_instance_type = "t3.small"
node_desired_count = 1
node_min_count     = 1
node_max_count     = 2
node_capacity_type = "SPOT"

# RDS - smallest, no HA, minimal backups in dev (disposable)
db_instance_class        = "db.t3.micro"
db_multi_az              = false
db_backup_retention_days = 1

github_org  = "manikant-git"
github_repo = "Rental_roomate_production"

tags = {
  Project     = "rentmate"
  Environment = "dev"
  ManagedBy   = "terraform"
  Team        = "devops"
  CostCenter  = "engineering-nonprod"
}
