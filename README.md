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

## Basic Usage

### `hcl.parse(input: string): ConfigFile`

Take hcl configuration as a string and return the parsed AST. Throw a ParseError if the input is not a valid HCL code. Note that the generated AST is a plain JavaScript object and does not provide any methods to evaluate the parsed code.

###  `hcl.stringify(ast: ConfigFile): string`

Take the parsed AST and return the HCL code as a string. The output does not preserve the original formatting and comments but it is a valid HCL code.

### Example

```ts
import { hcl } from "hcl-parser-js";

const hclCode = `
attr = "value"
`;

const ast = hcl.parse(hclCode);

console.log(hcl.stringify(parsed));
// Note that stringify does not preserve the original formatting and comments
// -> attr = "value"
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

## Optional Zod Schema

Zod schema for the parsed HCL AST is also provided. It can be used to validate the parsed AST to ensure that it is a valid HCL code. Zod is an optional dependency, so you need to install it separately.

```sh
bun install zod
```

```ts
import { hcl } from "hcl-parser-js";
import { schema } from "hcl-parser-js/schema";

const hclCode = `
# Comment will be ignored
attr = "value"
`;

const ast = hcl.parse(hclCode);
const parsed = schema.parse(ast);
```

See [`schema.ts`](./src/schema.ts) for the complete zod schema definition.

## Roadmap

- Parser to support variable and function validation and interpolation.
- Parser to support template expansion.
- Add Terraform grammar support.

## Credits

The project uses HashiCorp's [HCL Native Syntax Specification](https://github.com/hashicorp/hcl/blob/5c140ce1cb2007f7cce52769d8ee97aec5f1032c/hclsyntax/spec.md) as the base for the parser implementation. Which is published under the MPL-2.0 license.

This project uses [peggy](https://peggyjs.org) as the parser generator. Peggy is the successor of [PEG.js](https://github.com/pegjs/pegjs).