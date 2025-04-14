// src/tf/resource.ts
import type { Block, Expression } from "../types";
import {
	extractAttributes,
	extractNestedBlocks,
	getLabelValue,
	getOptionalAttribute,
	TerraformSemanticError,
} from "./common";

// Represents known nested blocks often found in resources
export type KnownNestedBlocks = {
	lifecycle?: Block;
	dynamic: Block[]; // Dynamic is repeatable
	// Add others like 'connection', 'provisioner' if needed
};

export class ResourceBlock {
	public readonly resourceType: string;
	public readonly resourceName: string;
	public readonly attributes: Readonly<Record<string, Expression>>;
	public readonly nestedBlocks: Readonly<Record<string, Block[]>>; // All nested blocks
	public readonly knownNestedBlocks: Readonly<KnownNestedBlocks>; // Specially handled blocks
	public readonly sourceAst: Block;

	// Convenience getters for common meta-arguments
	public readonly count?: Expression;
	public readonly forEach?: Expression;
	public readonly dependsOn?: Expression;
	public readonly provider?: Expression;

	constructor(astNode: Block) {
		if (astNode.blockType.value !== "resource") {
			throw new TerraformSemanticError(
				`Attempted to create ResourceBlock from AST node type "${astNode.blockType.value}"`,
			);
		}
		if (astNode.labels.length !== 2) {
			throw new TerraformSemanticError(
				`Resource block must have exactly two labels (type and name), found ${astNode.labels.length}`,
				astNode,
			);
		}

		this.sourceAst = astNode;
		this.resourceType = getLabelValue(astNode.labels[0]!);
		this.resourceName = getLabelValue(astNode.labels[1]!);

		this.attributes = extractAttributes(astNode.bodies);
		const allNested = extractNestedBlocks(astNode.bodies);

		// Store all nested blocks generically
		const nestedMap: Record<string, Block[]> = {};
		for (const block of allNested) {
			const typeName = block.blockType.value;
			if (!nestedMap[typeName]) {
				nestedMap[typeName] = [];
			}
			nestedMap[typeName].push(block);
		}
		this.nestedBlocks = nestedMap;

		// Extract known/special nested blocks
		const knownBlocks: KnownNestedBlocks = {
			lifecycle: nestedMap.lifecycle?.[0], // Lifecycle is usually singular
			dynamic: nestedMap.dynamic ?? [],
		};
		if (nestedMap.lifecycle?.length && nestedMap.lifecycle.length > 1) {
			console.warn(
				`Resource "${this.resourceType}.${this.resourceName}" has multiple lifecycle blocks. Only the first one is specially handled.`,
			);
		}
		this.knownNestedBlocks = knownBlocks;

		// Extract common meta-arguments from attributes
		this.count = getOptionalAttribute(this.attributes, "count");
		this.forEach = getOptionalAttribute(this.attributes, "for_each");
		this.dependsOn = getOptionalAttribute(this.attributes, "depends_on");
		this.provider = getOptionalAttribute(this.attributes, "provider");
	}

	/**
	 * Gets a specific attribute expression.
	 */
	getAttribute(name: string): Expression | undefined {
		return this.attributes[name];
	}

	/**
	 * Gets all nested blocks of a specific type.
	 */
	getNestedBlocks(typeName: string): Readonly<Block[]> | undefined {
		return this.nestedBlocks[typeName];
	}
}

// Updated Resources container
export class Resources {
	// Store by type, then by name
	private readonly resources = new Map<string, Map<string, ResourceBlock>>();

	add(resource: ResourceBlock) {
		const { resourceType, resourceName } = resource;
		if (!this.resources.has(resourceType)) {
			this.resources.set(resourceType, new Map());
		}
		const typeMap = this.resources.get(resourceType)!;

		if (typeMap.has(resourceName)) {
			// Terraform merges configurations, but duplicate resource declarations
			// with the same type and name are usually an error.
			throw new TerraformSemanticError(
				`Resource "${resourceType}.${resourceName}" is defined multiple times.`,
				resource.sourceAst,
			);
		}
		typeMap.set(resourceName, resource);
	}

	get(type: string, name: string): ResourceBlock | undefined {
		return this.resources.get(type)?.get(name);
	}

	getByType(type: string): ReadonlyMap<string, ResourceBlock> | undefined {
		return this.resources.get(type);
	}

	has(type: string, name: string): boolean {
		return this.resources.get(type)?.has(name) ?? false;
	}

	get all(): ReadonlyMap<string, ReadonlyMap<string, ResourceBlock>> {
		return this.resources;
	}

	get size(): number {
		let count = 0;
		for (const typeMap of this.resources.values()) {
			count += typeMap.size;
		}
		return count;
	}
}
