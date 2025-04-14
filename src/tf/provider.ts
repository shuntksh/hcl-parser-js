// src/tf/provider.ts
import type { Block, Expression } from "../types";
import { NodeTypes } from "../types";
import {
	TerraformSemanticError,
	extractAttributes,
	extractNestedBlocks,
	getLabelValue,
	getOptionalAttribute,
} from "./common";

export class ProviderBlock {
	public readonly name: string;
	public readonly alias?: string;
	public readonly attributes: Readonly<Record<string, Expression>>;
	public readonly sourceAst: Block;

	constructor(astNode: Block) {
		if (astNode.blockType.value !== "provider") {
			throw new TerraformSemanticError(
				`Attempted to create ProviderBlock from AST node type "${astNode.blockType.value}"`,
			);
		}
		if (astNode.labels.length !== 1) {
			throw new TerraformSemanticError(
				`Provider block must have exactly one label (the provider name), found ${astNode.labels.length}`,
				astNode,
			);
		}

		this.sourceAst = astNode;
		this.name = getLabelValue(astNode.labels[0]!);

		const attributes = extractAttributes(astNode.bodies);
		this.attributes = attributes;

		const aliasExpr = getOptionalAttribute(attributes, "alias");
		// Basic alias handling: assume it's a StringLiteral for simplicity
		// Real handling might need expression evaluation or type checking
		if (
			aliasExpr &&
			aliasExpr.type === NodeTypes.QuotedTemplateExpression &&
			aliasExpr.parts.length === 1 &&
			aliasExpr.parts[0]?.type === NodeTypes.TemplateLiteral
		) {
			this.alias = aliasExpr.parts[0]?.value;
		} else if (aliasExpr) {
			console.warn(
				`Provider "${this.name}" has a complex alias expression which is not fully interpreted.`,
			);
			// Store the expression itself? Maybe add an `aliasExpression` property.
		}

		// Providers generally don't have nested blocks
		const nested = extractNestedBlocks(astNode.bodies);
		if (nested.length > 0) {
			console.warn(
				`Provider block "${this.name}" contains unexpected nested blocks.`,
			);
		}
	}

	// Identifier for lookup, including alias if present
	get identifier(): string {
		return this.alias ? `${this.name}.${this.alias}` : this.name;
	}
}

export class Providers {
	// Store by full identifier (name or name.alias)
	private readonly providers = new Map<string, ProviderBlock>();

	add(provider: ProviderBlock) {
		const id = provider.identifier;
		if (this.providers.has(id)) {
			// Might be okay if merged from different files, but potentially an error
			// if defined identically twice.
			console.warn(
				`Provider "${id}" configuration redefined. Last definition wins.`,
			);
		}
		this.providers.set(id, provider);
	}

	get(name: string, alias?: string): ProviderBlock | undefined {
		const id = alias ? `${name}.${alias}` : name;
		return this.providers.get(id);
	}

	getDefault(name: string): ProviderBlock | undefined {
		return this.providers.get(name); // Get provider without alias
	}

	has(name: string, alias?: string): boolean {
		const id = alias ? `${name}.${alias}` : name;
		return this.providers.has(id);
	}

	get all(): ReadonlyMap<string, ProviderBlock> {
		return this.providers;
	}

	get size(): number {
		return this.providers.size;
	}
}
