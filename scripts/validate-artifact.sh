#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ "${CLOUDFLARE_ENV_READY:-}" != "1" ]]; then
  exec bash "${script_dir}/cloudflare-env.sh" -- bash "$0" "$@"
fi

worker="${CLOUDFLARE_PROJECT_ROOT}/dist/server/index.js"
wrangler_config="${CLOUDFLARE_PROJECT_ROOT}/dist/server/wrangler.json"
retired_sites_manifest="${CLOUDFLARE_PROJECT_ROOT}/dist/.openai/hosting.json"

[[ -f "${worker}" ]] || {
  echo "Missing Cloudflare Worker entry: dist/server/index.js" >&2
  exit 66
}
[[ -f "${wrangler_config}" ]] || {
  echo "Missing generated Wrangler configuration: dist/server/wrangler.json" >&2
  exit 66
}
[[ ! -e "${retired_sites_manifest}" ]] || {
  echo "Retired ChatGPT Sites manifest must not be packaged." >&2
  exit 66
}

node --input-type=module - "${worker}" "${wrangler_config}" <<'NODE'
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const [workerPath, wranglerPath] = process.argv.slice(2);
const configuration = JSON.parse(await readFile(wranglerPath, "utf8"));
if (configuration.name !== "beta-gestao-365") {
  throw new Error("The generated Worker name is not beta-gestao-365.");
}
if (configuration.main !== "index.js") {
  throw new Error("The generated Worker entry must be dist/server/index.js.");
}
if (configuration.assets?.directory !== "../client") {
  throw new Error("The generated Worker assets directory is invalid.");
}
const d1 = configuration.d1_databases?.find((binding) => binding.binding === "DB");
if (!d1 || d1.database_name !== "beta-gestao-365-db") {
  throw new Error("The production D1 binding DB is missing from the artifact.");
}

const workerUrl = pathToFileURL(workerPath);
workerUrl.searchParams.set("cloudflare-validation", `${process.pid}-${Date.now()}`);
const worker = await import(workerUrl.href);
if (!worker.default || typeof worker.default.fetch !== "function") {
  throw new Error("dist/server/index.js must have an ESM default export with fetch(request, env, ctx)");
}
NODE

echo "Validated Cloudflare artifact: Worker, assets and D1 binding are present."
