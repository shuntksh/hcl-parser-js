import { describe, expect, test } from "bun:test";
import { parse } from "./parser.js";
import type { Attribute } from "./types.js";

describe("parser", () => {
	describe("operation orders", () => {
		test("multiplicative operators have higher precedence than additive", () => {
			const result = parse("x = 2 + 3 * 4");
			const attr = result[0] as Attribute;
			expect(attr.value).toMatchObject({
				type: "BinaryOperator",
				operator: "+",
				left: { type: "NumberLiteral", value: 2 },
				right: {
					type: "BinaryOperator",
					operator: "*",
					left: { type: "NumberLiteral", value: 3 },
					right: { type: "NumberLiteral", value: 4 },
				},
			});
		});

		test("additive operators have higher precedence than comparison", () => {
			const result = parse("x = 5 > 2 + 3");
			const attr = result[0] as Attribute;
			expect(attr.value).toMatchObject({
				type: "BinaryOperator",
				operator: ">",
				left: { type: "NumberLiteral", value: 5 },
				right: {
					type: "BinaryOperator",
					operator: "+",
					left: { type: "NumberLiteral", value: 2 },
					right: { type: "NumberLiteral", value: 3 },
				},
			});
		});

		test("comparison operators have higher precedence than equality", () => {
			const result = parse("x = 1 == 5 > 3");
			const attr = result[0] as Attribute;
			expect(attr.value).toMatchObject({
				type: "BinaryOperator",
				operator: "==",
				left: { type: "NumberLiteral", value: 1 },
				right: {
					type: "BinaryOperator",
					operator: ">",
					left: { type: "NumberLiteral", value: 5 },
					right: { type: "NumberLiteral", value: 3 },
				},
			});
		});

		test("equality operators have higher precedence than logical AND", () => {
			const result = parse("x = true && 1 == 2");
			const attr = result[0] as Attribute;
			expect(attr.value).toMatchObject({
				type: "BinaryOperator",
				operator: "&&",
				left: { type: "BooleanLiteral", value: true },
				right: {
					type: "BinaryOperator",
					operator: "==",
					left: { type: "NumberLiteral", value: 1 },
					right: { type: "NumberLiteral", value: 2 },
				},
			});
		});

		test("logical AND has higher precedence than logical OR", () => {
			const result = parse("x = true || false && true");
			const attr = result[0] as Attribute;
			expect(attr.value).toMatchObject({
				type: "BinaryOperator",
				operator: "||",
				left: { type: "BooleanLiteral", value: true },
				right: {
					type: "BinaryOperator",
					operator: "&&",
					left: { type: "BooleanLiteral", value: false },
					right: { type: "BooleanLiteral", value: true },
				},
			});
		});

		test("parentheses override normal precedence", () => {
			const result = parse("x = (2 + 3) * 4");
			const attr = result[0] as Attribute;
			expect(attr.value).toMatchObject({
				type: "BinaryOperator",
				operator: "*",
				left: {
					type: "BinaryOperator",
					operator: "+",
					left: { type: "NumberLiteral", value: 2 },
					right: { type: "NumberLiteral", value: 3 },
				},
				right: { type: "NumberLiteral", value: 4 },
			});
		});
	});

	describe("template literals", () => {
		test("handles string interpolation", () => {
			const result = parse(`x = "Hello \${var.name}!"`);
			const attr = result[0] as Attribute;
			expect(attr.value).toMatchObject({
				type: "QuotedTemplateExpression",
				parts: [
					{ type: "TemplateLiteral", value: "Hello " },
					{
						type: "TemplateInterpolation",
						expression: {
							type: "GetAttributeOperator",
							target: { type: "VariableExpression", name: { value: "var" } },
							key: { value: "name" },
						},
						strip: { left: false, right: false },
					},
					{ type: "TemplateLiteral", value: "!" },
				],
			});
		});

		test.skip("handles template directives", () => {
			const result = parse(
				`x = "Items: %{for item in items}\${item}, %{endfor}"`,
			);
			const attr = result[0] as Attribute;
			expect(attr.value).toMatchObject({
				type: "QuotedTemplateExpression",
				parts: [
					{ type: "TemplateLiteral", value: "Items: " },
					{
						type: "TemplateFor",
						intro: {
							key: { value: "item" },
							value: null,
							collection: {
								type: "VariableExpression",
								name: { value: "items" },
							},
						},
						body: [
							{
								type: "TemplateInterpolation",
								expression: {
									type: "VariableExpression",
									name: { value: "item" },
								},
								strip: { left: false, right: false },
							},
							{ type: "TemplateLiteral", value: ", " },
						],
						strip: {
							for: { start: false, end: false },
							endfor: { start: false, end: false },
						},
					},
				],
			});
		});

		test("handles conditional directives", () => {
			const result = parse(`x = "Status: %{if enabled}ON%{else}OFF%{endif}"`);
			const attr = result[0] as Attribute;
			expect(attr.value).toMatchObject({
				type: "QuotedTemplateExpression",
				parts: [
					{ type: "TemplateLiteral", value: "Status: " },
					{
						type: "TemplateIf",
						condition: {
							type: "VariableExpression",
							name: { value: "enabled" },
						},
						then: [{ type: "TemplateLiteral", value: "ON" }],
						else: [{ type: "TemplateLiteral", value: "OFF" }],
						strip: {
							if: { start: false, end: false },
							else: { start: false, end: false },
							endif: { start: false, end: false },
						},
					},
				],
			});
		});

		test.skip("handles complex mixed templates", () => {
			const result = parse(`
				x = "Config: %{for svc in services}
					Service \${svc.name}: %{if svc.enabled}
						Port: \${svc.port}
					%{else}
						Disabled
					%{endif}
				%{endfor}"
			`);
			const attr = result[0] as Attribute;
			expect(attr.value).toMatchObject({
				type: "QuotedTemplateExpression",
				parts: [
					{ type: "TemplateLiteral", value: "Config: " },
					{
						type: "TemplateFor",
						intro: {
							key: { value: "svc" },
							value: null,
							collection: {
								type: "VariableExpression",
								name: { value: "services" },
							},
						},
						body: [
							{ type: "TemplateLiteral", value: "\n\t\t\t\t\tService " },
							{
								type: "TemplateInterpolation",
								expression: {
									type: "GetAttributeOperator",
									target: {
										type: "VariableExpression",
										name: { value: "svc" },
									},
									key: { value: "name" },
								},
							},
							{ type: "TemplateLiteral", value: ": " },
							{
								type: "TemplateIf",
								condition: {
									type: "GetAttributeOperator",
									target: {
										type: "VariableExpression",
										name: { value: "svc" },
									},
									key: { value: "enabled" },
								},
								then: [
									{ type: "TemplateLiteral", value: "\n\t\t\t\t\t\tPort: " },
									{
										type: "TemplateInterpolation",
										expression: {
											type: "GetAttributeOperator",
											target: {
												type: "VariableExpression",
												name: { value: "svc" },
											},
											key: { value: "port" },
										},
									},
								],
								else: [
									{ type: "TemplateLiteral", value: "\n\t\t\t\t\t\tDisabled" },
								],
							},
							{ type: "TemplateLiteral", value: "\n\t\t\t\t" },
						],
					},
				],
			});
		});
	});
});
