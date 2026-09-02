---
target: browse page
total_score: 21
max_score: 40
na_heuristics: 
p0_count: 1
p1_count: 3
timestamp: 2026-08-31T04-57-28Z
slug: frontend-src-pages-browsepage-tsx
---
Method: dual-agent (A: ac6ae6c113ef25ad0 · B: ab3a931b65b3fd305)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Good skeleton/fade-in/count, but the grid hard-swaps on filter change with no "updating" transition |
| 2 | Match System / Real World | 3 | Correct retailers/units/currency; fixed-order N/A rows read as data gaps, not intent |
| 3 | User Control and Freedom | 2 | No single "clear all filters"; remove-from-basket exists but is undiscoverable |
| 4 | Consistency and Standards | 1 | BrowseProductCard.tsx uses rounded-2xl/rounded-xl/shadow-sm/shadow-md against a DESIGN.md that mandates flat, square/pill-only shapes |
| 5 | Error Prevention | 3 | Search-clear only tabbable when populated; no destructive actions to guard beyond the basket toggle |
| 6 | Recognition Rather Than Recall | 2 | Fixed retailer order aids recognition once learned, but N/A rows and the silent save-badge threshold force inference |
| 7 | Flexibility and Efficiency | 1 | No bulk-add, no quantity stepper, no keyboard path |
| 8 | Aesthetic and Minimalist Design | 2 | Card carries more visual weight than the ledger shell it sits inside |
| 9 | Error Recovery | 3 | Empty states well-differentiated; no fetch-failure state shown |
| 10 | Help and Documentation | 1 | Nothing explains the remove-toggle, N/A convention, or save-badge cutoff |
| **Total** | | **21/40** | **Acceptable** |

## Design Specificity Verdict

LLM assessment: page shell (category accordion, hairline dividers, ledger typography) is specifically BasketWise; the product card (rounded-2xl, shadow-sm/md, rounded-xl image, circular FAB) is a generic e-commerce card silhouette that contradicts DESIGN.md's flat/square-or-pill system. The card's own loading skeleton stays on-system, proving the shadow/rounding was bolted on afterward.

Deterministic scan: static regex pass on the 5 target files was clean (exit 0). Live rendered-DOM scan found 25 anti-patterns: 24x undersized-ui-text (9.5px "product shot" caption, BrowseProductCard.tsx:57-59, one per card) and 1x low-contrast (#6e6d63 on #14170f, 3.5:1, traced to Footer.tsx:70 — shared layout, not Browse-specific code, but present on the rendered page). No false positives after manual verification.

Visual overlays: browser injection succeeded (not a fallback); findings drawn from a live console/JSON scan via the bundled detector script.

## Overall Impression

Chrome around the page is well-made and specific to BasketWise; the product card at its center is not. Closing that gap is the single biggest opportunity — it's the component shoppers look at hundreds of times per session.

## What's Working

1. Category sidebar accordion — correct aria-expanded/aria-current/roving tabIndex, fully on-system flat/square/hairline execution.
2. Empty and loading states — differentiated copy per empty-state cause, skeleton mirrors real card proportions.
3. Add-to-basket pop micro-interaction — small, well-scoped delight moment.

## Priority Issues

[P0] Product card breaks the design system it sits inside
- Why it matters: rounded-2xl/rounded-xl/shadow-sm/shadow-md (BrowseProductCard.tsx lines 48, 51, 62, 72) contradict DESIGN.md's shape vocabulary (pill/2px/square only) and its "no box-shadow" rule; the card's own skeleton gets this right, so it's an internal inconsistency, not just a documentation gap.
- Fix: 0-radius card + border, 0-radius image block, rounded-sm badge (no shadow), square rounded-sm add/remove control (no shadow).
- Suggested command: /impeccable polish

[P1] "product shot" placeholder caption is under the legibility floor — 24 instances, detector-confirmed
- Why it matters: measured at 9.5px against an 11px floor, real functional text repeated on every card.
- Fix: raise to >=11px or add sufficient contrast/size pairing.
- Suggested command: /impeccable audit

[P1] Add/remove toggle has no discoverable "click again to remove" affordance
- Why it matters: same button handles add and remove via icon swap alone; a checkmark reads as "done," not "click to undo."
- Fix: hover/focus state swapping check to an x/remove icon, or a first-use hint.
- Suggested command: /impeccable clarify

[P1] Duplicate search inputs stacked ~40px apart
- Why it matters: header search and page-local search both read "Search groceries…" simultaneously visible, no indication of whether they're linked.
- Fix: make header search Browse-aware and drop the page-local box, or differentiate them visually/functionally.
- Suggested command: /impeccable layout

[P2] "Save $X" badge threshold is invisible and looks inconsistent
- Why it matters: badge only shows when saving >=10% of cheapest price and >=$0.20, undocumented; comparable cards show/don't show it with no explanation.
- Fix: always show the literal saving (de-emphasized below threshold) or surface the rule near the filter row.
- Suggested command: /impeccable clarify

## Persona Red Flags

Jordan (First-Timer): two identical-looking search boxes; checkmark gives no hint it's removable; unexplained save-badge inconsistency across similar cards.

Alex (Power User): no bulk-add, no quantity stepper, no acceleration for a full weekly shop — contradicts PRODUCT.md's "reduce shopper effort" principle for the persona doing the most repetitive work.

Sam (Accessibility): cheapest-price row signaled by color+weight alone, no icon/label/ARIA; compounded by the detector-confirmed 9.5px placeholder text and 3.5:1 footer contrast — three stacking accessibility gaps.

## Minor Observations

- Footer.tsx:70 low-contrast finding is real on /browse but originates in shared MainLayout chrome, not Browse-specific code.
- Fixed retailer order with N/A fillers reads as a data gap on single-retailer items; consider de-emphasizing N/A rows.
- Mobile viewport (390x844) fully consumed by the 17-item category accordion before any product content is reachable.
- "SIGN IN" outlier amber color/underline vs. neutral nav items — likely intentional per DESIGN.md's stated header accent exception, flagged for confirmation only.
- bw-green-tint (#f4f8f5) used for cheapest-row background isn't in DESIGN.md's documented palette.
- PRODUCT.md marks retailer filtering/sorting/search as out of scope for the Browse MVP, yet all three are live and wired up.

## Questions to Consider

1. The loading skeleton for this card is on-system — what made the real card the one place that vocabulary was dropped?
2. If the fixed retailer order is kept for recognition, why repeat it unlabeled in all 24 cards instead of one persistent column header?
3. What would "reduce shopper effort" look like for someone adding 40 items to a weekly basket one click at a time?
