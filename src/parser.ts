import { parse as _parse } from "./__generated";
import type { ConfigFile } from "./types";
export { SyntaxError } from "./__generated";

export const parse = (input: string): ConfigFile =>
  _parse(input, { startRule: "ConfigFile" });
