// src/tf/output.ts
import type { Block, Expression } from "../types";
import {
	extractAttributes,
	extractNestedBlocks,
	getLabelValue,
	getOptionalAttribute,
	getRequiredAttribute,
	TerraformSemanticError,
} from "./common";

export class OutputBlock {
	public readonly name: string;
	public readonly value: Expression;
	public readonly description?: Expression;
	public readonly sensitive?: Expression;
	public readonly dependsOn?: Expression;
	public readonly attributes: Readonly<Record<string, Expression>>;
	public readonly sourceAst: Block;

	constructor(astNode: Block) {
		if (astNode.blockType.value !== "output") {
			throw new TerraformSemanticError(
				`Attempted to create OutputBlock from AST node type "${astNode.blockType.value}"`,
			);
		}
		if (astNode.labels.length !== 1) {
			throw new TerraformSemanticError(
				`Output block must have exactly one label (the output name), found ${astNode.labels.length}`,
				astNode,
			);
		}

		this.sourceAst = astNode;
		this.name = getLabelValue(astNode.labels[0]!);

		const attributes = extractAttributes(astNode.bodies);
		this.attributes = attributes;

		// 'value' is required for an output
		this.value = getRequiredAttribute(
			attributes,
			"value",
			`output "${this.name}"`,
		);
		this.description = getOptionalAttribute(attributes, "description");
		this.sensitive = getOptionalAttribute(attributes, "sensitive");
		this.dependsOn = getOptionalAttribute(attributes, "depends_on");

		// Outputs generally don't have nested blocks
		const nested = extractNestedBlocks(astNode.bodies);
		if (nested.length > 0) {
			console.warn(
				`Output block "${this.name}" contains unexpected nested blocks.`,
			);
		}
	}
}

export class Outputs {
	private readonly outputs = new Map<string, OutputBlock>();

	add(output: OutputBlock) {
		if (this.outputs.has(output.name)) {
			throw new TerraformSemanticError(
				`Output "${output.name}" is defined multiple times.`,
				output.sourceAst,
			);
		}
		this.outputs.set(output.name, output);
	}

	get(name: string): OutputBlock | undefined {
		return this.outputs.get(name);
	}

	has(name: string): boolean {
		return this.outputs.has(name);
	}

	get all(): ReadonlyMap<string, OutputBlock> {
		return this.outputs;
	}

	get size(): number {
		return this.outputs.size;
	}
}
