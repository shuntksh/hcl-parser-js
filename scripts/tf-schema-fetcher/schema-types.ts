// Represents Terraform's type system representation within the schema JSON.
// This can be a simple string (like "string", "number", "bool")
// or a JSON array/object for complex types (list, map, object, set, tuple, optional, etc.).
// Using 'unknown' acknowledges that further parsing/validation is needed
// to fully understand and check against these types programmatically.
export type TerraformType = unknown;

// Represents the structure of a Block (Resource, DataSource, Provider Config, Nested)
export interface TfBlockSchema {
	attributes: Record<string, TfAttributeSchema>;
	block_types: Record<string, TfNestedBlockSchema>;
	description?: string | null;
	description_kind?: string; // e.g., "markdown"
	deprecated?: boolean;
	// Added version for consistency, though might not always be present on nested
	version?: number;
}

// Represents a single Attribute within a Block
export interface TfAttributeSchema {
	type: TerraformType; // Changed from any to unknown
	description?: string | null;
	description_kind?: string;
	required?: boolean;
	optional?: boolean;
	computed?: boolean;
	sensitive?: boolean;
	deprecated?: boolean;
	// Potentially add validation rules if present in schema
}

// Represents a Nested Block definition within a parent Block
export interface TfNestedBlockSchema {
	nesting_mode: "single" | "list" | "set" | "map";
	block: TfBlockSchema;
	min_items?: number;
	max_items?: number;
	description?: string | null;
	description_kind?: string;
	deprecated?: boolean;
}

// Base schema structure for resources and data sources
interface TfTopLevelSchemaBase {
	version: number;
	block: TfBlockSchema;
	description?: string | null;
	description_kind?: string;
	deprecated?: boolean;
}

// Represents the schema for a specific Resource Type
export interface TfResourceSchema extends TfTopLevelSchemaBase {}

// Represents the schema for a specific Data Source Type
export interface TfDataSourceSchema extends TfTopLevelSchemaBase {}

// Defines the structure within provider_schemas
interface TfProviderSchemaDefinition {
	provider: TfResourceSchema; // Schema for the provider block itself
	resource_schemas: Record<string, TfResourceSchema>; // e.g., {"aws_instance": {...}}
	data_source_schemas: Record<string, TfDataSourceSchema>; // e.g., {"aws_ami": {...}}
}

// Represents the full JSON structure from 'terraform providers schema -json'
// This is the raw output structure before adding our custom metadata.
export interface TfProviderSchemaJson {
	format_version: string;
	provider_schemas: Record<string, TfProviderSchemaDefinition>; // Key is registry FQN e.g., "registry.terraform.io/hashicorp/aws"
}

// Represents the *processed* schema object used by our application,
// including added metadata.
export interface TfProviderSchema extends TfProviderSchemaJson {
	// Metadata added during processing
	_provider_fqn: string; // e.g., "hashicorp/aws"
	_provider_version: string;
}

// --- Type Guards ---

// Basic check for the overall raw schema structure
export function isTfProviderSchemaJson(
	obj: unknown,
): obj is TfProviderSchemaJson {
	if (typeof obj !== "object" || obj === null) return false;
	const maybeSchema = obj as Partial<TfProviderSchemaJson>; // Use Partial for checking
	return (
		typeof maybeSchema.format_version === "string" &&
		typeof maybeSchema.provider_schemas === "object" &&
		maybeSchema.provider_schemas !== null
		// Deeper checks could be added here if needed
	);
}

// Check for our processed schema structure
export function isTfProviderSchema(obj: unknown): obj is TfProviderSchema {
	if (!isTfProviderSchemaJson(obj)) return false;
	const maybeSchema = obj as Partial<TfProviderSchema>;
	return (
		typeof maybeSchema._provider_fqn === "string" &&
		typeof maybeSchema._provider_version === "string"
	);
}
