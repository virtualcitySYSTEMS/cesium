#!/usr/bin/env bash
set -euo pipefail

DRY_RUN=false
if [[ "${1-}" == "--dry-run" ]]; then
  DRY_RUN=true
elif [[ $# -gt 0 ]]; then
  echo "Usage: $0 [--dry-run]" >&2
  exit 1
fi

ROOT_DIR="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$ROOT_DIR"

echo "Renaming tracked Cesium package references in $ROOT_DIR"
if $DRY_RUN; then
  echo "Dry run enabled; files will be listed but not modified."
fi

mapfile -t CESIUM_PACKAGES < <(
  git grep -h -E '"name"[[:space:]]*:[[:space:]]*"@cesium/' -- '**/package.json' \
    | sed -E 's/.*"(@cesium\/[^"]+)".*/\1/' \
    | sort -u
)

if [[ ${#CESIUM_PACKAGES[@]} -eq 0 ]]; then
  echo "No tracked @cesium packages were discovered in package.json files."
  exit 0
fi

declare -A REPLACEMENTS=()
for old_package in "${CESIUM_PACKAGES[@]}"; do
  REPLACEMENTS["$old_package"]="@vcmap-cesium/${old_package#@cesium/}"
done

declare -A changed_files=()
total_replacements=0

while IFS= read -r -d '' file; do
  file_changed=false

  for old_package in "${CESIUM_PACKAGES[@]}"; do
    if ! grep -Fq "$old_package" "$file"; then
      continue
    fi

    new_package="${REPLACEMENTS[$old_package]}"
    total_replacements=$((total_replacements + 1))

    if $DRY_RUN; then
      echo "$file: $old_package -> $new_package"
    else
      sed -i "s|$old_package|$new_package|g" "$file"
    fi

    file_changed=true
  done

  if $file_changed; then
    changed_files["$file"]=1
  fi
done < <(git grep -Ilz '@cesium/' || true)

if [[ ${#changed_files[@]} -eq 0 ]]; then
  echo "No matching tracked files found."
  exit 0
fi

echo "Updated ${#changed_files[@]} files across $total_replacements package reference groups."