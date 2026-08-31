import { useEffect, useState } from 'react';
import { AiCardOutput } from '@repo/schemas';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field, FieldLabel } from '@/components/ui/field';
import { ArrowRight, BookOpen, Layers, Check, FolderPlus, FileJson } from 'lucide-react';

interface Deck {
  id: string;
  title: string;
}

interface AiResultPreviewProps {
  cards: AiCardOutput[];
  decks: Deck[];
  onSave: (deckIdOrTitle: string, isNew: boolean) => Promise<void>;
  isSaving: boolean;
}

export function AiResultPreview({ cards, decks, onSave, isSaving }: AiResultPreviewProps) {
  const [deckMode, setDeckMode] = useState<'existing' | 'new'>('existing');
  const [selectedDeckId, setSelectedDeckId] = useState(decks[0]?.id || '');
  const [newDeckTitle, setNewDeckTitle] = useState('');
  const [previewTab, setPreviewTab] = useState<'cards' | 'json'>('cards');
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    if (!selectedDeckId && decks.length > 0) {
      setSelectedDeckId(decks[0].id);
    }
  }, [decks, selectedDeckId]);

  const handleSave = async () => {
    if (deckMode === 'existing') {
      if (!selectedDeckId) return;
      await onSave(selectedDeckId, false);
    } else {
      if (!newDeckTitle.trim()) return;
      await onSave(newDeckTitle.trim(), true);
    }
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  // Structured notes representation for the json tab
  const noteRepresentation = {
    note_type: 'basic',
    fields_version: 1,
    notes: cards.map((c, i) => ({
      note_id: `note-${i + 1}`,
      fields_json: JSON.stringify({
        front: c.front,
        back: c.back,
      }),
      additional_content: `AI Generated Note #${i + 1}`,
      generated_cards: [
        {
          template_key: 'Recognition',
          front: c.front,
          back: c.back,
          id: `uuidv5(note-${i + 1} + 'Recognition')`,
        },
        {
          template_key: 'Recall',
          front: c.back,
          back: c.front,
          id: `uuidv5(note-${i + 1} + 'Recall')`,
        },
      ],
    })),
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Generation Results</h2>
          <p className="text-sm text-muted-foreground">Generated {cards.length} structured flashcard note candidates.</p>
        </div>

        {/* Tab Toggle */}
        <div className="flex bg-muted/60 p-0.5 rounded-lg border border-border/40 text-xs">
          <button
            onClick={() => setPreviewTab('cards')}
            className={`flex items-center gap-1 py-1 px-2.5 rounded-md font-medium transition-all ${
              previewTab === 'cards' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'
            }`}
          >
            <Layers className="size-3" /> Cards
          </button>
          <button
            onClick={() => setPreviewTab('json')}
            className={`flex items-center gap-1 py-1 px-2.5 rounded-md font-medium transition-all ${
              previewTab === 'json' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'
            }`}
          >
            <FileJson className="size-3" /> Note Schema
          </button>
        </div>
      </div>

      {previewTab === 'cards' ? (
        <div className="space-y-4 max-h-100 overflow-y-auto pr-2">
          {cards.map((card, idx) => (
            <div
              key={idx}
              className="bg-card/40 border border-border/60 rounded-2xl p-4 shadow-sm hover:border-violet-500/30 transition-all duration-200 group flex flex-col md:flex-row gap-4 justify-between items-stretch"
            >
              <div className="flex-1 space-y-1">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Front</div>
                <div className="text-sm font-medium">{card.front}</div>
              </div>
              <div className="hidden md:flex items-center text-muted-foreground">
                <ArrowRight className="size-4 group-hover:translate-x-0.5 transition-transform" />
              </div>
              <div className="flex-1 space-y-1">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Back</div>
                <div className="text-sm font-medium">{card.back}</div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-muted/40 border border-border/60 rounded-2xl p-4 overflow-auto max-h-100 text-xs font-mono text-muted-foreground whitespace-pre">
          {JSON.stringify(noteRepresentation, null, 2)}
        </div>
      )}

      {/* Persistence Section */}
      <div className="bg-card/30 border border-border/50 rounded-3xl p-6 backdrop-blur-sm space-y-6">
        <div>
          <h3 className="text-lg font-bold tracking-tight">Save to Database</h3>
          <p className="text-sm text-muted-foreground">Choose deck membership. Saving creates independent Recognition & Recall schedules.</p>
        </div>

        {/* Deck Mode Toggle */}
        <div className="flex bg-muted/40 p-1 rounded-xl w-fit border border-border/40">
          <button
            type="button"
            onClick={() => setDeckMode('existing')}
            className={`flex items-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all ${
              deckMode === 'existing' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'
            }`}
          >
            <BookOpen className="size-3.5" /> Select Deck
          </button>
          <button
            type="button"
            onClick={() => setDeckMode('new')}
            className={`flex items-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all ${
              deckMode === 'new' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'
            }`}
          >
            <FolderPlus className="size-3.5" /> Create New
          </button>
        </div>

        {/* Target Deck input */}
        {deckMode === 'existing' ? (
          <Field className="space-y-2">
            <FieldLabel htmlFor="deck-select">Target Deck</FieldLabel>
            <div className="relative">
              <select
                id="deck-select"
                value={selectedDeckId}
                onChange={(e) => setSelectedDeckId(e.target.value)}
                className="w-full rounded-3xl border border-border/60 bg-input/50 px-3 py-2 text-sm focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 outline-none appearance-none cursor-pointer"
              >
                <option value="" disabled>-- Choose a deck --</option>
                {decks.map((deck) => (
                  <option key={deck.id} value={deck.id} className="bg-background text-foreground">
                    {deck.title}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-muted-foreground">
                ▼
              </div>
            </div>
          </Field>
        ) : (
          <Field className="space-y-2">
            <FieldLabel htmlFor="new-deck">New Deck Name</FieldLabel>
            <Input
              id="new-deck"
              placeholder="e.g. French Vocab A1"
              value={newDeckTitle}
              onChange={(e) => setNewDeckTitle(e.target.value)}
              className="w-full border-border/60"
            />
          </Field>
        )}

        <Button
          onClick={handleSave}
          disabled={isSaving || (deckMode === 'existing' && !selectedDeckId) || (deckMode === 'new' && !newDeckTitle.trim())}
          className="w-full bg-linear-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-3xl py-5 shadow-lg shadow-emerald-500/10 font-semibold"
        >
          {isSaving ? (
            'Saving to Deck...'
          ) : savedSuccess ? (
            <span className="flex items-center justify-center gap-1">
              <Check className="size-4" /> Saved Successfully!
            </span>
          ) : (
            'Create Deck & Save'
          )}
        </Button>
      </div>
    </div>
  );
}
