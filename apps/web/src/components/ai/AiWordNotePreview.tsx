import { useState } from 'react';
import { AiWordNoteCandidate } from '@repo/schemas';
import { Button } from '@/components/ui/button';
import { FileJson, BookOpen, CheckCircle2, AlertCircle, LayoutTemplate } from 'lucide-react';
import { MarkdownRenderer } from '../ui/MarkdownRenderer';

interface AiWordNotePreviewProps {
  note: AiWordNoteCandidate;
  deckName: string;
  onSave: () => Promise<void>;
  isSaving: boolean;
}

export function AiWordNotePreview({
  note,
  deckName,
  onSave,
  isSaving,
}: AiWordNotePreviewProps) {
  const [previewTab, setPreviewTab] = useState<'preview' | 'json'>('preview');
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const handleSave = async () => {
    setSaveError(null);
    try {
      await onSave();
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save note';
      setSaveError(msg);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Generation Results</h2>
          <p className="text-sm text-muted-foreground">Generated structured word note candidate.</p>
        </div>

        {/* Tab Toggle */}
        <div className="flex bg-muted/60 p-0.5 rounded-lg border border-border/40 text-xs">
          <button
            onClick={() => setPreviewTab('preview')}
            className={`flex items-center gap-1 py-1 px-2.5 rounded-md font-medium transition-all ${
              previewTab === 'preview'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground'
            }`}
          >
            <LayoutTemplate className="size-3" /> Preview
          </button>
          <button
            onClick={() => setPreviewTab('json')}
            className={`flex items-center gap-1 py-1 px-2.5 rounded-md font-medium transition-all ${
              previewTab === 'json'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground'
            }`}
          >
            <FileJson className="size-3" /> JSON Schema
          </button>
        </div>
      </div>

      {previewTab === 'preview' ? (
        <div className="bg-card/40 border border-border/60 rounded-2xl p-6 shadow-sm hover:border-violet-500/30 transition-all duration-200">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                  Word
                </h4>
                <div className="text-lg font-bold">
                  {note.fields.word}
                </div>
              </div>

              <div>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                  Translation
                </h4>
                <div className="text-base font-medium">
                  {note.fields.translation}
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                    Part of Speech
                  </h4>
                  <div className="text-sm">
                    {note.fields.part_of_speech}
                  </div>
                </div>
                {note.fields.gender && (
                  <div>
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                      Gender
                    </h4>
                    <div className="text-sm">
                      {note.fields.gender}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                  Pronunciation
                </h4>
                <div className="text-sm font-mono">
                  {note.fields.pronunciation || 'N/A'}
                </div>
              </div>

              <div>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                  Example
                </h4>
                <div className="text-sm italic border-l-2 border-violet-500/30 pl-3 py-1">
                  <MarkdownRenderer content={note.fields.example} />
                </div>
              </div>

              <div>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                  Example Translation
                </h4>
                <div className="text-sm border-l-2 border-border pl-3 py-1">
                  <MarkdownRenderer content={note.fields.example_translation} />
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-muted/40 border border-border/60 rounded-2xl p-4 overflow-auto max-h-100 text-xs font-mono text-muted-foreground whitespace-pre">
          {JSON.stringify(note, null, 2)}
        </div>
      )}

      {/* Persistence Section */}
      <div className="bg-card/30 border border-border/50 rounded-3xl p-6 backdrop-blur-sm space-y-6">
        <div>
          <h3 className="text-lg font-bold tracking-tight">Save to Database</h3>
          <p className="text-sm text-muted-foreground">
            Target Deck:{' '}
            <span className="font-semibold text-foreground bg-muted/60 px-2 py-0.5 rounded-full inline-flex items-center gap-1.5 ml-1">
              <BookOpen className="size-3" /> {deckName}
            </span>
          </p>
        </div>

        {saveError && (
          <div className="flex items-center gap-2 bg-destructive/10 border border-destructive/20 rounded-2xl p-3 text-xs text-destructive">
            <AlertCircle className="size-4 shrink-0" />
            <span>{saveError}</span>
          </div>
        )}

        <Button
          onClick={handleSave}
          disabled={isSaving}
          className="w-full bg-linear-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-3xl py-5 shadow-lg shadow-emerald-500/10 font-semibold cursor-pointer"
        >
          {isSaving ? 'Saving to Deck...' : 'Save Note to Deck'}
        </Button>
      </div>

      {/* Toast Notification */}
      {savedSuccess && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 bg-emerald-600 text-white px-4 py-3 rounded-2xl shadow-xl border border-emerald-500/30 transition-all duration-300">
          <CheckCircle2 className="size-5 shrink-0 text-white" />
          <div>
            <h4 className="font-semibold text-sm">Note Saved!</h4>
            <p className="text-xs text-emerald-100">
              The word note has been added to your selected deck.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
