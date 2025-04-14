import { parse as _parse } from "./__generated__";
import type { ConfigFile, ParseError, SafeParseResult } from "./types";

/**
 * Parse a HCL string into an AST
 */
export function parse(input: string): ConfigFile {
	return _parse(input, { startRule: "ConfigFile" });
}

export function safeParse(input: string): SafeParseResult<ConfigFile> {
	try {
		return { success: true, data: parse(input) };
	} catch (error) {
		return { success: false, error: error as ParseError };
	}
}
