import { parse } from "hcl-parser-js";
import { schema } from "hcl-parser-js/schema";

const hcl = `
 attr = "value"
`;

const result = parse(hcl);
const parsed = schema.parse(result);
console.log(JSON.stringify(parsed, null, 2));
