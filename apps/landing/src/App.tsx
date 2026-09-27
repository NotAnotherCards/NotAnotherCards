import { type ReactNode } from 'react';
import { MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

const APP_URL = 'https://app.notanothercards.com';

export function App() {
  return <LandingPage />;
}

function LandingPage() {
  return (
    <main>
      <header className="mx-auto flex max-w-6xl items-center justify-between gap-3 border-b border-border px-5 py-5 sm:px-8">
        <a className="min-w-0" href="/" aria-label="NotAnotherCards home">
          <picture>
            <source
              media="(prefers-color-scheme: dark)"
              srcSet="/brand/notanothercards-logo-dark.svg"
            />
            <img
              className="h-[44px] w-[346px] max-w-[calc(100vw-14rem)] sm:max-w-none"
              src="/brand/notanothercards-logo.svg"
              alt="NotAnotherCards"
            />
          </picture>
        </a>
        <nav
          className="flex shrink-0 items-center gap-2"
          aria-label="Account actions"
        >
          <Button asChild variant="ghost" size="lg" className="px-1 sm:px-4">
            <a href={`${APP_URL}/login`}>Log in</a>
          </Button>
          <Button asChild size="lg">
            <a href={`${APP_URL}/register`}>Get started</a>
          </Button>
        </nav>
      </header>

      <section className="hero-section">
        <div className="hero-copy">
          <h1 className="text-balance text-5xl font-semibold tracking-[-0.065em] text-foreground sm:text-6xl">
            Learn the words that matter most.
          </h1>
          <p className="mx-auto mt-7 max-w-lg text-lg leading-8 text-muted sm:text-xl">
            Build real vocabulary with focused flashcards, helpful context, and
            short sessions that fit your day.
          </p>
          <Button asChild size="lg" className="mt-8 h-12 px-5 text-base">
            <a href={`${APP_URL}/register`}>Get started free</a>
          </Button>
        </div>

        <div className="card-scene" aria-label="Example learning cards">
          <div className="learning-grid" />
          <article className="learning-card learning-card-one z-10 rounded-2xl border border-sage-border bg-background p-5 shadow-card sm:p-6">
            <h2 className="text-3xl font-bold tracking-[-0.06em]">to learn</h2>
            <p className="mt-1 text-muted">aprender</p>
            <div className="my-5 border-t border-border" />
            <div className="learning-card-labels flex gap-2 text-xs font-medium">
              <span className="rounded-md border border-primary/20 bg-primary/10 px-2 py-1 font-semibold text-primary">
                Frequency
              </span>
              <span className="card-secondary-label rounded-md border border-sage-border bg-surface px-2 py-1">
                Examples
              </span>
            </div>
            <p className="mt-3 text-sm leading-5 text-muted">
              A little practice,
              <span className="card-overlap-break">
                <br />
              </span>{' '}
              <span className="whitespace-nowrap">every day.</span>
            </p>
          </article>
          <article className="learning-card learning-card-two z-20 rotate-[2deg] rounded-2xl border border-sage-border bg-background p-5 shadow-card sm:p-6">
            <h2 className="text-3xl font-bold tracking-[-0.06em]">
              to remember
            </h2>
            <p className="mt-1 text-muted">recordar</p>
            <div className="my-5 border-t border-border" />
            <div className="learning-card-labels flex gap-2 text-xs font-medium">
              <span className="rounded-md border border-primary/20 bg-primary/10 px-2 py-1 font-semibold text-primary">
                Memorization
              </span>
              <span className="card-secondary-label rounded-md border border-sage-border bg-surface px-2 py-1">
                Etymology
              </span>
            </div>
            <p className="mt-3 text-sm leading-5 text-muted">
              Make the word
              <span className="card-overlap-break">
                <br />
              </span>{' '}
              <span className="whitespace-nowrap">easier to recall.</span>
            </p>
          </article>
          <article className="learning-card learning-card-three z-30 -rotate-[1deg] rounded-2xl border border-sage-border bg-background p-5 shadow-card sm:p-6">
            <h2 className="text-3xl font-bold tracking-[-0.06em]">
              to practise
            </h2>
            <p className="mt-1 text-muted">practicar</p>
            <div className="my-5 border-t border-border" />
            <div className="learning-card-labels flex gap-2 text-xs font-medium">
              <span className="rounded-md border border-primary/20 bg-primary/10 px-2 py-1 font-semibold text-primary">
                Similar words
              </span>
              <span className="card-secondary-label rounded-md border border-sage-border bg-surface px-2 py-1">
                Pronunciation
              </span>
            </div>
            <p className="mt-3 text-sm leading-5 text-muted">
              Notice links{' '}
              <span className="whitespace-nowrap">between languages.</span>
            </p>
          </article>
          <p className="session-badge z-40 rounded-xl border border-border bg-background px-4 py-3 text-sm text-muted shadow-card">
            Today&apos;s session · 8 cards
          </p>
        </div>
      </section>

      <section className="border-y border-sage-border bg-surface">
        <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8 lg:py-24">
          <h2 className="mx-auto text-center text-3xl font-semibold tracking-[-0.05em] sm:text-4xl">
            Designed to make every word useful.
          </h2>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            <ValueProposition
              icon={<MessageCircle className="size-5" aria-hidden="true" />}
              title="Learn words you will use"
              description="Focus on high-frequency vocabulary for the conversations and content you meet every day."
            />
            <ValueProposition
              icon={<span className="text-2xl leading-none">✦</span>}
              title="More than a translation"
              description="AI adds frequency, origins, examples, language connections, and memory cues that make a word stick."
            />
            <ValueProposition
              icon={
                <span className="relative -top-px text-3xl leading-none">
                  ↻
                </span>
              }
              title="Study offline. Sync later."
              description="Keep learning without internet. Your progress synchronizes across devices when you reconnect."
            />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-16 text-center sm:px-8 lg:py-24">
        <div className="mx-auto max-w-2xl">
          <h2 className="text-3xl font-semibold tracking-[-0.05em] sm:text-4xl">
            More than individual words
          </h2>
          <p className="mt-5 text-lg leading-8 text-muted">
            Use cards for vocabulary, phrases, grammar — and any ideas, facts,
            or information you want to remember.
          </p>
        </div>
        <ul
          className="mx-auto mt-8 flex max-w-none flex-wrap justify-center gap-2"
          aria-label="Supported learning material"
        >
          {[
            'Useful phrases',
            'Grammar patterns',
            'Cultural context',
            'Your own study material',
          ].map((item) => (
            <li
              key={item}
              className="rounded-full border border-sage-border bg-surface-soft px-4 py-2 text-sm font-medium text-sage-foreground"
            >
              {item}
            </li>
          ))}
        </ul>
      </section>

      <section className="border-y border-sage-border bg-surface">
        <div className="mx-auto max-w-6xl px-5 py-16 text-center sm:px-8 lg:py-24">
          <h2 className="text-balance text-4xl font-semibold tracking-[-0.06em] sm:text-5xl">
            Start with the next card.
          </h2>
          <p className="mt-5 text-lg text-muted">
            Free to begin. Built for your daily learning rhythm.
          </p>
          <Button asChild size="lg" className="mt-8 h-12 px-5 text-base">
            <a href={`${APP_URL}/register`}>Create your account</a>
          </Button>
        </div>
      </section>

      <footer className="mx-auto max-w-6xl px-5 py-8 text-sm text-muted sm:px-8">
        © 2026 NotAnotherCards <span aria-hidden="true">·</span> Learn at your
        own pace.
      </footer>
    </main>
  );
}

function ValueProposition({
  icon,
  title,
  description,
}: {
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <article className="rounded-2xl border border-sage-border bg-background p-6 shadow-card">
      <div className="flex items-center gap-3">
        <span
          className="grid size-10 shrink-0 place-items-center rounded-lg border border-sage-border bg-surface-soft text-primary"
          aria-hidden="true"
        >
          {icon}
        </span>
        <h3 className="text-xl font-semibold tracking-[-0.035em]">{title}</h3>
      </div>
      <p className="mt-3 leading-7 text-muted">{description}</p>
    </article>
  );
}
