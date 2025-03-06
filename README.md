# hcl-parser-js

![NPM Version](https://img.shields.io/npm/v/hcl-parser-js)
![NPM License](https://img.shields.io/npm/l/hcl-parser-js)
![GitHub Actions Workflow Status](https://img.shields.io/github/actions/workflow/status/shuntksh/hcl-parser-js/ci.yaml)

A pure JavaScript HCL parser implementation that does not depends on transpiled go code.

It aiming to "parse" HCL code, currently it does not evaluate the generated AST which means that no variable interpolation or function calls are evaluated. Template expressions are parsed as is and not evaluated.

## Installation

```sh
bun install hcl-parser-js
```

## Usage

```ts
import { hcl } from "hcl-parser-js";

const hclCode = `
attr = "value"
`;

const ast = hcl.parse(hclCode);
```
The `ast` is an array of objects that represents the parsed HCL code.
See [`types.ts`](./src/types.ts) for the complete type definition.

```json
[
  {
    "type": "Attribute",
    "name": {
      "type": "Identifier",
      "value": "attr"
    },
    "value": {
      "type": "QuotedTemplateExpression",
      "parts": [
        {
          "type": "TemplateLiteral",
          "value": "value"
        }
      ]
    }
  }
]
```

## Zod Schema

Zod schema for the parsed HCL AST is also provided. It can be used to validate the parsed AST to ensure that it is a valid HCL code. Zod is an optional dependency, so you need to install it separately.

```sh
bun install zod
```

```ts
import { hcl } from "hcl-parser-js";
import { schema } from "hcl-parser-js/schema";

const hclCode = `
attr = "value"
`;

const ast = hcl.parse(hclCode);
const parsed = schema.parse(ast);
```

See [`schema.ts`](./src/schema.ts) for the complete zod schema definition.

## Credits

The parser uses HashiCorp's [HCL Native Syntax Specification](https://github.com/hashicorp/hcl/blob/5c140ce1cb2007f7cce52769d8ee97aec5f1032c/hclsyntax/spec.md) as the base for the parser implementation. Which is published under the MPL-2.0 license.
