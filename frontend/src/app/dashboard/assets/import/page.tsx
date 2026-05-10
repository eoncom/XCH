'use client';

import { useState, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { GroupedSiteSelector } from '@/components/ui/grouped-site-selector';
import {
  Upload,
  FileText,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  Download,
  Loader2,
  X,
} from 'lucide-react';
import Link from 'next/link';
import Papa from 'papaparse';
import { assetsApi } from '@/lib/api/assets';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ImportError {
  row: number;
  field: string;
  message: string;
}

interface ImportResult {
  total: number;
  imported: number;
  errors: ImportError[];
}

interface ServerPreview {
  total: number;
  validRows: Array<{ row: number; data: any }>;
  invalidRows: Array<{ row: number; data: Record<string, string>; errors: Array<{ field: string; message: string }> }>;
}

type Step = 'upload' | 'preview' | 'result';

// Expected CSV columns (order-independent)
const EXPECTED_COLUMNS = [
  'name',
  'type',
  'manufacturer',
  'model',
  'serialNumber',
  'status',
  'inventoryTag',
  'purchaseDate',
  'warrantyEnd',
  'ip',
  'hostname',
  'notes',
];

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default function ImportAssetsPage() {
  const [step, setStep] = useState<Step>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [siteId, setSiteId] = useState<string>('');
  const [parsedRows, setParsedRows] = useState<Record<string, string>[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [serverPreview, setServerPreview] = useState<ServerPreview | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // -----------------------------------------------------------------------
  // CSV parsing
  // -----------------------------------------------------------------------

  const parseFile = useCallback((f: File) => {
    setFile(f);
    setParseErrors([]);
    setParsedRows([]);
    setColumns([]);

    Papa.parse<Record<string, string>>(f, {
      header: true,
      skipEmptyLines: true,
      encoding: 'UTF-8',
      complete(results) {
        const cols = results.meta.fields || [];
        setColumns(cols);

        if (cols.length === 0) {
          setParseErrors(['Le fichier ne contient aucune colonne.']);
          return;
        }

        if (results.data.length === 0) {
          setParseErrors(['Le fichier ne contient aucune ligne de données.']);
          return;
        }

        const warnings: string[] = [];
        const mapped = cols.filter((c) =>
          EXPECTED_COLUMNS.includes(c.trim().toLowerCase()),
        );
        if (mapped.length === 0) {
          warnings.push(
            `Aucune colonne reconnue. Colonnes attendues : ${EXPECTED_COLUMNS.join(', ')}`,
          );
        }

        if (results.errors.length > 0) {
          results.errors.forEach((e) =>
            warnings.push(`Ligne ${e.row ?? '?'} : ${e.message}`),
          );
        }

        setParseErrors(warnings);
        setParsedRows(results.data);
        setStep('preview');
      },
      error(err) {
        setParseErrors([`Erreur de lecture : ${err.message}`]);
      },
    });
  }, []);

  // -----------------------------------------------------------------------
  // Drag & drop handlers
  // -----------------------------------------------------------------------

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const droppedFile = e.dataTransfer.files?.[0];
      if (droppedFile) parseFile(droppedFile);
    },
    [parseFile],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOver(false);
  }, []);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selected = e.target.files?.[0];
      if (selected) parseFile(selected);
    },
    [parseFile],
  );

  // -----------------------------------------------------------------------
  // Import submission
  // -----------------------------------------------------------------------

  const handleImport = async () => {
    if (!file) return;
    setImporting(true);
    setApiError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      if (siteId && siteId !== 'none') {
        formData.append('siteId', siteId);
      }

      const API_URL = process.env.NEXT_PUBLIC_API_URL || '';
      const response = await fetch(`${API_URL}/api/assets/import`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });

      if (!response.ok) {
        const error = await response
          .json()
          .catch(() => ({ message: response.statusText }));
        throw new Error(error.message || "Erreur lors de l'import");
      }

      const data: ImportResult = await response.json();
      setResult(data);
      setStep('result');
    } catch (err: any) {
      setApiError(err.message || "Erreur lors de l'import");
    } finally {
      setImporting(false);
    }
  };

  // -----------------------------------------------------------------------
  // Reset
  // -----------------------------------------------------------------------

  const handleReset = () => {
    setStep('upload');
    setFile(null);
    setSiteId('');
    setParsedRows([]);
    setColumns([]);
    setParseErrors([]);
    setResult(null);
    setApiError(null);
    setServerPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleServerPreview = async () => {
    if (!file) return;
    setPreviewing(true);
    setServerPreview(null);
    setApiError(null);
    try {
      const res = await assetsApi.importPreview(
        file,
        siteId && siteId !== 'none' ? siteId : undefined,
      );
      setServerPreview(res);
    } catch (e: any) {
      setApiError(e.message || 'Erreur lors de la validation serveur');
    } finally {
      setPreviewing(false);
    }
  };

  // -----------------------------------------------------------------------
  // Render helpers
  // -----------------------------------------------------------------------

  const previewRows = parsedRows.slice(0, 100);
  const errorRowSet = new Set(result?.errors.map((e) => e.row) ?? []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/dashboard/assets">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <h1 className="text-3xl font-bold text-foreground">
              Import CSV
            </h1>
          </div>
          <p className="text-muted-foreground ml-10">
            Importez des équipements depuis un fichier CSV
          </p>
        </div>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2 text-sm">
        <Badge variant={step === 'upload' ? 'default' : 'secondary'}>
          1. Fichier
        </Badge>
        <span className="text-muted-foreground">&rarr;</span>
        <Badge variant={step === 'preview' ? 'default' : 'secondary'}>
          2. Aperçu
        </Badge>
        <span className="text-muted-foreground">&rarr;</span>
        <Badge variant={step === 'result' ? 'default' : 'secondary'}>
          3. Résultat
        </Badge>
      </div>

      {/* ================================================================= */}
      {/* STEP 1 - Upload                                                   */}
      {/* ================================================================= */}
      {step === 'upload' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Charger un fichier CSV
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Drop zone */}
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => fileInputRef.current?.click()}
              className={`
                flex flex-col items-center justify-center gap-4 rounded-lg border-2 border-dashed p-12 cursor-pointer transition-colors
                ${dragOver ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'}
              `}
            >
              <Upload className="h-10 w-10 text-muted-foreground" />
              <div className="text-center">
                <p className="font-medium text-foreground">
                  Glissez-déposez votre fichier ici
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  ou cliquez pour parcourir (CSV, TXT)
                </p>
              </div>
              {file && (
                <div className="flex items-center gap-2 rounded-md bg-muted px-3 py-2 text-sm">
                  <FileText className="h-4 w-4" />
                  {file.name}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-5 w-5 p-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      setFile(null);
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.txt"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>

            {/* Site selector */}
            <div className="max-w-sm space-y-2">
              <label className="text-sm font-medium text-foreground">
                Site cible (optionnel)
              </label>
              <GroupedSiteSelector
                value={siteId}
                onValueChange={setSiteId}
                placeholder="Tous les sites"
                allowNone
                noneLabel="Aucun — utiliser les données du CSV"
                noneValue="none"
              />
              <p className="text-xs text-muted-foreground">
                Si sélectionné, tous les équipements importés seront affectés à
                ce site.
              </p>
            </div>

            {/* Parse errors */}
            {parseErrors.length > 0 && (
              <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-4 space-y-1">
                {parseErrors.map((err, i) => (
                  <p key={i} className="text-sm text-destructive flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                    {err}
                  </p>
                ))}
              </div>
            )}

            {/* Download template */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Download className="h-4 w-4" />
              <button
                type="button"
                className="underline hover:text-foreground"
                onClick={() => {
                  const header = EXPECTED_COLUMNS.join(',');
                  const example =
                    'Switch Cisco,SWITCH,Cisco,Catalyst 9300,SN123456,ACTIVE,INV-001,2024-01-15,2027-01-15,192.168.1.1,sw-core-01,';
                  const blob = new Blob([header + '\n' + example + '\n'], {
                    type: 'text/csv',
                  });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = 'modele-import-equipements.csv';
                  a.click();
                  URL.revokeObjectURL(url);
                }}
              >
                Télécharger le modèle CSV
              </button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ================================================================= */}
      {/* STEP 2 - Preview                                                  */}
      {/* ================================================================= */}
      {step === 'preview' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Aperçu de l&apos;import
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Summary */}
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <Badge variant="secondary">
                {parsedRows.length} ligne{parsedRows.length > 1 ? 's' : ''}{' '}
                détectée{parsedRows.length > 1 ? 's' : ''}
              </Badge>
              <Badge variant="secondary">
                {columns.length} colonne{columns.length > 1 ? 's' : ''}
              </Badge>
              {file && (
                <span className="text-muted-foreground">{file.name}</span>
              )}
            </div>

            {/* Column mapping */}
            <div className="space-y-1">
              <p className="text-sm font-medium">Colonnes détectées :</p>
              <div className="flex flex-wrap gap-1">
                {columns.map((col) => {
                  const isKnown = EXPECTED_COLUMNS.includes(
                    col.trim().toLowerCase(),
                  );
                  return (
                    <Badge
                      key={col}
                      variant={isKnown ? 'default' : 'outline'}
                      className={!isKnown ? 'opacity-60' : ''}
                    >
                      {col}
                      {!isKnown && ' (ignorée)'}
                    </Badge>
                  );
                })}
              </div>
            </div>

            {/* Parse warnings */}
            {parseErrors.length > 0 && (
              <div className="rounded-lg border border-yellow-500/50 bg-yellow-500/5 p-3 space-y-1">
                {parseErrors.map((err, i) => (
                  <p
                    key={i}
                    className="text-sm text-yellow-700 dark:text-yellow-400 flex items-start gap-2"
                  >
                    <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                    {err}
                  </p>
                ))}
              </div>
            )}

            {/* Data table */}
            <div className="max-h-[500px] overflow-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    {columns.map((col) => (
                      <TableHead key={col}>{col}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewRows.map((row, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="text-muted-foreground text-xs">
                        {idx + 1}
                      </TableCell>
                      {columns.map((col) => (
                        <TableCell
                          key={col}
                          className="max-w-[200px] truncate text-sm"
                        >
                          {row[col] || (
                            <span className="text-muted-foreground">--</span>
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {parsedRows.length > 100 && (
              <p className="text-xs text-muted-foreground">
                Aperçu limité aux 100 premières lignes ({parsedRows.length} au
                total).
              </p>
            )}

            {/* API error */}
            {apiError && (
              <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-4">
                <p className="text-sm text-destructive flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  {apiError}
                </p>
              </div>
            )}

            {/* Server preview result */}
            {serverPreview && (
              <div className="rounded-lg border p-4 space-y-3">
                <div className="flex items-center gap-3 text-sm font-medium">
                  <span className="text-green-600 flex items-center gap-1">
                    <CheckCircle2 className="h-4 w-4" />
                    {serverPreview.validRows.length} valide{serverPreview.validRows.length > 1 ? 's' : ''}
                  </span>
                  <span className="text-red-600 flex items-center gap-1">
                    <AlertCircle className="h-4 w-4" />
                    {serverPreview.invalidRows.length} invalide{serverPreview.invalidRows.length > 1 ? 's' : ''}
                  </span>
                  <span className="text-muted-foreground">sur {serverPreview.total} ligne(s)</span>
                </div>
                {serverPreview.invalidRows.length > 0 && (
                  <div className="max-h-[240px] overflow-y-auto border rounded">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-16">Ligne</TableHead>
                          <TableHead className="w-40">Type/Serial</TableHead>
                          <TableHead>Erreurs</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {serverPreview.invalidRows.map((r) => (
                          <TableRow key={r.row} className="bg-red-50/30 dark:bg-red-950/10">
                            <TableCell>{r.row}</TableCell>
                            <TableCell className="font-mono text-xs">
                              {r.data.type || '—'} / {r.data.serialNumber || '—'}
                            </TableCell>
                            <TableCell>
                              {r.errors.map((e, idx) => (
                                <div key={idx} className="text-xs text-destructive">
                                  <strong>{e.field}</strong>: {e.message}
                                </div>
                              ))}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-3 pt-2">
              <Button variant="outline" onClick={handleReset}>
                Annuler
              </Button>
              <Button
                variant="outline"
                onClick={handleServerPreview}
                disabled={previewing || !file}
              >
                {previewing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Validation...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Valider côté serveur
                  </>
                )}
              </Button>
              <Button
                onClick={handleImport}
                disabled={importing || parsedRows.length === 0}
                className="press-effect"
              >
                {importing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Import en cours...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Importer {parsedRows.length} ligne
                    {parsedRows.length > 1 ? 's' : ''}
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ================================================================= */}
      {/* STEP 3 - Results                                                  */}
      {/* ================================================================= */}
      {step === 'result' && result && (
        <div className="space-y-6">
          {/* Summary cards */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <FileText className="h-8 w-8 text-muted-foreground" />
                  <div>
                    <p className="text-2xl font-bold">{result.total}</p>
                    <p className="text-sm text-muted-foreground">
                      Lignes traitées
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-8 w-8 text-green-500" />
                  <div>
                    <p className="text-2xl font-bold text-green-600">
                      {result.imported}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Importés avec succès
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <AlertCircle
                    className={`h-8 w-8 ${result.errors.length > 0 ? 'text-red-500' : 'text-muted-foreground'}`}
                  />
                  <div>
                    <p
                      className={`text-2xl font-bold ${result.errors.length > 0 ? 'text-red-600' : ''}`}
                    >
                      {result.errors.length}
                    </p>
                    <p className="text-sm text-muted-foreground">Erreurs</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Error details */}
          {result.errors.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-destructive">
                  <AlertCircle className="h-5 w-5" />
                  Détails des erreurs
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="max-h-[400px] overflow-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-20">Ligne</TableHead>
                        <TableHead className="w-40">Champ</TableHead>
                        <TableHead>Message</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {result.errors.map((err, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="font-mono text-sm">
                            {err.row}
                          </TableCell>
                          <TableCell className="font-mono text-sm">
                            {err.field}
                          </TableCell>
                          <TableCell className="text-sm text-destructive">
                            {err.message}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={handleReset}>
              <Upload className="mr-2 h-4 w-4" />
              Importer un autre fichier
            </Button>
            <Button asChild>
              <Link href="/dashboard/assets">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Retour aux équipements
              </Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
