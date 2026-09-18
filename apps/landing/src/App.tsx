import { useEffect, type ReactNode } from 'react';
import { MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

const APP_URL = 'https://app.notanothercards.com';

export function App() {
  if (window.location.pathname === '/') {
    return <LandingPage />;
  }

  if (window.location.pathname === '/privacy') {
    return <PrivacyPolicyPage />;
  }

  return <NotFoundPage />;
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

      <LandingFooter />
    </main>
  );
}

function PrivacyPolicyPage() {
  usePrivacyPageMetadata();

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

      <article className="mx-auto max-w-3xl px-5 py-14 sm:px-8 sm:py-20">
        <p className="text-sm font-medium text-primary">NotAnotherCards</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-[-0.06em] sm:text-5xl">
          Privacy Policy
        </h1>
        <p className="mt-5 text-sm leading-6 text-muted">
          Effective date: September 17, 2026
        </p>

        <div className="mt-12 space-y-10 text-base leading-7 text-muted">
          <section aria-labelledby="privacy-overview">
            <h2
              id="privacy-overview"
              className="text-2xl font-semibold tracking-[-0.04em] text-foreground"
            >
              Overview
            </h2>
            <p className="mt-4">
              NotAnotherCards is operated by the NotAnotherCards team, based in
              Berlin, Germany. This policy explains how we handle information
              when you use our flashcard learning service. For privacy
              questions, contact us at{' '}
              <a
                className="underline underline-offset-4 hover:text-foreground"
                href="mailto:notanothercards@gmail.com"
              >
                notanothercards@gmail.com
              </a>
              .
            </p>
          </section>
          <section aria-labelledby="privacy-data">
            <h2
              id="privacy-data"
              className="text-2xl font-semibold tracking-[-0.04em] text-foreground"
            >
              Information we process
            </h2>
            <div className="mt-4 space-y-4">
              <p>
                We process the account details you provide, such as your email
                address and display name. When you choose Facebook Login, we
                receive the account identifier and the profile information Meta
                makes available to us, such as your name, email address when
                available, and profile image. We use this information to create
                or link your NotAnotherCards account and to sign you in. We do
                not receive your Facebook password and we do not post to
                Facebook on your behalf.
              </p>
              <p>
                We also process the learning content and settings you create,
                including decks, notes, cards, review events, and profile
                preferences. To support offline learning, a copy of this data
                may be stored in your browser&apos;s local database. After you
                sign in, the learning data synchronizes with our server and
                PostgreSQL database so it can be available on your devices.
                Passwords and session tokens are not part of this local
                learning-data store.
              </p>
              <p>
                We use hosted servers to operate NotAnotherCards and reasonable
                technical measures to protect the service, but no internet
                service can promise absolute security.
              </p>
            </div>
          </section>
          <section aria-labelledby="privacy-ai">
            <h2
              id="privacy-ai"
              className="text-2xl font-semibold tracking-[-0.04em] text-foreground"
            >
              AI processing and moderation
            </h2>
            <div className="mt-4 space-y-4">
              <p>
                If you ask NotAnotherCards to generate learning content, the
                input you submit and the generated result are sent through our
                server-side AI gateway to provide that feature. AI generation is
                optional: we do not send your learning content for AI generation
                unless you start a generation request.
              </p>
              <p>
                When you publish a deck publicly, its content is checked by an
                AI moderation service before publication. Private decks are not
                sent to that moderation check. We use protected AI
                infrastructure to provide generation and moderation.
              </p>
            </div>
          </section>
          <section aria-labelledby="privacy-public-decks">
            <h2
              id="privacy-public-decks"
              className="text-2xl font-semibold tracking-[-0.04em] text-foreground"
            >
              Public decks
            </h2>
            <p className="mt-4">
              A deck remains private unless you choose to publish it. Published
              deck information and its learning content can be viewed by other
              people through NotAnotherCards. You can unpublish a deck to stop
              making its published version publicly available.
            </p>
          </section>
          <section id="data-deletion" aria-labelledby="privacy-data-deletion">
            <h2
              id="privacy-data-deletion"
              className="scroll-mt-6 text-2xl font-semibold tracking-[-0.04em] text-foreground"
            >
              Data deletion
            </h2>
            <div className="mt-4 space-y-4">
              <p>
                You can request deletion of your NotAnotherCards account and
                associated data without signing in. Email{' '}
                <a
                  className="underline underline-offset-4 hover:text-foreground"
                  href="mailto:notanothercards@gmail.com?subject=NotAnotherCards%20data%20deletion%20request"
                >
                  notanothercards@gmail.com
                </a>{' '}
                with the subject “NotAnotherCards data deletion request.”
              </p>
              <p>
                Send the request from the email address on your account when
                possible. If you cannot access that address, include the email
                address and any other account details we reasonably need to
                verify that you own the account. We will confirm the request,
                verify your identity before deleting data, and confirm when the
                deletion has been completed.
              </p>
              <p>
                Removing NotAnotherCards from Facebook does not automatically
                delete your NotAnotherCards account or learning data. Use the
                process above to request deletion from our service.
              </p>
            </div>
          </section>
          <section aria-labelledby="privacy-changes">
            <h2
              id="privacy-changes"
              className="text-2xl font-semibold tracking-[-0.04em] text-foreground"
            >
              Changes to this policy
            </h2>
            <p className="mt-4">
              We may update this policy when the service or our data practices
              change. The current version and effective date will always be
              published on this page.
            </p>
          </section>
        </div>
      </article>

      <LandingFooter />
    </main>
  );
}

function NotFoundPage() {
  useNotFoundPageMetadata();

  const cards = [
    { digit: '4', word: 'Page', className: 'not-found-card-one' },
    {
      digit: '0',
      word: 'not',
      className: 'not-found-card-two',
    },
    {
      digit: '4',
      word: 'found',
      className: 'not-found-card-three',
    },
  ];

  return (
    <main className="flex min-h-screen flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 border-b border-border px-5 py-5 sm:px-8">
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

      <section className="not-found-section flex flex-1 flex-col items-center px-5 py-14 text-center sm:px-8 sm:py-20">
        <h1 className="sr-only">Page not found</h1>
        <div className="not-found-scene" aria-label="Page not found word cards">
          {cards.map(({ digit, word, className }) => (
            <article
              key={digit + word}
              className={`not-found-card ${className} rounded-2xl border border-sage-border bg-background p-5 text-center shadow-card sm:p-6`}
            >
              <p className="grid flex-1 place-items-center text-7xl font-bold tracking-[-0.08em] text-foreground sm:text-8xl">
                {digit}
              </p>
              <div>
                <div className="border-t border-border" />
                <p className="mt-3 text-sm font-medium text-foreground">
                  {word}
                </p>
              </div>
            </article>
          ))}
        </div>

        <p className="mt-4 max-w-md text-lg leading-8 text-muted">
          The page you are looking for does not exist or has moved.
        </p>
        <Button asChild size="lg" className="mt-7 h-12 px-5 text-base">
          <a href="/">Back to home</a>
        </Button>
      </section>

      <LandingFooter />
    </main>
  );
}

function usePrivacyPageMetadata() {
  useEffect(() => {
    const originalTitle = document.title;
    const canonical = document.querySelector<HTMLLinkElement>(
      'link[rel="canonical"]',
    );
    const openGraphUrl = document.querySelector<HTMLMetaElement>(
      'meta[property="og:url"]',
    );
    const originalCanonicalUrl = canonical?.href;
    const originalOpenGraphUrl = openGraphUrl?.content;

    document.title = 'NotAnotherCards — Privacy Policy';
    if (canonical) canonical.href = 'https://notanothercards.com/privacy';
    if (openGraphUrl)
      openGraphUrl.content = 'https://notanothercards.com/privacy';

    return () => {
      document.title = originalTitle;
      if (canonical && originalCanonicalUrl)
        canonical.href = originalCanonicalUrl;
      if (openGraphUrl && originalOpenGraphUrl) {
        openGraphUrl.content = originalOpenGraphUrl;
      }
    };
  }, []);
}

function useNotFoundPageMetadata() {
  useEffect(() => {
    const originalTitle = document.title;
    document.title = 'NotAnotherCards — Page not found';

    return () => {
      document.title = originalTitle;
    };
  }, []);
}

function LandingFooter() {
  return (
    <footer className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-2 gap-y-1 px-5 py-8 text-sm text-muted sm:px-8">
      <span>© 2026 NotAnotherCards</span>
      <span aria-hidden="true">·</span>
      <span>Learn at your own pace.</span>
      <span aria-hidden="true">·</span>
      <a
        className="underline underline-offset-4 hover:text-foreground"
        href="/privacy"
      >
        Privacy Policy
      </a>
    </footer>
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
