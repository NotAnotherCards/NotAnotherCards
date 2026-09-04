import { useState, useRef, useCallback } from 'react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Download,
  Upload,
  FileJson,
  FileSpreadsheet,
  AlertCircle,
  RefreshCw,
  CheckCircle2,
  X,
  File,
} from 'lucide-react';
import { useStore } from '@/hooks/useStore';
import {
  exportDataToJson,
  exportDataToCsv,
  validateAndImportData,
  type ImportReport,
  type ImportOptions,
} from '@repo/offline-db';

export function ImportExport() {
  const { db } = useStore();

  // ── Export state ──
  const [exportingFormat, setExportingFormat] = useState<'json' | 'csv' | null>(
    null,
  );
  const [exportError, setExportError] = useState<string | null>(null);

  // ── Import state ──
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importPhase, setImportPhase] = useState<
    'idle' | 'validating' | 'previewing' | 'importing' | 'done'
  >('idle');
  const [importReport, setImportReport] = useState<ImportReport | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  // ── Export helpers ──
  const triggerDownload = (
    content: string,
    filename: string,
    mimeType: string,
  ) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExportJson = async () => {
    if (!db) return;
    try {
      setExportingFormat('json');
      setExportError(null);
      const data = await exportDataToJson(db);
      const content = JSON.stringify(data, null, 2);
      const dateStr = new Date().toISOString().split('T')[0];
      triggerDownload(
        content,
        `flashcards-backup-${dateStr}.json`,
        'application/json',
      );
    } catch (err: unknown) {
      setExportError(
        err instanceof Error ? err.message : 'Failed to export JSON',
      );
    } finally {
      setExportingFormat(null);
    }
  };

  const handleExportCsv = async () => {
    if (!db) return;
    try {
      setExportingFormat('csv');
      setExportError(null);
      const content = await exportDataToCsv(db);
      const dateStr = new Date().toISOString().split('T')[0];
      triggerDownload(content, `flashcards-backup-${dateStr}.csv`, 'text/csv');
    } catch (err: unknown) {
      setExportError(
        err instanceof Error ? err.message : 'Failed to export CSV',
      );
    } finally {
      setExportingFormat(null);
    }
  };

  // ── Import helpers ──
  const detectFormat = (file: File): 'json' | 'csv' => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext === 'json') return 'json';
    return 'csv';
  };

  const readFileContent = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });

  const handleFileSelected = useCallback(
    async (file: File) => {
      if (!db) return;
      setSelectedFile(file);
      setImportError(null);
      setImportReport(null);
      setImportPhase('validating');

      try {
        const content = await readFileContent(file);
        const format = detectFormat(file);
        const options: ImportOptions = { format, dryRun: true };
        const report = await validateAndImportData(db, content, options);
        setImportReport(report);
        setImportPhase('previewing');
      } catch (err: unknown) {
        setImportError(
          err instanceof Error ? err.message : 'Failed to validate file',
        );
        setImportPhase('idle');
      }
    },
    [db],
  );

  const handleConfirmImport = async () => {
    if (!db || !selectedFile) return;
    setImportPhase('importing');
    setImportError(null);

    try {
      const content = await readFileContent(selectedFile);
      const format = detectFormat(selectedFile);
      const options: ImportOptions = { format, dryRun: false };
      const report = await validateAndImportData(db, content, options);
      setImportReport(report);
      setImportPhase(report.success ? 'done' : 'previewing');
    } catch (err: unknown) {
      setImportError(
        err instanceof Error ? err.message : 'Import failed unexpectedly',
      );
      setImportPhase('previewing');
    }
  };

  const handleClearImport = () => {
    setSelectedFile(null);
    setImportPhase('idle');
    setImportReport(null);
    setImportError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const onFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelected(file);
  };

  // ── Drag & Drop handlers ──
  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files?.[0];
      if (file) handleFileSelected(file);
    },
    [handleFileSelected],
  );

  const isImportBusy = importPhase === 'validating' || importPhase === 'importing';

  return (
    <div className="space-y-6">
      {/* Export Section */}
      <Card className="border border-border/60 shadow-xs rounded-3xl">
        <CardHeader className="flex flex-row items-center gap-3 pb-4">
          <div className="p-2 bg-primary/10 rounded-2xl text-primary">
            <Download className="size-5" />
          </div>
          <div>
            <CardTitle className="text-base font-bold">Export Data</CardTitle>
            <CardDescription className="text-xs">
              Download your decks, cards, and study schedule as a backup
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {exportError && (
            <Alert variant="destructive" className="rounded-2xl text-xs py-3">
              <AlertCircle className="size-4 shrink-0" />
              <AlertTitle className="text-xs font-bold">
                Export Error
              </AlertTitle>
              <AlertDescription className="text-xs">
                {exportError}
              </AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-2xl border border-border/40 bg-muted/20 flex flex-col justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2 font-bold text-sm">
                  <FileJson className="size-4 text-primary" />
                  JSON Format (Full Backup)
                </div>
                <p className="text-xs text-muted-foreground">
                  Lossless format. Includes all decks, notes, cards, and review
                  history.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleExportJson}
                disabled={exportingFormat !== null}
                className="w-full justify-center gap-2 rounded-xl cursor-pointer"
              >
                {exportingFormat === 'json' ? (
                  <RefreshCw className="size-3.5 animate-spin" />
                ) : (
                  <Download className="size-3.5" />
                )}
                Export JSON
              </Button>
            </div>

            <div className="p-4 rounded-2xl border border-border/40 bg-muted/20 flex flex-col justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2 font-bold text-sm">
                  <FileSpreadsheet className="size-4 text-emerald-500" />
                  CSV Format (Basic Cards)
                </div>
                <p className="text-xs text-muted-foreground">
                  Spreadsheet format. Exports basic flashcards with card
                  schedule.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleExportCsv}
                disabled={exportingFormat !== null}
                className="w-full justify-center gap-2 rounded-xl cursor-pointer"
              >
                {exportingFormat === 'csv' ? (
                  <RefreshCw className="size-3.5 animate-spin" />
                ) : (
                  <Download className="size-3.5" />
                )}
                Export CSV
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Import Section */}
      <Card className="border border-border/60 shadow-xs rounded-3xl">
        <CardHeader className="flex flex-row items-center gap-3 pb-4">
          <div className="p-2 bg-emerald-500/10 rounded-2xl text-emerald-500">
            <Upload className="size-5" />
          </div>
          <div>
            <CardTitle className="text-base font-bold">Import Data</CardTitle>
            <CardDescription className="text-xs">
              Import decks and cards from a JSON backup or CSV file
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Error alert */}
          {importError && (
            <Alert variant="destructive" className="rounded-2xl text-xs py-3">
              <AlertCircle className="size-4 shrink-0" />
              <AlertTitle className="text-xs font-bold">
                Import Error
              </AlertTitle>
              <AlertDescription className="text-xs">
                {importError}
              </AlertDescription>
            </Alert>
          )}

          {/* Success alert */}
          {importPhase === 'done' && importReport?.success && (
            <Alert className="rounded-2xl text-xs py-3 border-emerald-500/40 bg-emerald-500/5">
              <CheckCircle2 className="size-4 shrink-0 text-emerald-500" />
              <AlertTitle className="text-xs font-bold text-emerald-600">
                Import Complete
              </AlertTitle>
              <AlertDescription className="text-xs text-emerald-600/80">
                Successfully imported {importReport.counts.decks} deck{importReport.counts.decks !== 1 ? 's' : ''},{' '}
                {importReport.counts.notes} note{importReport.counts.notes !== 1 ? 's' : ''},{' '}
                {importReport.counts.cards} card{importReport.counts.cards !== 1 ? 's' : ''}, and{' '}
                {importReport.counts.review_events} review event{importReport.counts.review_events !== 1 ? 's' : ''}.
              </AlertDescription>
            </Alert>
          )}

          {/* Drop zone / File picker */}
          {(importPhase === 'idle' || importPhase === 'done') && (
            <>
              <input
                ref={fileInputRef}
                id="import-file-input"
                type="file"
                accept=".json,.csv"
                onChange={onFileInputChange}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
                className={`
                  w-full p-8 rounded-2xl border-2 border-dashed
                  flex flex-col items-center gap-2 cursor-pointer
                  transition-all duration-200
                  ${
                    isDragging
                      ? 'border-emerald-500 bg-emerald-500/10 scale-[1.01]'
                      : 'border-border/50 bg-muted/10 hover:border-border hover:bg-muted/20'
                  }
                `}
              >
                <div
                  className={`p-3 rounded-2xl transition-colors duration-200 ${
                    isDragging
                      ? 'bg-emerald-500/20 text-emerald-500'
                      : 'bg-muted/30 text-muted-foreground'
                  }`}
                >
                  <Upload className="size-6" />
                </div>
                <div className="text-sm font-medium">
                  {isDragging ? 'Drop file here' : 'Drop a file or click to browse'}
                </div>
                <p className="text-xs text-muted-foreground">
                  Supports .json and .csv files
                </p>
              </button>
            </>
          )}

          {/* Validating spinner */}
          {importPhase === 'validating' && (
            <div className="p-6 rounded-2xl border border-border/40 bg-muted/20 flex flex-col items-center gap-3">
              <RefreshCw className="size-5 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Validating file…</p>
            </div>
          )}

          {/* Validation preview */}
          {(importPhase === 'previewing' || importPhase === 'importing') &&
            importReport && (
              <div className="space-y-4">
                {/* Selected file bar */}
                <div className="p-3 rounded-2xl border border-border/40 bg-muted/20 flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-muted/40">
                    <File className="size-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {selectedFile?.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {selectedFile
                        ? `${(selectedFile.size / 1024).toFixed(1)} KB · ${detectFormat(selectedFile).toUpperCase()}`
                        : ''}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleClearImport}
                    disabled={isImportBusy}
                    className="p-1.5 rounded-lg hover:bg-muted/40 text-muted-foreground transition-colors disabled:opacity-50"
                  >
                    <X className="size-4" />
                  </button>
                </div>

                {/* Counts preview */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {([
                    ['Decks', importReport.counts.decks, 'text-primary'],
                    ['Notes', importReport.counts.notes, 'text-violet-500'],
                    ['Cards', importReport.counts.cards, 'text-emerald-500'],
                    ['Reviews', importReport.counts.review_events, 'text-amber-500'],
                  ] as const).map(([label, count, color]) => (
                    <div
                      key={label}
                      className="p-3 rounded-xl border border-border/40 bg-muted/10 text-center"
                    >
                      <p className={`text-lg font-bold ${color}`}>{count}</p>
                      <p className="text-xs text-muted-foreground">{label}</p>
                    </div>
                  ))}
                </div>

                {/* Validation errors */}
                {importReport.errors.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-bold text-destructive">
                      {importReport.errors.length} validation error{importReport.errors.length !== 1 ? 's' : ''} found
                    </p>
                    <div className="max-h-40 overflow-y-auto rounded-xl border border-destructive/30 bg-destructive/5 p-3 space-y-1.5">
                      {importReport.errors.slice(0, 20).map((err, idx) => (
                        <div key={idx} className="text-xs text-destructive/90 flex gap-2">
                          <span className="font-mono shrink-0 opacity-70">
                            {err.path ?? (err.row ? `row ${err.row}` : err.code)}
                          </span>
                          <span>{err.message}</span>
                        </div>
                      ))}
                      {importReport.errors.length > 20 && (
                        <p className="text-xs text-destructive/70 pt-1">
                          …and {importReport.errors.length - 20} more
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Action buttons */}
                <div className="flex gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleClearImport}
                    disabled={isImportBusy}
                    className="flex-1 rounded-xl cursor-pointer"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleConfirmImport}
                    disabled={isImportBusy || importReport.errors.length > 0}
                    className="flex-1 rounded-xl gap-2 cursor-pointer bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    {importPhase === 'importing' ? (
                      <RefreshCw className="size-3.5 animate-spin" />
                    ) : (
                      <Upload className="size-3.5" />
                    )}
                    {importPhase === 'importing' ? 'Importing…' : 'Import'}
                  </Button>
                </div>
              </div>
            )}
        </CardContent>
      </Card>
    </div>
  );
}
