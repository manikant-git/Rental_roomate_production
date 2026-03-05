# ================================================================
# RDS PRODUCTION MODULE
# Multi-AZ PostgreSQL with automated backups, encryption at rest
# ================================================================

resource "aws_db_subnet_group" "main" {
  name       = "${var.identifier}-subnet-group"
  subnet_ids = var.private_subnet_ids
  tags       = merge(var.tags, { Name = "${var.identifier}-subnet-group" })
}

resource "aws_security_group" "rds" {
  name   = "${var.identifier}-rds-sg"
  vpc_id = var.vpc_id

  ingress {
    description     = "PostgreSQL from EKS nodes only"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = var.allowed_security_group_ids
  }

  tags = merge(var.tags, { Name = "${var.identifier}-rds-sg" })
}

resource "aws_db_parameter_group" "postgres" {
  name   = "${var.identifier}-postgres15"
  family = "postgres15"

  parameter {
    name  = "log_connections"
    value = "1"
  }
  parameter {
    name  = "log_disconnections"
    value = "1"
  }
  parameter {
    name  = "log_min_duration_statement"
    value = "1000"
  }
}

resource "aws_db_instance" "postgres" {
  identifier        = var.identifier
  engine            = "postgres"
  engine_version    = "15.4"
  instance_class    = var.instance_class
  allocated_storage = var.allocated_storage
  storage_type      = "gp3"
  storage_encrypted = true # Encryption at Rest

  db_name  = var.db_name
  username = var.db_username
  password = var.db_password

  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.rds.id]
  parameter_group_name   = aws_db_parameter_group.postgres.name

  multi_az               = true  # High Availability - automatic failover
  publicly_accessible    = false # Never expose DB to internet

  backup_retention_period = 7       # 7-day automated backups
  backup_window           = "02:00-04:00"
  maintenance_window      = "sun:04:00-sun:06:00"

  deletion_protection      = true  # Prevent accidental deletion
  skip_final_snapshot      = false
  final_snapshot_identifier = "${var.identifier}-final-snapshot"

  performance_insights_enabled = true
  monitoring_interval          = 60

  tags = var.tags
}

# Store DB credentials in AWS Secrets Manager
resource "aws_secretsmanager_secret" "db" {
  name        = "/${var.environment}/rentmate/database"
  description = "RentMate Production Database Credentials"
  recovery_window_in_days = 7
}

resource "aws_secretsmanager_secret_version" "db" {
  secret_id = aws_secretsmanager_secret.db.id
  secret_string = jsonencode({
    username = var.db_username
    password = var.db_password
    host     = aws_db_instance.postgres.address
    port     = 5432
    dbname   = var.db_name
  })
}
