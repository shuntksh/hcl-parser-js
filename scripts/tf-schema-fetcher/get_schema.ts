import * as fs from "node:fs/promises";
import * as path from "node:path";
import { fetchProviderSchema, SchemaFetcherError } from "./schema-fetcher";
import type { TfProviderSchema, TfProviderSchemaJson } from "./schema-types";

export interface GetSchemaOptions {
	outputDir: string; // Changed from cacheDir
	terraformPath?: string;
	force?: boolean; // Controls skipping existing files
}

/**
 * Calculates the path where a provider schema should be stored.
 * Uses the structure: <outputDir>/<namespace>/<providerName>/<version>.json
 */
function getSchemaFilePath(
	outputDir: string,
	providerFqn: string,
	version: string,
): string {
	const [namespace, providerName] = providerFqn.split("/");
	if (!namespace || !providerName) {
		// This should ideally be caught earlier, but double-check
		throw new Error(
			`Invalid provider FQN: ${providerFqn}. Expected format 'namespace/name'.`,
		);
	}
	return path.join(outputDir, namespace, providerName, `${version}.json`);
}

/**
 * Gets the structured schema for a specific provider version,
 * fetching if necessary and storing it in the specified output directory.
 * Skips fetching if the file already exists unless `force` is true.
 *
 * @param providerFqn - Fully qualified provider name (e.g., "hashicorp/aws").
 * @param version - The specific provider version (e.g., "5.30.0").
 * @param options - Configuration options including output directory and force flag.
 * @returns The processed TfProviderSchema object, or null if skipped.
 * @throws {SchemaFetcherError | Error} if schema cannot be fetched, parsed, validated, or saved.
 */
export async function getAndCacheProviderSchema(
	providerFqn: string,
	version: string,
	options: GetSchemaOptions,
): Promise<TfProviderSchema | null> {
	const { outputDir, terraformPath = "terraform", force = false } = options;

	// Validate FQN early
	if (!providerFqn.includes("/")) {
		throw new Error(
			`Invalid provider FQN "${providerFqn}". Must be in "namespace/name" format.`,
		);
	}

	const schemaFilePath = getSchemaFilePath(outputDir, providerFqn, version);
	const schemaFileDir = path.dirname(schemaFilePath);

	// 1. Check if schema file exists and handle skip/force logic
	try {
		await fs.access(schemaFilePath, fs.constants.F_OK);
		// File exists
		if (!force) {
			console.log(
				`  Schema for ${providerFqn} v${version} already exists at ${schemaFilePath}. Skipping (use --force to overwrite).`,
			);
			// Optionally, read and validate the existing file? For now, just skip.
			// Consider reading and returning if we need the schema object even when skipping fetch.
			// Let's return null to indicate it wasn't fetched *now*.
			return null;
		}
		console.log(
			`  Schema for ${providerFqn} v${version} exists, but --force specified. Overwriting...`,
		);
	} catch (error: unknown) {
		// File does not exist (ENOENT) or other access error
		if (error instanceof Error && "code" in error && error.code !== "ENOENT") {
			// Log other errors (like permission issues) but proceed to fetch
			console.warn(
				`  Warning: Could not check existing schema file ${schemaFilePath}: ${error.message}. Attempting to fetch...`,
			);
		}
		// If ENOENT, file doesn't exist, proceed to fetch.
		console.log(
			`  Schema for ${providerFqn} v${version} not found locally. Fetching...`,
		);
	}

	// 2. Fetch raw schema JSON using fetchProviderSchema
	// It now returns TfProviderSchemaJson or throws SchemaFetcherError/Error
	let rawSchemaJson: TfProviderSchemaJson;
	try {
		rawSchemaJson = await fetchProviderSchema(
			providerFqn,
			version,
			terraformPath,
		);
	} catch (fetchError) {
		// Re-throw fetch errors to be handled by the CLI
		console.error(`  Failed to fetch schema for ${providerFqn} v${version}.`);
		throw fetchError; // Propagate the error (could be SchemaFetcherError)
	}

	// 3. Add metadata to create the processed schema object
	// Validation of rawSchemaJson happened within fetchProviderSchema
	const processedSchema: TfProviderSchema = {
		...rawSchemaJson, // Spread the validated raw schema
		_provider_fqn: providerFqn,
		_provider_version: version,
	};

	// 4. Store processed schema in the output directory
	try {
		await fs.mkdir(schemaFileDir, { recursive: true });
		await fs.writeFile(
			schemaFilePath,
			JSON.stringify(processedSchema, null, 2), // Pretty-print JSON
			"utf-8",
		);
		console.log(
			`✔ Schema for ${providerFqn} v${version} saved to ${schemaFilePath}`,
		);
	} catch (writeError: unknown) {
		let message = `Failed to write schema file to ${schemaFilePath}`;
		if (writeError instanceof Error) {
			message = `${message}: ${writeError.message}`;
		}
		// Throw this as a critical error, as the fetch succeeded but saving failed
		throw new Error(message);
	}

	return processedSchema;
}
