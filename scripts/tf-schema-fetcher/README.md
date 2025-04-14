# Terraform Provider Schema Fetcher

A command-line tool to fetch and cache Terraform provider schemas directly from the Terraform Registry. It uses the local Terraform CLI to extract the schema for specific provider versions, ensuring accuracy.

## Prerequisites

- **Terraform CLI:** Version 0.14+ recommended. Must be installed and accessible in your system's `PATH`.
- **Bun:** Version 1.0.0+ (required for running the script and its dependencies like `bun:semver`).

```bash
# For Mac
brew install terraform
```

## Usage

Run the tool using `bun run`:

```bash
tf-schema-fetcher [options]
```

## Options

- `-p, --provider <spec...>`: Fetch specific provider(s). Formats:
  - namespace/name (fetches latest stable version)
  - namespace/name@version (fetches specific version)
  - namespace/* (fetches latest stable for all providers in the namespace)
  - Cannot be used with `-a` or `-f`.
- `-a, --all`: Fetch the latest stable schema for all known providers in the Terraform Registry. Warning: This can take a significant amount of time.
  - Cannot be used with `-p` or `-f`.
- `-f, --file <filename>`: Fetch providers listed in a file (one spec per line, format same as --provider). Comments (#) and empty lines are ignored.
  - Cannot be used with -p or -a.
- `-o, --out-dir <path>`: Required. Directory where schema files will be stored. 
  - Schemas are saved in a structured format: <out-dir>/<namespace>/<provider>/<version>.json.
  - Default to `./.tf-schema`.
- `--force`: Overwrite existing schema files in the output directory instead of skipping them. Defaults to false.
- `--terraform-path <path>`: Specify a custom path to the Terraform executable (if not in default PATH). Defaults to terraform.
- -h, --help: Display the help message and exit.

## Examples

```bash
# Fetch latest stable AWS and GCP schemas into './tf-schemas' directory
bun run ./schema-fetcher/cli.ts -p hashicorp/aws google/gcp -o ./tf-schemas

# Fetch a specific AWS version
bun run ./schema-fetcher/cli.ts -p hashicorp/aws@5.31.0 -o ./tf-schemas

# Fetch latest stable for all providers in the 'hashicorp' namespace
bun run ./schema-fetcher/cli.ts -p "hashicorp/*" -o ./tf-schemas

# Fetch all providers listed in providers.txt
bun run ./schema-fetcher/cli.ts -f ./providers.txt -o ./tf-schemas

# Fetch latest stable for ALL providers (may take a long time!)
bun run ./schema-fetcher/cli.ts --all -o ./tf-schemas

# Force overwrite schema for AWS even if it exists
bun run ./schema-fetcher/cli.ts -p hashicorp/aws -o ./tf-schemas --force

```

## How it Works

1. Parses command-line arguments to determine which providers/versions to fetch.
2. Handles wildcards (*) by querying the Terraform Registry for matching providers.
3. For each provider/version combination:
   - Checks if the schema file already exists in the <out-dir> (unless --force is used).
   - If needed, resolves the 'latest' stable version by querying the registry.
   - Creates a temporary directory.
   - Generates a minimal main.tf file requiring the specific provider and version.
   - Runs terraform init in the temporary directory.
   - Runs terraform providers schema -json to extract the schema.
   - Parses and validates the schema JSON.
   - Saves the processed schema (with added metadata _provider_fqn and _provider_version) to the specified output directory.
   - Cleans up the temporary directory.

