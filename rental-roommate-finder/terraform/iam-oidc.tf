# =============================================================
# GITHUB ACTIONS OIDC + IAM ROLES
# Real org standard: No long-lived access keys EVER
# GitHub Actions assumes role via OIDC token (temporary creds)
# =============================================================

data "aws_caller_identity" "current" {}

# -------------------------------------------------------
# OIDC Provider for GitHub Actions
# Created ONCE per AWS account, shared across all repos
# -------------------------------------------------------
resource "aws_iam_openid_connect_provider" "github" {
  url = "https://token.actions.githubusercontent.com"

  client_id_list = ["sts.amazonaws.com"]

  # GitHub's OIDC thumbprint (stable, rarely changes)
  thumbprint_list = ["6938fd4d98bab03faadb97b34396831e3780aea1"]

  tags = merge(var.tags, {
    Name = "github-actions-oidc"
  })
}

# -------------------------------------------------------
# IAM Role: GitHub Actions — STAGING
# Only triggers from develop branch
# -------------------------------------------------------
resource "aws_iam_role" "github_staging" {
  name = "github-actions-staging-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Principal = {
        Federated = aws_iam_openid_connect_provider.github.arn
      }
      Action = "sts:AssumeRoleWithWebIdentity"
      Condition = {
        StringEquals = {
          "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com"
        }
        StringLike = {
          # Only develop branch can assume this role
          "token.actions.githubusercontent.com:sub" = "repo:${var.github_org}/${var.github_repo}:ref:refs/heads/develop"
        }
      }
    }]
  })

  tags = merge(var.tags, {
    Name        = "github-actions-staging"
    Environment = "staging"
  })
}

# -------------------------------------------------------
# IAM Role: GitHub Actions — PRODUCTION
# Only triggers from main branch
# -------------------------------------------------------
resource "aws_iam_role" "github_production" {
  name = "github-actions-production-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Principal = {
        Federated = aws_iam_openid_connect_provider.github.arn
      }
      Action = "sts:AssumeRoleWithWebIdentity"
      Condition = {
        StringEquals = {
          "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com"
        }
        StringLike = {
          # Only main branch can assume this role
          "token.actions.githubusercontent.com:sub" = "repo:${var.github_org}/${var.github_repo}:ref:refs/heads/main"
        }
      }
    }]
  })

  tags = merge(var.tags, {
    Name        = "github-actions-production"
    Environment = "production"
  })
}

# -------------------------------------------------------
# Policy: EKS Deploy Permissions
# Minimal permissions — least privilege principle
# -------------------------------------------------------
resource "aws_iam_policy" "eks_deploy" {
  name        = "rentmate-eks-deploy-policy"
  description = "Permissions for GitHub Actions to deploy to EKS"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "EKSAccess"
        Effect = "Allow"
        Action = [
          "eks:DescribeCluster",
          "eks:ListClusters",
          "eks:AccessKubernetesApi"
        ]
        Resource = "*"
      },
      {
        Sid    = "ECRAccess"
        Effect = "Allow"
        Action = [
          "ecr:GetAuthorizationToken",
          "ecr:BatchCheckLayerAvailability",
          "ecr:GetDownloadUrlForLayer",
          "ecr:BatchGetImage"
        ]
        Resource = "*"
      }
    ]
  })
}

# Attach policy to staging role
resource "aws_iam_role_policy_attachment" "staging_eks" {
  role       = aws_iam_role.github_staging.name
  policy_arn = aws_iam_policy.eks_deploy.arn
}

# Attach policy to production role
resource "aws_iam_role_policy_attachment" "production_eks" {
  role       = aws_iam_role.github_production.name
  policy_arn = aws_iam_policy.eks_deploy.arn
}
