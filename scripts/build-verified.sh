#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ "${CLOUDFLARE_ENV_READY:-}" != "1" ]]; then
  exec bash "${script_dir}/cloudflare-env.sh" -- bash "$0" "$@"
fi

command -v timeout >/dev/null || {
  echo "build-verified.sh requires GNU timeout." >&2
  exit 69
}

vinext="${CLOUDFLARE_PROJECT_ROOT}/node_modules/.bin/vinext"
if [[ ! -x "${vinext}" ]]; then
  echo "vinext is unavailable. Install the locked dependencies before building." >&2
  exit 69
fi

# `dist` is generated and ignored. Remove only the retired Sites packaging
# directory so an old local build can never leak into a Cloudflare release.
retired_sites_output="${CLOUDFLARE_PROJECT_ROOT}/dist/.openai"
if [[ -d "${retired_sites_output}" ]]; then
  rm -rf -- "${retired_sites_output}"
fi

echo "Running bounded vinext build..."
timeout \
  --signal=TERM \
  --kill-after="${CLOUDFLARE_BUILD_KILL_AFTER:-10s}" \
  "${CLOUDFLARE_BUILD_TIMEOUT:-3m}" \
  "${vinext}" build

bash "${script_dir}/validate-artifact.sh"
