// @ts-nocheck
'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Package, MapPin, Server, CheckSquare, Users, Loader2 } from 'lucide-react';
import { searchApi, type SearchHit, type SearchHitType } from '@/lib/api/search';

const typeIcons: Record<SearchHitType, any> = {
  asset: Package,
  site: MapPin,
  rack: Server,
  task: CheckSquare,
  contact: Users,
};

const typeLabels: Record<SearchHitType, string> = {
  asset: 'Équipements',
  site: 'Sites',
  rack: 'Baies',
  task: 'Tâches',
  contact: 'Contacts',
};

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [selected, setSelected] = useState(0);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keyboard shortcut: Cmd+K / Ctrl+K
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(true);
      }
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQ('');
      setHits([]);
      setSelected(0);
    }
  }, [open]);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!q || q.length < 2) {
      setHits([]);
      return;
    }
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await searchApi.search(q, 10);
        setHits(res.hits || []);
        setSelected(0);
      } catch {
        setHits([]);
      } finally {
        setLoading(false);
      }
    }, 200);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [q]);

  const pick = useCallback((hit: SearchHit) => {
    setOpen(false);
    router.push(hit.link);
  }, [router]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelected((i) => Math.min(i + 1, Math.max(hits.length - 1, 0)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelected((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (hits[selected]) pick(hits[selected]);
    }
  };

  // Group hits by type
  const grouped: Record<SearchHitType, SearchHit[]> = {
    asset: [], site: [], rack: [], task: [], contact: [],
  };
  hits.forEach((h) => { grouped[h.type].push(h); });

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent transition-colors"
        title="Recherche globale (Ctrl+K)"
      >
        <Search className="h-4 w-4" />
        <span className="hidden md:inline">Rechercher...</span>
        <kbd className="hidden md:inline-flex text-xs bg-muted rounded px-1.5 py-0.5 ml-2">Ctrl+K</kbd>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-start justify-center pt-[10vh]"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-background border rounded-lg shadow-2xl w-full max-w-xl mx-4 max-h-[70vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 border-b px-4 py-3">
              <Search className="h-4 w-4 text-muted-foreground shrink-0" />
              <input
                ref={inputRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Rechercher sites, équipements, tâches, contacts..."
                className="flex-1 bg-transparent outline-none text-sm"
                autoComplete="off"
              />
              {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
              <kbd className="text-xs bg-muted rounded px-1.5 py-0.5 text-muted-foreground">ESC</kbd>
            </div>

            <div className="flex-1 overflow-y-auto">
              {!q || q.length < 2 ? (
                <div className="py-10 text-center text-sm text-muted-foreground">
                  Commencez à taper (min 2 caractères)...
                </div>
              ) : hits.length === 0 && !loading ? (
                <div className="py-10 text-center text-sm text-muted-foreground">
                  Aucun résultat pour &quot;{q}&quot;
                </div>
              ) : (
                <div className="py-2">
                  {(Object.keys(grouped) as SearchHitType[]).map((type) => {
                    const items = grouped[type];
                    if (items.length === 0) return null;
                    const Icon = typeIcons[type];
                    return (
                      <div key={type} className="mb-1">
                        <div className="px-3 py-1 text-xs font-semibold text-muted-foreground uppercase">
                          {typeLabels[type]}
                        </div>
                        {items.map((hit) => {
                          const idx = hits.findIndex((h) => h === hit);
                          const isSelected = idx === selected;
                          return (
                            <button
                              key={`${hit.type}-${hit.id}`}
                              type="button"
                              onClick={() => pick(hit)}
                              onMouseEnter={() => setSelected(idx)}
                              className={`w-full flex items-center gap-3 px-4 py-2 text-left text-sm transition-colors ${
                                isSelected ? 'bg-accent' : 'hover:bg-accent/50'
                              }`}
                            >
                              <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                              <div className="flex-1 min-w-0">
                                <div className="font-medium truncate">{hit.title}</div>
                                {hit.subtitle && (
                                  <div className="text-xs text-muted-foreground truncate">{hit.subtitle}</div>
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="border-t px-4 py-2 text-xs text-muted-foreground flex gap-4">
              <span><kbd className="bg-muted rounded px-1">↑↓</kbd> naviguer</span>
              <span><kbd className="bg-muted rounded px-1">↵</kbd> ouvrir</span>
              <span><kbd className="bg-muted rounded px-1">ESC</kbd> fermer</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
