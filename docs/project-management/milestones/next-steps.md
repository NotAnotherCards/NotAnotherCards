# Next steps - milestone categories after M2

As we talked yesterday, here are the categories I see, how we could divide the rest of the things for our project.

The grouping is based on:

- `docs/application-modules-transcendence-plan.md`
- `docs/concept.md`

Each category should:

- become a milestone track
- have at least 2 people involved

> The structureof the milestone for each category has to be defined between the 2 people involved. All new features should be integrated in the existing architecture, they MUST NOT change it.

## Recommended category split

My recommended categories are:

1. Auth and Platform
2. Core Learning and Content
3. Mobile
4. Social Features, Gamification, and Progress
5. AI and Content Quality

## Category in detail

### 1. Auth and Platform

This category covers the modules that make the application operational,
deployable, secure, and externally accessible.

What this category includes in practice:

- auth flows (OAuth 2.0), sessions, protected routes, account basics
- Privacy Policy and Terms of Service pages
- public API, API keys, rate limiting, and docs
- health checks, monitoring, backup/recovery basics (if we decide to take this)
- production environment setup, HTTPS, env handling, release readiness

### 2. Core Learning and Content

This category covers the main product data model and the user-facing content
management features that are not specifically AI or social.

What this category includes in practice:

- the card schema development for word, comparison, and phrase cards
- personal dictionary CRUD and word-state management
- curated starter dictionaries and thematic word collections
- search, filters, sorting, and pagination
- CSV import/export and related validation

### 3. Mobile

This category covers the whole extra module that is in our case the mobile version. In practice this category will be developed at the same pace that our web version.

What this category includes in practice:

- UI components
- Sync engine integration
- Social features
- Offline capabilities
- Constant replication of web new features

Here `@dustyway` already started working in the base structure

### 4. Social Features, Gamification, and Progress

This category covers everything that makes learning visible, comparable, and
motivating across personal progress and other users.

What this category includes in practice:

- personal progress dashboards and charts
- streaks, due counts, learned-word counts, and activity history
- friend discovery, requests, profiles, and rankings
- XP, levels, badges, achievement logic, and leaderboard feedback

### 5. AI and Content Quality

This category covers generation of new card/decks content and the workflow needed to
keep that generated/shared content trustworthy over time.

What this category includes in practice:

- LLM integration for fixed decks/cards
- generation of examples, hints, grammar metadata, and related fields
- retry/error handling and generation limits
- user generation of new cards/decks

## Dependency notes

Some tracks can start in parallel, but they are not equally independent.

Most dependency-sensitive tracks:

- `Auth and Platform` should stay ahead because other modules depend on stable
  auth, deployment, and shared app structure.
- `Core Learning and Content` should progress early because AI, search, social
  stats, and review flows all depend on the card/domain model.
- `Mobile ` this one will move with based on each update done in the web version.

Less blocked tracks:

- `Social Features, Gamification, and Progress` can start once basic user data,
  review events, and progress data exist.
- `AI and Content Quality` can start once the card schema and generation target
  format are stable enough.
