import { describe, expect, test } from "bun:test";
import { parse } from "./parser";
import { schema } from "./schema";

const parseAndValidate = (block: string) => {
	const ast = parse(block);
	const parsed = schema.parse(ast);
	expect(parsed).toEqual(ast);
};

describe("zod schema", () => {
	test("one line block", () => {
		const block = `
		resource "aws_instance" "web" { attr = "value" }
		`;
		parseAndValidate(block);
	});

	test("empty block", () => {
		const block = `
		resource "aws_instance" "web" {
		}
		`;
		parseAndValidate(block);
	});

	test("quoted template", () => {
		const block = `
		attr = "hello"
		`;
		parseAndValidate(block);
	});

	test("heredoc template", () => {
		const block = `
		attr = <<EOF
		hello
		EOF
		`;
		parseAndValidate(block);
	});

	test("tuple", () => {
		const block = `
		attr = [1, 2, 3]
		`;
		parseAndValidate(block);
	});

	test("object", () => {
		const block = `
		attr = { a = 1, b = 2, c = 3 }
		`;
		parseAndValidate(block);
	});

	test("boolean true", () => {
		const block = `
		attr = true
		`;
		parseAndValidate(block);
	});

	test("boolean false", () => {
		const block = `
			attr = false
		`;
		parseAndValidate(block);
	});

	test("null", () => {
		const block = `
			attr = null
		`;
		parseAndValidate(block);
	});

	test("nested block", () => {
		const block = `
			resource "aws_instance" "web" {
				network_interface {
					network_id = "net-123"
				}
			}
			`;
		parseAndValidate(block);
	});

	test("function call", () => {
		const block = `
			attr = call(a,b,c)
			attr2 = call()
			`;
		parseAndValidate(block);
	});

	test("expression", () => {
		const block = `
			attr = 1
			`;
		parseAndValidate(block);
	});

	test("multiple expressions", () => {
		const block = `
			attr = 1
			attr2 = [1,2,3]
			`;
		parseAndValidate(block);
	});

	test("binary operation", () => {
		const block = `
			attr = 1 + 2
			`;
		parseAndValidate(block);
	});

	test("conditional expression", () => {
		const block = `
			attr = true ? "yes" : "no"
			`;
		parseAndValidate(block);
	});

	test("string interpolation", () => {
		const block = `
			attr = "Hello, \${var.name}!"
			`;
		parseAndValidate(block);
	});
});
