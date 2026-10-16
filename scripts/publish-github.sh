#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
command -v gh >/dev/null || { echo 'Install the official GitHub CLI: https://cli.github.com/'; exit 1; }
gh auth status >/dev/null || { echo 'Run gh auth login first.'; exit 1; }
owner="$(gh api user --jq .login)"
repo="$owner/D3oiraM"
if gh repo view "$repo" >/dev/null 2>&1; then
  echo "Repository $repo already exists. Stopping to avoid changing an existing project."
  exit 1
fi
npm ci
npm test
npm run build
if [ ! -d .git ]; then git init -b main; fi
if [ "$(git branch --show-current)" != main ]; then echo 'Use the main branch before publishing.'; exit 1; fi
git add .
git diff --cached --quiet || git commit -m 'Create D3oiraM Three.js platform adventure'
gh repo create "$repo" --public --source=. --remote=origin --description 'D3oiraM — an original Three.js 3D platform adventure'
# Pages needs an existing source branch. Dispatch again after enabling Pages.
git push -u origin main
gh api --method POST "repos/$repo/pages" -f build_type=workflow >/dev/null
gh workflow run pages.yml --repo "$repo" --ref main
gh run list --repo "$repo" --limit 1
echo "Open the successful deployment from: https://github.com/$repo/actions"
