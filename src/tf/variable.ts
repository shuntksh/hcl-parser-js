// src/tf/variable.ts
import type { Block, Expression } from "../types";
import {
	extractAttributes,
	extractNestedBlocks,
	getLabelValue,
	getOptionalAttribute,
	TerraformSemanticError,
} from "./common";

export class VariableBlock {
	public readonly name: string;
	public readonly typeExpression?: Expression;
	public readonly description?: Expression;
	public readonly defaultValue?: Expression;
	public readonly validation?: Block[]; // Assuming 'validation' is a nested block
	public readonly sensitive?: Expression;
	public readonly nullable?: Expression;
	public readonly attributes: Readonly<Record<string, Expression>>;
	public readonly sourceAst: Block;

	constructor(astNode: Block) {
		if (astNode.blockType.value !== "variable") {
			throw new TerraformSemanticError(
				`Attempted to create VariableBlock from AST node type "${astNode.blockType.value}"`,
			);
		}
		if (astNode.labels.length !== 1) {
			throw new TerraformSemanticError(
				`Variable block must have exactly one label (the variable name), found ${astNode.labels.length}`,
				astNode,
			);
		}

		this.sourceAst = astNode;
		this.name = getLabelValue(astNode.labels[0]!);

		const attributes = extractAttributes(astNode.bodies);
		this.attributes = attributes;

		this.typeExpression = getOptionalAttribute(attributes, "type");
		this.description = getOptionalAttribute(attributes, "description");
		this.defaultValue = getOptionalAttribute(attributes, "default");
		this.sensitive = getOptionalAttribute(attributes, "sensitive");
		this.nullable = getOptionalAttribute(attributes, "nullable");

		this.validation = extractNestedBlocks(astNode.bodies, "validation");

		// Basic validation example: Check for required properties based on TF logic
		// if (!this.typeExpression && !this.defaultValue) {
		//   console.warn(`Variable "${this.name}" should have a 'type' or a 'default' value.`);
		// }
	}
}

export class Variables {
	private readonly variables = new Map<string, VariableBlock>();

	add(variable: VariableBlock) {
		if (this.variables.has(variable.name)) {
			// Terraform allows overriding variables in different files, but
			// within a single logical configuration, duplicates might be an issue.
			// Decide on handling: error, warn, or overwrite. Let's warn for now.
			console.warn(
				`Variable "${variable.name}" redefined. The last definition will be used.`,
			);
		}
		this.variables.set(variable.name, variable);
	}

	get(name: string): VariableBlock | undefined {
		return this.variables.get(name);
	}

	has(name: string): boolean {
		return this.variables.has(name);
	}

	get all(): ReadonlyMap<string, VariableBlock> {
		return this.variables;
	}

	get size(): number {
		return this.variables.size;
	}
}
