import { semver } from "bun"; // Using bun's built-in semver

const REGISTRY_API_BASE = "https://registry.terraform.io/v1";

// --- API Helper ---
async function apiFetch(url: string): Promise<unknown> {
	try {
		const response = await fetch(url, {
			headers: { Accept: "application/json" },
		});
		if (!response.ok) {
			// Attempt to get error message from body
			let errorBody = "";
			try {
				errorBody = await response.text();
			} catch (_) {
				/* ignore */
			}
			throw new Error(
				`Registry API request failed: ${response.status} ${response.statusText} for ${url}. ${errorBody ? `Body: ${errorBody.substring(0, 200)}...` : ""}`,
			);
		}
		// Handle potential empty responses or non-JSON responses gracefully
		const text = await response.text();
		if (!text) {
			return null; // Or consider throwing if JSON is always expected
		}
		return JSON.parse(text);
	} catch (error: unknown) {
		if (error instanceof Error) {
			throw new Error(`Failed to fetch or parse ${url}: ${error.message}`);
		}
		throw new Error(`An unknown error occurred while fetching ${url}`);
	}
}

// --- Provider Listing ---
interface ProviderListResponse {
	providers?: { fqn: string }[];
	meta?: {
		limit: number;
		current_offset: number;
		next_offset?: number;
		next_url?: string;
	};
}

/**
 * Fetches all provider FQNs from the Terraform Registry.
 */
export async function getAllProviderFqns(): Promise<string[]> {
	console.log("Fetching full provider list from Terraform Registry...");
	const fqns: string[] = [];
	let nextUrl: string | null = `${REGISTRY_API_BASE}/providers?limit=100`;
	let pageCount = 0;

	while (nextUrl) {
		pageCount++;
		console.log(`  Fetching provider list page ${pageCount} (${nextUrl})...`);
		const response = await apiFetch(nextUrl);

		if (typeof response !== "object" || response === null) {
			throw new Error(
				`Invalid non-object response from provider list API: ${nextUrl}`,
			);
		}

		const page = response as ProviderListResponse;

		if (!page.providers || !Array.isArray(page.providers)) {
			console.warn("Warning: Invalid response structure received:", page);
			throw new Error(
				`Invalid response structure: missing providers array from ${nextUrl}`,
			);
		}

		for (const p of page.providers) {
			if (p?.fqn && typeof p.fqn === "string") {
				fqns.push(p.fqn);
			} else {
				console.warn(
					`  Skipping provider with invalid FQN data: ${JSON.stringify(p)}`,
				);
			}
		}

		nextUrl = page.meta?.next_url || null;
		// Add a small delay to avoid hammering the API
		if (nextUrl) await new Promise((resolve) => setTimeout(resolve, 150));
	}
	console.log(`Fetched ${fqns.length} provider FQNs.`);
	return fqns;
}

// --- Version Fetching ---
interface ProviderVersionsResponse {
	versions?: { version: string; protocols?: string[] }[];
}

/**
 * Checks if a version string looks like a stable SemVer (X.Y.Z).
 * Excludes pre-releases (e.g., X.Y.Z-beta.1) and build metadata.
 */
function isStableSemVer(version: string): boolean {
	// Regex for X.Y.Z - ensures no extra characters like -alpha or +build
	const stableSemVerRegex = /^\d+\.\d+\.\d+$/;
	return stableSemVerRegex.test(version);
}

/**
 * Fetches the latest *stable* semantic version for a given provider FQN.
 * Filters out pre-release versions.
 * @param providerFqn - Fully qualified provider name (e.g., "hashicorp/aws").
 * @returns The latest stable version string, or null if none found or error occurs.
 */
export async function getLatestProviderVersion(
	providerFqn: string,
): Promise<string | null> {
	const url = `${REGISTRY_API_BASE}/providers/${providerFqn}/versions`;
	try {
		const response = await apiFetch(url);

		if (typeof response !== "object" || response === null) {
			console.warn(
				`  Received non-object response for versions of ${providerFqn}`,
			);
			return null;
		}

		const data = response as ProviderVersionsResponse;
		if (
			!data.versions ||
			!Array.isArray(data.versions) ||
			data.versions.length === 0
		) {
			console.warn(`  No versions found for provider ${providerFqn}`);
			return null; // No versions found
		}

		// Filter for stable SemVer versions only
		const stableVersions = data.versions
			.map((v) => v.version)
			.filter((v): v is string => typeof v === "string" && isStableSemVer(v)); // Type assertion after check

		if (stableVersions.length === 0) {
			console.warn(`  No stable SemVer versions found for ${providerFqn}`);
			return null; // No stable versions found
		}

		// Sort descending using semver to get the latest stable version first
		// Handle potential errors during sorting just in case
		try {
			stableVersions.sort((a, b) => semver.order(b, a));
		} catch (sortError) {
			console.error(`  Error sorting versions for ${providerFqn}:`, sortError);
			// Fallback: maybe return the first valid one found? Or null.
			return stableVersions.length > 0 ? (stableVersions[0] ?? null) : null;
		}

		// Return the highest valid stable semver version found
		const latest = stableVersions[0] ?? null;
		if (latest) {
			console.log(`  Latest stable version for ${providerFqn}: ${latest}`);
		} else {
			console.warn(
				`  Could not determine latest stable version for ${providerFqn} after sorting.`,
			);
		}
		return latest;
	} catch (error: unknown) {
		console.error(
			`  Error fetching versions for ${providerFqn}:`,
			error instanceof Error ? error.message : String(error),
		);
		return null; // Return null on error to allow skipping
	}
}
