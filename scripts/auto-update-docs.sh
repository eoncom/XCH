#!/bin/bash

###############################################################################
# auto-update-docs.sh - Automatic Documentation Update System
#
# Purpose: Automatically update PROJECT_STATUS.md, DEVELOPMENT_LOG.md, TODO.md
#          when code changes are detected in backend/frontend
#
# Usage:
#   1. Manual: bash scripts/auto-update-docs.sh
#   2. Git hook: Automatically via .git/hooks/pre-commit
#   3. Package.json: npm run update-docs
#
# What it does:
#   - Updates timestamp in PROJECT_STATUS.md
#   - Adds entry to DEVELOPMENT_LOG.md with commit info
#   - Stages updated documentation files for commit
#
# Created: 2026-01-18
# Author: Claude Sonnet 4.5
###############################################################################

set -e  # Exit on error

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}📝 Automatic Documentation Update System${NC}"
echo ""

# Get project root (script is in XCH/scripts/)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_ROOT"

# Files to update
PROJECT_STATUS="docs/status/PROJECT_STATUS.md"
DEVELOPMENT_LOG="DEVELOPMENT_LOG.md"
TODO_FILE="TODO.md"

# Check if we're in a git repository
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    echo -e "${RED}❌ Not a git repository${NC}"
    exit 1
fi

# Check if there are staged changes in backend/frontend
BACKEND_CHANGES=$(git diff --cached --name-only | grep "^backend/" | wc -l)
FRONTEND_CHANGES=$(git diff --cached --name-only | grep "^frontend/" | wc -l)
DOC_CHANGES=$(git diff --cached --name-only | grep "^docs/" | wc -l)

# Trim whitespace
BACKEND_CHANGES=$(echo "$BACKEND_CHANGES" | tr -d ' ')
FRONTEND_CHANGES=$(echo "$FRONTEND_CHANGES" | tr -d ' ')
DOC_CHANGES=$(echo "$DOC_CHANGES" | tr -d ' ')

echo -e "${BLUE}Changes detected:${NC}"
echo "  - Backend files: $BACKEND_CHANGES"
echo "  - Frontend files: $FRONTEND_CHANGES"
echo "  - Documentation files: $DOC_CHANGES"
echo ""

# If no backend/frontend changes, skip documentation update
if [ "$BACKEND_CHANGES" -eq 0 ] && [ "$FRONTEND_CHANGES" -eq 0 ]; then
    echo -e "${YELLOW}ℹ️  No backend/frontend changes detected${NC}"
    echo -e "${YELLOW}ℹ️  Skipping documentation auto-update${NC}"
    exit 0
fi

# Get current timestamp
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
DATE_ONLY=$(date '+%Y-%m-%d')

echo -e "${GREEN}✅ Code changes detected - Updating documentation...${NC}"
echo ""

###############################################################################
# 1. Update PROJECT_STATUS.md timestamp
###############################################################################

if [ -f "$PROJECT_STATUS" ]; then
    echo -e "${BLUE}📊 Updating PROJECT_STATUS.md...${NC}"

    # Update "Dernière mise à jour" line
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        sed -i '' "s/^\*\*Dernière mise à jour :\*\*.*/\*\*Dernière mise à jour :\*\* $TIMESTAMP (Auto-update)/" "$PROJECT_STATUS"
    else
        # Linux/WSL
        sed -i "s/^\*\*Dernière mise à jour :\*\*.*/\*\*Dernière mise à jour :\*\* $TIMESTAMP (Auto-update)/" "$PROJECT_STATUS"
    fi

    git add "$PROJECT_STATUS"
    echo -e "${GREEN}  ✅ PROJECT_STATUS.md timestamp updated${NC}"
else
    echo -e "${YELLOW}  ⚠️  PROJECT_STATUS.md not found${NC}"
fi

###############################################################################
# 2. Update DEVELOPMENT_LOG.md (only if significant changes)
###############################################################################

if [ -f "$DEVELOPMENT_LOG" ]; then
    # Only update if backend OR frontend changes >= 3 files
    TOTAL_CHANGES=$((BACKEND_CHANGES + FRONTEND_CHANGES))

    if [ "$TOTAL_CHANGES" -ge 3 ]; then
        echo -e "${BLUE}📋 Updating DEVELOPMENT_LOG.md...${NC}"

        # Get commit message from git (if amending) or use default
        COMMIT_MSG=$(git log -1 --pretty=%B 2>/dev/null | head -1 || echo "Code changes")

        # Create log entry
        LOG_ENTRY="
---

## Session Auto-Update - $DATE_ONLY

**Date:** $TIMESTAMP
**Type:** Automatic documentation update

**Changes:**
- Backend files modified: $BACKEND_CHANGES
- Frontend files modified: $FRONTEND_CHANGES

**Commit message:**
\`\`\`
$COMMIT_MSG
\`\`\`

**Auto-updated files:**
- PROJECT_STATUS.md (timestamp)
- DEVELOPMENT_LOG.md (this entry)
"

        # Append to DEVELOPMENT_LOG.md
        echo "$LOG_ENTRY" >> "$DEVELOPMENT_LOG"

        git add "$DEVELOPMENT_LOG"
        echo -e "${GREEN}  ✅ DEVELOPMENT_LOG.md entry added${NC}"
    else
        echo -e "${YELLOW}  ℹ️  Not enough changes to update DEVELOPMENT_LOG.md (< 3 files)${NC}"
    fi
else
    echo -e "${YELLOW}  ⚠️  DEVELOPMENT_LOG.md not found${NC}"
fi

###############################################################################
# Summary
###############################################################################

echo ""
echo -e "${GREEN}✅ Documentation auto-update complete!${NC}"
echo ""
echo -e "${BLUE}Updated files staged for commit:${NC}"
git diff --cached --name-only | grep -E "(PROJECT_STATUS|DEVELOPMENT_LOG|TODO)" || echo "  (none)"
echo ""
echo -e "${YELLOW}💡 Tip: These files will be included in your next commit${NC}"

exit 0
