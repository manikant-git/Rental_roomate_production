provider "aws" {
  region = var.aws_region
}

# --- VPC & Networking ---
module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "~> 5.0"  # vpc module 5.x is compatible with AWS provider 5.x

  name = "rental-production-vpc"
  cidr = "10.0.0.0/16"

  azs             = ["us-east-1a", "us-east-1b", "us-east-1c"]
  private_subnets = ["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"]
  public_subnets  = ["10.0.101.0/24", "10.0.102.0/24", "10.0.103.0/24"]

  enable_nat_gateway = true
  single_nat_gateway = false  # High Availability - one NAT per AZ
  enable_vpn_gateway = false

  tags = {
    Environment = var.environment
    Project     = "rentmate"
  }
}

# --- EKS Cluster ---
module "eks" {
  source  = "terraform-aws-modules/eks/aws"
  version = "~> 19.0"  # v19.x is compatible with AWS provider ~> 5.0
  # v20+ requires AWS provider >= 6.0 - DO NOT upgrade

  cluster_name    = "rental-${var.environment}-cluster"
  cluster_version = "1.31"  # Updated: 1.28 AMI no longer supported by AWS

  vpc_id     = module.vpc.vpc_id
  subnet_ids = module.vpc.private_subnets

  cluster_endpoint_public_access = true

  eks_managed_node_groups = {
    general = {
      desired_size = var.node_desired_count
      min_size     = var.node_min_count
      max_size     = var.node_max_count

      instance_types = [var.node_instance_type]
      capacity_type  = "ON_DEMAND"
    }
  }

  tags = {
    Environment = var.environment
    Project     = "rentmate"
  }
}

# --- Production RDS (PostgreSQL) ---
resource "aws_db_instance" "postgres" {
  allocated_storage    = 20
  engine               = "postgres"
  engine_version       = "15.8"  # Fixed: 15.4 not available in us-east-1
  instance_class       = var.db_instance_class
  db_name              = "rental_db"
  username             = "rental_admin"
  password             = var.db_password
  parameter_group_name = "default.postgres15"  # Works for all 15.x versions
  skip_final_snapshot  = true

  db_subnet_group_name   = aws_db_subnet_group.default.name
  vpc_security_group_ids = [aws_security_group.rds_sg.id]

  multi_az = var.environment == "production" ? true : false

  tags = {
    Environment = var.environment
    Project     = "rentmate"
  }
}

resource "aws_db_subnet_group" "default" {
  name       = "rentmate-${var.environment}-subnet-group"
  subnet_ids = module.vpc.private_subnets
}

resource "aws_security_group" "rds_sg" {
  name   = "rentmate-${var.environment}-rds-sg"
  vpc_id = module.vpc.vpc_id

  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [module.eks.node_security_group_id]
    description     = "Allow PostgreSQL from EKS nodes only"
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# --- ECR Repositories ---
resource "aws_ecr_repository" "backend" {
  name                 = "rentmate-${var.environment}-backend"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = {
    Environment = var.environment
    Project     = "rentmate"
  }
}

resource "aws_ecr_repository" "frontend" {
  name                 = "rentmate-${var.environment}-frontend"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = {
    Environment = var.environment
    Project     = "rentmate"
  }
}
