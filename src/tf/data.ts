// src/tf/data.ts
import type { Block, Expression } from "../types";
import {
	TerraformSemanticError,
	extractAttributes,
	extractNestedBlocks,
	getLabelValue,
	getOptionalAttribute,
} from "./common";

export class DataBlock {
	public readonly dataSourceType: string;
	public readonly dataSourceName: string;
	public readonly attributes: Readonly<Record<string, Expression>>;
	public readonly nestedBlocks: Readonly<Record<string, Block[]>>;
	public readonly sourceAst: Block;

	// Convenience getters for common meta-arguments
	public readonly dependsOn?: Expression;
	public readonly provider?: Expression;

	constructor(astNode: Block) {
		if (astNode.blockType.value !== "data") {
			throw new TerraformSemanticError(
				`Attempted to create DataBlock from AST node type "${astNode.blockType.value}"`,
			);
		}
		if (astNode.labels.length !== 2) {
			throw new TerraformSemanticError(
				`Data block must have exactly two labels (type and name), found ${astNode.labels.length}`,
				astNode,
			);
		}

		this.sourceAst = astNode;
		this.dataSourceType = getLabelValue(astNode.labels[0]!);
		this.dataSourceName = getLabelValue(astNode.labels[1]!);

		this.attributes = extractAttributes(astNode.bodies);
		const allNested = extractNestedBlocks(astNode.bodies);

		const nestedMap: Record<string, Block[]> = {};
		for (const block of allNested) {
			const typeName = block.blockType.value;
			if (!nestedMap[typeName]) {
				nestedMap[typeName] = [];
			}
			nestedMap[typeName].push(block);
		}
		this.nestedBlocks = nestedMap;

		this.dependsOn = getOptionalAttribute(this.attributes, "depends_on");
		this.provider = getOptionalAttribute(this.attributes, "provider");
	}

	getAttribute(name: string): Expression | undefined {
		return this.attributes[name];
	}

	getNestedBlocks(typeName: string): Readonly<Block[]> | undefined {
		return this.nestedBlocks[typeName];
	}
}

// Container for Data Blocks (similar structure to Resources)
export class DataSources {
	private readonly dataSources = new Map<string, Map<string, DataBlock>>();

	add(dataBlock: DataBlock) {
		const { dataSourceType, dataSourceName } = dataBlock;
		if (!this.dataSources.has(dataSourceType)) {
			this.dataSources.set(dataSourceType, new Map());
		}
		const typeMap = this.dataSources.get(dataSourceType)!;

		if (typeMap.has(dataSourceName)) {
			throw new TerraformSemanticError(
				`Data source "${dataSourceType}.${dataSourceName}" is defined multiple times.`,
				dataBlock.sourceAst,
			);
		}
		typeMap.set(dataSourceName, dataBlock);
	}

	get(type: string, name: string): DataBlock | undefined {
		return this.dataSources.get(type)?.get(name);
	}

	getByType(type: string): ReadonlyMap<string, DataBlock> | undefined {
		return this.dataSources.get(type);
	}

	has(type: string, name: string): boolean {
		return this.dataSources.get(type)?.has(name) ?? false;
	}

	get all(): ReadonlyMap<string, ReadonlyMap<string, DataBlock>> {
		return this.dataSources;
	}

	get size(): number {
		let count = 0;
		for (const typeMap of this.dataSources.values()) {
			count += typeMap.size;
		}
		return count;
	}
}
