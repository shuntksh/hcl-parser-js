// src/tf/common.ts
import type { Attribute, Block, ConfigBody, Expression, Label } from "../types";
import { NodeTypes } from "../types";

// Base class or interface might be overkill if constructors handle common logic
// For now, we'll just define common helpers/types

export class TerraformSemanticError extends Error {
	constructor(message: string, node?: Block | Attribute) {
		// TODO: Add location info from the node if available
		super(message);
		this.name = "TerraformSemanticError";
	}
}

/** Helper to extract attributes into a more accessible map */
export function extractAttributes(
	body: ConfigBody[],
): Record<string, Expression> {
	const attributes: Record<string, Expression> = {};
	for (const item of body) {
		if (item.type === NodeTypes.Attribute) {
			// Check for duplicates? Terraform allows overrides in some contexts,
			// but for a basic model, let's assume last one wins or error.
			// For simplicity now, last one wins.
			attributes[item.name.value] = item.value;
		}
	}
	return attributes;
}

/** Helper to extract specific nested blocks */
export function extractNestedBlocks(
	body: ConfigBody[],
	blockTypeName?: string,
): Block[] {
	const blocks: Block[] = [];
	for (const item of body) {
		if (item.type === NodeTypes.Block) {
			if (!blockTypeName || item.blockType.value === blockTypeName) {
				blocks.push(item);
			}
		}
		// OneLineBlocks aren't typically used for nested structures in TF,
		// but could be added here if needed.
	}
	return blocks;
}

/** Helper to get a single optional attribute */
export function getOptionalAttribute(
	attributes: Record<string, Expression>,
	name: string,
): Expression | undefined {
	return attributes[name];
}

/** Helper to get a single required attribute */
export function getRequiredAttribute(
	attributes: Record<string, Expression>,
	name: string,
	blockIdentifier: string, // For error messages
): Expression {
	const attr = attributes[name];
	if (!attr) {
		throw new TerraformSemanticError(
			`Missing required attribute "${name}" in ${blockIdentifier}`,
		);
	}
	return attr;
}

/** Helper to get string value from label (Identifier or StringLiteral) */
export function getLabelValue(label: Label): string {
	if (label.type === NodeTypes.Identifier) {
		return label.value;
	}
	// StringLiteral already holds the bare value from the parser
	return label.value;
}
