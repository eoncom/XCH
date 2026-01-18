#!/bin/bash

###############################################################################
# install-git-hooks.sh - Install Git hooks for automatic documentation
#
# Purpose: Copy Git hooks to .git/hooks/ directory
#
# Usage:
#   bash scripts/install-git-hooks.sh
#   npm run install-hooks
#
# Created: 2026-01-18
# Author: Claude Sonnet 4.5
###############################################################################

set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🔧 Installing Git hooks...${NC}"
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_ROOT"

# Create pre-commit hook
cat > .git/hooks/pre-commit <<'EOF'
#!/bin/bash

###############################################################################
# Git pre-commit hook - Automatic Documentation Update
#
# This hook runs BEFORE each commit to automatically update documentation
# when backend/frontend code changes are detected.
#
# What it does:
#   1. Detects if backend/frontend files are in the commit
#   2. Automatically updates PROJECT_STATUS.md timestamp
#   3. Adds entry to DEVELOPMENT_LOG.md for significant changes
#   4. Stages updated documentation files
#
# To disable temporarily:
#   git commit --no-verify
#
# Installed: 2026-01-18
# Author: Claude Sonnet 4.5
###############################################################################

# Run the auto-update script
bash scripts/auto-update-docs.sh

# Always allow commit to proceed (exit 0)
exit 0
EOF

chmod +x .git/hooks/pre-commit

echo -e "${GREEN}✅ pre-commit hook installed${NC}"
echo ""
echo -e "${BLUE}Installed hooks:${NC}"
echo "  - .git/hooks/pre-commit (automatic documentation update)"
echo ""
echo -e "${GREEN}✅ Git hooks ready!${NC}"
echo ""
echo -e "${BLUE}💡 The pre-commit hook will automatically:${NC}"
echo "  - Update PROJECT_STATUS.md timestamp when you commit code"
echo "  - Add DEVELOPMENT_LOG.md entries for significant changes"
echo "  - Stage documentation files for your commit"
echo ""
echo -e "${BLUE}To disable temporarily:${NC}"
echo "  git commit --no-verify"
