# Design

Both clients share one unified brand visual system (a custom palette centered around Pine, Sage, and Indigo primary), moving away from the default standalone neutral theme. This unified palette is used on the landing page and the web application, and the same tokens are transcribed for React Native on mobile. This document is the checkable description of that system; the rules below are what the code follows.

## Palette

Colours are semantic tokens, never raw palette values. Each token is a CSS
custom property, defined for light in `:root` and for dark in `.dark` (web) or
the `prefers-color-scheme: dark` media query (mobile).

Web defines them in `apps/web/src/style.css`, mostly as hex, with oklch for
destructive and rating colors. Mobile defines RGB channel triplets in
`apps/mobile/global.css` so NativeWind can apply alpha. Mobile is a subset of
web: every mobile token exists on web, and every shared light and dark color
matches after conversion to sRGB. A card is the page's own colour on both
clients; a sage border and web's card shadow set it apart. Mobile's screens
also sit on `--surface` in both modes, since a phone shows a card edge to
edge with little page around it; web keeps `--surface` for its login and
review screens.

### Shared tokens

| token                                        | used for                                |
| -------------------------------------------- | --------------------------------------- |
| `--background` / `--foreground`              | page ground and default text            |
| `--card` / `--card-foreground`               | raised surfaces: cards, forms, dialogs  |
| `--primary` / `--primary-foreground`         | the main action, text on it, due counts |
| `--secondary` / `--secondary-foreground`     | a second, quieter action                |
| `--muted` / `--muted-foreground`             | de-emphasised surfaces and helper text  |
| `--accent` / `--accent-foreground`           | hover and selected states               |
| `--destructive` / `--destructive-foreground` | delete, errors, and text on them        |
| `--border`                                   | borders and separators                  |
| `--input`                                    | input field borders and backgrounds     |
| `--ring`                                     | focus rings                             |
| `--rating-again` … `--rating-easy`           | review answer buttons, one hue each     |
| `--primary-hover`                            | pressed/hovered primary buttons         |
| `--sage`, `--sage-border`                    | native switch track and card border     |
| `--surface`                                  | tinted ground: web auth, mobile screens |
| `--success`, `--warning`, `--info`           | status: done, needs attention, working  |

Tailwind exposes each as a utility of the same name: `bg-card`,
`text-muted-foreground`, `border-border`, `ring-ring`. Web does this through
`@theme inline` in `style.css`; mobile through `theme.extend.colors` in
`tailwind.config.js`.

The four rating tokens are the second place the palette leaves greyscale,
after the charts: forgot, hard, remember and very easy have to be told apart
at a glance. `--rating-again` is `--destructive`; hard, good and easy are
tailored colors based on the design system. Both clients colour their
answer buttons and swipe labels with them.

### Brand Tokens

- **Pine/Sage.** `--pine`, `--sage` and their variants. These form the core
  brand identity colors for the application and landing page, moving away from
  neutral greys.
- **Primary.** `--primary` is set to an Indigo tone, offering contrast and
  interactivity.

### Web-only tokens

These exist on web and are not expected on mobile. Adding one to mobile is a
decision, not an oversight to fix.

- **Popover.** `--popover`, `--popover-foreground`. Mobile has no popover
  surface yet; the first React Native Reusables component that needs one adds
  the pair to `global.css` with web's values.
- **Sidebar.** `--sidebar` and its seven companions. Desktop navigation only.
- **Charts.** `--chart-1` to `--chart-5`. Web statistics only. The first
  three carry a hue each so a reader tells the series apart (reviews, notes
  added, forgot rate); `--chart-4` and `--chart-5` are still neutral. They
  leave greyscale only because a chart without distinguishable series is
  unreadable.
- **Other brand surfaces.** `--surface-soft`, `--sage-foreground`, `--pine`
  and `--pine-foreground` remain web-only until a mobile component needs
  them. `--shadow-card` is a shadow, not a colour: mobile's card repeats its
  values in `lib/theme.ts` (`cardShadows`), unchecked.
- **Radius scale.** `--radius` (0.625rem) and `--radius-sm` to `--radius-4xl`
  derived from it. Mobile gains `--radius` with the kit; see Spacing and radius.
- **`--color-*`.** Tailwind 4's `@theme` bridge, one per token above. These are
  not semantic tokens; do not reference them directly.

### Adding a token

A token that both clients need is added to `style.css` first, then to
`global.css` as RGB triplets for light and dark in the same change. A token
only web needs is added to `style.css` and listed above.

## Typography

Web loads Poppins through `@fontsource/poppins` and exposes two
tokens: `--font-sans` (`'Poppins', sans-serif`) and `--font-heading`
(also `'Poppins', sans-serif`). Headings and body share a family; weight
and size do the work. This unifies typography between the marketing pages and the app.

Mobile does not load Poppins yet. It currently renders the platform default,
San Francisco on iOS and Roboto on Android. The mobile font decision is tracked
in #371; this palette port does not settle it.

Weight utilities are shared: `font-medium` for labels, `font-semibold` for
headings and button labels. Size follows Tailwind's default scale on both
clients (`text-sm`, `text-base`, `text-lg`).

## Spacing and radius

Spacing uses Tailwind's default scale on both clients. Gaps between stacked
controls are `gap-2` to `gap-4`; card padding is `p-4`.

Radius still differs: web derives its scale from `--radius` (0.625rem), while
mobile uses Tailwind 3's defaults. Both card components now use `rounded-2xl`,
but their exact radii differ until the React Native Reusables adoption (#143)
maps the shared scale. Buttons remain pill-shaped on both clients.

## Motion and micro-animations

Animations are designed to be fast and functional: they confirm user actions without blocking interactions.

- **Micro-interactions.** Web elements transition color and transform over 150ms–200ms
  (`transition-colors duration-200`, `active:scale-95`). 128 animation and
  transition utilities are currently in use.
- **Surfaces.** Floating notification banners, dialog overlays, and alerts enter using
  `animate-in fade-in slide-in-from-top-4 duration-300`.
- **Reduced motion.** Target standard. Web currently has no `motion-reduce:` usage
  (0 of 128). Newly introduced animated surfaces should pair each animation with
  `motion-reduce:animate-none` / `motion-reduce:transition-none`.
- **Mobile.** The review is the one animated surface, through Reanimated and
  gesture-handler. Once the answer shows, the answer card follows a swipe,
  tilts slightly, springs back below the threshold and leaves in the swipe's
  direction in 260ms before the answer is recorded. With four answers, a
  swipe down and to the right (30 to 60 degrees) answers easy, towards the
  Easy button. While it is dragged, the
  question fades out over the first half of the way and the next question
  comes in over the second, growing from 95%; both follow the finger, so they
  apply with reduced motion too. With the system's reduced motion setting on
  (`useReducedMotion`), the answer is recorded without the flight. Elsewhere
  mobile has no motion: Pressables use no ripple, pressed opacity or timed
  transitions. Touch feedback will arrive with the React Native Reusables
  adoption (#233); until then its absence is intentional, not an oversight.

## Responsive breakpoints and layout grid

Web only. Mobile uses no media query breakpoints, grids, or max-width utilities today,
and will refrain from doing so until a dedicated tablet layout approach is defined;
that is a design decision, not a gap to fix.

- **Breakpoints.** Web uses Tailwind defaults: `sm` (640px), `md` (768px), `lg` (1024px),
  `xl` (1280px).
- **Containers.** Focused forms use `max-w-md` (11 occurrences) or `max-w-lg` (3).
  Dashboards use `max-w-7xl` (2). The single `max-w-xl` is reserved for the floating
  banner container.
- **Grids.** Collection layouts start single-column and expand:
  `grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6` for deck grids
  (`DeckList.tsx:193`), and `grid-cols-1 sm:grid-cols-2 gap-4` for summary stat tiles (3
  occurrences).

## Icons

- **Web** uses `lucide-react` for general UI icons. Brand marks are dedicated
  components: `components/ui/google-icon.tsx`.
- **Mobile** uses no icon library today. When #143 lands it uses
  `lucide-react-native`, the same icon set with the same names. Brand marks
  stay dedicated assets.

One general icon set per client. A second set is not added for a single icon
the first lacks.

## Components

A reusable component is one owned file under `components/ui/` with typed props
and named variants. Repeated markup in screens is the signal that a component
is missing; the fix is to add it there, not to copy the markup.

### Inventory

Mobile multiline inputs use a minimum height of 6rem and top-aligned text;
single-line inputs keep their compact height. This applies to card sides,
deck descriptions and word-note notes through the shared `Input` component.

| web `apps/web/src/components/ui`            | mobile `apps/mobile/components/ui`                    |
| ------------------------------------------- | ----------------------------------------------------- |
| `alert`                                     |                                                       |
| `button`                                    | `button` (primary, secondary, destructive; `loading`) |
| `card`                                      | `card`                                                |
| `dropdown-menu`                             |                                                       |
| `field`, `label`, `input`, `password-input` | `form-field`, `label`, `input`                        |
| `MarkdownRenderer`                          | `markdown`                                            |
| `progress`                                  | `progress` (value and indicator colour; no animation) |
| `select`                                    |                                                       |
| `separator`                                 |                                                       |
| `spinner`                                   |                                                       |
| `switch`                                    |                                                       |
| `google-icon`                               | `google-icon`, `icon` (lucide wrappers)               |
|                                             | `segmented`                                           |
|                                             | `text`                                                |

Web components come from shadcn (`components.json`: style `radix-luma`, base
colour `neutral`, CSS variables on, icon library lucide). They are added with
the shadcn CLI and then owned by the repo; edits are made in place.

Mobile components are hand-written today. #143 replaces them with React Native
Reusables, shadcn's React Native port, which uses the same token names. The
kit's generated theme is not adopted: `global.css` stays the source of values,
so the shared tokens keep matching web. Installing the kit adds components; it
does not overwrite `global.css`. The standard shadcn set has two tokens mobile
lacks, `--popover` with `--popover-foreground` and `--radius`; the first kit
component that references one adds it to `global.css` with web's value. The
kit's navigation theme file is not used either, since `lib/theme.ts` already
holds `navigationColors`. Existing screens migrate incrementally.

### Adding a component

1. Check the inventory above and the other client. If the other client has it,
   match its name, props and variants.
2. Web: `npx shadcn add <name>`, then edit in place. Mobile: the equivalent
   React Native Reusables command once adopted; until then, a hand-written file
   following `button.tsx`.
3. Style with semantic tokens only. A raw palette utility in a component is a
   review finding.
4. Add the component to the inventory here.

## Conventions

- Semantic tokens over raw palette utilities. `bg-emerald-500` and
  `text-[#...]` do not appear outside `components/ui`, and rarely inside it.
- One general icon set per client, brand marks as dedicated assets.
- Tailwind's default spacing scale on both clients; web's radius scale on web.
- A shared token is added to both stylesheets in the same change.
- Mobile stays a subset of web. A token mobile needs that web lacks is added to
  web first.

### Enforcement

`pnpm check:design-docs` runs `scripts/check-design-docs.mjs`; CI runs it too.
It checks that every web and mobile `components/ui` file appears in the
inventory and every listed file exists, that mobile defines no token web
lacks, and that shared light/dark colors and native navigation colors match.
The table remains hand-written: a new component needs a deliberate row edit.

Raw palette utilities such as `bg-emerald-500` outside `components/ui` are
ratcheted: `scripts/design-raw-palette.json` records how many each file has,
and the check fails when a file exceeds its count or a new file has any. A
file that drops below its count fails too, until its entry is lowered, so the
baseline only moves down. Status colours use `--success`, `--warning` and
`--info`; mobile's sync badge and daily goals already do. Web's existing uses
are converted file by file. The Overview stat tiles keep a raw hue each on
both clients: it tells the tiles apart and states nothing.
