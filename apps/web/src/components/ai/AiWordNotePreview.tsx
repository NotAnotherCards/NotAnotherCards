import { useTranslation } from 'react-i18next';
import { useEffect, useRef, useState } from 'react';
import { AiWordNoteCandidate } from '@repo/schemas';
import { Button } from '@/components/ui/button';
import { useDismissTimer } from '@/hooks/useDismissTimer';
import { BookOpen, CheckCircle2, AlertCircle } from 'lucide-react';
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
  const { t } = useTranslation();
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const { schedule: scheduleSuccessDismiss } = useDismissTimer(3000);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const handleSave = async () => {
    setSaveError(null);
    try {
      await onSave();
      if (!mounted.current) return;
      setSavedSuccess(true);
      scheduleSuccessDismiss(() => {
        setSavedSuccess(false);
      });
    } catch (err) {
      if (!mounted.current) return;
      const msg =
        err instanceof Error
          ? err.message
          : t('playground.preview.save_note_failed', 'Failed to save note');
      setSaveError(msg);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold tracking-tight">
            {t('playground.preview.results_title', 'Creation Results')}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t(
              'playground.preview.word_note_desc',
              'Created structured word note candidate.',
            )}
          </p>
        </div>
      </div>

      <div className="bg-card/40 border border-border/60 rounded-2xl p-6 shadow-sm hover:border-violet-500/30 transition-all duration-200">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                {t('playground.preview.word', 'Word')}
              </h4>
              <div className="text-lg font-bold">{note.fields.word}</div>
            </div>

            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                {t('playground.preview.translation', 'Translation')}
              </h4>
              <div className="text-base font-medium">
                {note.fields.translation}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                  {t('playground.preview.part_of_speech', 'Part of Speech')}
                </h4>
                <div className="text-sm">{note.fields.part_of_speech}</div>
              </div>
              {note.fields.gender && (
                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                    {t('playground.preview.gender', 'Gender')}
                  </h4>
                  <div className="text-sm">{note.fields.gender}</div>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                {t('playground.preview.pronunciation', 'Pronunciation')}
              </h4>
              <div className="text-sm font-mono">
                {note.fields.pronunciation || 'N/A'}
              </div>
            </div>

            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                {t('playground.preview.example', 'Example')}
              </h4>
              <div className="text-sm italic border-l-2 border-violet-500/30 pl-3 py-1">
                <MarkdownRenderer content={note.fields.example} />
              </div>
            </div>

            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                {t(
                  'playground.preview.example_translation',
                  'Example Translation',
                )}
              </h4>
              <div className="text-sm border-l-2 border-border pl-3 py-1">
                <MarkdownRenderer content={note.fields.example_translation} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Persistence Section */}
      <div className="bg-card/30 border border-border/50 rounded-3xl p-6 backdrop-blur-sm space-y-6">
        <div>
          <h3 className="text-lg font-bold tracking-tight">
            {t('playground.preview.save_db', 'Save to Database')}
          </h3>
          <p className="text-sm text-muted-foreground">
            {t('playground.preview.target_deck', 'Target Deck:')}{' '}
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
          {isSaving
            ? t('playground.preview.saving_note', 'Saving to Deck...')
            : t('playground.preview.save_note', 'Save Note to Deck')}
        </Button>
      </div>

      {/* Toast Notification */}
      {savedSuccess && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 bg-emerald-600 text-white px-4 py-3 rounded-2xl shadow-xl border border-emerald-500/30 transition-all duration-300">
          <CheckCircle2 className="size-5 shrink-0 text-white" />
          <div>
            <h4 className="font-semibold text-sm">
              {t('playground.preview.note_saved', 'Note Saved!')}
            </h4>
            <p className="text-xs text-emerald-100">
              {t(
                'playground.preview.note_saved_desc',
                'The word note has been added to your selected deck.',
              )}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
