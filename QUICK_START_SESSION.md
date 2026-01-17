# Comment Démarrer une Session XCH - Guide Ultra-Rapide

## 🚀 Avant (Sans Système Auto-Doc)

**Tu devais faire :**
```
1. Ouvrir Claude
2. Taper manuellement :
   "Lis CLAUDE.md, DEVELOPMENT_LOG.md, TODO.md, PROJECT_STATUS.md..."
3. Attendre lecture
4. Re-expliquer contexte projet
5. Re-préciser chemin serveur
6. Re-donner accès SSH
7. Demander résumé
```

**Temps : ~5-10 minutes de setup répétitif**

---

## 🎯 Maintenant (Avec Système Auto-Doc)

### Option 1 : Prompt Ultra-Court (30 secondes)

**Copier-coller ce fichier :** `.claude/SESSION_STARTUP_PROMPT.txt`

```
Projet XCH - Démarrage Session

Contexte :
- Local : C:\xampp\htdocs\XCH
- Serveur : ssh xch-deploy → /opt/xch-dev/XCH

Lis pour contexte :
1. docs/status/PROJECT_STATUS.md (source vérité)
2. TODO.md (priorités)
3. DEVELOPMENT_LOG.md (dernière session)

Mission :
1. Résume état projet (1 paragraphe)
2. Top 3 tâches prioritaires
3. Demande confirmation avant démarrage
```

**C'EST TOUT ! 🎉**

---

### Option 2 : Encore Plus Court (15 secondes)

**Si tu veux juste un résumé rapide :**

```
XCH - Résume état + top 3 priorités

Lis : PROJECT_STATUS.md, TODO.md, DEVELOPMENT_LOG.md
```

---

### Option 3 : Session Spécialisée (1 minute)

**Pour débogage :**
```
XCH - Débogage Bug [#X]

Lis : PROJECT_STATUS.md, TODO.md
Bug : [description courte]
Mission : Analyser + proposer fix
```

**Pour tests E2E :**
```
XCH - Tests E2E

Lis : PROJECT_STATUS.md, docs/testing/E2E_VALIDATION_REPORT.md
Mission : Valider tests + corriger si nécessaire
```

---

## 📋 Workflow Session Simplifié

### Avant (Sans Auto-Doc)
```
1. Ouvrir Claude
2. Taper prompt long (5 min)
3. Attendre lecture contexte
4. Résumé état projet
5. Développement (2h)
6. Tests (30 min)
7. Commit
8. ⚠️ Mettre à jour docs manuellement (60 min)
9. Fin session

Total : 3h30 dont 65 min overhead
```

### Maintenant (Avec Auto-Doc)
```
1. Ouvrir Claude
2. Coller prompt court (30 sec)
3. Résumé état projet (immédiat)
4. Développement (2h)
5. Tests (30 min)
6. Commit
7. ✅ Docs auto-update (0 min)
8. Fin session

Total : 2h30 dont 30 sec overhead
```

**Gain : 1h par session (38% plus rapide) ! 🚀**

---

## 🎯 Réponse Simple à Ta Question

### "Comment je démarre maintenant ?"

**1. Ouvre Claude**

**2. Copie-colle ce prompt :**
```
Projet XCH - Démarrage Session

Contexte :
- Local : C:\xampp\htdocs\XCH
- Serveur : ssh xch-deploy → /opt/xch-dev/XCH

Lis pour contexte :
1. docs/status/PROJECT_STATUS.md (source vérité)
2. TODO.md (priorités)
3. DEVELOPMENT_LOG.md (dernière session)

Mission :
1. Résume état projet (1 paragraphe)
2. Top 3 tâches prioritaires
3. Demande confirmation avant démarrage
```

**3. Claude va :**
- Lire automatiquement PROJECT_STATUS.md
- Lire TODO.md
- Lire dernière session DEVELOPMENT_LOG.md
- Te donner résumé état projet
- Proposer 3 tâches prioritaires
- Attendre ta confirmation

**4. Tu confirmes la tâche**

**5. Claude travaille**

**6. Fin session : Commit + Push**
- Documentation mise à jour automatiquement ✅
- DEVELOPMENT_LOG.md auto-log ✅
- PROJECT_STATUS.md timestamp ✅
- AUTO_PROGRESS_REPORT.md stats ✅

**C'EST TOUT ! 🎉**

---

## 💡 Où est le Prompt ?

**3 options :**

### Option A : Fichier Local
```bash
cat .claude/SESSION_STARTUP_PROMPT.txt
# Copier le contenu
```

### Option B : Guide Complet
```bash
cat docs/guides/SESSION_STARTUP_GUIDE.md
# Section "Template Session Standard"
```

### Option C : Ce Fichier
```bash
cat QUICK_START_SESSION.md
# Section "Option 1 : Prompt Ultra-Court"
```

---

## 🤖 Système Auto-Doc : Rien à Faire

**Rappel : Documentation maintenue automatiquement**

**Niveaux actifs :**
- ✅ Niveau 1 : Git Hook (chaque commit)
- ✅ Niveau 2 : Agent Local (toutes les 60s)
- ✅ Niveau 3 : GitHub Actions (push + daily)

**Vérification (optionnel) :**
```bash
# Vérifier agent local
./scripts/auto-doc-agent.sh status

# Si non démarré (première fois)
./scripts/auto-doc-agent.sh start
```

**Fichiers auto-maintenus :**
- `PROJECT_STATUS.md` - Timestamp
- `DEVELOPMENT_LOG.md` - Auto-log commits
- `AUTO_PROGRESS_REPORT.md` - Stats + activité
- `CHANGELOG.md` - Historique

**❌ NE PLUS mettre à jour manuellement !**

---

## 📊 Comparaison Avant/Après

| Tâche | Avant | Maintenant | Gain |
|-------|-------|------------|------|
| **Setup session** | 5-10 min | 30 sec | **90%** |
| **Développement** | 2h | 2h | 0% |
| **Tests** | 30 min | 30 min | 0% |
| **Commit** | 2 min | 2 min | 0% |
| **Update docs** | 60 min | 0 min | **100%** |
| **TOTAL** | 3h30 | 2h30 | **29%** |

**Économie : 1 heure par session**

---

## 🎉 Résumé Final

### Avant
```
"Projet XCH - Contexte : C:\xampp\htdocs\XCH
Lis d'abord pour contexte complet :
CLAUDE.md, DEVELOPMENT_LOG.md, TODO.md, PROJECT_STATUS.md
Accès serveur : ssh xch-deploy, /opt/xch-dev/XCH
Ta mission : [longue explication...]"
```

**Problème :** Long, répétitif, perte de temps

### Maintenant
```
[Coller .claude/SESSION_STARTUP_PROMPT.txt]
```

**Résultat :** Court, standardisé, efficace

---

## 📞 Aide Rapide

**Prompts disponibles :**
- `.claude/SESSION_STARTUP_PROMPT.txt` - Prompt court standard
- `docs/guides/SESSION_STARTUP_GUIDE.md` - Guide complet
- `QUICK_START_SESSION.md` - Ce fichier (ultra-rapide)

**Documentation système :**
- `AUTO_DOC_SYSTEM_SUMMARY.md` - Résumé système auto-doc
- `docs/guides/AUTO_DOCUMENTATION_GUIDE.md` - Guide complet 6000+ mots

**Commandes utiles :**
```bash
# Vérifier agent doc
./scripts/auto-doc-agent.sh status

# Voir dernier état projet
cat docs/status/PROJECT_STATUS.md

# Voir tâches prioritaires
cat TODO.md

# Voir dernière session
tail -n 100 DEVELOPMENT_LOG.md
```

---

**Créé le :** 2026-01-17
**Version :** 1.0

**Ta question répondue : Copie-colle `.claude/SESSION_STARTUP_PROMPT.txt` au démarrage ! 🚀**
