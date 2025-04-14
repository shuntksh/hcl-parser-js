import { describe, expect, test } from "bun:test";
import { parse } from "../parser";
import { stringify } from "../stringify";

describe("HCL Roundtrip Tests", () => {
	/**
	 * Helper function to test the roundtrip: parse -> stringify -> parse
	 * Verifies that the AST remains equivalent after the roundtrip
	 */
	function testRoundtrip(hcl: string, description: string) {
		test(description, () => {
			// First parse to get the initial AST
			const ast1 = parse(hcl);

			// Stringify the AST back to HCL
			const serialized = stringify(ast1);

			// Parse the stringified HCL to get a new AST
			const ast2 = parse(serialized);

			expect(ast1).toEqual(ast2);

			// Optional: Log the original and serialized HCL for debugging
			// console.log("Original:", hcl);
			// console.log("Serialized:", serialized);
		});
	}

	describe("Basic Attributes", () => {
		// Simple attribute examples from schema.test.ts
		testRoundtrip('attr = "hello"', "string attribute");
		testRoundtrip("attr = 1", "number attribute");
		testRoundtrip("attr = true", "boolean true attribute");
		testRoundtrip("attr = false", "boolean false attribute");
		testRoundtrip("attr = null", "null attribute");
	});

	describe("Collections", () => {
		// Collection examples from schema.test.ts
		testRoundtrip("attr = [1, 2, 3]", "tuple attribute");
		testRoundtrip("attr = { a = 1, b = 2, c = 3 }", "object attribute");
		testRoundtrip("attr = []", "empty tuple");
		testRoundtrip("attr = {}", "empty object");
	});

	describe("Blocks", () => {
		// Block examples from schema.test.ts
		testRoundtrip(
			'resource "aws_instance" "web" { attr = "value" }',
			"one line block",
		);
		testRoundtrip('resource "aws_instance" "web" {}', "empty block");
		testRoundtrip(
			`resource "aws_instance" "web" {
  network_interface {
    network_id = "net-123"
  }
}`,
			"nested block",
		);
	});

	describe("Templates", () => {
		// Template examples from schema.test.ts
		testRoundtrip('attr = "Hello, ${var.name}!"', "string interpolation");
		testRoundtrip(
			`attr = <<EOF
hello
EOF`,
			"heredoc template",
		);
		testRoundtrip(
			`attr = <<-EOF
  hello
  world
EOF`,
			"indented heredoc template",
		);
	});

	describe("Function Calls", () => {
		// Function call examples from schema.test.ts
		testRoundtrip("attr = call(a,b,c)", "function call with arguments");
		testRoundtrip("attr = call()", "function call without arguments");
	});

	describe("Expressions", () => {
		// Expression examples from parser.test.ts and schema.test.ts
		testRoundtrip("x = 2 + 3 * 4", "multiplicative and additive operators");
		testRoundtrip("x = 5 > 2 + 3", "comparison and additive operators");
		testRoundtrip("x = 1 == 5 > 3", "equality and comparison operators");
		testRoundtrip("x = true ? 1 : 2", "conditional expression");
		testRoundtrip("x = (1 + 2) * 3", "parenthesized expression");
		testRoundtrip("x = -5", "unary minus");
		testRoundtrip("x = !true", "unary not");
	});

	describe("Multiple Attributes", () => {
		// Multiple attributes example from schema.test.ts
		testRoundtrip(
			`attr = 1
attr2 = [1,2,3]`,
			"multiple attributes",
		);
	});

	describe("Complex Examples", () => {
		// More complex examples combining multiple features
		testRoundtrip(
			`resource "aws_instance" "web" {
  ami           = "ami-a1b2c3d4"
  instance_type = var.instance_type
  count         = 2

  tags = {
    Name = "HelloWorld-\${count.index}"
  }
}\n`,
			"AWS instance resource",
		);

		testRoundtrip(
			`locals {
  common_tags = {
    Environment = var.environment
    Project     = var.project_name
  }
  
  instance_tags = merge(
    local.common_tags,
    "instance-\${var.environment}"
  )
}`,
			"locals with merge function",
		);
	});

	describe("Operator Precedence", () => {
		// Additional operator precedence tests
		testRoundtrip("x = 1 + (2 - 3)", "additive operators");
		testRoundtrip("x = 1 * (2 / 3)", "multiplicative operators");
		testRoundtrip("x = 1 < (2 && (3 > 4))", "comparison and logical operators");
		testRoundtrip("x = (1 + 2) * (3 - 4)", "complex parenthesized expression");
		testRoundtrip("x = a || (b && c)", "logical OR and AND with precedence");
	});

	describe("Index and Attribute Access", () => {
		// Index and attribute access examples
		testRoundtrip("x = foo[0]", "index access");
		testRoundtrip("x = foo.bar", "attribute access");
		testRoundtrip("x = foo[0].bar", "index then attribute access");
		testRoundtrip("x = foo.bar[0]", "attribute then index access");
	});

	describe("For Expressions", () => {
		// For expression examples
		testRoundtrip("x = [for i in range(3): i]", "for expression in tuple");
		testRoundtrip("x = {for k, v in map: k => v}", "for expression in object");
		testRoundtrip(
			"x = [for i in range(3): i if i > 0]",
			"for expression with condition",
		);
	});
});
