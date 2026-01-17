#!/bin/bash
# XCH - Agent Automatique de Documentation
# S'exécute en arrière-plan et surveille les changements de code
# Met à jour la documentation en temps réel

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_FILE="$PROJECT_ROOT/.claude/auto-doc-agent.log"
PID_FILE="$PROJECT_ROOT/.claude/auto-doc-agent.pid"

# Fonction pour logger
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Fonction pour analyser les changements
analyze_changes() {
    local last_commit_sha=$(git rev-parse HEAD)
    local last_commit_msg=$(git log -1 --pretty=%B)

    # Compter les lignes de code modifiées
    local stats=$(git diff --shortstat HEAD~1 HEAD 2>/dev/null || echo "0 files changed")

    # Détecter les modules affectés
    local modules_changed=$(git diff --name-only HEAD~1 HEAD | cut -d'/' -f2 | sort -u | tr '\n' ',' | sed 's/,$//')

    echo "$last_commit_sha|$stats|$modules_changed"
}

# Fonction pour générer un rapport de progression automatique
generate_progress_report() {
    local output_file="$PROJECT_ROOT/docs/status/AUTO_PROGRESS_REPORT.md"

    cat > "$output_file" << 'EOF'
# Rapport de Progression Automatique

**Généré automatiquement par:** Auto-Doc Agent
**Dernière mise à jour:** $(date '+%Y-%m-%d %H:%M:%S')

## 📊 Statistiques Commits (7 derniers jours)

```bash
# Backend commits
EOF

    git log --since="7 days ago" --pretty=format:"%h|%an|%ar|%s" --grep="backend" >> "$output_file" 2>/dev/null || echo "Aucun commit backend" >> "$output_file"

    cat >> "$output_file" << 'EOF'

# Frontend commits
EOF

    git log --since="7 days ago" --pretty=format:"%h|%an|%ar|%s" --grep="frontend" >> "$output_file" 2>/dev/null || echo "Aucun commit frontend" >> "$output_file"

    cat >> "$output_file" << 'EOF'

# Tests commits
EOF

    git log --since="7 days ago" --pretty=format:"%h|%an|%ar|%s" --grep="test\|e2e" >> "$output_file" 2>/dev/null || echo "Aucun commit tests" >> "$output_file"

    cat >> "$output_file" << 'EOF'
```

## 📈 Métriques Code

```bash
EOF

    # Compter lignes de code backend
    echo "Backend TypeScript:" >> "$output_file"
    find "$PROJECT_ROOT/backend/src" -name "*.ts" -exec wc -l {} + 2>/dev/null | tail -1 >> "$output_file" || echo "N/A" >> "$output_file"

    # Compter lignes de code frontend
    echo "" >> "$output_file"
    echo "Frontend TypeScript:" >> "$output_file"
    find "$PROJECT_ROOT/frontend/src" -name "*.ts" -o -name "*.tsx" -exec wc -l {} + 2>/dev/null | tail -1 >> "$output_file" || echo "N/A" >> "$output_file"

    # Compter fichiers de tests
    echo "" >> "$output_file"
    echo "Fichiers de tests E2E:" >> "$output_file"
    find "$PROJECT_ROOT/frontend/e2e" -name "*.spec.ts" 2>/dev/null | wc -l >> "$output_file" || echo "0" >> "$output_file"

    cat >> "$output_file" << 'EOF'
```

## 🔄 Activité Récente

EOF

    # Derniers 10 commits
    git log -10 --pretty=format:"- **%h** (%ar) - %s [%an]" >> "$output_file"

    cat >> "$output_file" << 'EOF'

## 📁 Fichiers Récemment Modifiés

EOF

    # Top 20 fichiers récemment modifiés
    git log --since="7 days ago" --name-only --pretty=format: | sort | uniq -c | sort -rn | head -20 >> "$output_file"

    log "✅ Rapport de progression généré: $output_file"
}

# Fonction pour mettre à jour PROJECT_STATUS.md
update_project_status() {
    local status_file="$PROJECT_ROOT/docs/status/PROJECT_STATUS.md"

    if [ ! -f "$status_file" ]; then
        log "⚠️ PROJECT_STATUS.md introuvable"
        return
    fi

    # Mise à jour timestamp
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    sed -i "s/^\*\*Dernière mise à jour :\*\*.*/\*\*Dernière mise à jour :\*\* $timestamp (Auto-update)/" "$status_file"

    # Mise à jour version (incrément patch)
    local current_version=$(grep "Version actuelle" "$status_file" | sed 's/.*: \(.*\)/\1/')
    log "✅ PROJECT_STATUS.md mis à jour (version: $current_version)"
}

# Fonction pour démarrer l'agent en mode daemon
start_daemon() {
    if [ -f "$PID_FILE" ]; then
        log "⚠️ Agent déjà en cours d'exécution (PID: $(cat $PID_FILE))"
        return
    fi

    log "🚀 Démarrage Auto-Doc Agent..."

    # Créer répertoire .claude si inexistant
    mkdir -p "$PROJECT_ROOT/.claude"

    # Sauvegarder PID
    echo $$ > "$PID_FILE"

    # Boucle infinie de surveillance
    while true; do
        # Attendre 60 secondes
        sleep 60

        # Vérifier si des commits ont été créés
        local current_commit=$(git rev-parse HEAD)
        local last_processed="$PROJECT_ROOT/.claude/last_processed_commit"

        if [ -f "$last_processed" ]; then
            local last_commit=$(cat "$last_processed")

            if [ "$current_commit" != "$last_commit" ]; then
                log "📝 Nouveau commit détecté: $current_commit"

                # Analyser changements
                analyze_changes

                # Mettre à jour documentation
                update_project_status
                generate_progress_report

                # Sauvegarder dernier commit traité
                echo "$current_commit" > "$last_processed"
            fi
        else
            echo "$current_commit" > "$last_processed"
        fi
    done
}

# Fonction pour arrêter l'agent
stop_daemon() {
    if [ ! -f "$PID_FILE" ]; then
        log "⚠️ Agent non démarré"
        return
    fi

    local pid=$(cat "$PID_FILE")
    log "🛑 Arrêt Auto-Doc Agent (PID: $pid)..."

    kill "$pid" 2>/dev/null || true
    rm -f "$PID_FILE"

    log "✅ Agent arrêté"
}

# Fonction pour afficher le statut
status() {
    if [ -f "$PID_FILE" ]; then
        local pid=$(cat "$PID_FILE")
        if ps -p "$pid" > /dev/null 2>&1; then
            log "✅ Agent en cours d'exécution (PID: $pid)"
        else
            log "⚠️ PID file exists but process not running"
            rm -f "$PID_FILE"
        fi
    else
        log "❌ Agent non démarré"
    fi
}

# Menu principal
case "${1:-}" in
    start)
        start_daemon
        ;;
    stop)
        stop_daemon
        ;;
    restart)
        stop_daemon
        sleep 2
        start_daemon
        ;;
    status)
        status
        ;;
    once)
        log "🔄 Exécution unique de l'agent..."
        update_project_status
        generate_progress_report
        log "✅ Terminé"
        ;;
    *)
        echo "Usage: $0 {start|stop|restart|status|once}"
        echo ""
        echo "Commandes:"
        echo "  start    - Démarre l'agent en arrière-plan"
        echo "  stop     - Arrête l'agent"
        echo "  restart  - Redémarre l'agent"
        echo "  status   - Affiche le statut de l'agent"
        echo "  once     - Exécute une mise à jour unique (sans daemon)"
        exit 1
        ;;
esac
