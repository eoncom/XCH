#!/bin/bash

##############################################################################
# check-secrets.sh - Script de vérification des secrets avant commit
#
# Usage:
#   bash scripts/check-secrets.sh              # Vérifier fichiers stagés
#   bash scripts/check-secrets.sh --all        # Vérifier tout le repo
#   bash scripts/check-secrets.sh --install    # Installer comme pre-commit hook
#
# Description:
#   Détecte les fichiers sensibles (credentials, tokens, secrets) qui
#   pourraient être commitées accidentellement dans Git.
#
# Auteur: XCH Project
# Date: 2026-01-27
##############################################################################

set -euo pipefail

# Couleurs pour l'output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Patterns à détecter (sensibles à la casse)
SENSITIVE_PATTERNS=(
  "CREDENTIALS"
  "TOKEN"
  "SECRET"
  "PASSWORD"
  "API_KEY"
  "PRIVATE_KEY"
  ".pem$"
  ".key$"
  ".keystore$"
  ".p12$"
  ".pfx$"
)

# Extensions autorisées (templates, docs)
ALLOWED_EXTENSIONS=(
  ".template.md"
  ".example"
  ".sample"
  ".dist"
)

# Fichiers spécifiques ignorés
IGNORED_FILES=(
  ".gitignore"
  "package-lock.json"
  "pnpm-lock.yaml"
  "yarn.lock"
)

##############################################################################
# Fonctions utilitaires
##############################################################################

print_header() {
  echo -e "${BLUE}========================================${NC}"
  echo -e "${BLUE}🔐 XCH - Secrets Detection Scanner${NC}"
  echo -e "${BLUE}========================================${NC}"
  echo ""
}

print_success() {
  echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
  echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
  echo -e "${RED}❌ $1${NC}"
}

print_info() {
  echo -e "${BLUE}ℹ️  $1${NC}"
}

##############################################################################
# Fonction principale de vérification
##############################################################################

check_file() {
  local file="$1"
  local filename=$(basename "$file")

  # Ignorer fichiers spécifiques
  for ignored in "${IGNORED_FILES[@]}"; do
    if [[ "$filename" == "$ignored" ]]; then
      return 0
    fi
  done

  # Autoriser les templates et exemples
  for allowed_ext in "${ALLOWED_EXTENSIONS[@]}"; do
    if [[ "$filename" == *"$allowed_ext" ]]; then
      return 0
    fi
  done

  # Vérifier patterns sensibles dans le nom du fichier
  for pattern in "${SENSITIVE_PATTERNS[@]}"; do
    if echo "$filename" | grep -qiE "$pattern"; then
      print_error "SENSITIVE FILE DETECTED: $file"
      echo "         Pattern matched: $pattern"
      return 1
    fi
  done

  return 0
}

##############################################################################
# Mode: Vérifier fichiers stagés (par défaut)
##############################################################################

check_staged_files() {
  print_header
  print_info "Scanning staged files for secrets..."
  echo ""

  local has_sensitive_files=0
  local files_checked=0

  # Récupérer les fichiers stagés
  while IFS= read -r file; do
    if [[ -n "$file" ]]; then
      ((files_checked++))
      if ! check_file "$file"; then
        has_sensitive_files=1
      fi
    fi
  done < <(git diff --cached --name-only --diff-filter=ACM)

  echo ""
  echo -e "${BLUE}========================================${NC}"

  if [[ $files_checked -eq 0 ]]; then
    print_warning "No staged files found."
    echo ""
    print_info "Run 'git add <files>' to stage files first."
    exit 0
  fi

  if [[ $has_sensitive_files -eq 1 ]]; then
    echo ""
    print_error "COMMIT BLOCKED: Sensitive files detected!"
    echo ""
    print_info "Actions you can take:"
    echo "  1. Remove sensitive files from staging:"
    echo "     git reset HEAD <file>"
    echo ""
    echo "  2. Verify .gitignore includes the pattern:"
    echo "     cat .gitignore | grep -i credentials"
    echo ""
    echo "  3. If this is a template (no secrets), rename it:"
    echo "     mv FILE.md FILE.template.md"
    echo ""
    exit 1
  else
    print_success "All staged files are safe to commit ($files_checked files checked)"
    echo ""
    exit 0
  fi
}

##############################################################################
# Mode: Vérifier tout le repo
##############################################################################

check_all_files() {
  print_header
  print_info "Scanning entire repository for secrets..."
  echo ""

  local has_sensitive_files=0
  local files_checked=0

  # Récupérer tous les fichiers trackés par Git
  while IFS= read -r file; do
    if [[ -n "$file" ]] && [[ -f "$file" ]]; then
      ((files_checked++))
      if ! check_file "$file"; then
        has_sensitive_files=1
      fi
    fi
  done < <(git ls-files)

  echo ""
  echo -e "${BLUE}========================================${NC}"

  if [[ $has_sensitive_files -eq 1 ]]; then
    echo ""
    print_error "WARNING: Sensitive files found in repository!"
    echo ""
    print_info "Recommendation:"
    echo "  1. Remove from Git tracking:"
    echo "     git rm --cached <file>"
    echo ""
    echo "  2. Add to .gitignore"
    echo ""
    echo "  3. Commit the removal:"
    echo "     git commit -m 'security: Remove sensitive files from tracking'"
    echo ""
    exit 1
  else
    print_success "Repository is clean ($files_checked files checked)"
    echo ""
    exit 0
  fi
}

##############################################################################
# Mode: Installer comme pre-commit hook
##############################################################################

install_hook() {
  print_header
  print_info "Installing as Git pre-commit hook..."
  echo ""

  local hook_path=".git/hooks/pre-commit"
  local script_path="scripts/check-secrets.sh"

  # Vérifier si on est dans un repo Git
  if [[ ! -d ".git" ]]; then
    print_error "Not a Git repository!"
    exit 1
  fi

  # Créer le hook
  cat > "$hook_path" << 'EOF'
#!/bin/bash
# XCH - Pre-commit hook for secrets detection
# Auto-generated by scripts/check-secrets.sh --install

bash scripts/check-secrets.sh
exit $?
EOF

  # Rendre exécutable (Linux/Mac)
  if [[ "$OSTYPE" != "msys" ]] && [[ "$OSTYPE" != "win32" ]]; then
    chmod +x "$hook_path"
  fi

  print_success "Pre-commit hook installed at $hook_path"
  echo ""
  print_info "The hook will run automatically before each commit."
  print_info "To bypass (NOT recommended): git commit --no-verify"
  echo ""
  exit 0
}

##############################################################################
# CLI Argument Parsing
##############################################################################

show_usage() {
  print_header
  echo "Usage:"
  echo "  bash scripts/check-secrets.sh              # Check staged files (default)"
  echo "  bash scripts/check-secrets.sh --all        # Check entire repository"
  echo "  bash scripts/check-secrets.sh --install    # Install as pre-commit hook"
  echo "  bash scripts/check-secrets.sh --help       # Show this help"
  echo ""
  exit 0
}

# Parse arguments
case "${1:-}" in
  --all)
    check_all_files
    ;;
  --install)
    install_hook
    ;;
  --help|-h)
    show_usage
    ;;
  "")
    check_staged_files
    ;;
  *)
    print_error "Unknown option: $1"
    echo ""
    show_usage
    ;;
esac
