# Fidl Website — Design Spec

> Product marketing website for **Fidl** (fidl.ai) — a Chrome extension that turns browser tabs into searchable, AI-powered knowledge.
> Design derived from comprehensive analysis of [twenty.com](https://twenty.com) source code (`packages/twenty-website-new`).
> Tech stack: **Tanstack Start + React + Tanstack Query + Tailwind CSS 4**

---

## 1. Product & Content

**Product:** Fidl — browser extension for tab capture, content extraction, AI chat, and knowledge management.

**Tagline:** "Turn your tabs into knowledge"

**Primary CTAs:**
- "Install Extension" → Chrome Web Store (primary, contained button)
- "Sign Up" / "Learn More" → fidl.ai account (secondary, outlined button)

**Pages:**
1. **Homepage** — hero, product screenshot, problem statement, features bento, three-cards, testimonials, FAQ, CTA, footer
2. **Pricing** — billing toggle, tier cards, bottom CTA
3. **Story** — editorial narrative about the problem and mission
4. **Releases** — changelog with feature cards
5. **Docs** — sidebar + content layout (MDX)
6. **Blog** — article listing + detail pages (MDX)

**Domain:** fidl.ai

---

## 2. Design Philosophy

- **Monochromatic palette** — 3 colors only: near-black `#1C1C1C`, white `#FFFFFF`, indigo accent `#4A38F5`. All variation via alpha transparency.
- **Whitespace as primary design tool** — 64–120px between sections.
- **Mixed serif + sans headings** — Aleo italic for descriptive phrases, Host Grotesk for key phrases, within a single heading.
- **Monospace uppercase for all UI chrome** — Azeret Mono 500 for nav, buttons, eyebrows, labels, footer links.
- **Custom SVG shapes** — Chamfered button corners, notched card shapes, scalloped footer edges. Not standard CSS border-radius.
- **Separator plus-icon pattern** — `[+] ——— text ——— [+]` dividers with indigo plus icons.
- **Data-driven content** — All page text in typed constant files, components are pure presentation.
- **Dark/light section alternation** — Sections alternate between white and dark `#1C1C1C` backgrounds.
- **No borders, use shading** — Cards use `background: black-5` or `border: 1px solid black-20`, never heavy borders or shadows.
- **Grid-first layout** — CSS Grid is the primary layout tool, not Flexbox.

---

## 3. Color System

### Root Tokens

| Token | Hex | Usage |
|-------|-----|-------|
| `--color-black-100` | `#1C1C1C` | Primary text, dark backgrounds |
| `--color-black-hover` | `#333333` | Dark background hover |
| `--color-black-80` | `#1C1C1CCC` | Secondary text |
| `--color-black-60` | `#1C1C1C99` | Tertiary text, eyebrows, muted labels |
| `--color-black-40` | `#1C1C1C66` | Placeholder, list markers, nav dividers |
| `--color-black-20` | `#1C1C1C33` | Borders, card outlines |
| `--color-black-10` | `#1C1C1C1A` | Subtle borders, separator lines |
| `--color-black-5` | `#1C1C1C0D` | Faint backgrounds, card fills, toggle tracks |
| `--color-white-100` | `#FFFFFF` | Primary background, button text on dark |
| `--color-white-80` | `#FFFFFFCC` | Secondary text on dark |
| `--color-white-60` | `#FFFFFF99` | Muted text on dark |
| `--color-white-40` | `#FFFFFF66` | Borders on dark, FAQ question text (closed) |
| `--color-white-20` | `#FFFFFF33` | Subtle borders on dark |
| `--color-white-10` | `#FFFFFF1A` | Faint elements on dark |
| `--color-blue-100` | `#4A38F5` | Accent: eyebrow icons, active nav, focus rings |
| `--color-blue-70` | `#8174F8` | Softer accent variant |

### Semantic Mapping

**Primary theme** (white background sections):
- Background: `white-100`, hover: `black-100`
- Text: `black-100` through `black-5` (alpha scale)
- Border: `black-20` default, `black-10` subtle

**Secondary theme** (dark background sections):
- Background: `black-100`, hover: `black-hover` (#333)
- Text: `white-100` through `white-10` (alpha scale)
- Border: `white-20` default, `white-10` subtle

### Tailwind Config

```ts
colors: {
  background: '#FFFFFF',
  foreground: '#1C1C1C',
  'foreground-hover': '#333333',
  accent: { DEFAULT: '#4A38F5', soft: '#8174F8' },
  // Alpha scale utilities via CSS custom properties
}
```

---

## 4. Typography

### Font Families

| Role | Font | Weights | CSS Variable |
|------|------|---------|-------------|
| Sans (primary) | Host Grotesk | 300, 400, 500, 600 | `--font-sans` |
| Serif (display accent) | Aleo | 300 | `--font-serif` |
| Mono (UI chrome) | Azeret Mono | 300, 500 | `--font-mono` |

All loaded via Google Fonts with `display: swap`.

### Font Size Scale

Base: `0.25rem` (4px). Sizes are `calc(0.25rem * multiplier)`.

| Name | Mobile | Desktop (≥921px) | Line Height (M) | Line Height (D) | Weight |
|------|--------|-------------------|-----------------|-----------------|--------|
| heading-xl | 60px (×15) | 80px (×20) | 66px | 86px | 300 |
| heading-lg | 40px (×10) | 60px (×15) | 46px | 66px | 300 |
| heading-md | 40px (×10) | 48px (×12) | 46px | 56px | 300 |
| heading-sm | 32px (×8) | 32px (×8) | 40px | 40px | 300 |
| heading-xs | 18px (×4.5) | 22px (×5.5) | 24px | 28px | 300 |
| body-md | 16px (×4) | 18px (×4.5) | 22px | 24px | 400 |
| body-sm | 16px (×4) | 16px (×4) | 22px | 22px | 400 |
| body-xs | 12px (×3) | 12px (×3) | 14px | 14px | 500 |

### Letter Spacing

| Context | Value |
|---------|-------|
| Sans headings | `-0.04em` |
| Serif headings | `-0.02em` |
| Mono headings | `-0.04em` |
| Body (sans) | `-0.01em` |
| Body (mono) | `-0.02em` |
| Buttons, nav, labels | `0` |

### Mixed-Family Heading Pattern

The signature typographic feature — headings mix sans and serif inline:

```tsx
type HeadingSegment = {
  text: string
  fontFamily: 'sans' | 'serif' | 'mono'
  fontWeight?: 'light' | 'regular' | 'medium'
  newLine?: boolean
}

// Example: "Turn your tabs into knowledge"
const heading: HeadingSegment[] = [
  { text: 'Turn your tabs into ', fontFamily: 'sans' },
  { text: 'knowledge', fontFamily: 'serif' },  // renders italic Aleo
]
```

Pattern: **serif for descriptive/emotional phrases**, **sans for action/key phrases**.

### Text Transform Rules

- `uppercase` — buttons, nav links, eyebrow text, footer labels, drawer links, social links. Always paired with mono font.
- Content text (headings, body) — never uses text-transform.

---

## 5. Spacing System

Base: `4px`. All spacing is `multiplier × 4px`.

### Key Values

| Multiplier | Value | Usage |
|------------|-------|-------|
| 1 | 4px | Micro elements, dots |
| 2 | 8px | Small gaps, eyebrow gap, nav vertical padding |
| 4 | 16px | Mobile padding, card content, gap, bento grid gap |
| 5 | 20px | Button horizontal padding |
| 6 | 24px | Section row-gap, FAQ padding |
| 8 | 32px | Nav link column gap |
| 10 | 40px | Desktop padding, button height, nav/footer side padding |
| 12 | 48px | Section vertical padding (mobile), hero padding-top (desktop) |
| 20 | 80px | Section vertical padding (desktop), footer content |
| 22 | 88px | Three-cards/testimonials padding |
| 30 | 120px | FAQ section padding |

### Section Padding Patterns

- Mobile side: `spacing(4)` = 16px — always
- Desktop side: `spacing(10)` = 40px — always
- Section vertical (mobile): `spacing(12)` to `spacing(22)` = 48–88px
- Section vertical (desktop): `spacing(16)` to `spacing(30)` = 64–120px

---

## 6. Border Radius

Base: `2px`. Values are `multiplier × 2px`.

| Multiplier | Value | Usage |
|------------|-------|-------|
| 1 | 2px | Eyebrow icon rx, illustration rounding |
| 2 | 4px | **Default** — buttons, cards, nav, FAQ items, modals |
| 8 | 16px | Pill toggles, stepper progress |
| 20 | 40px | Full pill — toggle container |

Note: Buttons and cards use custom SVG shapes for their distinctive chamfered/notched corners, not CSS border-radius.

---

## 7. Breakpoints

| Name | Value | Usage |
|------|-------|-------|
| md | 921px | Mobile → desktop (most responsive changes happen here) |
| lg | 1281px | Large desktop (nav, footer spacing only) |
| maxContent | 1440px | Container max-width |

Mobile-first approach. Typography primarily scales at `md` only.

---

## 8. Component Specs

### 8.1 Chamfered Button (SVG Shape)

The most distinctive component. Buttons use a 3-part SVG: left cap (4px rounded) + stretchy middle + right cap (15px, chamfered bottom-right).

**Right cap creates the signature diagonal cut:**
```
FILL:    M0 0 h11 a4 4 0 0 1 4 4 v20.523 a6 6 0 0 1 -1.544 4.019 l-8.548 9.477 A6 6 0 0 1 0.453 40 H0 Z
OUTLINE: M0 0.5 h11 a3.5 3.5 0 0 1 3.5 3.5 v20.523 a5.5 5.5 0 0 1 -1.416 3.684 l-8.547 9.477 a5.5 5.5 0 0 1 -4.084 1.816 H0
```

**Left cap:**
```
FILL:    M4 0 A4 4 0 0 0 0 4 V36 A4 4 0 0 0 4 40 Z
OUTLINE: M4 0.5 A3.5 3.5 0 0 0 0.5 4 V36 A3.5 3.5 0 0 0 4 39.5
```

**Button base styles:**
```css
font-family: var(--font-mono);
font-size: 12px;  /* font.size(3) */
font-weight: 500;
height: 40px;     /* spacing(10) */
padding: 0 20px;  /* spacing(5) */
text-transform: uppercase;
letter-spacing: 0;
border: none;
```

**Variants:**

| Variant | Fill | Text | Hover Fill |
|---------|------|------|-----------|
| contained.secondary (dark bg CTA) | `#1C1C1C` | `#FFFFFF` | `#333333` |
| contained.primary (light bg CTA) | `#FFFFFF` | `#1C1C1C` | `#1C1C1C` |
| outlined.secondary (dark border) | none | `#1C1C1C` | 5% opacity |
| outlined.primary (light border) | none | `#FFFFFF` | `#FFFFFF` |

**Hover animation:** Slide-in fill from left:
```css
transform: translateX(calc(-100% - 16px));
transition: transform 260ms cubic-bezier(0.22, 1, 0.36, 1);
/* On hover: transform: translateX(0) */
```

**Focus:** `outline: 1px solid #4A38F5; outline-offset: 1px`

### 8.2 Navigation (Sticky Header)

```css
position: sticky; top: 0; z-index: 200;
backdrop-filter: blur(10px);
box-shadow: 0 1px 3px 0 rgba(0,0,0,0); /* idle */
box-shadow: 0 1px 3px 0 rgba(0,0,0,0.06); /* scrolling */
transition: box-shadow 0.2s cubic-bezier(0.16, 1, 0.3, 1);
```

- Inner nav: `min-height: 48px`, grid layout, padding 16px mobile / 40px desktop
- Nav links: Azeret Mono, 12px, 500, uppercase, 32px column-gap
- Dividers: 1px wide, 10px tall, `black-40`
- Active link: `color: #4A38F5` with 2px underline (20% width, centered 6px below)
- Right side: "Log in" (outlined) + "Get started" (contained)
- Mobile: hamburger → full-screen drawer with 32px links

### 8.3 Eyebrow

```
[14×7 blue rounded rect icon] + [Heading xs, mono, uppercase, medium, 60% opacity]
```

Gap: 8px. Icon wrapper: 24×24px centered. RectangleFillIcon: `<rect width="14" height="7" rx="1" fill="#4A38F5"/>`.

### 8.4 Separator (Plus Icon Pattern)

Horizontal: `[+] ——— text ——— [+]`
- Plus icon: 12px, stroke `#4A38F5`, path `M.5 7.25H14M7.25 14V.5`
- Line: `flex: 1; height: 1px; background: black-10`
- Text: mono, 12px, 500, uppercase, `black-60`
- Gap: 6px

Vertical (testimonials, footer dividers): Same plus icons at top/bottom with `width: 1px; background: black-20` line between.

### 8.5 Notched Card Shape

SVG viewBox `0 0 443 494`, preserveAspectRatio="none":
```
FILL:   M0 490V4a4 4 0 0 1 4-4h288.23c.932 0 1.856.163 2.731.48l60.814 22.09c.875.318 1.8.48 2.731.48H439a4 4 0 0 1 4 4V490a4 4 0 0 1-4 4H4a4 4 0 0 1-4-4
STROKE: M4 .5h288.23c.874 0 1.74.152 2.561.45l60.813 22.09c.931.338 1.912.51 2.902.51H439a3.5 3.5 0 0 1 3.5 3.5V490a3.5 3.5 0 0 1-3.5 3.5H4A3.5 3.5 0 0 1 .5 490V4A3.5 3.5 0 0 1 4 .5Z
```

Creates a card with notched top-right corner (diagonal tab). Used for "Why Fidl" three-cards section.

Card inner: `padding: 16px`, dotted rule dividers (`border-top: 1px dotted black-40`), 240px embed area for illustrations.

### 8.6 Feature Tiles (Bento Grid)

12-column grid on desktop, single column mobile, gap: 16px.

Spans by index: `[0]` span 12, `[1,2]` span 6, `[3]` span 4, `[4]` span 8, `[5,6]` span 6.

Tile: `background: white; border: 1px solid black-20; border-radius: 4px; overflow: hidden`.

Visual area: `background: black-10`, height 240px (320px for index 0). Content: icon slot (24×24 blue), title, bullet list.

### 8.7 Footer

Dark container (`#1C1C1C`) with fixed heights (880px mobile, 920px md, 1080px lg). White content area pushed to bottom via `margin-top: auto`.

**Scalloped SVG shape** (top edge of white panel):
```
viewBox="0 0 1360 20", preserveAspectRatio="none"
path: M0 4a4 4 0 0 1 4-4h344.32c4.197 0 8.369.66 12.361 1.958l49.5 16.084A40 40 0 0 0 422.542 20h517.7c4.293 0 8.559-.691 12.633-2.047l47.785-15.906A40 40 0 0 1 1013.29 0H1356a4 4 0 0 1 4 4v16H0z
```

Nav grid: `1fr auto 1fr auto 1fr auto 1fr` (4 columns + 3 plus-icon dividers).
Footer links: 16px sans, hover reveals arrow icon (width 0→14px, opacity 0→1, 0.3s ease-out).
Bottom bar: copyright (mono, 12px, uppercase) + social links with `↗` arrows.

### 8.8 FAQ Accordion

Dark background (`#1C1C1C`). Uses `grid-template-rows: 0fr → 1fr` technique.

Question: 32px (2rem), weight 400, `color: white-40` when closed, `white-100` when open/hovered.
Toggle button: 36×36, `border: 1px solid white-40`, scale(1.08) hover, scale(0.96) active.
Expand: `transition: grid-template-rows 0.4s cubic-bezier(0.4, 0, 0.2, 1)`.

### 8.9 Testimonials

Layout: counter column | vertical separator | quote content.
Counter: 48px, weight 300, `black-40` color.
Quote: heading-sm size (32px), weight 300, with serif mixed in.
Navigation: prev/next icon buttons (48px, border, scale hover).
Background: `black-5` with optional decorative shape image.

### 8.10 Billing Toggle (Pricing)

Pill track: `background: black-10; border-radius: 40px; padding: 2px`.
Sliding highlight: `background: white; border-radius: 16px`.
Option: mono, 12px, 500, height 28px.
Transition: `0.24s cubic-bezier(0.2, 0.8, 0.2, 1)`.
Discount badge: `background: #4A38F5; border-radius: 24px; font-size: 10px`.

---

## 9. Animation System

### Scroll Reveal (Primary)
```
from: { opacity: 0, y: 40, scale: 0.98 }
to:   { opacity: 1, y: 0, scale: 1 }
duration: 1s, ease: power3.out
stagger: 0.15s (optional)
trigger: top 85% of viewport
toggleActions: play none none reverse
```

Implementation: Framer Motion `useInView` + `motion.div` (React equivalent of GSAP ScrollTrigger).

### Easing Functions

| Name | Value | Usage |
|------|-------|-------|
| expo-out | `cubic-bezier(0.16, 1, 0.3, 1)` | Nav, carousel, card tilt |
| out-expo | `cubic-bezier(0.22, 1, 0.36, 1)` | Button hover fill |
| spring | `cubic-bezier(0.2, 0.8, 0.2, 1)` | Icon scale, toggle, FAQ toggle |
| standard | `cubic-bezier(0.4, 0, 0.2, 1)` | FAQ accordion, text color |

### Duration Tokens

| Speed | Duration | Usage |
|-------|----------|-------|
| fast | 150–180ms | Toggle color, link color, fill progress |
| normal | 200–260ms | Button hover, nav shadow, icon scale |
| medium | 300–400ms | FAQ accordion, stepper, footer link reveal |
| slow | 500ms | Carousel slide |
| reveal | 1000ms | GSAP scroll reveal |

### Reduced Motion
```css
@media (prefers-reduced-motion: reduce) {
  /* Disable: button fill, pricing features, parallax, WebGL */
  /* Preserve: accordion, navigation, functional transitions */
}
```

---

## 10. Background Textures

### Dot Grid (CSS approximation of WebGL halftone)
```css
background-image: radial-gradient(circle, rgba(28,28,28,0.06) 1px, transparent 1px);
background-size: 20px 20px;
```

Used on: hero section, features section, CTA section. Creates the signature subtle tactile texture.

### Halftone Illustration Areas
For card embeds and footer illustration areas, use:
```css
background-image: radial-gradient(circle, rgba(74,56,245,0.08) 1.5px, transparent 1.5px);
background-size: 12px 12px;
```

---

## 11. SEO Requirements

### Per-Page Meta
- `<title>` pattern: `Fidl — [Page]` (under 60 chars)
- `<meta name="description">` unique per page, under 160 chars
- `<link rel="canonical">` full URL
- Complete OG tags: type, title, description, image, url, site_name, locale
- Twitter cards: card, title, description, image, site

### Structured Data (JSON-LD)
Organization + WebSite schemas on every page. BreadcrumbList on subpages.

### Semantic HTML
`<header>`, `<nav>`, `<main>`, `<section>`, `<article>`, `<footer>`. Exactly one `<h1>` per page. Proper h2-h6 nesting.

### Images
WebP/AVIF with `<picture>` fallbacks. `alt` text on every image. `loading="lazy"` below fold, `fetchpriority="high"` above fold.

### Performance Targets
HTML < 100KB, LCP < 2.5s, CLS < 0.1. Font preloading, preconnect to fonts.gstatic.com.

---

## 12. Architecture

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Tanstack Start (SSR, file-based routing) |
| UI | React 19 |
| Data | Tanstack Query |
| Styling | Tailwind CSS 4 |
| Animations | Framer Motion |
| Icons | Lucide React |
| Fonts | Google Fonts (Host Grotesk, Aleo, Azeret Mono) |
| Headless UI | Radix UI (accordion, navigation menu, drawer) |
| MDX | For blog and docs content |
| Images | Sharp for WebP/AVIF |

### Project Structure

```
apps/website/
├── src/
│   ├── routes/                 # Tanstack Start file-based routes
│   │   ├── __root.tsx          # Root layout (nav + footer)
│   │   ├── index.tsx           # Homepage
│   │   ├── pricing.tsx
│   │   ├── story.tsx
│   │   ├── releases.tsx
│   │   ├── docs/               # Docs section
│   │   └── blog/               # Blog section
│   ├── components/
│   │   ├── ui/                 # Design system primitives
│   │   │   ├── button.tsx      # Chamfered SVG button
│   │   │   ├── heading.tsx     # Mixed-family heading
│   │   │   ├── body.tsx
│   │   │   ├── eyebrow.tsx
│   │   │   ├── container.tsx
│   │   │   ├── separator.tsx   # Plus-icon separator
│   │   │   ├── icon-button.tsx
│   │   │   └── image.tsx
│   │   ├── sections/           # Page sections (compound components)
│   │   │   ├── navigation/
│   │   │   ├── hero/
│   │   │   ├── trusted-by/
│   │   │   ├── problem/
│   │   │   ├── features/       # Bento grid
│   │   │   ├── three-cards/    # Notched cards
│   │   │   ├── testimonials/
│   │   │   ├── faq/
│   │   │   ├── cta/
│   │   │   ├── footer/
│   │   │   └── pricing/
│   │   ├── shapes/             # SVG shape components
│   │   │   ├── button-shape.tsx
│   │   │   ├── card-shape.tsx
│   │   │   ├── footer-shape.tsx
│   │   │   └── client-count-shape.tsx
│   │   └── seo/
│   │       ├── meta.tsx
│   │       └── json-ld.tsx
│   ├── content/                # Typed content constants
│   │   ├── home.ts
│   │   ├── pricing.ts
│   │   ├── story.ts
│   │   ├── navigation.ts
│   │   ├── footer.ts
│   │   └── faq.ts
│   ├── styles/
│   │   └── global.css          # Tailwind + CSS custom properties
│   ├── lib/
│   │   ├── fonts.ts
│   │   ├── animations.ts       # Framer Motion variants
│   │   └── theme.ts            # Design token helpers
│   └── types/j
│       └── content.ts          # HeadingSegment, BodyType, etc.
├── public/
│   ├── images/
│   ├── og/                     # Open Graph images
│   └── fonts/                  # Self-hosted if needed
├── content/                    # MDX files for blog/docs
│   ├── blog/
│   └── docs/
├── package.json
├── tsconfig.json
├── app.config.ts               # Tanstack Start config
├── postcss.config.js
└── tailwind.config.ts
```

### Compound Component Pattern

Every section exports a namespaced object:

```tsx
export const Hero = { Root, Heading, Body, Cta, Visual }

// Usage:
<Hero.Root backgroundColor="white">
  <Hero.Heading segments={HOME.hero.heading} size="lg" />
  <Hero.Body text={HOME.hero.body} size="sm" />
  <Hero.Cta>
    <Button variant="contained" color="secondary">Install Extension</Button>
    <Button variant="outlined" color="secondary">Learn More</Button>
  </Hero.Cta>
  <Hero.Visual />
</Hero.Root>
```

### Content as Typed Constants

```tsx
// src/content/home.ts
export const HOME = {
  hero: {
    heading: [
      { text: 'Turn your tabs into ', fontFamily: 'sans' },
      { text: 'knowledge', fontFamily: 'serif' },
    ],
    body: { text: 'Save, extract, and chat with your browser content.' },
  },
  // ... other sections
} satisfies HomePageData
```

---

## 13. Homepage Section Order

1. **Navigation** — sticky, blur backdrop, chamfered CTA buttons
2. **Hero** — mixed heading + subtitle + dual CTAs + product screenshot mockup
3. **Trusted By** — separator + logo grid
4. **Problem** — two-column: terminal visual + eyebrow/heading/body
5. **Features** — bento grid (12-col, 7 tiles with screenshots)
6. **Three Cards** — eyebrow + heading + 3 notched illustration cards
7. **Testimonials** — counter | separator | quote carousel with nav buttons
8. **FAQ** — dark background, accordion with grid-template-rows animation
9. **CTA** — large heading + dual buttons, dot-grid background
10. **Footer** — dark container, halftone area, scalloped white panel, plus-icon dividers

---

## 14. Tailwind Configuration

```ts
import type { Config } from 'tailwindcss'

export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    screens: {
      md: '921px',
      lg: '1281px',
    },
    fontFamily: {
      sans: ['Host Grotesk', 'sans-serif'],
      serif: ['Aleo', 'serif'],
      mono: ['Azeret Mono', 'monospace'],
    },
    extend: {
      maxWidth: {
        content: '1440px',
      },
      spacing: {
        // Extended spacing for section padding
        18: '72px',
        22: '88px',
        25: '100px',
        30: '120px',
        35: '140px',
      },
      fontSize: {
        'heading-xl': ['80px', { lineHeight: '86px', letterSpacing: '-0.04em', fontWeight: '300' }],
        'heading-lg': ['60px', { lineHeight: '66px', letterSpacing: '-0.04em', fontWeight: '300' }],
        'heading-md': ['48px', { lineHeight: '56px', letterSpacing: '-0.04em', fontWeight: '300' }],
        'heading-sm': ['32px', { lineHeight: '40px', letterSpacing: '-0.04em', fontWeight: '300' }],
        'heading-xs': ['22px', { lineHeight: '28px', letterSpacing: '-0.04em', fontWeight: '300' }],
        'body-md': ['18px', { lineHeight: '24px', letterSpacing: '-0.01em', fontWeight: '400' }],
        'body-sm': ['16px', { lineHeight: '22px', letterSpacing: '-0.01em', fontWeight: '400' }],
        'body-xs': ['12px', { lineHeight: '14px', letterSpacing: '0em', fontWeight: '500' }],
      },
    },
  },
} satisfies Config
```

---

## Appendix: Reference Materials

- Design system extracts: `/tmp/design-system-parts/`
- Twenty.com repo clone: `/tmp/twenty-repo/packages/twenty-website-new/`
- Screenshots: `/tmp/twenty-screenshots/`
- Earlier design system doc: `docs/website-design-system.md`
- Visual mockups: `.superpowers/brainstorm/` (look-and-feel-v2.html)
