import { hcl } from "hcl-parser-js";
import { schema } from "hcl-parser-js/schema";

const hclCode = `
 attr = "value"
`;

const result = hcl.parse(hclCode);
const parsed = schema.parse(result);
console.log(JSON.stringify(parsed, null, 2));
