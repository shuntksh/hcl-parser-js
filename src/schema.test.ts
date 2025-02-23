import { describe, expect, test } from "bun:test";
import { parse } from "./parser";
import type { ConfigFile } from "./types";
describe("zod schema", () => {
	test("should parse an empty block", () => {
		const block = `
		resource "aws_instance" "web" {
		}
		`;
		const parsed = parse(block);
		expect(parsed).toEqual([
			{
				blockType: { type: "Identifier", value: "resource" },
				type: "Block",
				labels: [
					{ type: "StringLiteral", value: "aws_instance" },
					{ type: "StringLiteral", value: "web" },
				],
				bodies: [],
			},
		]);
	});

	describe("template", () => {
		test("should parse a quoted template", () => {
			const block = `
		attr = "hello"
		`;
			const parsed = parse(block);
			expect(parsed).toEqual([
				{
					type: "Attribute",
					name: { type: "Identifier", value: "attr" },
					value: {
						type: "QuotedTemplateExpression",
						parts: [{ type: "TemplateLiteral", value: "hello" }],
					},
				},
			]);
		});

		test("should parse a heredoc template", () => {
			const block = `
		attr = <<EOF
		hello
		EOF
		`;
			const parsed = parse(block);
			expect(parsed).toEqual([
				{
					type: "Attribute",
					name: { type: "Identifier", value: "attr" },
					value: {
						type: "HeredocTemplateExpression",
						marker: { type: "Identifier", value: "EOF" },
						stripIndent: false,
						template: [{ type: "TemplateLiteral", value: "\t\thello" }],
					},
				},
			]);
		});
	});

	describe("collection", () => {
		test("should parse a tuple", () => {
			const block = `
		attr = [1, 2, 3]
		`;
			const parsed = parse(block);
			expect(parsed).toEqual([
				{
					type: "Attribute",
					name: { type: "Identifier", value: "attr" },
					value: {
						type: "TupleValue",
						elements: [
							{ type: "NumberLiteral", value: 1 },
							{ type: "NumberLiteral", value: 2 },
							{ type: "NumberLiteral", value: 3 },
						],
					},
				},
			]);
		});

		test("should parse an object", () => {
			const block = `
		attr = { a = 1, b = 2, c = 3 }
		`;
			const parsed = parse(block);
			expect(parsed).toEqual([
				{
					type: "Attribute",
					name: { type: "Identifier", value: "attr" },
					value: {
						type: "ObjectValue",
						elements: [
							{ key: { type: "Identifier", value: "a" }, value: { type: "NumberLiteral", value: 1 } },
							{ key: { type: "Identifier", value: "b" }, value: { type: "NumberLiteral", value: 2 } },
							{ key: { type: "Identifier", value: "c" }, value: { type: "NumberLiteral", value: 3 } },
						],
					},
				},
			]);
		});
	});

	describe("literals", () => {
		test("should parse boolean true", () => {
			const block = `
			attr = true
			`;
			const parsed = parse(block);
			expect(parsed).toEqual([
				{
					type: "Attribute",
					name: { type: "Identifier", value: "attr" },
					value: { type: "BooleanLiteral", value: true },
				},
			]);
		});

		test("should parse boolean false", () => {
			const block = `
			attr = false
			`;
			const parsed = parse(block);
			expect(parsed).toEqual([
				{
					type: "Attribute",
					name: { type: "Identifier", value: "attr" },
					value: { type: "BooleanLiteral", value: false },
				},
			]);
		});

		test("should parse null", () => {
			const block = `
			attr = null
			`;
			const parsed = parse(block);
			expect(parsed).toEqual([
				{
					type: "Attribute",
					name: { type: "Identifier", value: "attr" },
					value: { type: "NullLiteral", value: null },
				},
			]);
		});
	});

	describe("nested blocks", () => {
		test("should parse nested block", () => {
			const block = `
			resource "aws_instance" "web" {
				network_interface {
					network_id = "net-123"
				}
			}
			`;
			const parsed = parse(block);
			expect(parsed).toEqual([
				{
					type: "Block",
					blockType: { type: "Identifier", value: "resource" },
					labels: [
						{ type: "StringLiteral", value: "aws_instance" },
						{ type: "StringLiteral", value: "web" },
					],
					bodies: [
						{
							type: "Block",
							blockType: { type: "Identifier", value: "network_interface" },
							labels: [],
							bodies: [
								{
									type: "Attribute",
									name: { type: "Identifier", value: "network_id" },
									value: {
										type: "QuotedTemplateExpression",
										parts: [{ type: "TemplateLiteral", value: "net-123" }],
									},
								},
							],
						},
					],
				},
			]);
		});
	});

	describe("expressions", () => {
		test.skip("should parse binary operation", () => {
			const block = `
			attr = 1 + 2
			`;
			const parsed = parse(block);
			expect(parsed).toEqual([
				{
					type: "Attribute",
					name: { type: "Identifier", value: "attr" },
					value: {
						type: "BinaryOperator",
						operator: "+",
						left: { type: "NumberLiteral", value: 1 },
						right: { type: "NumberLiteral", value: 2 },
					},
				},
			]);
		});

		test.skip("should parse conditional expression", () => {
			const block = `
			attr = true ? "yes" : "no"
			`;
			const parsed = parse(block);
			expect(parsed).toEqual([
				{
					type: "Attribute",
					name: { type: "Identifier", value: "attr" },
					value: {
						type: "ConditionalOperator",
						predicate: { type: "BooleanLiteral", value: true },
						trueExpr: {
							type: "QuotedTemplateExpression",
							parts: [{ type: "TemplateLiteral", value: "yes" }],
						},
						falseExpr: {
							type: "QuotedTemplateExpression",
							parts: [{ type: "TemplateLiteral", value: "no" }],
						},
					},
				},
			]);
		});
	});

	describe("interpolation", () => {
		test("should parse string interpolation", () => {
			const block = `
			attr = "Hello, \${var.name}!"
			`;
			const parsed = parse(block);
			expect(parsed).toEqual([
				{
					type: "Attribute",
					name: { type: "Identifier", value: "attr" },
					value: {
						type: "QuotedTemplateExpression",
						parts: [
							{ type: "TemplateLiteral", value: "Hello, " },
							{
								type: "TemplateInterpolation",
								expr: {
									type: "GetAttributeOperator",
									target: { type: "VariableExpression", name: { type: "Identifier", value: "var" } },
									name: { type: "Identifier", value: "name" },
								},
								strip: { left: false, right: false },
							},
							{ type: "TemplateLiteral", value: "!" },
						],
					},
				},
			] satisfies ConfigFile);
		});
	});
});
