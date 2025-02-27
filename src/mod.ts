export type * from "./types";

import { parse } from "./parser";
import { stringify } from "./stringify";

export const hcl = {
	parse,
	stringify,
};

export default hcl;
