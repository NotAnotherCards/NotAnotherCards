# Design

Both clients share one visual system: shadcn's neutral theme on web, and the
same tokens transcribed for React Native on mobile. This document is the
checkable description of that system; the rules below are what the code
follows.

## Palette

Colours are semantic tokens, never raw palette values. Each token is a CSS
custom property, defined for light in `:root` and for dark in `.dark` (web) or
the `prefers-color-scheme: dark` media query (mobile).

Web defines them in `apps/web/src/style.css`, in oklch. Mobile defines them in
`apps/mobile/global.css`, in hex, because React Native does not parse oklch.
Mobile is a subset of web: every token mobile defines exists on web under the
same name, and as of this writing every shared value is the same colour once
web's oklch is converted to sRGB (17 tokens, light and dark, 34 of 34).

### Shared tokens

| token                                        | used for                               |
| -------------------------------------------- | -------------------------------------- |
| `--background` / `--foreground`              | page ground and default text           |
| `--card` / `--card-foreground`               | raised surfaces: cards, forms, dialogs |
| `--primary` / `--primary-foreground`         | the main action, and text on it        |
| `--secondary` / `--secondary-foreground`     | a second, quieter action               |
| `--muted` / `--muted-foreground`             | de-emphasised surfaces and helper text |
| `--accent` / `--accent-foreground`           | hover and selected states              |
| `--destructive` / `--destructive-foreground` | delete, errors, and text on them       |
| `--border`                                   | borders and separators                 |
| `--input`                                    | input field borders and backgrounds    |
| `--ring`                                     | focus rings                            |

Tailwind exposes each as a utility of the same name: `bg-card`,
`text-muted-foreground`, `border-border`, `ring-ring`. Web does this through
`@theme inline` in `style.css`; mobile through `theme.extend.colors` in
`tailwind.config.js`.

### Web-only tokens

These exist on web and are not expected on mobile. Adding one to mobile is a
decision, not an oversight to fix.

- **Popover.** `--popover`, `--popover-foreground`. Mobile has no popover
  surface yet; the first React Native Reusables component that needs one adds
  the pair to `global.css` with web's values.
- **Sidebar.** `--sidebar` and its seven companions. Desktop navigation only.
- **Charts.** `--chart-1` to `--chart-5`. Web statistics only.
- **Radius scale.** `--radius` (0.625rem) and `--radius-sm` to `--radius-4xl`
  derived from it. Mobile gains `--radius` with the kit; see Spacing and radius.
- **`--color-*`.** Tailwind 4's `@theme` bridge, one per token above. These are
  not semantic tokens; do not reference them directly.

### Adding a token

A token that both clients need is added to `style.css` first, then to
`global.css` with the converted hex value for light and dark, in the same
change. A token only web needs is added to `style.css` and listed above.

## Typography

Web loads Inter Variable through `@fontsource-variable/inter` and exposes two
tokens: `--font-sans` (`'Inter Variable', sans-serif`) and `--font-heading`,
which currently aliases `--font-sans`. Headings and body share a family; weight
and size do the work.

Mobile defines no font tokens and loads no font. Text renders in the platform
default, San Francisco on iOS and Roboto on Android, and that is intended:
React Native Reusables ships with the system font, loading Inter through
`expo-font` would hold first render until the font resolves, and the two faces
are close enough that only Android would show a difference. Should that change,
`components/ui/text.tsx` and one `fontFamily` entry in `tailwind.config.js` are
the only places that set it.

Weight utilities are shared: `font-medium` for labels, `font-semibold` for
headings and button labels. Size follows Tailwind's default scale on both
clients (`text-sm`, `text-base`, `text-lg`).

## Spacing and radius

Spacing uses Tailwind's default scale on both clients. Gaps between stacked
controls are `gap-2` to `gap-4`; card padding is `p-4`.

Radius differs today. Web derives its scale from `--radius` (0.625rem), so
`rounded-lg` is 0.625rem and `rounded-xl` is 0.875rem. Mobile uses Tailwind 3's
defaults, so the same class names produce 0.5rem and 0.75rem. The React Native
Reusables adoption (#143) closes the gap: the first component that needs
`--radius` adds it to `global.css` at web's 0.625rem and maps `borderRadius` in
`tailwind.config.js`, after which the class names mean the same on both clients.

## Motion and micro-animations

UI transitions enhance feel and feedback without slowing interaction. Animations must be quick, functional, and consistent across components.

- **Micro-interactions.** Interactive controls (buttons, menu triggers, input fields) use 150ms–200ms color and transform transitions (`transition-colors duration-200`, `active:translate-y-px`, `hover:bg-accent/60`).
- **Surface & Banner Animations.** Floating banners, dialogs, and alerts enter with `animate-in fade-in slide-in-from-top-4 duration-300` or slide transitions (`duration-200` to `duration-300`).
- **Reduced Motion.** All CSS animations and transitions must respect user system preferences. Web uses `motion-reduce:animate-none` / `motion-reduce:transition-none` to instantly present final states when reduced motion is requested.
- **Mobile.** Mobile interactions use native touch feedback (Pressable ripple/opacity) and 150ms–250ms layout transitions.

## Responsive breakpoints and layout grid

Both clients use Tailwind's responsive grid and container rules to ensure layouts adapt fluidly across devices.

- **Breakpoints.** Web targets standard Tailwind breakpoints: `sm` (640px), `md` (768px), `lg` (1024px), `xl` (1280px).
- **Layout Containers.** Main screen content is centered in structured container shells (`max-w-xl` for focused forms and floating notification shells; `max-w-5xl` or `max-w-7xl` for dashboards and deck grids). Horizontal page padding is standard `px-4 sm:px-6`.
- **Grid Patterns.** Collection layouts (deck cards, study grids) default to single-column on mobile (`grid-cols-1`) and expand dynamically on wider screens (`sm:grid-cols-2 lg:grid-cols-3 gap-4`).

## Icons

- **Web** uses `lucide-react` for general UI icons. Brand marks are dedicated
  components: `components/ui/google-icon.tsx` and `facebook-icon.tsx`.
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

| web `apps/web/src/components/ui`            | mobile `apps/mobile/components/ui`                    |
| ------------------------------------------- | ----------------------------------------------------- |
| `alert`                                     |                                                       |
| `button`                                    | `button` (primary, secondary, destructive; `loading`) |
| `card`                                      |                                                       |
| `field`, `label`, `input`, `password-input` | `form-field`, `input`                                 |
| `separator`                                 |                                                       |
| `spinner`                                   |                                                       |
| `google-icon`, `facebook-icon`              |                                                       |
|                                             | `text`                                                |

The first mobile deck CRUD slice in #68 introduces the `secondary` and
`destructive` button variants. They are listed here because this document is
the review contract for that work; until the slice lands, `main` has only the
primary variant and `loading` state.

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

Nothing enforces these today. The lint rule `better-tailwindcss/no-unknown-classes`
rejects classes that do not exist, so `bg-emerald-500` passes. Web currently
contains more than a hundred raw palette utilities in components and routes;
clearing them is follow-up work, not a precondition for this document.

Two checks are worth adding when someone is in the area:

- A lint rule or script rejecting raw palette utilities outside `components/ui`.
- A script comparing token names between `style.css` and `global.css`, failing
  when mobile defines a token web does not. The check that produced the
  numbers in this document is a shell one-liner:

```sh
tok() { grep -oE -- '--[a-z][a-z0-9-]*\s*:' "$1" | sed 's/\s*:$//' | sort -u; }
comm -13 <(tok apps/web/src/style.css) <(tok apps/mobile/global.css)
```

An empty result means mobile is still a subset.
