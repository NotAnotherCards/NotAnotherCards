import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { PageContainer } from '@/components/PageContainer';
import {
  BarChart3,
  BookOpen,
  Library,
  Settings as SettingsIcon,
} from 'lucide-react';
import { DeckList } from '@/components/deck/DeckList';
import { DeckDetail } from '@/components/deck/DeckDetail';
import { Settings } from './settings/Settings';
import { Overview } from './Overview';
import { Statistics } from './Statistics';
import { AiGenerationPlaygroundComponent } from '../ai/AiGenerationPlaygroundComponent';
import { Leaderboard } from './Leaderboard';

export function DashboardComponent() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<
    | 'overview'
    | 'decks'
    | 'statistics'
    | 'leaderboard'
    | 'playground'
    | 'settings'
  >('overview');
  const [subView, setSubView] = useState<{
    type: 'list' | 'detail';
    deckId?: string;
  }>({ type: 'list' });

  return (
    <PageContainer
      title={t('dashboard.title')}
      description={t('dashboard.description')}
    >
      {/* Navigation Tabs */}
      <div
        role="tablist"
        aria-label={t('dashboard.aria_sections')}
        className="flex flex-col sm:flex-row border border-border/50 sm:border-0 sm:border-b gap-2 p-1.5 bg-muted/30 rounded-2xl w-full sm:w-fit"
      >
        <Button
          role="tab"
          aria-selected={activeTab === 'overview'}
          variant={activeTab === 'overview' ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() => {
            setActiveTab('overview');
          }}
          className="cursor-pointer font-semibold rounded-xl text-xs px-4 justify-start sm:justify-center"
        >
          <BookOpen className="size-3.5 mr-1.5" />
          {t('dashboard.tabs.overview')}
        </Button>
        <Button
          role="tab"
          aria-selected={activeTab === 'decks'}
          variant={activeTab === 'decks' ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() => {
            setActiveTab('decks');
            setSubView({ type: 'list' });
          }}
          className="cursor-pointer font-semibold rounded-xl text-xs px-4 justify-start sm:justify-center"
        >
          <Library className="size-3.5 mr-1.5" />
          {t('dashboard.tabs.library')}
        </Button>
        <Button
          role="tab"
          aria-selected={activeTab === 'playground'}
          variant={activeTab === 'playground' ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() => {
            setActiveTab('playground');
          }}
          className="cursor-pointer font-semibold rounded-xl text-xs px-4 justify-start sm:justify-center"
        >
          <BookOpen className="size-3.5 mr-1.5" />
          {t('dashboard.tabs.playground')}
        </Button>
        <Button
          role="tab"
          aria-selected={activeTab === 'statistics'}
          variant={activeTab === 'statistics' ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() => {
            setActiveTab('statistics');
          }}
          className="cursor-pointer font-semibold rounded-xl text-xs px-4 justify-start sm:justify-center"
        >
          <BarChart3 className="size-3.5 mr-1.5" />
          {t('dashboard.tabs.statistics')}
        </Button>{' '}
        <Button
          role="tab"
          aria-selected={activeTab === 'leaderboard'}
          variant={activeTab === 'leaderboard' ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() => {
            setActiveTab('leaderboard');
          }}
          className="cursor-pointer font-semibold rounded-xl text-xs px-4 justify-start sm:justify-center"
        >
          <BarChart3 className="size-3.5 mr-1.5" />
          {t('dashboard.tabs.leaderboard')}
        </Button>
        <Button
          role="tab"
          aria-selected={activeTab === 'settings'}
          variant={activeTab === 'settings' ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() => {
            setActiveTab('settings');
          }}
          className="cursor-pointer font-semibold rounded-xl text-xs px-4 justify-start sm:justify-center"
        >
          <SettingsIcon className="size-3.5 mr-1.5" />
          {t('dashboard.tabs.settings')}
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
                navigate({ to: '/deck-review', search: { deckId } })
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

      {activeTab === 'statistics' && <Statistics />}
      {activeTab === 'leaderboard' && <Leaderboard />}
      {activeTab === 'playground' && <AiGenerationPlaygroundComponent />}
      {activeTab === 'settings' && <Settings />}
    </PageContainer>
  );
}
