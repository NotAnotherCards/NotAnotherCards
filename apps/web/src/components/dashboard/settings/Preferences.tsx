import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card';
import { Settings as SettingsIcon } from 'lucide-react';
import { ThemeChanger } from '@/components/ThemeChanger';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { authClient } from '@/lib/auth-client';
import {
  getReviewPreferences,
  saveReviewPreferences,
  type ReviewPreferences,
} from '@/lib/review-preferences';
import {
  getUiPreferences,
  saveUiPreferences,
  type UiPreferences,
} from '@/lib/ui-preferences';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

export function Preferences() {
  const { t } = useTranslation();
  const { data: session } = authClient.useSession();
  const [reviewPreferences, setReviewPreferences] = useState(() =>
    getReviewPreferences(session?.user.id),
  );
  const [uiPreferences, setUiPreferences] = useState(() =>
    getUiPreferences(session?.user.id),
  );

  useEffect(() => {
    setReviewPreferences(getReviewPreferences(session?.user.id));
    setUiPreferences(getUiPreferences(session?.user.id));
  }, [session?.user.id]);

  const updateReviewPreferences = (nextPreferences: ReviewPreferences) => {
    setReviewPreferences(nextPreferences);
    saveReviewPreferences(session?.user.id, nextPreferences);
  };

  const updateUiPreferences = (nextPreferences: UiPreferences) => {
    setUiPreferences(nextPreferences);
    saveUiPreferences(session?.user.id, nextPreferences);
  };

  return (
    <div className="space-y-6">
      <Card className="border border-border/60 shadow-xs rounded-3xl">
        <CardHeader className="flex flex-row items-center gap-3 pb-4">
          <div className="p-2 bg-primary/10 rounded-2xl text-primary">
            <SettingsIcon className="size-5" />
          </div>
          <div>
            <CardTitle className="text-base font-bold">
              {t('dashboard.settings.preferences.title')}
            </CardTitle>
            <CardDescription className="text-xs">
              {t('dashboard.settings.preferences.description')}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium text-foreground">
              {t('dashboard.settings.preferences.use_target_language')}
            </span>
            <span className="text-xs text-muted-foreground">
              {t(
                'dashboard.settings.preferences.use_target_language_description',
              )}
            </span>
            <div className="mt-1">
              <Switch
                id="use-target-language"
                checked={uiPreferences.useTargetLanguageForUi}
                onCheckedChange={(useTargetLanguageForUi) =>
                  updateUiPreferences({
                    ...uiPreferences,
                    useTargetLanguageForUi,
                  })
                }
                aria-label={t(
                  'dashboard.settings.preferences.use_target_language',
                )}
              />
            </div>
          </div>
          <div className="flex flex-col gap-2 border-t border-border/60 pt-6">
            <span className="text-sm font-medium text-foreground">
              {t('dashboard.settings.preferences.theme')}
            </span>
            <span className="text-xs text-muted-foreground">
              {t('dashboard.settings.preferences.theme_description')}
            </span>
            <div className="mt-1">
              <ThemeChanger />
            </div>
          </div>
          <div className="flex flex-col gap-2 border-t border-border/60 pt-6">
            <span className="text-sm font-medium text-foreground">
              {t('dashboard.settings.preferences.review_mode')}
            </span>
            <span className="text-xs text-muted-foreground">
              {t('dashboard.settings.preferences.review_mode_description')}
            </span>
            <div
              className="mt-1 flex gap-2"
              role="group"
              aria-label={t('dashboard.settings.preferences.review_mode')}
            >
              <Button
                type="button"
                variant={
                  reviewPreferences.reviewMode === 'basic'
                    ? 'default'
                    : 'outline'
                }
                aria-pressed={reviewPreferences.reviewMode === 'basic'}
                onClick={() =>
                  updateReviewPreferences({
                    ...reviewPreferences,
                    reviewMode: 'basic',
                  })
                }
              >
                {t('dashboard.settings.preferences.basic')}
              </Button>
              <Button
                type="button"
                variant={
                  reviewPreferences.reviewMode === 'extended'
                    ? 'default'
                    : 'outline'
                }
                aria-pressed={reviewPreferences.reviewMode === 'extended'}
                onClick={() =>
                  updateReviewPreferences({
                    ...reviewPreferences,
                    reviewMode: 'extended',
                  })
                }
              >
                {t('dashboard.settings.preferences.extended')}
              </Button>
            </div>
          </div>
          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-col gap-1">
              <label
                htmlFor="show-next-review-interval"
                className="text-sm font-medium text-foreground"
              >
                {t('dashboard.settings.preferences.show_next_review')}
              </label>
              <span className="text-xs text-muted-foreground">
                {t(
                  'dashboard.settings.preferences.show_next_review_description',
                )}
              </span>
            </div>
            <Switch
              id="show-next-review-interval"
              checked={reviewPreferences.showNextReviewInterval}
              onCheckedChange={(showNextReviewInterval) =>
                updateReviewPreferences({
                  ...reviewPreferences,
                  showNextReviewInterval,
                })
              }
              aria-label={t('dashboard.settings.preferences.show_next_review')}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
