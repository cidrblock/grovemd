#!/usr/bin/env bash
# Relabel ~/Documents/Grove so Podman (Volume :Z) can read host-moved files.
set -euo pipefail
ROOT="${GROVE_ROOT:-/var/home/bthornto/Documents/Grove}"
REF="$(find "$ROOT" -type f -name '*.md' | head -n1 || true)"
if [[ -z "${REF}" ]]; then
  echo "No reference .md under $ROOT — create one in Grove first, then re-run." >&2
  exit 1
fi
echo "Using reference label from: $REF"
find "$ROOT" \( -type f -o -type d \) -print0 | while IFS= read -r -d '' p; do
  chcon --reference="$REF" "$p"
done
echo "Done. Refresh Grove (or wait for the watcher) to see newly moved files."
