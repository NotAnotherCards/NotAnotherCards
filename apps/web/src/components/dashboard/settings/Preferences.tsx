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
import { useEffect, useState } from 'react';

export function Preferences() {
  const { data: session } = authClient.useSession();
  const [reviewPreferences, setReviewPreferences] = useState(() =>
    getReviewPreferences(session?.user.id),
  );

  useEffect(() => {
    setReviewPreferences(getReviewPreferences(session?.user.id));
  }, [session?.user.id]);

  const updateReviewPreferences = (nextPreferences: ReviewPreferences) => {
    setReviewPreferences(nextPreferences);
    saveReviewPreferences(session?.user.id, nextPreferences);
  };

  return (
    <div className="space-y-6">
      <Card className="border border-border/60 shadow-xs rounded-3xl">
        <CardHeader className="flex flex-row items-center gap-3 pb-4">
          <div className="p-2 bg-primary/10 rounded-2xl text-primary">
            <SettingsIcon className="size-5" />
          </div>
          <div>
            <CardTitle className="text-base font-bold">Preferences</CardTitle>
            <CardDescription className="text-xs">
              Customize your application settings and appearance
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium text-foreground">Theme</span>
            <span className="text-xs text-muted-foreground">
              Select how the application looks to you
            </span>
            <div className="mt-1">
              <ThemeChanger />
            </div>
          </div>
          <div className="flex flex-col gap-2 border-t border-border/60 pt-6">
            <span className="text-sm font-medium text-foreground">
              Review mode
            </span>
            <span className="text-xs text-muted-foreground">
              Choose how many answer options you see after revealing a card
            </span>
            <div
              className="mt-1 flex gap-2"
              role="group"
              aria-label="Review mode"
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
                Basic
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
                Extended
              </Button>
            </div>
          </div>
          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-col gap-1">
              <label
                htmlFor="show-next-review-interval"
                className="text-sm font-medium text-foreground"
              >
                Show next review interval
              </label>
              <span className="text-xs text-muted-foreground">
                Show when each answer schedules the card next
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
              aria-label="Show next review interval"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
