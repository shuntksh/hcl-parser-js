import { exec, type ExecException } from "node:child_process";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { promisify } from "node:util";

import {
	isTfProviderSchemaJson,
	type TfProviderSchemaJson,
} from "./schema-types";

const execPromise = promisify(exec);
const MAX_BUFFER_SIZE = 1024 * 1024 * 100; // 100MB buffer for large schemas

// Custom error class for schema fetching issues
export class SchemaFetcherError extends Error {
	constructor(
		message: string,
		public code?: string | number | null, // Terraform exit code or other error code
		public stdout?: string,
		public stderr?: string,
	) {
		super(message);
		this.name = "SchemaFetcherError";
		// Ensure stack trace is captured correctly
		if (Error.captureStackTrace) {
			Error.captureStackTrace(this, SchemaFetcherError);
		}
	}
}

// Type guard for ExecException from child_process
function isExecException(
	error: unknown,
): error is ExecException & { stdout?: string; stderr?: string } {
	return error instanceof Error && "code" in error;
}

/**
 * Executes Terraform commands in a temporary directory to extract the schema JSON
 * for a specific provider version.
 *
 * @param providerFqn - Fully qualified provider name (e.g., "hashicorp/aws").
 * @param version - The specific provider version (e.g., "5.30.0").
 * @param terraformPath - Path to the Terraform executable.
 * @returns The validated raw provider schema JSON object (implements TfProviderSchemaJson).
 * @throws {SchemaFetcherError} if Terraform commands fail, JSON is invalid, or structure is wrong.
 */
export async function fetchProviderSchema(
	providerFqn: string,
	version: string,
	terraformPath = "terraform",
): Promise<TfProviderSchemaJson> {
	const tempDir = await fs.mkdtemp(
		path.join(os.tmpdir(), `tf-schema-${providerFqn.replace(/[\/\\]/g, "-")}-`),
	);
	const mainTfPath = path.join(tempDir, "main.tf");

	console.log(
		`  Fetching schema for ${providerFqn} v${version} (using temporary directory ${path.basename(tempDir)})...`,
	);

	// Simple validation
	const fqnParts = providerFqn.split("/");
	if (fqnParts.length < 2 || !fqnParts[0] || !fqnParts[1]) {
		throw new SchemaFetcherError(
			`Invalid provider FQN format: "${providerFqn}". Expected "namespace/name".`,
		);
	}
	const providerName = fqnParts[fqnParts.length - 1]; // Handle cases like "registry.terraform.io/hashicorp/aws"

	// 1. Create temporary main.tf
	const tfConfig = `
terraform {
  required_providers {
    ${providerName} = {
      source  = "${providerFqn}"
      version = "${version}"
    }
  }
}

# Define an empty provider block to ensure it's processed for schema generation
provider "${providerName}" {}
`;
	await fs.writeFile(mainTfPath, tfConfig);

	try {
		// 2. Run terraform init
		console.log(`    Running \`${terraformPath} init\`...`);
		try {
			// Use TF_IN_AUTOMATION to suppress interactive prompts and color codes
			const { stderr: initStderr } = await execPromise(
				`${terraformPath} init -no-color`,
				{ cwd: tempDir, env: { ...process.env, TF_IN_AUTOMATION: "true" } },
			);
			if (initStderr) {
				console.warn(`    \`terraform init\` stderr: ${initStderr.trim()}`);
			}
		} catch (error: unknown) {
			let message = "Unknown error during 'terraform init'";
			let stdout: string | undefined;
			let stderr: string | undefined;
			let code: string | number | null = null;
			if (isExecException(error)) {
				message = `\`terraform init\` failed (code ${error.code}): ${error.message}`;
				stdout = error.stdout;
				stderr = error.stderr;
				code = error.code ?? null;
			} else if (error instanceof Error) {
				message = `\`terraform init\` failed: ${error.message}`;
			}
			// Include stderr in the error message if available
			const detailedMessage = stderr
				? `${message}\nStderr:\n${stderr}`
				: message;
			throw new SchemaFetcherError(detailedMessage, code, stdout, stderr);
		}

		// 3. Run terraform providers schema -json
		console.log(`    Running \`${terraformPath} providers schema -json\`...`);
		let schemaJsonString: string;
		try {
			const { stdout: schemaStdout, stderr: schemaStderr } = await execPromise(
				`${terraformPath} providers schema -json`,
				{
					cwd: tempDir,
					maxBuffer: MAX_BUFFER_SIZE, // Increase buffer for potentially large schemas
					env: { ...process.env, TF_IN_AUTOMATION: "true" },
				},
			);
			if (schemaStderr) {
				console.warn(
					`    \`terraform providers schema\` stderr: ${schemaStderr.trim()}`,
				);
			}
			schemaJsonString = schemaStdout;
		} catch (error: unknown) {
			let message = "Unknown error during 'terraform providers schema -json'";
			let stdout: string | undefined;
			let stderr: string | undefined;
			let code: string | number | null = null;
			if (isExecException(error)) {
				message = `\`terraform providers schema -json\` failed (code ${error.code}): ${error.message}`;
				stdout = error.stdout;
				stderr = error.stderr;
				code = error.code ?? null;
			} else if (error instanceof Error) {
				message = `\`terraform providers schema -json\` failed: ${error.message}`;
			}
			const detailedMessage = stderr
				? `${message}\nStderr:\n${stderr}`
				: message;
			throw new SchemaFetcherError(detailedMessage, code, stdout, stderr);
		}

		// 4. Parse and validate the JSON output
		console.log("    Parsing schema JSON...");
		try {
			const parsedJson = JSON.parse(schemaJsonString);

			// Validate structure using the type guard
			if (!isTfProviderSchemaJson(parsedJson)) {
				console.error(
					`Invalid schema structure: ${JSON.stringify(parsedJson, null, 2).substring(0, 1000)}...`,
				);
				throw new Error(
					"Fetched data does not conform to the expected Terraform schema JSON structure (TfProviderSchemaJson).",
				);
			}
			console.log("    Schema parsed and validated successfully.");
			return parsedJson; // Return the validated raw structure
		} catch (parseError: unknown) {
			let message = "Unknown error parsing schema JSON";
			if (parseError instanceof Error) {
				message = `Failed to parse schema JSON: ${parseError.message}`;
			}
			// Include beginning of the invalid JSON for context
			const context =
				schemaJsonString.substring(0, 500) +
				(schemaJsonString.length > 500 ? "..." : "");
			throw new SchemaFetcherError(`${message}\nReceived:\n${context}`);
		}
	} finally {
		// 5. Clean up temporary directory
		console.log(
			`    Cleaning up temporary directory ${path.basename(tempDir)}...`,
		);
		await fs.rm(tempDir, { recursive: true, force: true }).catch((rmError) => {
			// Log cleanup error but don't fail the overall operation if fetch succeeded
			console.error(
				`    Warning: Failed to cleanup temp directory ${tempDir}:`,
				rmError instanceof Error ? rmError.message : rmError,
			);
		});
	}
}
