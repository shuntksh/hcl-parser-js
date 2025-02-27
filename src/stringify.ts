import type {
	Attribute,
	BinaryOperator,
	Block,
	ConditionalOperator,
	ConfigBody,
	ConfigFile,
	Expression,
	ForExpression,
	ForObjectExpression,
	ForTupleExpression,
	FunctionCallExpression,
	GetAttributeOperator,
	HeredocTemplateExpression,
	Identifier,
	IndexOperator,
	Label,
	LegacyIndexOperator,
	NodeType,
	ObjectValue,
	ObjectValueElement,
	OneLineBlock,
	QuotedTemplateExpression,
	SplatOperator,
	StringLiteral,
	Template,
	TemplateFor,
	TemplateIf,
	TemplateInterpolation,
	TemplateLiteral,
	TupleValue,
	UnaryOperator,
	VariableExpression,
} from "./types";
import { NodeTypes } from "./types";

/**
 * Stringify a HCL AST to a hcl string
 */
export const stringify = (ast: ConfigFile): string => marshalConfigFile(ast);

// Helper function to marshal a ConfigFile (top-level AST)
function marshalConfigFile(configFile: ConfigFile): string {
	return configFile.map((body) => marshalConfigBody(body)).join("\n");
}

// Marshal a ConfigBody element (Attribute, Block, or OneLineBlock)
function marshalConfigBody(body: ConfigBody, indent = ""): string {
	const bodyType = body.type;
	switch (bodyType) {
		case NodeTypes.Attribute:
			return marshalAttribute(body as Attribute, indent);
		case NodeTypes.Block:
			return marshalBlock(body as Block, indent);
		case NodeTypes.OneLineBlock:
			return marshalOneLineBlock(body as OneLineBlock, indent);
		default:
			throw new Error(`Unknown body type: ${bodyType}`);
	}
}

// Marshal an Attribute
function marshalAttribute(attr: Attribute, indent = ""): string {
	const name = marshalIdentifier(attr.name);
	const value = marshalExpression(attr.value);
	return `${indent}${name} = ${value}`;
}

// Marshal a Block
function marshalBlock(block: Block, indent = ""): string {
	const blockType = marshalIdentifier(block.blockType);
	const labels = block.labels.map(marshalLabel).join(" ");
	const labelStr = labels ? ` ${labels}` : "";

	if (!block.bodies || block.bodies.length === 0) {
		return `${indent}${blockType}${labelStr} {}`;
	}

	const bodyContent = block.bodies
		.map((body) => marshalConfigBody(body, `${indent}  `))
		.join("\n");

	return `${indent}${blockType}${labelStr} {\n${bodyContent}\n${indent}}`;
}

// Marshal a OneLineBlock
function marshalOneLineBlock(block: OneLineBlock, indent = ""): string {
	const blockType = marshalIdentifier(block.blockType);
	const labels = block.labels.map(marshalLabel).join(" ");
	const labelStr = labels ? ` ${labels}` : "";

	if (!block.attribute) {
		return `${indent}${blockType}${labelStr} {}`;
	}

	const attrName = marshalIdentifier(block.attribute.name);
	const attrValue = marshalExpression(block.attribute.value);

	return `${indent}${blockType}${labelStr} { ${attrName} = ${attrValue} }`;
}

// Marshal a Label (StringLiteral or Identifier)
function marshalLabel(label: Label): string {
	// Using type assertion to handle the type checking issue
	if ((label as Label).type === NodeTypes.StringLiteral) {
		const strLabel = label as StringLiteral;
		return `"${escapeString(strLabel.value)}"`;
	}
	return marshalIdentifier(label as Identifier);
}

// Marshal an Identifier
function marshalIdentifier(identifier: Identifier): string {
	return identifier.value;
}

// Marshal an Expression
function marshalExpression(expr: Expression | StringLiteral): string {
	if (!expr) return "";

	// Handle StringLiteral separately since it's not part of the Expression type
	// but can appear in some contexts
	if (expr.type === NodeTypes.StringLiteral) {
		return `"${escapeString((expr as StringLiteral).value)}"`;
	}

	const exprType = expr.type;
	switch (exprType) {
		case NodeTypes.NumberLiteral:
			return expr.value.toString();
		case NodeTypes.BooleanLiteral:
			return expr.value ? "true" : "false";
		case NodeTypes.NullLiteral:
			return "null";
		case NodeTypes.TupleValue:
			return marshalTupleValue(expr as TupleValue);
		case NodeTypes.ObjectValue:
			return marshalObjectValue(expr as ObjectValue);
		case NodeTypes.QuotedTemplateExpression:
			return marshalQuotedTemplate(expr as QuotedTemplateExpression);
		case NodeTypes.HeredocTemplateExpression:
			return marshalHeredocTemplate(expr as HeredocTemplateExpression);
		case NodeTypes.FunctionCallExpression:
			return marshalFunctionCall(expr as FunctionCallExpression);
		case NodeTypes.VariableExpression:
			return marshalVariableExpression(expr as VariableExpression);
		case NodeTypes.ForExpression:
			return marshalForExpression(expr as ForExpression);
		case NodeTypes.UnaryOperator:
			return marshalUnaryOperator(expr as UnaryOperator);
		case NodeTypes.BinaryOperator:
			return marshalBinaryOperator(expr as BinaryOperator);
		case NodeTypes.ConditionalOperator:
			return marshalConditionalOperator(expr as ConditionalOperator);
		case NodeTypes.IndexOperator:
			return marshalIndexOperator(expr as IndexOperator);
		case NodeTypes.LegacyIndexOperator:
			return marshalLegacyIndexOperator(expr as LegacyIndexOperator);
		case NodeTypes.GetAttributeOperator:
			return marshalGetAttributeOperator(expr as GetAttributeOperator);
		case NodeTypes.SplatOperator:
			return marshalSplatOperator(expr as SplatOperator);
		default:
			throw new Error(`Unknown expression type: ${exprType}`);
	}
}

// Marshal a TupleValue
function marshalTupleValue(tuple: TupleValue): string {
	if (!tuple.elements || tuple.elements.length === 0) {
		return "[]";
	}

	const elements = tuple.elements.map(marshalExpression).join(", ");
	return `[${elements}]`;
}

// Marshal an ObjectValue
function marshalObjectValue(obj: ObjectValue): string {
	if (!obj.elements || obj.elements.length === 0) {
		return "{}";
	}

	const elements = obj.elements
		.map((elem: ObjectValueElement) => {
			const key = marshalIdentifier(elem.key);
			const value = marshalExpression(elem.value);
			return `${key} = ${value}`;
		})
		.join(", ");

	return `{ ${elements} }`;
}

// Marshal a QuotedTemplateExpression
function marshalQuotedTemplate(template: QuotedTemplateExpression): string {
	const parts = template.parts
		.map((part) => {
			const partType = part.type as NodeType;
			if (partType === NodeTypes.TemplateLiteral) {
				return escapeString((part as TemplateLiteral).value);
			}
			if (partType === NodeTypes.TemplateInterpolation) {
				const interp = part as TemplateInterpolation;
				const expr = marshalExpression(interp.expression);
				const left = interp.strip.left ? "~" : "";
				const right = interp.strip.right ? "~" : "";
				return `\${${left}${expr}${right}}`;
			}
			if (
				partType === NodeTypes.TemplateIf ||
				partType === NodeTypes.TemplateFor
			) {
				// Template directives are more complex and would need specific handling
				// This is a simplified version
				return "%{/* Template directive not fully implemented */}";
			}
			return "";
		})
		.join("");

	return `"${parts}"`;
}

// Marshal a HeredocTemplateExpression
function marshalHeredocTemplate(heredoc: HeredocTemplateExpression): string {
	const marker = marshalIdentifier(heredoc.marker);
	const indent = heredoc.stripIndent ? "-" : "";
	const content = marshalTemplateContent(heredoc.template);

	return `<<${indent}${marker}\n${content}\n${marker}`;
}

// Marshal Template content
function marshalTemplateContent(template: Template[]): string {
	if (!template) return "";

	return template
		.map((part) => {
			const partType = part.type as NodeType;
			if (partType === NodeTypes.TemplateLiteral) {
				return (part as TemplateLiteral).value;
			}
			if (partType === NodeTypes.TemplateInterpolation) {
				const interp = part as TemplateInterpolation;
				const expr = marshalExpression(interp.expression);
				const left = interp.strip.left ? "~" : "";
				const right = interp.strip.right ? "~" : "";
				return `\${${left}${expr}${right}}`;
			}
			if (partType === NodeTypes.TemplateIf) {
				// Simplified implementation
				const ifPart = part as TemplateIf;
				const condition = marshalExpression(ifPart.condition);
				const thenContent = marshalTemplateContent([ifPart.then]);
				const elseContent = ifPart.else
					? marshalTemplateContent([ifPart.else])
					: "";

				let result = `%{if ${condition}}${thenContent}`;
				if (elseContent) {
					result += `%{else}${elseContent}`;
				}
				result += "%{endif}";
				return result;
			}
			if (partType === NodeTypes.TemplateFor) {
				// Simplified implementation
				const forPart = part as TemplateFor;
				const key = marshalIdentifier(forPart.key);
				const value = forPart.value ? marshalIdentifier(forPart.value) : "";
				const collection = marshalExpression(forPart.collection);
				const body = marshalTemplateContent([forPart.body]);

				const iterDecl = value ? `${key}, ${value}` : key;
				return `%{for ${iterDecl} in ${collection}}${body}%{endfor}`;
			}
			return "";
		})
		.join("");
}

// Marshal a FunctionCallExpression
function marshalFunctionCall(func: FunctionCallExpression): string {
	const name = marshalIdentifier(func.name);
	const args = func.args.map(marshalExpression).join(", ");
	return `${name}(${args})`;
}

// Marshal a VariableExpression
function marshalVariableExpression(variable: VariableExpression): string {
	return marshalIdentifier(variable.name);
}

// Marshal a ForExpression
function marshalForExpression(forExpr: ForExpression): string {
	const intro = forExpr.intro;
	const iterator = marshalIdentifier(intro.iterator);
	const value = intro.value ? marshalIdentifier(intro.value) : null;
	const collection = marshalExpression(intro.collection);
	const condition = forExpr.condition
		? marshalExpression(forExpr.condition)
		: null;

	const introStr = value
		? `for ${iterator}, ${value} in ${collection}:`
		: `for ${iterator} in ${collection}:`;

	const conditionStr = condition ? ` if ${condition}` : "";

	const forKind = forExpr.kind;
	if (forKind === "tuple") {
		const tupleExpr = forExpr as ForTupleExpression;
		const expr = marshalExpression(tupleExpr.expression);
		return `[${introStr} ${expr}${conditionStr}]`;
	}

	if (forKind === "object") {
		const objExpr = forExpr as ForObjectExpression;
		const key = marshalExpression(objExpr.key);
		const value = marshalExpression(objExpr.value);
		const grouping = objExpr.grouping ? " ..." : "";
		return `{${introStr} ${key} => ${value}${grouping}${conditionStr}}`;
	}

	throw new Error(`Unknown for expression kind: ${forKind}`);
}

// Marshal a UnaryOperator
function marshalUnaryOperator(op: UnaryOperator): string {
	const operator = op.operator;
	const term = marshalExpression(op.term);
	return `${operator}${term}`;
}

// Marshal a BinaryOperator
function marshalBinaryOperator(op: BinaryOperator): string {
	// Define operator precedence (higher number means higher precedence)
	const precedence: Record<string, number> = {
		"*": 5,
		"/": 5,
		"%": 5,
		"+": 4,
		"-": 4,
		">": 3,
		">=": 3,
		"<": 3,
		"<=": 3,
		"==": 2,
		"!=": 2,
		"&&": 1,
		"||": 0,
	};

	// Get the precedence of the current operator
	const currentPrecedence = precedence[op.operator] || 0;

	// Marshal the left operand, adding parentheses if needed
	let left = marshalExpression(op.left);
	if (op.left.type === NodeTypes.BinaryOperator) {
		const leftOp = op.left as BinaryOperator;
		const leftPrecedence = precedence[leftOp.operator] || 0;
		if (leftPrecedence < currentPrecedence) {
			left = `(${left})`;
		}
	}

	// Marshal the right operand, adding parentheses if needed
	let right = marshalExpression(op.right);
	if (op.right.type === NodeTypes.BinaryOperator) {
		const rightOp = op.right as BinaryOperator;
		const rightPrecedence = precedence[rightOp.operator] || 0;
		// For right-associative operators or equal precedence, we need parentheses
		if (
			rightPrecedence <= currentPrecedence &&
			op.operator !== "||" &&
			op.operator !== "&&"
		) {
			right = `(${right})`;
		}
	}

	return `${left} ${op.operator} ${right}`;
}

// Marshal a ConditionalOperator
function marshalConditionalOperator(op: ConditionalOperator): string {
	const predicate = marshalExpression(op.predicate);
	const trueExpr = marshalExpression(op.trueExpr);
	const falseExpr = marshalExpression(op.falseExpr);
	return `${predicate} ? ${trueExpr} : ${falseExpr}`;
}

// Marshal an IndexOperator
function marshalIndexOperator(op: IndexOperator): string {
	const target = marshalExpression(op.target);
	const key = marshalExpression(op.key);
	return `${target}[${key}]`;
}

// Marshal a LegacyIndexOperator
function marshalLegacyIndexOperator(op: LegacyIndexOperator): string {
	const target = marshalExpression(op.target);
	const key = op.key.value;
	return `${target}.${key}`;
}

// Marshal a GetAttributeOperator
function marshalGetAttributeOperator(op: GetAttributeOperator): string {
	const target = marshalExpression(op.target);
	const key = marshalIdentifier(op.key);
	return `${target}.${key}`;
}

// Marshal a SplatOperator
function marshalSplatOperator(op: SplatOperator): string {
	const target = marshalExpression(op.target);

	const splatKind = op.kind;
	if (splatKind === "Attribute") {
		const attrs = op.attributes
			.map((attr) => `.${marshalIdentifier(attr.key)}`)
			.join("");
		return `${target}.*${attrs}`;
	}

	if (splatKind === "Full") {
		const ops = op.operations
			.map((operation) => {
				const opType = operation.type as NodeType;
				if (opType === NodeTypes.GetAttributeOperator) {
					return `.${marshalIdentifier((operation as GetAttributeOperator).key)}`;
				}
				if (opType === NodeTypes.IndexOperator) {
					return `[${marshalExpression((operation as IndexOperator).key)}]`;
				}
				return "";
			})
			.join("");
		return `${target}[*]${ops}`;
	}

	throw new Error(`Unknown splat operator kind: ${splatKind}`);
}

// Helper function to escape strings
function escapeString(str: string): string {
	return str
		.replace(/\\/g, "\\\\")
		.replace(/"/g, '\\"')
		.replace(/\n/g, "\\n")
		.replace(/\r/g, "\\r")
		.replace(/\t/g, "\\t");
}
