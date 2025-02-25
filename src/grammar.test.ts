import { describe, expect, test } from "bun:test";
import { parse } from "./__generated__";
import { schema } from "./schema";

describe("Smoke", () => {
	test("parses a test hcl file", async () => {
		const template = await Bun.file(
			new URL("./grammar.test.hcl", import.meta.url),
		).text();
		const parsed = parse(template);
		expect(parsed).toBeObject();
		expect(parsed).toMatchSnapshot();
		expect(schema.parse(parsed)).toEqual(parsed);
	});

	test("throws on invalid syntax", () => {
		const input = `resource aws_instance" "web" {}`; // Missing opening quote
		expect(() => parse(input)).toThrow();
	});
});
