import { parse as _parse } from "./__generated__";
import type { ConfigFile } from "./types";
export { SyntaxError } from "./__generated__";

export const parse = (input: string): ConfigFile =>
	_parse(input, { startRule: "ConfigFile" });
