/**
 * Helper function to walk through two objects and report their differences
 * It is used to compare two HCL ASTs as they tend to be very similar but not identical
 * @param obj1 First object to compare
 * @param obj2 Second object to compare
 * @param path Current path in the object (used for recursion)
 * @returns Array of differences with their paths
 */
export function diff(obj1: unknown, obj2: unknown, path = ""): string[] {
	// If both objects are identical, return empty array
	if (obj1 === obj2) return [];

	// If either is null/undefined but not both
	if (
		obj1 === null ||
		obj2 === null ||
		obj1 === undefined ||
		obj2 === undefined
	) {
		return [`${path}: ${obj1} !== ${obj2}`];
	}

	// If types don't match
	if (typeof obj1 !== typeof obj2) {
		return [`${path}: type mismatch - ${typeof obj1} !== ${typeof obj2}`];
	}

	// If not objects, compare values
	if (typeof obj1 !== "object" || typeof obj2 !== "object") {
		return obj1 === obj2 ? [] : [`${path}: ${obj1} !== ${obj2}`];
	}

	// Handle arrays
	if (Array.isArray(obj1) && Array.isArray(obj2)) {
		if (obj1.length !== obj2.length) {
			return [
				`${path}: array length mismatch - ${obj1.length} !== ${obj2.length}`,
			];
		}

		const diffs: string[] = [];
		for (let i = 0; i < obj1.length; i++) {
			const nestedDiffs = diff(obj1[i], obj2[i], `${path}[${i}]`);
			diffs.push(...nestedDiffs);
		}
		return diffs;
	}

	// Handle regular objects
	if (!Array.isArray(obj1) && !Array.isArray(obj2)) {
		const diffs: string[] = [];
		const allKeys = new Set([
			...Object.keys(obj1 as object),
			...Object.keys(obj2 as object),
		]);

		for (const key of allKeys) {
			const obj1Value = (obj1 as Record<string, unknown>)[key];
			const obj2Value = (obj2 as Record<string, unknown>)[key];

			// Key exists in both objects
			if (key in (obj1 as object) && key in (obj2 as object)) {
				const nestedDiffs = diff(
					obj1Value,
					obj2Value,
					path ? `${path}.${key}` : key,
				);
				diffs.push(...nestedDiffs);
			}
			// Key only exists in obj1
			else if (key in (obj1 as object)) {
				diffs.push(
					`${path ? `${path}.${key}` : key}: missing in second object`,
				);
			}
			// Key only exists in obj2
			else {
				diffs.push(`${path ? `${path}.${key}` : key}: missing in first object`);
			}
		}
		return diffs;
	}

	// If we get here, one is an array and one is an object
	return [`${path}: structure mismatch - array vs object`];
}
