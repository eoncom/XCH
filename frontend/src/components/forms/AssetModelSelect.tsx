'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ChevronsUpDown, Check, Search, Package, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { assetModelsApi, type AssetModel } from '@/lib/api/asset-models';

interface AssetModelSelectProps {
  value: string | null;
  onChange: (modelId: string | null, model: AssetModel | null) => void;
  disabled?: boolean;
  className?: string;
}

export function AssetModelSelect({ value, onChange, disabled, className }: AssetModelSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [models, setModels] = useState<AssetModel[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState<AssetModel | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadModels();
  }, []);

  useEffect(() => {
    if (value && models.length > 0 && (!selectedModel || selectedModel.id !== value)) {
      const found = models.find((m) => m.id === value);
      if (found) setSelectedModel(found);
    }
    if (!value && selectedModel) setSelectedModel(null);
  }, [value, models]);

  // Close dropdown on outside click
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const loadModels = async () => {
    setLoading(true);
    try {
      const res = await assetModelsApi.getAll({ isActive: 'true', pageSize: 200 });
      setModels(res.data);
    } catch {
      // silent
    }
    setLoading(false);
  };

  const filtered = models.filter((m) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      m.name.toLowerCase().includes(s) ||
      (m.manufacturer?.toLowerCase().includes(s)) ||
      m.type.toLowerCase().includes(s)
    );
  });

  const formatPrice = (model: AssetModel) => {
    if (model.pricingMode === 'MONTHLY' && model.monthlyPrice) {
      return `${model.monthlyPrice} ${model.currency}/mois`;
    }
    if (model.acquisitionPrice) {
      return `${model.acquisitionPrice} ${model.currency}`;
    }
    return '';
  };

  const handleSelect = (model: AssetModel) => {
    setSelectedModel(model);
    onChange(model.id, model);
    setOpen(false);
    setSearch('');
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedModel(null);
    onChange(null, null);
  };

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <Button
        type="button"
        variant="outline"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className="w-full justify-between font-normal"
      >
        {selectedModel ? (
          <span className="flex items-center gap-2 truncate flex-1 text-left">
            <Package className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="truncate">{selectedModel.name}</span>
            {formatPrice(selectedModel) && (
              <span className="text-muted-foreground text-xs ml-1">({formatPrice(selectedModel)})</span>
            )}
          </span>
        ) : (
          <span className="text-muted-foreground flex-1 text-left">Sélectionner un modèle...</span>
        )}
        <div className="flex items-center gap-1">
          {selectedModel && (
            <span
              role="button"
              tabIndex={0}
              onClick={handleClear}
              className="h-5 w-5 inline-flex items-center justify-center rounded hover:bg-muted"
            >
              <X className="h-3 w-3" />
            </span>
          )}
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
        </div>
      </Button>

      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover text-popover-foreground shadow-md">
          <div className="p-2 border-b">
            <div className="flex items-center gap-2 px-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher un modèle..."
                className="border-0 focus-visible:ring-0 h-8 px-0"
                autoFocus
              />
            </div>
          </div>
          <div className="max-h-60 overflow-y-auto p-1">
            {loading ? (
              <p className="text-center text-muted-foreground py-4 text-sm">Chargement...</p>
            ) : filtered.length === 0 ? (
              <p className="text-center text-muted-foreground py-4 text-sm">Aucun modèle trouvé</p>
            ) : (
              filtered.map((model) => (
                <button
                  key={model.id}
                  type="button"
                  onClick={() => handleSelect(model)}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2 rounded-md text-left text-sm hover:bg-accent transition-colors',
                    value === model.id && 'bg-accent',
                  )}
                >
                  <Check className={cn('h-4 w-4 shrink-0', value === model.id ? 'opacity-100' : 'opacity-0')} />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{model.name}</div>
                    <div className="text-xs text-muted-foreground flex gap-2">
                      {model.manufacturer && <span>{model.manufacturer}</span>}
                      <span>{model.type}</span>
                      {formatPrice(model) && <span className="font-medium">{formatPrice(model)}</span>}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
