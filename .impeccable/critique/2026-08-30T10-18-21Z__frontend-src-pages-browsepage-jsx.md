---
target: browse page (frontend/src/pages/BrowsePage.jsx)
total_score: 27
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 2
timestamp: 2026-08-30T10-18-21Z
slug: frontend-src-pages-browsepage-jsx
---
Method: dual-agent (A: general-purpose design review · B: general-purpose detector/evidence)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Item count, sort label, active store, expand/collapse all reflected live; no focus-visible feedback anywhere |
| 2 | Match System / Real World | 2 | "Best at Coles" chip label implies a comparison even for Coles-only items, which the card itself labels "Only at Coles" — the two components disagree on framing |
| 3 | User Control and Freedom | 3 | Subcategory toggles cleanly back to "All"; no global "clear all filters," and state isn't restorable via URL/back button |
| 4 | Consistency and Standards | 3 | Add-to-cart swap correctly mirrors the homepage `ProductCard`; focus-style gap is consistent with an existing project-wide gap, not a new regression |
| 5 | Error Prevention | 4 | Nothing destructive is possible on this page; every toggle is reversible |
| 6 | Recognition Rather Than Recall | 2 | The `<h1>` is hardcoded "Browse groceries" and never reflects the selected category/subcategory — once the sidebar scrolls out of view, there's no on-screen record of the active filter |
| 7 | Flexibility and Efficiency | 2 | Store/sort live in local `useState`, not the URL — navigating away and back silently resets both |
| 8 | Aesthetic and Minimalist Design | 4 | Strict, disciplined adherence to DESIGN.md's flat/hairline/two-color system, confirmed by a clean detector run |
| 9 | Error Recovery | 2 | Empty state always offers "Show both stores," even for categories with zero real items regardless of store filter — a dead-end CTA |
| 10 | Help and Documentation | 2 | None present; acceptable for task complexity, the store filter's `aria-label` is the only in-context help |
| **Total** | | **27/40** | **Acceptable** |

## Design Specificity Verdict

**LLM assessment:** Authored for BasketWise, not generic. The dual-price grid in `BrowseProductCard` (Coles/Woolworths columns, green check + green price on the cheaper side) is a genuinely domain-specific interaction that couldn't be dropped into an arbitrary e-commerce site — it's a direct visualization of the product's core value prop. The Provisions Ledger aesthetic is followed with unusual discipline: zero shadows, zero rogue radii, zero third saturated color anywhere in the six new files. Where it slips toward generic is the toolbar: "Name A–Z / Z–A / Price / Savings" is a stock e-commerce sort list, and defaulting to alphabetical rather than price/savings undercuts the very positioning this page exists to serve.

**Deterministic scan:** `detect.mjs` ran clean across all 7 target files — exit code 0, zero findings, confirmed not suppressed by any ignore config. No `box-shadow` anywhere (Flat-By-Default Rule holds), and the only radius values in use are `rounded-full` and `rounded-sm`, both within DESIGN.md's allowed set. Manual supplementary evidence found one untokenized one-off color (`bg-[#f4f8f5]`, the best-price tint, appears nowhere else in the app and isn't backed by a `--color-bw-*` token) and a real ARIA spec issue: `aria-selected` is used on a plain `<button>` (`CategorySidebar.jsx`) — invalid per the ARIA spec, which restricts `aria-selected` to `option`/`tab`/`row`/etc. roles, so the state is correctly tracked in code but likely ignored by assistive tech. Hand-computed contrast confirmed the prior round's `--subtle`→`--muted` migration held for Browse's own body/meta text (no `text-bw-subtle` found outside icon usage, which sits in the more lenient 3:1 non-text bucket) — though the same migration has *not* landed on the sibling homepage `ProductCard.jsx`, which still uses `text-bw-subtle` on real body text outside this page's scope.

**Visual overlays:** Unavailable — no browser automation tool exposed this session. Both assessments worked from static source analysis; findings above are code-verified, not visually confirmed.

## Trend

**Up from 23/40 (Acceptable) on the earlier static-HTML comp to 27/40 (Acceptable, top of band) on this real React implementation.** Both P0s from that earlier round are confirmed fixed in code: the store-chip relabeling now matches `passesPreferredStore()`'s actual behavior, and `CategorySidebar`'s `handleHeaderClick` correctly preserves the subcategory selection when collapsing an already-expanded category rather than resetting it. The remaining issues below are new-tier problems this round surfaced, not leftovers.

## Overall Impression

The port from comp to real code preserved what worked and fixed both P0s from the last round without regressing anything the detector or the reviewer could find — that's a clean pass. What's left is less "broken" and more "not yet living up to its own premise": the page defaults to alphabetical sorting on a tool whose whole reason to exist is showing you the cheapest option, and it forgets every filter choice the moment you navigate away. Both are one-line-of-intent fixes, not structural problems.

## What's Working

- **The core comparison interaction is real and specific** — green check + green price on whichever store is cheaper, directly visualizing "the cheaper option is never hidden" rather than just claiming it in copy.
- **Both P0s from the last critique are genuinely fixed**, confirmed by tracing the actual state logic, not just re-reading labels.
- **Reduced-motion is implemented correctly, not decoratively** — every transform/opacity animation (accordion height, sort panel, grid stagger) has a working `prefers-reduced-motion` path; only plain color-hover transitions lack one, which is a defensible, low-stakes gap.
- **Zero deterministic-scan findings** across all 7 files — no shadows, no off-system radii, no ignore-file suppression hiding the result.

## Priority Issues

**[P1] Default sort works against the product's own purpose.**
Why it matters: `BrowsePage.jsx` defaults to `useState('name-asc')`. A price-comparison tool opening alphabetically means every single visit requires a manual step to see the thing the product exists to show.
Fix: Default to `'savings-desc'`, or add a genuinely savings-led "Recommended" option to `SORT_OPTIONS` in `lib/browseFilters.js` and default to that.
Suggested command: `/impeccable clarify`

**[P1] Filter and sort state don't survive navigation.**
Why it matters: `store` and `sort` live in `BrowsePage`'s local `useState`, not the URL. Any navigation away and back — including simple browser back — silently resets both to defaults, which is especially costly for a distracted mobile shopper who steps away mid-task.
Fix: Lift `store`/`sort` into `useSearchParams` (react-router is already in use) so `?store=coles&sort=savings-desc` persists across navigation and is shareable.
Suggested command: `/impeccable harden`

**[P2] ARIA state has real gaps and one spec error.**
Why it matters: `CategorySidebar.jsx` puts `aria-selected` on a plain `<button>` — invalid per spec (that attribute requires `option`/`tab`/`row`-family roles), so assistive tech likely ignores a value the code correctly tracks. Separately, subcategory rows and `SortMenu`'s option rows convey "currently selected" through color/weight only, with no ARIA equivalent at all — a screen-reader user can't tell which subcategory or sort order is active.
Fix: Replace the category header's `aria-selected` with `aria-current="true"` (valid on any element); add `aria-current`/equivalent state to subcategory rows and sort-option rows.
Suggested command: `/impeccable audit`

**[P2] The empty-state recovery button is a dead end for most empty categories.**
Why it matters: Only 8 of 17 categories in `browseProducts.js` have any mock items. For the other 9 (e.g. Deli), the empty state still offers "Show both stores" — a no-op, since the category itself has zero data regardless of store filter. This reads as a bug on retry, not as reassurance.
Fix: Branch the empty-state copy/CTA on `browseProducts[category]?.length === 0` (nothing built yet) vs. filtered-to-zero (loosen the store filter).
Suggested command: `/impeccable onboard`

**[P3] Small visual-system hygiene gaps.**
Why it matters: `BrowseProductCard.jsx`'s best-price tint (`bg-[#f4f8f5]`) is a one-off hex with no backing token and no other usage in the app — the kind of value that quietly drifts the system if repeated by hand elsewhere. Separately, none of the four new Browse components (`StoreFilter`, `SortMenu`, `CategorySidebar`, `BrowseProductCard`) define a `focus-visible:` treatment, leaving keyboard focus to the browser default against a very light hairline palette.
Fix: Promote `#f4f8f5` to a named token (e.g. a green-tint) if the best-price highlight pattern is meant to recur; add `focus-visible:ring-2 focus-visible:ring-bw-green` consistent with the mustard-focus precedent already used on inputs.
Suggested command: `/impeccable polish`

## Persona Red Flags

**Sam (Accessibility-Dependent):** The `aria-selected`-on-`<button>` spec error and the missing state on subcategory/sort rows (P2) mean a screen-reader user gets no reliable signal of what's currently filtered or sorted. Zero `focus-visible:` styling anywhere in the four new components adds risk at 200% zoom against the light `bw-line` palette.

**Riley (Stress Tester):** Selecting a genuinely-empty category (Deli) with any store filter set lands on an empty state whose only action is a no-op (P2). Rapid store-filter toggling re-keys the results container on every click, replaying the full entrance stagger each time — no debounce, so fast clicking produces visible grid thrash.

**Casey (Mobile/Interruption):** On mobile, the full 17-row category accordion renders stacked *above* the product grid — a long scroll past 9 "No items yet" rows before reaching any product. Filter/sort state loss on navigation (P1) directly punishes exactly this persona: step away mid-task, come back, and the choices are gone.

## Minor Observations

- `BrowseProductCard.jsx` drops the homepage `ProductCard`'s "Save to list" secondary button with no comment marking it an intentional scope cut.
- `CategoryAccordionList` renders twice in the DOM (desktop `<aside>` + mobile `<div>`, toggled via `hidden`/`lg:hidden`) — correctly invisible to assistive tech per breakpoint, but doubles the interactive node count; worth a mental note for future perf passes, not urgent now.
- Plain `transition-colors` hover states (buttons across all four components) have no `motion-reduce:` variant — defensible, since WCAG's reduced-motion criterion targets transform/parallax, not color fades, but flagged for completeness.
- The earlier `--subtle`→`--muted` contrast fix was scoped to Browse only — the sibling `home/ProductCard.jsx` still uses `text-bw-subtle` on real body text (unit label, review count), so the same AA gap likely still exists on the homepage.

## Questions to Consider

- What if the store filter defaulted to whichever store is cheaper overall for the current category, rather than "both," turning the toolbar itself into the first savings insight instead of a neutral starting point?
- What if the empty state for a genuinely-unstocked category looked and read differently enough from a filtered-to-zero state that Riley never mistakes "not built yet" for "your filter is wrong"?
- What if category, subcategory, store, and sort all lived in the URL — making Browse linkable and shareable, not just a page that forgets itself on back-navigation?
