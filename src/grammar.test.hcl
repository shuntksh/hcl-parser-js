/*
 * HCL Parser Test Cases
 * Each block/section tests specific syntax features in focused, minimal examples
 */

/* One Line Block */
variable "online" { type = bool }

variable "number_var" {  # Inline comment at end of line
  type = number
  default = 8080
}

#Inline_comment_without_space
variable "tuple_var" {
  type = list(string)
  default = /*comment_without_space*/ ["item1", "item2", "item3"]
}

variable "string_var" {
  type    = string
  default = "vpc-123456"
}

variable "dictionary_var" {
  type = map(string)
  default = {
    Environment = "test"
    Managed_by  = "terraform"
  }
}

# Basic attribute types
data "data" "basic_types" {
  string_val = "simple string"
  number_val = 42
  bool_val   = true
  null_val   = null
}

# String interpolation and heredoc
data "data" "string_expressions" {
  # Simple interpolation
  interpolated = "Hello, ${var.name}!"
  
  # Heredoc with interpolation
  multiline = <<-EOT
    Server: ${var.hostname}
    Port: ${var.port}
    Active: ${true}
  EOT

  # Heredoc without indent stripping
  raw_heredoc = <<EOT
    Keep this indentation
      exactly as is
    EOT
}

# Complex expressions and operators
data "data" "expressions" {
  # Conditional operator
  conditional = var.environment == "prod" ? 5 : 1
  
  # Binary operators
  arithmetic = (10 * 5) + (20 / 2)
  comparison = 5 > (3 && 2 <= 4)
  
  # Unary operators
  negation = !false
  negative = -42
}

# Collection types
data "data" "collections" {
  # Simple tuple
  simple_list = ["a", "b", "c"]
  
  # Mixed type tuple
  mixed_tuple = [1, "two", true]
  
  # Simple object
  simple_map = {
    key1 = "value1"
    key2 = "value2"
  }
}

# For expressions
locals {
  # Tuple for expression
  tuple_transform = [
    for item in var.tuple_var:
    upper(item)
    if item != ""
  ]
  
  # Object for expression
  object_transform = {
    for k, v in var.dictionary_var:
    k => upper(v)
    if v != null
  }
}

# Nested blocks with labels
resource "aws_security_group" "test" {
  # Multiple attributes
  name        = "test-sg"
  description = "Test security group"
  vpc_id      = var.string_var
  # Empty line



  # Multiple nested blocks
  ingress {
    from_port = 80
    to_port   = 80
    protocol  = "tcp"
  }

  ingress {
    from_port = 443
    to_port   = 443
    protocol  = "tcp"
  }
}

# Dynamic blocks
resource "aws_autoscaling_group" "test" {
  name = "test-asg"
  
  min_size = 1
  max_size = 10

  dynamic "tag" {
    for_each = var.dictionary_var
    content {
      key   = tag.key
      value = tag.value
      propagate_at_launch = true
    }
  }
}

# Function calls
locals {
  # Basic function calls
  timestamp = timestamp()
  upper     = upper("test")
  
  # Nested function calls
  encoded = base64encode(jsonencode({
    foo = "bar"
    baz = 123
  }))
}

# Splat expressions
locals {
  # Attribute splat
  instance_ids = aws_instance.test.*.id
  
  # Full splat
  public_ips = [for i in aws_instance.test: i.public_ip]
}
