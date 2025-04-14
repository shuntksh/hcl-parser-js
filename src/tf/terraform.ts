// src/tf/terraform.ts
import type { Block, Expression } from "../types";
import {
	TerraformSemanticError,
	extractAttributes,
	extractNestedBlocks,
	getLabelValue,
} from "./common";

export class TerraformConfigBlock {
	public readonly attributes: Readonly<Record<string, Expression>>;
	public readonly requiredProviders?: Block; // Example nested block
	public readonly backend?: Block; // Example nested block
	public readonly requiredVersion?: Expression;
	// Add other known nested blocks/attributes like 'provider_meta', 'experiments'
	public readonly sourceAst: Block;

	constructor(astNode: Block) {
		if (astNode.blockType.value !== "terraform") {
			throw new TerraformSemanticError(
				`Attempted to create TerraformConfigBlock from AST node type "${astNode.blockType.value}"`,
			);
		}
		if (astNode.labels.length !== 0) {
			// Maybe warn? Terraform ignores labels here.
			console.warn(
				`Terraform block received unexpected labels: ${astNode.labels.map(getLabelValue).join(", ")}`,
			);
		}

		this.sourceAst = astNode;
		this.attributes = extractAttributes(astNode.bodies);
		const nested = extractNestedBlocks(astNode.bodies);

		// Extract known nested blocks
		this.requiredProviders = nested.find(
			(b) => b.blockType.value === "required_providers",
		);
		this.backend = nested.find((b) => b.blockType.value === "backend");

		// Extract known attributes
		this.requiredVersion = this.attributes.required_version;

		// Warn about unknown nested blocks/attributes?
	}
}
