#!/usr/bin/env bun

import { Command, Option } from "commander";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { getAndCacheProviderSchema } from "./tf-schema-fetcher/get_schema";
import {
	getAllProviderFqns,
	getLatestProviderVersion,
} from "./tf-schema-fetcher/schema-registry";

interface CliOptions {
	provider?: string[]; // Can contain 'fqn', 'fqn@version', or 'namespace/*'
	all?: boolean;
	file?: string;
	outDir: string;
	force?: boolean;
	terraformPath: string;
}

interface ProviderTask {
	fqn: string;
	version: string; // Specific version or resolved latest version
}

// --- Helper Functions ---

/**
 * Parses a single provider spec string.
 * Returns null if the format is invalid.
 * Distinguishes between exact FQNs and wildcard patterns.
 */
function parseSingleProviderSpec(
	spec: string,
):
	| { type: "exact"; fqn: string; version: string | "latest" }
	| { type: "wildcard"; namespace: string }
	| null {
	const fqnVersionRegex = /^([a-zA-Z0-9.-]+\/[a-zA-Z0-9-]+)(?:@([\w.-]+))?$/;
	const wildcardRegex = /^([a-zA-Z0-9.-]+)\/\*$/; // Matches "namespace/*"

	const wildcardMatch = spec.match(wildcardRegex);
	if (wildcardMatch) {
		return { type: "wildcard", namespace: wildcardMatch[1]! };
	}

	const fqnMatch = spec.match(fqnVersionRegex);
	if (fqnMatch) {
		const [, fqn, version] = fqnMatch;
		if (!fqn?.includes("/")) {
			// Ensure namespace/name format
			console.warn(
				`Skipping invalid provider FQN format: "${fqn}". Must be "namespace/name".`,
			);
			return null;
		}
		return { type: "exact", fqn, version: version || "latest" };
	}

	console.warn(
		`Skipping invalid provider specification: "${spec}". Expected "namespace/name", "namespace/name@version", or "namespace/*".`,
	);
	return null;
}

/** Reads provider specs from a file */
async function readProviderSpecsFromFile(filePath: string): Promise<string[]> {
	try {
		const content = await fs.readFile(filePath, "utf-8");
		const lines = content
			.split(/\r?\n/)
			.map((line) => line.trim())
			.filter((line) => line && !line.startsWith("#")); // Ignore empty lines and comments
		if (lines.length === 0) {
			console.warn(
				`Warning: Provider file "${filePath}" is empty or contains only comments.`,
			);
		}
		return lines;
	} catch (error: unknown) {
		if (error instanceof Error) {
			throw new Error(
				`Failed to read provider file "${filePath}": ${error.message}`,
			);
		}
		throw new Error(`Failed to read provider file "${filePath}": ${error}`);
	}
}

/**
 * Processes a list of provider specs (including wildcards) into a final list of tasks.
 * Fetches all providers from registry if wildcards are present.
 * Resolves 'latest' versions.
 * Deduplicates tasks based on FQN.
 */
async function resolveProviderTasks(
	specs: string[],
	terraformPath: string, // Needed if we were resolving versions here, but resolution happens later now
): Promise<ProviderTask[]> {
	let allRegistryFqns: string[] | null = null;
	const initialTasks: { fqn: string; version: string | "latest" }[] = [];
	const wildcardNamespaces: string[] = [];

	// 1. Parse all specs and separate exact from wildcard
	for (const spec of specs) {
		const parsed = parseSingleProviderSpec(spec);
		if (parsed) {
			if (parsed.type === "exact") {
				initialTasks.push({ fqn: parsed.fqn, version: parsed.version });
			} else if (parsed.type === "wildcard") {
				if (!wildcardNamespaces.includes(parsed.namespace)) {
					wildcardNamespaces.push(parsed.namespace);
				}
			}
		}
	}

	// 2. Expand wildcards if necessary
	if (wildcardNamespaces.length > 0) {
		console.log(
			"Wildcard(s) detected, fetching full provider list from registry...",
		);
		try {
			allRegistryFqns = await getAllProviderFqns();
			console.log(
				`Registry query complete (${allRegistryFqns?.length || 0} providers found).`,
			);
		} catch (error: unknown) {
			if (error instanceof Error) {
				console.error(
					`❌ Error fetching provider list for wildcard expansion: ${error.message}`,
				);
			} else {
				console.error(
					`❌ Error fetching provider list for wildcard expansion: ${error}`,
				);
			}
			// Decide: throw or continue without wildcard expansion? Let's throw.
			throw new Error(
				"Failed to fetch provider list required for wildcard expansion.",
			);
		}

		if (allRegistryFqns) {
			for (const namespace of wildcardNamespaces) {
				const prefix = `${namespace}/`;
				const matchedFqns = allRegistryFqns.filter((fqn) =>
					fqn.startsWith(prefix),
				);
				console.log(
					`  Wildcard "${namespace}/*" expanded to ${matchedFqns.length} provider(s).`,
				);
				for (const fqn of matchedFqns) {
					// Add wildcard matches with 'latest' version marker
					initialTasks.push({ fqn, version: "latest" });
				}
			}
		}
	}

	// 3. Deduplicate and finalize tasks (prioritize specific versions over 'latest')
	// We now resolve 'latest' *later* just before fetching each provider.
	// We just need to deduplicate based on FQN, prioritizing specific versions.
	const finalTaskMap = new Map<
		string,
		{ fqn: string; version: string | "latest" }
	>();
	for (const task of initialTasks) {
		const existing = finalTaskMap.get(task.fqn);
		if (!existing) {
			finalTaskMap.set(task.fqn, task);
		} else {
			// If current task has specific version and existing is 'latest', overwrite
			if (task.version !== "latest" && existing.version === "latest") {
				finalTaskMap.set(task.fqn, task);
			}
			// If current is 'latest', don't overwrite existing specific version.
			// If both are specific, the last one encountered in the initial list wins (arbitrary but consistent).
			else if (task.version !== "latest" && existing.version !== "latest") {
				// Optional: Warn about conflicting specific versions? For now, last wins.
				finalTaskMap.set(task.fqn, task); // Keep the later one
			}
		}
	}

	// The tasks at this point still have 'latest'. Resolution happens in the main loop.
	return Array.from(finalTaskMap.values());
}

// --- Main CLI Logic ---

async function main() {
	const program = new Command();

	program
		.version("1.1.0") // Incremented version for new feature
		.description("CLI tool to fetch and cache Terraform provider schemas")
		.addOption(
			new Option(
				"-p, --provider <spec...>", // Allows multiple values
				'Fetch schema for specific provider(s). Format: "namespace/name", "namespace/name@version", or "namespace/*" (wildcard). Fetches latest stable if version omitted or wildcard used.',
			).conflicts(["all", "file"]),
		)
		.addOption(
			new Option(
				"-a, --all",
				"Fetch the latest stable schema for ALL providers in the Terraform Registry.",
			).conflicts(["provider", "file"]),
		)
		.addOption(
			new Option(
				"-f, --file <filename>",
				"Fetch schemas for providers listed in a file (one per line, format same as --provider).",
			).conflicts(["provider", "all"]),
		)
		.requiredOption(
			"-o, --out-dir <path>",
			"Directory to store schema files",
			path.resolve(process.cwd(), ".tf-schemas"),
		)
		.option(
			"--force",
			"Overwrite existing schema files instead of skipping.",
			false,
		)
		.option(
			"--terraform-path <path>",
			"Path to the Terraform executable.",
			"terraform",
		);

	program.parse(process.argv);
	const options = program.opts<CliOptions>();

	if (!options.provider && !options.all && !options.file) {
		console.error(
			"Error: Must specify providers via --provider, --all, or --file.",
		);
		program.help();
		process.exit(1);
	}

	options.outDir = path.resolve(options.outDir);
	console.log(`Schema output directory: ${options.outDir}`);

	let providerSpecs: string[] = [];
	let fetchMode = "";
	let initialTaskCount = 0; // Track count before deduplication/resolution

	try {
		if (options.provider) {
			fetchMode = "specific providers/wildcards";
			providerSpecs = options.provider;
			initialTaskCount = providerSpecs.length;
		} else if (options.file) {
			fetchMode = `providers from file ${options.file}`;
			providerSpecs = await readProviderSpecsFromFile(options.file);
			initialTaskCount = providerSpecs.length;
		} else if (options.all) {
			fetchMode = "all providers";
			console.log("Fetching full provider list for --all mode...");
			const allFqns = await getAllProviderFqns();
			initialTaskCount = allFqns.length;
			// Represent --all as specs with 'latest' version marker
			providerSpecs = allFqns.map((fqn) => `${fqn}@latest`);
		}
	} catch (error: unknown) {
		if (error instanceof Error) {
			console.error(`Error preparing provider list: ${error.message}`);
		} else {
			console.error(`Error preparing provider list: ${error}`);
		}
		process.exit(1);
	}

	if (providerSpecs.length === 0) {
		console.log(
			`No valid provider specifications found for mode "${fetchMode}". Nothing to do.`,
		);
		process.exit(0);
	}

	console.log(
		`\nFound ${initialTaskCount} initial provider specification(s) for mode "${fetchMode}".`,
	);
	console.log(
		"Resolving specifications (expanding wildcards, deduplicating)...",
	);

	// Resolve specs into final, deduplicated tasks (still potentially with 'latest')
	let tasksToProcess: { fqn: string; version: string | "latest" }[];
	try {
		tasksToProcess = await resolveProviderTasks(
			providerSpecs,
			options.terraformPath,
		);
	} catch (error: unknown) {
		if (error instanceof Error) {
			console.error(`❌ Error resolving provider tasks: ${error.message}`);
		} else {
			console.error(`❌ Error resolving provider tasks: ${error}`);
		}
		process.exit(1);
	}

	if (tasksToProcess.length === 0) {
		console.log("No providers to fetch after resolving specifications.");
		process.exit(0);
	}

	console.log(
		`\nStarting schema fetch for ${tasksToProcess.length} unique provider(s)...`,
	);
	console.log(`Force overwrite: ${options.force ? "Enabled" : "Disabled"}`);
	console.log(`Using Terraform executable: ${options.terraformPath}`);

	let successCount = 0;
	let skipCount = 0;
	let errorCount = 0;

	// Process tasks sequentially
	for (let i = 0; i < tasksToProcess.length; i++) {
		const task = tasksToProcess[i];
		if (!task) {
			console.error(`❌ No task found at index ${i}`);
			continue;
		}
		let versionToFetch = task.version; // Could be 'latest' or a specific version

		const progressPrefix = `[${i + 1}/${tasksToProcess.length}]`;
		const providerDisplayName = `${task.fqn}${versionToFetch === "latest" ? " (latest)" : `@${versionToFetch}`}`;

		console.log(`\n${progressPrefix} Processing ${providerDisplayName}...`);

		// Resolve 'latest' version just before fetching if needed
		if (versionToFetch === "latest") {
			console.log(`  Resolving latest stable version for ${task.fqn}...`);
			const latestVersion = await getLatestProviderVersion(task.fqn);
			if (!latestVersion) {
				console.error(
					`  ❌ Failed to determine latest stable version for ${task.fqn}. Skipping.`,
				);
				errorCount++;
				continue;
			}
			versionToFetch = latestVersion; // Now we have the actual version string
			console.log(
				`  Resolved ${task.fqn} latest version to: ${versionToFetch}`,
			);
		}

		// We now have a definite fqn and version string
		try {
			const schema = await getAndCacheProviderSchema(task.fqn, versionToFetch, {
				outputDir: options.outDir,
				terraformPath: options.terraformPath,
				force: options.force,
			});

			if (schema === null) {
				skipCount++; // Logged within getAndCacheProviderSchema
			} else {
				successCount++; // Logged within getAndCacheProviderSchema
			}
		} catch (error: unknown) {
			errorCount++;
			// Error logging is now more detailed inside getAndCacheProviderSchema and fetchProviderSchema
			// Log a summary error here
			if (error instanceof Error) {
				console.error(
					`  ❌ Error processing ${task.fqn} v${versionToFetch}: ${error.message.split("\n")[0]}`,
				); // Show first line
			} else {
				console.error(
					`  ❌ Unknown error occurred for ${task.fqn} v${versionToFetch}:`,
					error,
				);
			}
			// Detailed logging (like stderr) would have happened inside the fetch/cache functions
		}
		if (tasksToProcess.length > 10)
			await new Promise((resolve) => setTimeout(resolve, 50));
	}

	// --- Final Summary ---
	console.log("\n--- Schema Fetch Summary ---");
	console.log(`Successfully Fetched/Saved: ${successCount}`);
	console.log(`Skipped (Already Existed): ${skipCount}`);
	console.log(`Errors: ${errorCount}`);
	console.log(`Total Unique Providers Processed: ${tasksToProcess.length}`);
	console.log(`Schema files stored in: ${options.outDir}`);
	console.log("--------------------------\n");

	if (errorCount > 0) {
		process.exit(1);
	}
}

// Execute the main function
main().catch((err) => {
	console.error("\nUnhandled exception during CLI execution:", err);
	process.exit(1);
});
