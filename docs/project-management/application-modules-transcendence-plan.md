# Application modules and Transcendence plan

## Purpose

This document breaks NotAnotherCards into high-level application modules and marks which modules are needed for the 42 Transcendence evaluation.

It is a planning document, not a final commitment. The team should update it after technical milestones and module choices are finalized.

## Transcendence scoring summary

The subject requires **14 points**.

- Major module: **2 points**
- Minor module: **1 point**

Recommended target:

- Claim at least **19 points** as the main plan.
- Keep reserve modules in case one module is not validated during evaluation.

## Mandatory evaluation requirements

These are required by the subject, but they do not give module points by themselves.

| Requirement | How we cover it | Evaluation status |
| --- | --- | --- |
| Web application | React frontend, NestJS backend, PostgreSQL database | Mandatory |
| Frontend, backend, database | `apps/web`, `apps/api`, PostgreSQL | Mandatory |
| Containerized deployment | Docker Compose with one command startup | Mandatory |
| Multiple users | User accounts, sessions, isolated user data | Mandatory |
| Email/password authentication | Better Auth with secure password handling | Mandatory |
| Frontend and backend validation | Zod schemas, backend validation, form validation | Mandatory |
| Responsive accessible UI | Mobile-first layout, keyboard-friendly forms | Mandatory |
| Privacy Policy and Terms of Service | Real pages accessible from the app | Mandatory |
| HTTPS for browser-to-backend traffic | Production deployment with HTTPS | Mandatory |
| Clear README and documentation | README, database docs, modules, contributions | Mandatory |

## Main application modules

| ID | Application module | Short description | Related Transcendence module | Planned points |
| --- | --- | --- | --- | ---: |
| A01 | Project foundation | Monorepo, shared configs, scripts, Docker base, local development workflow | Web: frontend and backend frameworks | 2 |
| A02 | Authentication and user accounts | Signup, login, logout, sessions, protected routes, basic user profile | Mandatory auth; supports Web frameworks and OAuth | 1 |
| A03 | Legal and static pages | Privacy Policy, Terms of Service, basic public pages | Mandatory requirement | 0 |
| A04 | Core card data model | Data model for word cards, comparison cards, phrase cards, languages, grammar fields | Supports ORM and custom adaptive card reserve module | 1 |
| A05 | Review session UI | Card review screen, remember/forgot actions, mobile swipe/buttons, next card flow | Supports custom spaced repetition module | 0 |
| A06 | Spaced repetition engine | Scheduling algorithm, review history, due cards, progress reset | Modules of choice: spaced repetition learning engine | 2 |
| A07 | Personal dictionary | User dictionary, add/remove words, learned/in-progress/due states | Product core, no direct subject points | 0 |
| A08 | Ready-made dictionary library | Top word lists, thematic dictionaries, add words from public library | Supports ORM and card database modules | 0 |
| A09 | Search and filtering | Search personal dictionary and global database with filters, sorting, pagination | Web: advanced search | 1 |
| A10 | CSV import/export | Import word lists from CSV, validate rows, export user data or dictionaries | Data and Analytics: data export/import; GDPR support | 2 |
| A11 | Statistics dashboard | Learned words, due cards, streak, points by day, added words by day, reset progress | Data and Analytics: advanced analytics dashboard | 2 |
| A12 | Friends and social ranking | Find users, friend requests, friend profiles, public stats, global ranking | Product core; possible real-time reserve support | 0 |
| A13 | Gamification | XP, levels, achievements/badges, leaderboard feedback | Gaming and user experience: gamification system | 1 |
| A14 | PWA and offline mode | Installable app, offline review for downloaded cards, sync after reconnect | Web: PWA with offline support | 1 |
| A15 | Design system | Reusable UI components, color palette, typography, icons, consistent auth/card layouts | Web: custom-made design system | 1 |
| A16 | Accessibility and internationalization | Keyboard navigation, screen reader support, UI translations for at least 3 languages | Accessibility and Internationalization: multiple languages | 1 |
| A17 | AI card generation | Generate missing word cards, examples, mnemonic hints, grammar metadata, error handling | Artificial Intelligence: complete LLM system interface | 2 |
| A18 | Content quality workflow | User edits, reports, frequently edited fields, regeneration/manual review queue | Product core; supports AI/content quality | 0 |
| A19 | Public API | API key access, rate limiting, docs, at least 5 endpoints for database interaction | Web: Public API | 2 |
| A20 | Monitoring and backups | Health page/checks, backup procedure, basic recovery documentation | DevOps reserve module | 0 |
| A21 | Deployment and production readiness | Production environment, HTTPS, env management, browser console clean-up | Mandatory deployment and HTTPS requirement | 0 |

## Planned Transcendence scoring modules

This is the current recommended scoring plan. It avoids modules that conflict with our product decisions, such as mandatory chat or online status.

| Subject category | Module | Type | Points | Related app modules | Confidence |
| --- | --- | --- | ---: | --- | --- |
| Web | Use a framework for both frontend and backend | Major | 2 | A01, A02, A21 | High |
| Web | Use an ORM for the database | Minor | 1 | A02, A04, A08 | High |
| Web | Progressive Web App with offline support and installability | Minor | 1 | A14 | Medium |
| Web | Custom-made design system with at least 10 reusable components | Minor | 1 | A15 | High |
| Web | Advanced search with filters, sorting, and pagination | Minor | 1 | A09 | Medium |
| Accessibility and Internationalization | Multiple languages, at least 3 UI languages | Minor | 1 | A16 | Medium |
| User Management | OAuth 2.0 remote authentication | Minor | 1 | A02 | Medium |
| Artificial Intelligence | Complete LLM system interface | Major | 2 | A17 | Medium |
| Data and Analytics | Advanced analytics dashboard with data visualization | Major | 2 | A11 | Medium |
| Data and Analytics | Data export and import functionality | Minor | 1 | A10 | High |
| Data and Analytics | GDPR compliance features | Minor | 1 | A10, A21 | Medium |
| Gaming and user experience | Gamification system | Minor | 1 | A13 | Medium |
| Web | Public API with API key, rate limiting, docs, and 5 endpoints | Major | 2 | A19 | Medium |
| Modules of choice | Spaced repetition learning engine | Major | 2 | A06 | Medium |

Main planned total: **19 points**

### Planned Public API endpoints

The Public API module should expose documented endpoints protected by an API key and rate limiting.

Initial endpoint candidates:

| Endpoint | Purpose |
| --- | --- |
| `GET /api/public/cards` | Get public cards from the shared card database. |
| `GET /api/public/cards/:id` | Get one public card by id. |
| `GET /api/public/search` | Search public cards by query, language, card type, or other filters. |
| `GET /api/public/dictionaries` | Get the list of ready-made dictionaries. |
| `GET /api/public/dictionaries/:id/cards` | Get cards from one ready-made dictionary. |
| `POST /api/public/cards/:id/report` | Report a problem with a public card. |

### Planned GDPR compliance features

The GDPR module should give users basic control over their personal data.

Initial feature candidates:

| Feature | Purpose |
| --- | --- |
| Export my data | Let the user download their account, cards, review history, dictionary progress, and social data in a readable format. |
| Delete my account | Let the user permanently delete their account after confirmation. |
| Delete or anonymize personal data | Remove or anonymize personal data connected to cards, reviews, sessions, and friend links where appropriate. |
| Confirmation flow | Require clear confirmation before destructive data deletion. |
| Privacy page link | Make the Privacy Policy easy to access from the application. |

## Reserve Transcendence modules

These modules can increase the safety margin if the team has time or if one planned module becomes risky.

| Subject category | Module | Type | Points | Related app modules | Notes |
| --- | --- | --- | ---: | --- | --- |
| Web | Real-time features using WebSockets or similar technology | Major | 2 | A11, A12 | Could be live leaderboard/friend progress updates. |
| Accessibility and Internationalization | WCAG 2.1 AA accessibility compliance | Major | 2 | A16 | Valuable, but needs strict testing and documentation. |
| DevOps | Health check/status page with backups and disaster recovery | Minor | 1 | A20 | Realistic if kept simple and documented. |
| Modules of choice | Adaptive language-card system | Major | 2 | A04, A05, A08 | Must be justified clearly as custom technical complexity. |

Potential total with reserves: **26 points**

The reserve total is not a commitment. It is a planning buffer.

## Modules we should not claim unless scope changes

| Subject module | Reason |
| --- | --- |
| Web: Allow users to interact with other users | The subject requires basic chat, profiles, and friends. We currently do not plan to build chat. |
| User Management: Standard user management and authentication | The subject requires avatar upload and online status. We currently do not plan online status. |
| Web: File upload and management system | The subject expects multiple file types, secure storage, preview, progress, and deletion. CSV import alone fits better under Data export/import. |
| Game modules | Our product is not a game. Game-specific modules require a functional game first. |
| Blockchain modules | Not relevant to the product and high risk for schedule. |
