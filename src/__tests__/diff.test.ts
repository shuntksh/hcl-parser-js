import { describe, expect, test } from "bun:test";
import { diff } from "../diff";

describe("diffObjects", () => {
	test("returns empty array for identical objects", () => {
		const obj1 = { a: 1, b: "test" };
		const obj2 = { a: 1, b: "test" };
		expect(diff(obj1, obj2)).toEqual([]);
	});

	test("detects primitive value differences", () => {
		const obj1 = { a: 1, b: "test" };
		const obj2 = { a: 2, b: "test" };
		expect(diff(obj1, obj2)).toEqual(["a: 1 !== 2"]);
	});

	test("detects missing keys", () => {
		const obj1 = { a: 1, b: "test" };
		const obj2 = { a: 1 };
		expect(diff(obj1, obj2)).toEqual(["b: missing in second object"]);
	});

	test("detects extra keys", () => {
		const obj1 = { a: 1 };
		const obj2 = { a: 1, b: "test" };
		expect(diff(obj1, obj2)).toEqual(["b: missing in first object"]);
	});

	test("handles nested objects", () => {
		const obj1 = { a: 1, b: { c: 2, d: 3 } };
		const obj2 = { a: 1, b: { c: 2, d: 4 } };
		expect(diff(obj1, obj2)).toEqual(["b.d: 3 !== 4"]);
	});

	test("handles arrays", () => {
		const obj1 = { a: [1, 2, 3] };
		const obj2 = { a: [1, 5, 3] };
		expect(diff(obj1, obj2)).toEqual(["a[1]: 2 !== 5"]);
	});

	test("handles array length mismatch", () => {
		const obj1 = { a: [1, 2, 3] };
		const obj2 = { a: [1, 2] };
		expect(diff(obj1, obj2)).toEqual(["a: array length mismatch - 3 !== 2"]);
	});

	test("handles type mismatches", () => {
		const obj1 = { a: 1 };
		const obj2 = { a: "1" };
		expect(diff(obj1, obj2)).toEqual(["a: type mismatch - number !== string"]);
	});

	test("handles null and undefined", () => {
		const obj1 = { a: null, b: undefined };
		const obj2 = { a: 1, b: 2 };
		expect(diff(obj1, obj2)).toContain("a: null !== 1");
		expect(diff(obj1, obj2)).toContain("b: undefined !== 2");
	});

	test("handles complex nested structures", () => {
		const obj1 = {
			name: "test",
			config: {
				options: [
					{ id: 1, value: "a" },
					{ id: 2, value: "b" },
				],
				settings: {
					enabled: true,
					timeout: 1000,
				},
			},
		};

		const obj2 = {
			name: "test",
			config: {
				options: [
					{ id: 1, value: "a" },
					{ id: 2, value: "c" },
				],
				settings: {
					enabled: true,
					timeout: 2000,
				},
			},
		};

		const diffs = diff(obj1, obj2);
		expect(diffs).toContain("config.options[1].value: b !== c");
		expect(diffs).toContain("config.settings.timeout: 1000 !== 2000");
		expect(diffs.length).toBe(2);
	});
});
