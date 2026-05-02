#!/usr/bin/env python3
"""
S7 PR0 codemod — react/no-unescaped-entities → &apos;

Lit la sortie ESLint format `./path:line:col  Error: ...  react/no-unescaped-entities`
et remplace chaque caractère apostrophe (') au point exact par `&apos;`.

Usage :
    npm run lint 2>&1 | grep -E "(^\\./|react/no-unescaped-entities)" > /tmp/lint-unescaped.txt
    python3 scripts/codemod-unescaped-entities.py /tmp/lint-unescaped.txt

Stratégie : trie les remplacements par (file desc, line desc, col desc)
pour éviter les décalages quand on remplace 1 char par 7 chars (`&apos;`).
"""

from __future__ import annotations

import re
import sys
from collections import defaultdict
from pathlib import Path

LINT_RULE = 'react/no-unescaped-entities'
RE_FILE = re.compile(r'^\./(.+\.tsx?)$')
RE_ERROR = re.compile(r'^\s*(\d+):(\d+)\s+Error:.*' + re.escape(LINT_RULE) + r'\s*$')

# Mapping caractère → entité HTML. La règle react/no-unescaped-entities
# flag aussi les `"` (à échapper en &quot;) en plus des `'`.
ENTITY_MAP = {
    "'": '&apos;',
    '"': '&quot;',
}


def parse_lint_output(path: Path) -> dict[str, list[tuple[int, int]]]:
    """Retourne {file_relpath: [(line_1based, col_1based), ...]} pour chaque erreur ciblée."""
    by_file: dict[str, list[tuple[int, int]]] = defaultdict(list)
    current_file: str | None = None
    for raw in path.read_text(encoding='utf-8').splitlines():
        m_file = RE_FILE.match(raw)
        if m_file:
            current_file = m_file.group(1)
            continue
        m_err = RE_ERROR.match(raw)
        if m_err and current_file:
            line = int(m_err.group(1))
            col = int(m_err.group(2))
            by_file[current_file].append((line, col))
    return by_file


def apply_codemod(file_relpath: str, positions: list[tuple[int, int]], frontend_root: Path) -> int:
    """Applique le remplacement sur un fichier. Retourne le nombre de remplacements effectifs."""
    full = frontend_root / file_relpath
    text = full.read_text(encoding='utf-8')
    lines = text.split('\n')
    # Trier desc pour ne pas décaler les positions sur la même ligne.
    positions_sorted = sorted(positions, key=lambda p: (-p[0], -p[1]))
    applied = 0
    for line_1, col_1 in positions_sorted:
        idx = line_1 - 1
        if idx >= len(lines):
            print(f'  WARN {file_relpath}:{line_1}:{col_1} — line out of range', file=sys.stderr)
            continue
        line = lines[idx]
        col_idx = col_1 - 1
        if col_idx >= len(line):
            print(f'  WARN {file_relpath}:{line_1}:{col_1} — col out of range', file=sys.stderr)
            continue
        ch = line[col_idx]
        replacement = ENTITY_MAP.get(ch)
        if replacement is None:
            # Fallback : ESLint compte les colonnes en UTF-16 code units
            # (cf. https://eslint.org/docs/latest/rules/#column-numbers).
            # Python compte en codepoints. Pour les lignes contenant des
            # caractères hors BMP (emoji 💡 = surrogate pair, 2 unités UTF-16
            # mais 1 codepoint Python), col ESLint > col Python. On retente
            # à col-1 pour chaque emoji présent avant la position.
            shift = sum(1 for c in line[:col_idx] if ord(c) > 0xFFFF)
            if shift > 0:
                fallback_idx = col_idx - shift
                if 0 <= fallback_idx < len(line) and line[fallback_idx] in ENTITY_MAP:
                    replacement = ENTITY_MAP[line[fallback_idx]]
                    lines[idx] = line[:fallback_idx] + replacement + line[fallback_idx + 1:]
                    applied += 1
                    continue
            print(f'  WARN {file_relpath}:{line_1}:{col_1} — char at col is {ch!r}, not in {list(ENTITY_MAP.keys())}', file=sys.stderr)
            continue
        lines[idx] = line[:col_idx] + replacement + line[col_idx + 1:]
        applied += 1
    full.write_text('\n'.join(lines), encoding='utf-8')
    return applied


def main() -> int:
    if len(sys.argv) != 2:
        print(__doc__, file=sys.stderr)
        return 2
    lint_file = Path(sys.argv[1])
    if not lint_file.exists():
        print(f'fatal: {lint_file} not found', file=sys.stderr)
        return 1
    frontend_root = Path(__file__).resolve().parent.parent
    by_file = parse_lint_output(lint_file)
    total_positions = sum(len(p) for p in by_file.values())
    total_applied = 0
    print(f'Codemod react/no-unescaped-entities — {total_positions} positions sur {len(by_file)} fichiers')
    for file_relpath, positions in sorted(by_file.items()):
        applied = apply_codemod(file_relpath, positions, frontend_root)
        total_applied += applied
        status = 'OK' if applied == len(positions) else 'PARTIAL'
        print(f'  {status} {file_relpath} — {applied}/{len(positions)}')
    print(f'Total : {total_applied}/{total_positions} apostrophes remplacées par &apos;')
    return 0 if total_applied == total_positions else 1


if __name__ == '__main__':
    sys.exit(main())
