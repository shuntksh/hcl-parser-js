import { parse as _parse } from "./generated";
import type { ConfigFile } from "./types";
export { SyntaxError } from "./generated";

export const parse = (input: string): ConfigFile => _parse(input, { startRule: "ConfigFile" });
