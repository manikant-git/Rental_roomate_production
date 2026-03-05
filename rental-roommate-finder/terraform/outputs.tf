# ================================================================
# TERRAFORM OUTPUTS
# Expose key infrastructure values for CI/CD and K8s configuration
# ================================================================

output "vpc_id" {
  description = "The ID of the production VPC"
  value       = module.vpc.vpc_id
}

output "private_subnet_ids" {
  description = "Private subnet IDs for EKS and RDS"
  value       = module.vpc.private_subnet_ids
}

output "public_subnet_ids" {
  description = "Public subnet IDs for Load Balancers"
  value       = module.vpc.public_subnet_ids
}

output "eks_cluster_name" {
  description = "EKS cluster name"
  value       = module.eks.cluster_name
}

output "eks_cluster_endpoint" {
  description = "EKS cluster API endpoint"
  value       = module.eks.cluster_endpoint
feat: add terraform outputs for CI/CD pipeline and K8s integration}

output "eks_oidc_provider_arn" {
  description = "OIDC provider ARN for IRSA"
  value       = module.eks.oidc_provider_arn
}

output "rds_endpoint" {
  description = "RDS instance endpoint"
  value       = module.rds.db_endpoint
  sensitive   = true
}

output "db_secret_arn" {
  description = "ARN of the database credentials in Secrets Manager"
  value       = module.rds.secret_arn
}

output "eso_role_arn" {
  description = "IAM role ARN for External Secrets Operator"
  value       = module.eks.eso_role_arn
}
