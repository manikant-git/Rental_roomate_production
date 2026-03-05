# =============================================================
# VARIABLES - Controls all environment differences
# Real org: same code, different values per environment
# Staging uses staging.tfvars, Production uses prod.tfvars
# =============================================================

variable "aws_region" {
  description = "AWS region for all resources"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Environment name (staging or production)"
  type        = string
  validation {
    condition     = contains(["staging", "production"], var.environment)
    error_message = "Environment must be staging or production."
  }
}

variable "cluster_name" {
  description = "EKS cluster name"
  type        = string
}

variable "cluster_version" {
  description = "Kubernetes version"
  type        = string
  default     = "1.29"
}

variable "vpc_cidr" {
  description = "VPC CIDR block"
  type        = string
}

variable "private_subnets" {
  description = "Private subnet CIDRs (for EKS nodes, RDS)"
  type        = list(string)
}

variable "public_subnets" {
  description = "Public subnet CIDRs (for Load Balancers)"
  type        = list(string)
}

variable "availability_zones" {
  description = "AZs to spread resources across"
  type        = list(string)
  default     = ["us-east-1a", "us-east-1b", "us-east-1c"]
}

# ---- Node Group Config ----
variable "node_instance_type" {
  description = "EC2 instance type for EKS worker nodes"
  type        = string
  # staging: t3.medium, production: t3.large
}

variable "node_desired_count" {
  description = "Desired number of worker nodes"
  type        = number
}

variable "node_min_count" {
  description = "Minimum worker nodes (for autoscaler)"
  type        = number
}

variable "node_max_count" {
  description = "Maximum worker nodes (for autoscaler)"
  type        = number
}

variable "node_capacity_type" {
  description = "ON_DEMAND or SPOT"
  type        = string
  default     = "ON_DEMAND"
  # staging can use SPOT to save cost
  # production should use ON_DEMAND for stability
}

# ---- RDS Config ----
variable "db_instance_class" {
  description = "RDS instance type"
  type        = string
  # staging: db.t3.micro, production: db.t3.medium
}

variable "db_password" {
  description = "RDS master password"
  type        = string
  sensitive   = true  # never printed in plan output
  # In real org: passed via TF_VAR_db_password env variable
  # or pulled from AWS Secrets Manager
}

variable "db_multi_az" {
  description = "Enable multi-AZ for RDS (production only)"
  type        = bool
  default     = false
}

variable "db_backup_retention_days" {
  description = "RDS backup retention period in days"
  type        = number
  default     = 7
}

# ---- GitHub Actions OIDC ----
variable "github_org" {
  description = "GitHub organization or username"
  type        = string
  default     = "manikant-git"
}

variable "github_repo" {
  description = "GitHub repository name"
  type        = string
  default     = "Rental_roomate_production"
}

# ---- Tags (real org tags everything for cost tracking) ----
variable "tags" {
  description = "Common tags applied to all AWS resources"
  type        = map(string)
  default     = {}
}
