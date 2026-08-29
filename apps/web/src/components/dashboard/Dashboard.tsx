import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import { PageContainer } from '@/components/PageContainer';
import { BookOpen, Library, Settings as SettingsIcon } from 'lucide-react';
import { DeckList } from '@/components/deck/DeckList';
import { DeckDetail } from '@/components/deck/DeckDetail';
import { Settings } from './settings/Settings';
import { Overview } from './Overview';

export function DashboardComponent() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'overview' | 'decks' | 'settings'>(
    'overview',
  );
  const [subView, setSubView] = useState<{
    type: 'list' | 'detail';
    deckId?: string;
  }>({ type: 'list' });

  return (
    <PageContainer
      title="Dashboard Page"
      description="Welcome to your language learning portal. Track your vocabulary review progress, explore dictionaries, and build your learning streak."
    >
      {/* Navigation Tabs */}
      <div className="flex flex-col sm:flex-row border border-border/50 sm:border-0 sm:border-b gap-2 p-1.5 bg-muted/30 rounded-2xl w-full sm:w-fit">
        <Button
          variant={activeTab === 'overview' ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() => {
            setActiveTab('overview');
          }}
          className="cursor-pointer font-semibold rounded-xl text-xs px-4 justify-start sm:justify-center"
        >
          <BookOpen className="size-3.5 mr-1.5" />
          Overview
        </Button>
        <Button
          variant={activeTab === 'decks' ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() => {
            setActiveTab('decks');
            setSubView({ type: 'list' });
          }}
          className="cursor-pointer font-semibold rounded-xl text-xs px-4 justify-start sm:justify-center"
        >
          <Library className="size-3.5 mr-1.5" />
          My Library
        </Button>
        <Button
          variant={activeTab === 'settings' ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() => {
            setActiveTab('settings');
          }}
          className="cursor-pointer font-semibold rounded-xl text-xs px-4 justify-start sm:justify-center"
        >
          <SettingsIcon className="size-3.5 mr-1.5" />
          Profile & Settings
        </Button>
      </div>

      {/* Tab Contents */}
      {activeTab === 'overview' && (
        <Overview
          onChooseDeck={() => {
            setActiveTab('decks');
            setSubView({ type: 'list' });
          }}
        />
      )}

      {activeTab === 'decks' && (
        <div className="space-y-6">
          {subView.type === 'list' ? (
            <DeckList
              onSelectDeck={(deckId) => setSubView({ type: 'detail', deckId })}
              onStartReview={(deckId) =>
                navigate({ to: '/app/deck-review', search: { deckId } })
              }
            />
          ) : (
            <DeckDetail
              deckId={subView.deckId!}
              onBack={() => setSubView({ type: 'list' })}
            />
          )}
        </div>
      )}

      {activeTab === 'settings' && <Settings />}
    </PageContainer>
  );
}
