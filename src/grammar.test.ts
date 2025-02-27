import { describe, expect, test } from "bun:test";
import path from "node:path";

import { parse } from "./__generated__";
import { diff } from "./diff";
import { schema } from "./schema";
import { stringify } from "./stringify";

describe("Smoke", () => {
	test("parses a test tf file", async () => {
		const template = await Bun.file(
			path.join(__dirname, "./grammar.test.hcl"),
		).text();
		const ast = parse(template);
		expect(ast).toBeObject();
		expect(ast).toMatchSnapshot();
		expect(schema.parse(ast)).toEqual(ast);
	});

	test("throws on invalid syntax", () => {
		const input = `resource aws_instance" "web" {}`; // Missing opening quote
		expect(() => parse(input)).toThrow();
	});
});
