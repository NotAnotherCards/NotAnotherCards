import { useState } from 'react';
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
  FileJson,
  FileSpreadsheet,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { useStore } from '@/hooks/useStore';
import {
  exportDataToJson,
  exportDataToCsv,
} from '@repo/offline-db';

export function ImportExport() {
  const { db } = useStore();

  const [exportingFormat, setExportingFormat] = useState<'json' | 'csv' | null>(
    null,
  );
  const [exportError, setExportError] = useState<string | null>(null);

  // Download helper for JSON & CSV files
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
    </div>
  );
}
