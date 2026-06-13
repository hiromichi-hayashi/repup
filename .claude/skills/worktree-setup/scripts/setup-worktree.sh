#!/usr/bin/env bash
set -euo pipefail

# Usage: setup-worktree.sh <branch-name> [base-branch]
# Creates a git worktree, installs deps, copies env/config, assigns a unique port.

BRANCH_NAME="${1:?Usage: setup-worktree.sh <branch-name> [base-branch]}"
BASE_BRANCH="${2:-main}"

REPO_ROOT="$(git rev-parse --show-toplevel)"
WORKTREE_DIR="${REPO_ROOT}/.worktrees/${BRANCH_NAME}"

# --- 1. Ensure .worktrees is gitignored ---
if ! git check-ignore -q .worktrees 2>/dev/null; then
  echo ".worktrees" >> "${REPO_ROOT}/.gitignore"
  echo "[setup] Added .worktrees to .gitignore"
fi

# --- 2. Create worktree ---
if [ -d "${WORKTREE_DIR}" ]; then
  echo "[setup] Worktree already exists at ${WORKTREE_DIR}"
else
  git worktree add "${WORKTREE_DIR}" -b "${BRANCH_NAME}" "${BASE_BRANCH}" 2>/dev/null \
    || git worktree add "${WORKTREE_DIR}" "${BRANCH_NAME}"
  echo "[setup] Created worktree at ${WORKTREE_DIR}"
fi

# --- 3. Copy environment files ---
for env_file in .env .env.local .env.development .env.development.local; do
  if [ -f "${REPO_ROOT}/${env_file}" ]; then
    cp "${REPO_ROOT}/${env_file}" "${WORKTREE_DIR}/${env_file}"
    echo "[setup] Copied ${env_file}"
  fi
done

# --- 4. Port assignment (3000 + worktree index) ---
WORKTREE_COUNT=$(git worktree list | wc -l | tr -d ' ')
PORT=$((3000 + WORKTREE_COUNT - 1))
# Write port override to worktree-local env
echo "" >> "${WORKTREE_DIR}/.env.local"
echo "# Assigned by worktree-setup (avoid port conflict)" >> "${WORKTREE_DIR}/.env.local"
echo "PORT=${PORT}" >> "${WORKTREE_DIR}/.env.local"
echo "[setup] Assigned PORT=${PORT}"

# --- 5. Copy AI / Claude config ---
if [ -d "${REPO_ROOT}/.claude" ]; then
  # Use rsync to mirror .claude dir, preserving structure
  rsync -a --exclude='*.skill' "${REPO_ROOT}/.claude/" "${WORKTREE_DIR}/.claude/"
  echo "[setup] Synced .claude/ config"
fi

# Copy other AI config files if present
for cfg in .cursorrules .windsurfrules .clinerules; do
  if [ -f "${REPO_ROOT}/${cfg}" ]; then
    cp "${REPO_ROOT}/${cfg}" "${WORKTREE_DIR}/${cfg}"
    echo "[setup] Copied ${cfg}"
  fi
done

# --- 6. Install dependencies ---
cd "${WORKTREE_DIR}"
if [ -f package.json ]; then
  echo "[setup] Installing npm dependencies..."
  npm install --prefer-offline 2>&1 | tail -1
fi

# --- 7. Generate Prisma client if applicable ---
if [ -f prisma/schema.prisma ] || [ -d prisma/schema ]; then
  echo "[setup] Generating Prisma client..."
  npx prisma generate 2>&1 | tail -1
fi

echo ""
echo "=== Worktree Ready ==="
echo "  Path:   ${WORKTREE_DIR}"
echo "  Branch: ${BRANCH_NAME}"
echo "  Port:   ${PORT}"
echo "  Next:   cd ${WORKTREE_DIR} && claude"
