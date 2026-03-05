# =============================================================
# TERRAFORM VARIABLES
# All variables have defaults - no manual prompts during apply
# Override via: terraform apply -var-file=environments/staging.tfvars
# =============================================================

variable "aws_region" {
  description = "AWS region to deploy resources"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Environment name (staging or production)"
  type        = string
  default     = "staging"
  validation {
    condition     = contains(["staging", "production"], var.environment)
    error_message = "Environment must be staging or production."
  }
}

variable "cluster_name" {
  description = "EKS cluster name"
  type        = string
  default     = "rental-staging-cluster"
}

variable "db_password" {
  description = "RDS PostgreSQL master password"
  type        = string
  sensitive   = true
  default     = "ChangeMe123!"
}

variable "db_instance_class" {
  description = "RDS instance type"
  type        = string
  default     = "db.t3.micro"
}

variable "node_instance_type" {
  description = "EC2 instance type for EKS worker nodes"
  type        = string
  default     = "t3.medium"
}

variable "node_desired_count" {
  description = "Desired number of worker nodes"
  type        = number
  default     = 2
}

variable "node_min_count" {
  description = "Minimum worker nodes (for autoscaler)"
  type        = number
  default     = 1
}

variable "node_max_count" {
  description = "Maximum worker nodes (for autoscaler)"
  type        = number
  default     = 4
}

variable "private_subnets" {
  description = "Private subnet CIDRs (for EKS nodes, RDS)"
  type        = list(string)
  default     = ["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"]
}

variable "public_subnets" {
  description = "Public subnet CIDRs (for Load Balancers)"
  type        = list(string)
  default     = ["10.0.101.0/24", "10.0.102.0/24", "10.0.103.0/24"]
}

variable "vpc_cidr" {
  description = "VPC CIDR block"
  type        = string
  default     = "10.0.0.0/16"
}

variable "tags" {
  description = "Common tags applied to all AWS resources"
  type        = map(string)
  default = {
    Project   = "rentmate"
    ManagedBy = "terraform"
    Owner     = "devops"
  }
}

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
