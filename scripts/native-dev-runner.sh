#!/bin/sh
set -eu

# Cargo owns this PID. Replace it with the app so Tauri restarts leave no orphan.
script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
polar_dev_binary=$("${POLAR_DEV_NODE:?Missing development launcher}" "$script_dir/native-dev.mjs" prepare-app "$1" "$$")
shift
exec "$polar_dev_binary" "$@"
