terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  backend "s3" {
    bucket         = "dentacrm-terraform-state"
    key            = "analysis/terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "dentacrm-terraform-lock"
    encrypt        = true
  }
}

provider "aws" {
  region = "ap-south-1"
  alias  = "ap_south_1"
}

provider "aws" {
  region = "us-east-1"
  alias  = "us_east_1"
}

# --- ECR Repository (ap-south-1) ---
resource "aws_ecr_repository" "analysis_frontend" {
  provider             = aws.ap_south_1
  name                 = "analysis-frontend"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = {
    Project   = "stock-analysis"
    Terraform = "true"
  }
}

resource "aws_ecr_lifecycle_policy" "analysis_frontend" {
  provider   = aws.ap_south_1
  repository = aws_ecr_repository.analysis_frontend.name

  policy = jsonencode({
    rules = [{
      rulePriority = 1
      description  = "Keep last 10 images"
      selection = {
        tagStatus   = "any"
        countType   = "imageCountMoreThan"
        countNumber = 10
      }
      action = { type = "expire" }
    }]
  })
}

# --- Route53 A Record ---
data "aws_route53_zone" "main" {
  provider = aws.us_east_1
  zone_id  = "Z01213603PUH8MLSQUY6J"
}

resource "aws_route53_record" "analysis" {
  provider = aws.us_east_1
  zone_id  = data.aws_route53_zone.main.zone_id
  name     = "analysis.geekzlabs.com"
  type     = "A"
  ttl      = 300
  records  = ["43.205.152.73"]
}

# --- Outputs ---
output "ecr_repository_url" {
  value = aws_ecr_repository.analysis_frontend.repository_url
}

output "domain" {
  value = aws_route53_record.analysis.name
}
