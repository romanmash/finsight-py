#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: bash scripts/release.sh [--dry-run] [--push] [--github-release]

Creates an annotated Git tag from [project].version in pyproject.toml.

Options:
  --dry-run         Validate everything but do not create/push tag
  --push            Push tag to origin after creating it
  --github-release  Create a GitHub release with notes from CHANGELOG.md (requires gh)
EOF
}

dry_run=false
push_tag=false
create_gh_release=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run)
      dry_run=true
      shift
      ;;
    --push)
      push_tag=true
      shift
      ;;
    --github-release)
      create_gh_release=true
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage
      exit 1
      ;;
  esac
done

if [[ ! -f pyproject.toml ]]; then
  echo "pyproject.toml not found in current directory." >&2
  exit 1
fi

if [[ ! -f CHANGELOG.md ]]; then
  echo "CHANGELOG.md not found in current directory." >&2
  exit 1
fi

if [[ -n "$(git status --porcelain)" ]]; then
  echo "Working tree is not clean. Commit or stash changes before creating a release tag." >&2
  exit 1
fi

version="$(
python - <<'PY'
import tomllib
from pathlib import Path

data = tomllib.loads(Path("pyproject.toml").read_text(encoding="utf-8"))
project = data.get("project", {})
version = project.get("version")
if not isinstance(version, str) or not version.strip():
    raise SystemExit("Missing [project].version in pyproject.toml")
print(version.strip())
PY
)"

if [[ ! "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "Version '$version' is not strict SemVer core format (X.Y.Z)." >&2
  exit 1
fi

tag="v${version}"

if git rev-parse --verify --quiet "refs/tags/${tag}" >/dev/null; then
  echo "Tag ${tag} already exists." >&2
  exit 1
fi

if ! grep -Eq "^## \[${version}\] - [0-9]{4}-[0-9]{2}-[0-9]{2}$" CHANGELOG.md; then
  echo "Missing CHANGELOG section header: ## [${version}] - YYYY-MM-DD" >&2
  echo "Add the release section in CHANGELOG.md before tagging." >&2
  exit 1
fi

notes="$(
awk -v version="$version" '
  $0 ~ "^## \\[" version "\\] - " { in_section = 1; next }
  in_section && $0 ~ "^## \\[" { exit }
  in_section { print }
' CHANGELOG.md
)"

if [[ -z "${notes//[[:space:]]/}" ]]; then
  echo "CHANGELOG section for ${version} is empty." >&2
  exit 1
fi

echo "Version source : pyproject.toml -> ${version}"
echo "Release tag    : ${tag}"
echo "Changelog check: OK"

if [[ "$dry_run" == true ]]; then
  echo "[dry-run] Validation complete. No tag created."
  exit 0
fi

git tag -a "$tag" -m "Release ${tag}"
echo "Created tag ${tag}"

if [[ "$push_tag" == true ]]; then
  if ! git remote get-url origin >/dev/null 2>&1; then
    echo "No 'origin' remote configured; cannot push tag." >&2
    exit 1
  fi
  git push origin "$tag"
  echo "Pushed tag ${tag} to origin"
fi

if [[ "$create_gh_release" == true ]]; then
  if ! command -v gh >/dev/null 2>&1; then
    echo "'gh' CLI is required for --github-release." >&2
    exit 1
  fi
  gh release create "$tag" --title "$tag" --notes "$notes"
  echo "Created GitHub release ${tag}"
fi
