---
name: BasketWise
description: Australia's independent grocery price comparison tool
colors:
  page: "#fbfaf7"
  surface: "#ffffff"
  panel: "#efede4"
  line: "#e4e1d6"
  line-strong: "#c9c6b8"
  ink: "#1c1c1a"
  ink-inverse-bg: "#14170f"
  body: "#5c5b52"
  muted: "#6e6d63"
  subtle: "#8a897e"
  on-dark: "#b9b7ac"
  primary: "#1f4d2e"
  primary-hover: "#2e7a47"
  accent: "#f2c230"
  accent-ink: "#2a2405"
  danger: "#b0332b"
typography:
  display:
    fontFamily: "Newsreader, Georgia, serif"
    fontSize: "clamp(1.875rem, 4vw, 3.25rem)"
    fontWeight: 400
    lineHeight: 1.1
    letterSpacing: "-0.02em"
  label:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "0.16em"
  body:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: "normal"
rounded:
  none: "0px"
  sm: "2px"
  full: "9999px"
spacing:
  xs: "8px"
  sm: "12px"
  md: "24px"
  lg: "40px"
  container-max: "1160px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "#ffffff"
    rounded: "{rounded.full}"
    padding: "13px 20px"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
  button-card-cta:
    backgroundColor: "{colors.primary}"
    textColor: "#ffffff"
    rounded: "{rounded.sm}"
    padding: "9px 10px"
  button-card-cta-active:
    backgroundColor: "{colors.ink-inverse-bg}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.body}"
    rounded: "{rounded.full}"
    padding: "10px 18px"
  badge-accent:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.accent-ink}"
    rounded: "{rounded.none}"
    padding: "3px 6px"
  input-search:
    backgroundColor: "rgba(255,255,255,0.1)"
    textColor: "{colors.panel}"
    rounded: "{rounded.full}"
    padding: "10px 16px 10px 48px"
---

# Design System: BasketWise

## Overview

**Creative North Star: "The Provisions Ledger"**

BasketWise reads like a stocktake sheet turned into a storefront: ink on warm cream paper, hairline rules dividing everything into an implied grid, and quiet numbered index marks (01, 02, 03) doing the work most apps give to icons or illustration. It is an editorial system wearing a grocer's apron — a serif for the moments that matter (prices, headlines, the wordmark) and a tight, uppercase, letter-spaced sans for everything operational (labels, buttons, navigation, meta text). Nothing floats: there are no shadows anywhere, and depth comes entirely from hairline borders and flat color contrast, especially the near-black "ink-inverse" blocks used for the header and footer.

The system currently trusts placeholder photography blocks (a diagonal two-tone stripe pattern with a small monospace caption naming the intended shot) rather than faking real imagery — a deliberate honesty about what's real and what's a stand-in, which fits a product whose whole pitch is "we don't take a cut, we just show you the truth."

**Key Characteristics:**
- Warm off-white paper ground, near-black ink text — never pure white-on-black.
- Deep pantry green is the only color allowed to mean "go" or "action."
- Market mustard yellow is reserved for money signals: savings, count badges, the sign-in accent.
- Flat everywhere. Hairline borders and color blocking replace shadows entirely.
- A restrained, almost print-like radius vocabulary: square by default, full pill or a 2px nudge as the only two exceptions.
- Serif for feeling (headlines, prices, the wordmark), tracked-uppercase sans for function (labels, buttons, nav).

## Colors

Muted, warm neutrals built around unbleached paper and near-black ink, with exactly two saturated colors — pantry green and market mustard — each locked to a single job.

### Primary
- **Deep Pantry Green** (`#1f4d2e`): The only "go" color — Add to cart, Compare basket, active CTAs, the "Start another way" link underline. Its hover state, **Fresh Pantry Green** (`#2e7a47`), is used exclusively on hover/focus, never at rest.

### Secondary
- **Market Mustard** (`#f2c230`): Reserved for money and attention — the basket count badge, the "you save" badge on product cards, the sign-in link in the dark header. Paired with **Mustard Ink** (`#2a2405`) for on-accent text, never white.

### Tertiary
- **Brick Red** (`#b0332b`): Strike-through / "was" pricing only. The system's one warning-adjacent color; not used for buttons or navigation.

### Neutral
- **Warm Paper** (`#fbfaf7`): Page background — the base "ledger sheet."
- **Bright White** (`#ffffff`): Card and panel surfaces sitting on top of the page.
- **Oat Panel** (`#efede4`): Secondary surface for framed content blocks (the meals feature panel, mobile menu).
- **Hairline Oat** (`#e4e1d6`): The border/grid-line color — also used as the 1px gap fill between grid cells (see Layout).
- **Aged Parchment** (`#c9c6b8`): A stronger line/text color used for index numerals (01, 02...) and firmer borders like the "saved" state outline.
- **Near-Black Ink** (`#1c1c1a`): Primary text color.
- **Deep Pantry Black** (`#14170f`): The header/footer/"added" background — not a true black, carries a green undertone consistent with the palette.
- **Warm Charcoal** (`#5c5b52`) / **Muted Taupe** (`#6e6d63`) / **Subtle Sage-Grey** (`#8a897e`): A three-step body-to-meta text ramp, darkest to lightest, for paragraph copy, secondary labels, and tertiary meta text respectively.
- **Pale Oat** (`#b9b7ac`): Text color for content sitting on the dark ink-inverse background.

### Named Rules
**The Two-Color Rule.** Only pantry green and market mustard carry saturation. Every other token in the system is a neutral warm grey or off-white/off-black. If a new element needs a third saturated color, that's a sign it doesn't belong in this system as designed.

**The No-Pure-Black Rule.** Text and dark surfaces are never `#000` or `#fff`-on-black; ink and its inverse both carry warmth (green- and paper-tinted respectively).

## Typography

**Display Font:** Newsreader (with Georgia, serif fallback)
**Body/Label Font:** Archivo (with system-ui, sans-serif fallback)

**Character:** A literary serif for anything that should feel considered — headlines, prices, the wordmark — set in regular weight with italic-bold used as an emphasis device inline (see the hero: "Shop *smarter*, spend *less*"). Everything operational drops to Archivo, almost always uppercase and letter-spaced, reading closer to a shelf label than a UI string.

### Hierarchy
- **Display** (400, `clamp(1.875rem, 4vw, 3.25rem)` / 34–52px, line-height 1.06–1.14): Section and hero headlines. Set in Newsreader; emphasis words within a headline switch to italic + bold (font-weight 700 italic), never a color change.
- **Price** (400, 26px, line-height 1): A dedicated Newsreader role — product prices are typographically treated like headlines, not like body numerals.
- **Title** (600, 14.5–15px): Card and list titles (meal name, product name context, step titles) — Archivo semibold, sentence case.
- **Body** (400, 13–14.5px, line-height 1.5–1.6): Paragraph copy in Archivo. Max width capped per block (44–70ch) rather than a global rule.
- **Label** (700, 10.5–13px, letter-spacing 0.14em–0.22em, uppercase): Eyebrow labels, nav links, button text, badges. This is the system's most distinctive type role — nearly every piece of "chrome" text uses it.
- **Meta** (400, 11–12.5px): Small supporting text (unit price, review counts, timestamps) in the muted/subtle neutral ramp.

Note: `EB Garamond` is loaded as a variable font in `index.css` but has no assigned role in the implemented system yet — treat it as reserved, not a documented hierarchy role, until a component actually uses it.

### Named Rules
**The Shelf-Label Rule.** Any text that is functional rather than expressive (a button, a nav item, an eyebrow, a badge) is uppercase Archivo with wide letter-spacing. Any text that is meant to be read and felt (headlines, prices) is Newsreader, sentence case, letter-spacing tightened slightly negative.

## Layout

A single centered container at **1160px max-width**, with `px-6` mobile gutters widening to `px-10` at `lg`. Section vertical rhythm steps in irregular but intentional increments (`pt-9.5` through `pt-19`) rather than a strict 8pt grid — read the spacing as "considered," not systematic.

Product and category grids run responsive column counts: 2 columns mobile → 3 at `sm` → 5–6 at `lg`, using CSS grid.

### Named Rules
**The Hairline Gutter Rule.** Bordered grids (category grid, "how it works" steps) are built by giving the grid container `bg-bw-line` (the hairline color) and a `gap-px`, so the 1px gaps between cells render as seams rather than literal `<hr>` elements or per-cell borders. Reuse this pattern for any new tessellated grid rather than adding individual cell borders.

## Elevation & Depth

Flat by design — there is no shadow vocabulary anywhere in the implemented system. Depth and separation come from two devices only: hairline borders (`border-bw-line`) around cards and panels, and flat color blocking (the near-black `ink-inverse-bg` header/footer sitting against the warm-paper page). Overlays (the cart sidebar's scrim) use a plain `bg-black/40` wash rather than a blurred or elevated treatment.

### Named Rules
**The Flat-By-Default Rule.** Never add `box-shadow` to a card, button, or panel. If something needs to read as "above" the page, use a border and/or a darker flat fill — not elevation.

## Shapes

A deliberately narrow radius vocabulary with exactly two values in active use:
- **Full pill** (`rounded-full`, 9999px): Every clickable chip, tab, and header/nav-level button (Basket button, ghost nav links, search input, tab toggles, circular icon buttons, the mustard count badge).
- **2px nudge** (`rounded-sm`): Only on card-level CTA buttons and badges sitting inside a `ProductCard` (Add to cart, Save to list, the savings badge) — barely-there, closer to "eased" than "rounded."
- **Square** (0px, default/unset): Everything else — cards, panels, containers, the category grid cells, the search dropdown, the mobile menu. Squareness is the resting state; roundness is earned by being an interactive pill or a small in-card control.

Borders are always 1px, always the hairline oat color at rest, stepping up to `bw-line-strong` or `bw-ink` only for a selected/active state (e.g. the "Saved" toggle, the active "Start another way" tab).

## Components

### Buttons
- **Primary (pill):** `rounded-full`, `bg-bw-green` / white text, Archivo semibold, used for header/nav-level and section-level calls to action ("Basket", "Compare basket", ghost ring CTAs). Hover → `bg-bw-green-hover`. No shadow, no scale transform.
- **Card CTA (squared):** `rounded-sm`, same green fill, smaller padding, used inside `ProductCard`/`MealCard`. Its "done" state doesn't fade the color — it swaps entirely to `bg-bw-ink-inverse-bg` ("In basket ✓"), keeping full contrast rather than dimming.
- **Secondary/Outline:** transparent or surface background, 1px border in `bw-line-strong` (unselected) or `bw-ink` (selected/active, e.g. "Saved"), text in `bw-ink`.
- **Ghost (tab/ghost nav):** transparent background, `bw-body` text at rest; selected state fills solid `bg-bw-ink` with white text (see `StartAnotherWay` tabs) rather than an underline or color-only change.

### Badges
- **Accent badge:** `bg-bw-yellow` / `text-bw-yellow-ink`, square corners, bold uppercase-adjacent label — used for savings callouts and the basket-count pip (which is circular via `rounded-full` instead, ringed in `bw-green`).
- **Tag badge:** `bg-bw-green` / white text, `rounded-full`, small, top-left overlay on product imagery.

### Cards / Containers
- **Corner Style:** Square (0px radius) throughout.
- **Background:** `bw-surface` (white) on `bw-page`, or `bw-panel` (oat) for framed feature blocks.
- **Shadow Strategy:** None — see Elevation & Depth.
- **Border:** 1px `bw-line`, uniform on all sides.
- **Internal Padding:** Card body padding runs `px-3` to `px-4`/`py-3.5`–`py-5.5` depending on card density; feature panels (meals) use generous `px-6 sm:px-10 pt-10 pb-9`.
- **Placeholder imagery:** Where real product/hero photography is missing, use a repeating 135° two-tone diagonal-stripe background (`#F3F1EA`/`#EDEBE2` or similar close warm-neutral pair) with a centered, small monospace caption naming the intended shot — never a gray box or a broken-image icon.

### Inputs / Fields
- **Style:** `rounded-full`, translucent white fill (`bg-white/10`) on the dark header, no visible border at rest (`border-transparent`).
- **Focus:** Border and ring switch to `bw-yellow` (`focus:border-bw-yellow focus:ring-2 focus:ring-bw-yellow/20`), fill brightens slightly (`bg-white/15`) — the accent color's one appearance outside money contexts.

### Navigation
- **Header:** Solid `bw-ink-inverse-bg` bar, sticky top, `bw-on-dark` text. Section anchor links and account/browse/lists links use uppercase tracked Archivo labels; the one exception is "Sign in," which is styled in `bw-yellow` with an underline to stand apart as a secondary but noticeable action.
- **Icons:** Material Design icon set (`react-icons/md`) for Browse/Lists/Account/menu affordances, mixed with hand-authored inline SVGs (search, cart-outline) that get a CSS `invert` filter to sit correctly on the dark header. Icons are functional, never decorative — every icon pairs with a visible or `aria-label` text equivalent.
- **Mobile menu:** A square-cornered white dropdown panel (`bw-surface`/`bw-line` border) rather than a full-screen takeover, anchored under the menu button.

## Do's and Don'ts

### Do:
- **Do** keep pantry green and market mustard as the only saturated colors in any new UI; every other new token should land in the existing warm-neutral ramp.
- **Do** use the Hairline Gutter Rule (`bg-bw-line` container + `gap-px`) for any new bordered grid rather than per-cell borders.
- **Do** use the diagonal-stripe placeholder + mono caption pattern for any imagery slot that doesn't yet have a real asset, rather than a plain gray box.
- **Do** reserve italic-bold Newsreader for inline emphasis within a headline, not for standalone UI text.
- **Do** keep functional text (labels, nav, buttons, badges) in uppercase tracked Archivo, and expressive text (headlines, prices) in Newsreader sentence case.

### Don't:
- **Don't** add `box-shadow` anywhere — depth comes from borders and flat color blocking only, never elevation.
- **Don't** introduce a third saturated color; if something needs emphasis beyond green/mustard/red, reach for the neutral ramp or a stronger border, not a new hue.
- **Don't** use a radius outside the three established values (pill / 2px / square) — no `rounded-md`, `rounded-lg`, or `rounded-xl`.
- **Don't** fade or dim a completed/active state (e.g. "added" or "saved") — swap to a distinct solid fill (ink-inverse or a bordered active state) so it reads as fully done, not partially disabled.
