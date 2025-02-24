![NPM Version](https://img.shields.io/npm/v/hcl-parser-js)
![NPM License](https://img.shields.io/npm/l/hcl-parser-js)
![GitHub Actions Workflow Status](https://img.shields.io/github/actions/workflow/status/shuntksh/hcl-parser-js/ci.yaml)

# hcl-js-parser

A pure JavaScript HCL parser implementation that does not depends on transpiled go code.

It aiming to "parse" HCL code, not "evaluate" it which means that any function call or expressions are not evaluated.

## Usage

```ts
import { parse } from "hcl-parser-js";

const hcl = `
attr = "value"
`;

const ast = parse(hcl);
```

## Zod Schema

```ts
import { parse } from "hcl-parser-js";
import { schema } from "hcl-parser-js/schema";

const hcl = `
attr = "value"
`;

const ast = parse(hcl);
const parsed = schema.parse(ast);
```
