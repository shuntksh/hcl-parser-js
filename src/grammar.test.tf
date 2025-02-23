/*
 * This is a test file for the HCL parser as a sanity check or smoke test
 * It should be valid HCL2 and parse without throwing errors
 * It is not intended to be a comprehensive test of the parser (see tests/)
 * For parsed result, see __snapshots__/hcl-parser.test.ts.snap
 */

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "production"
}

variable "vpc_cidr" {
  type    = string
  default = "10.0.0.0/16"
}

variable "db_config" {
  type = object({
    instance_class    = string
    allocated_storage = number
    multi_az          = bool
    engine_version    = string
  })
  default = {
    instance_class    = "db.t3.medium"
    allocated_storage = 100
    multi_az          = true
    engine_version    = "13.7"
  }
}

# List of availability zones
variable "availability_zones" {
  type    = list(string)
  default = ["us-west-2a", "us-west-2b", "us-west-2c"]
}

# Map of environment-specific tags
variable "environment_tags" {
  type = map(string)
  default = {
    Environment = "Production"
    Terraform   = "true"
    Project     = "MyApp"
  }
}

terraform {
  required_version = ">= 1.0.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 4.0"
    }
  }

  backend "s3" {
    bucket         = "terraform-state-prod"
    key            = "terraform.tfstate"
    region         = "us-west-2"
    dynamodb_table = "terraform-locks"
    encrypt        = true
  }
}

provider "aws" {
  region = "us-west-2"

  default_tags {
    tags = var.environment_tags
  }
}

# VPC Configuration
resource "aws_vpc" "main" {
  cidr_block           = var.vpc_cidr
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name = "main-vpc-${var.environment}"
  }
}

# RDS Database
resource "aws_db_instance" "main" {
  identifier        = "myapp-${var.environment}-db"
  engine            = "postgres"
  engine_version    = var.db_config.engine_version
  instance_class    = var.db_config.instance_class
  allocated_storage = var.db_config.allocated_storage
  storage_encrypted = true

  db_name  = "myappdb"
  username = "dbadmin"

  # Using heredoc for complex string
  password = <<-EOT
		${base64encode("PLACEHOLDER_PASSWORD")}
	EOT

  backup_retention_period = 7
  multi_az                = var.db_config.multi_az
  skip_final_snapshot     = false

  vpc_security_group_ids = [aws_security_group.db.id]
  db_subnet_group_name   = aws_db_subnet_group.main.name
}

# ECS Cluster with dynamic block example
resource "aws_ecs_cluster" "main" {
  name = local.cluster_name

  dynamic "setting" {
    for_each = {
      containerInsights = "enabled"
      capacityProviders = "FARGATE"
    }

    content {
      name  = setting.key
      value = setting.value
    }
  }
}

# Application Load Balancer
resource "aws_lb" "main" {
  name               = "myapp-prod-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = aws_subnet.public[*].id
}

# S3 Bucket for Application Assets
resource "aws_s3_bucket" "assets" {
  bucket = "myapp-prod-assets"
}

resource "aws_s3_bucket_versioning" "assets" {
  bucket = aws_s3_bucket.assets.id
  versioning_configuration {
    status = "Enabled"
  }
}

# CloudWatch Log Group
resource "aws_cloudwatch_log_group" "app" {
  name              = "/ecs/myapp-prod"
  retention_in_days = 30
}

# IAM Role for ECS Tasks
resource "aws_iam_role" "ecs_task_role" {
  name = "myapp-prod-ecs-task-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
      }
    ]
  })
}

# Example of using heredoc for policy document
resource "aws_iam_role_policy" "ecs_task_policy" {
  name = "myapp-ecs-task-policy"
  role = aws_iam_role.ecs_task_role.id

  policy = <<-POLICY
		{
			"Version": "2012-10-17",
			"Statement": [
				{
					"Effect": "Allow",
					"Action": [
						"s3:GetObject",
						"s3:PutObject"
					],
					"Resource": "${aws_s3_bucket.assets.arn}/*"
				}
			]
		}
	POLICY
}

# Route53 DNS Records
resource "aws_route53_record" "app" {
  zone_id = "ZONE_ID_PLACEHOLDER"
  name    = "app.example.com"
  type    = "A"

  alias {
    name                   = aws_lb.main.dns_name
    zone_id                = aws_lb.main.zone_id
    evaluate_target_health = true
  }
}

# Security Group for Application
resource "aws_security_group" "app" {
  name_prefix = "myapp-prod-app"
  vpc_id      = aws_vpc.main.id

  ingress {
    from_port       = 80
    to_port         = 80
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

locals {
  # Complex expression example
  cluster_name = "myapp-${var.environment}-${md5(timestamp())}"

  # Tuple type example
  port_config = [80, 443, 8080]

  # Map with various types
  app_config = {
    is_enabled = true
    count      = 3
    name       = "myapp"
    settings = {
      timeout       = 30
      retries       = 3
      cache_enabled = true
    }
  }
}
