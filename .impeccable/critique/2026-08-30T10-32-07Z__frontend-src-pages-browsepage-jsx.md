---
target: browse page (frontend/src/pages/BrowsePage.jsx)
total_score: 32
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 2
timestamp: 2026-08-30T10-32-07Z
slug: frontend-src-pages-browsepage-jsx
---
Method: dual-agent (A: general-purpose design review · B: general-purpose detector/evidence)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Item count, active filters, `aria-expanded`/`aria-current` all reflect state live; no loading affordance, but data is static mock |
| 2 | Match System / Real World | 4 | Store names, category taxonomy, "Best at X" language map cleanly to real shopping mental models |
| 3 | User Control and Freedom | 2 | `SortMenu` has no Escape-to-close (outside-click effect only listens for `mousedown`); category/subcategory still aren't in the URL, so back/forward can't restore them |
| 4 | Consistency and Standards | 3 | Tokens/typography consistent with the homepage `ProductCard`; `SortMenu`'s option list has no `role="listbox"` despite behaving like one |
| 5 | Error Prevention | 4 | URL param validation on `store`/`sort` prevents any invalid-state crash or silent bad filter |
| 6 | Recognition Rather Than Recall | 4 | Active filters visibly bordered/filled; sort label always shown on the trigger |
| 7 | Flexibility and Efficiency | 3 | Savings-first default sort is a real efficiency win; no bulk reset or category search |
| 8 | Aesthetic and Minimalist Design | 4 | Flat, hairline, restrained — matches DESIGN.md closely |
| 9 | Error Recovery | 2 | Empty-state copy assumes the store filter caused zero results even when it's actually the subcategory |
| 10 | Help and Documentation | 3 | Not deeply needed for a filter UI; nothing egregiously missing |
| **Total** | | **32/40** | **Good** |

## Design Specificity Verdict

**LLM assessment:** Authored for BasketWise, not generic. The placeholder-photography convention, the Newsreader-price/Archivo-label split, the two-saturated-color discipline, and the "Best at Coles"/"Best at Woolworths" language all match DESIGN.md's Provisions Ledger system and the product's actual comparison-first positioning. One undocumented deviation: the product grid runs 4 columns at `xl`, where DESIGN.md's documented spec is 5–6 columns at `lg` for product grids elsewhere — likely justified by the sidebar eating width, but not stated anywhere as an intentional Browse-specific exception.

**Deterministic scan:** `detect.mjs` ran clean (exit 0, zero findings) across all 6 files. No `box-shadow`, only `rounded-full`/`rounded-sm` in use, no structural issues (keys, unclosed JSX). The scanner's own regex-based rule set is narrow — a clean run means "nothing in its ruleset," not "no issues," which is exactly why the manual fix-verification pass below carries the real weight this round.

**Visual overlays:** Unavailable — no browser automation tool exposed this session; findings are code-verified, not visually confirmed.

## Fix Verification (Round 2 → Round 3)

All 5 previously-reported fixes were independently re-verified against the current code by both assessments, not taken on the prior claim:

| # | Fix | Verdict |
|---|-----|---------|
| 1 | Default sort → `savings-desc` | **Confirmed** — `DEFAULT_SORT = 'savings-desc'`, genuinely wired as fallback and delete-threshold, matches `sortProducts`'s actual descending-savings comparator |
| 2 | Filter state → URL (`useSearchParams`) | **Confirmed** — real import/usage, validated against `STORE_VALUES`/`SORT_OPTIONS` with clean fallback on garbage/missing values, functional updater preserves unrelated params |
| 3 | Invalid `aria-selected` → `aria-current` | **Confirmed** — spec-valid, wired to real state on both the category header and subcategory rows |
| 4 | ARIA state on subcategory/sort-option rows | **Confirmed** — `aria-current` present and dynamic in both `CategorySidebar.jsx` and `SortMenu.jsx` |
| 5 | Untokenized color → named token | **Confirmed** — `--color-bw-green-tint` genuinely defined in `index.css`, zero remaining `#f4f8f5` literals |
| 6 | `focus-visible:` coverage | **Confirmed, and correctly targeted** — all four components have real focus rings; the one case that actually needed special handling (the green Add-to-cart button on a green background) got `ring-offset-2`, which — combined with Tailwind's default white ring-offset color — produces a visible white gap against the card background rather than a green-on-green blend. (One assessment flagged this as a residual risk worth a real-browser check since no offset-color class is explicit; the other traced through the default and judged it resolved. Flagging the disagreement rather than picking a side without visual confirmation.)

All 5 landed for real, not cosmetically. This round's issues are new-tier, not leftovers.

## Trend

**23/40 → 27/40 → 32/40** across three rounds (static comp → first React pass → this pass), moving from Acceptable into Good. Every P0 and P1 from the prior two rounds is now fixed.

## Overall Impression

This is now a genuinely solid Browse implementation — the fixes weren't superficial, and the savings-first default sort plus URL-backed filters are real product-purpose wins, not just checklist items. What's left is a pattern of *half-finished* good ideas: the empty state branches correctly on category-vs-filter emptiness but doesn't yet know which filter is actually responsible; store/sort made it into the URL but category/subcategory didn't, so a shared Browse link still can't fully reconstruct what someone was looking at.

## What's Working

- **Savings-first default sort directly serves the product's purpose** instead of a generic alphabetical fallback that undercut it two rounds ago.
- **URL-backed store/sort with real input validation** — a clean, defensive implementation, not just "read from `useState`."
- **The `ring-offset-2` fix on the green Add-to-cart button shows real understanding of *why* a fix was needed**, not a blanket class copy-pasted onto every button regardless of context.

## Priority Issues

**[P1] The empty-state CTA still misdiagnoses what's actually empty.**
Why it matters: `BrowsePage.jsx`'s empty state checks category-has-data vs. filtered-to-zero, but doesn't check *which* filter caused the zero — a category with items but an empty subcategory (e.g. Bakery → "Instore Bakery Savoury Treats") shows "Nothing in Bakery is cheaper at that store… Show both stores," even when store is already `'both'`. The button becomes a no-op because the real cause is the subcategory, not the store. This is the exact "reads as broken, not reassuring" failure mode the P2 fix two rounds ago was meant to close, just relocated one level deeper.
Fix: Check `subcategory !== 'All'` as a distinct cause and offer a "Clear subcategory" action alongside (or instead of) "Show both stores."
Suggested command: `/impeccable onboard`

**[P1] Category and subcategory still aren't in the URL.**
Why it matters: `store`/`sort` moved to `useSearchParams` this round, but `category`/`subcategory` remain local `useState` in `BrowseLayout.jsx`. A shared or bookmarked "cheapest Bakery items at Woolworths, sorted by savings" link loses the category half of that context on load — the URL-persistence fix is half-applied.
Fix: Extend the same `useSearchParams` pattern already proven for store/sort to cover category/subcategory in `BrowseLayout.jsx`.
Suggested command: `/impeccable harden`

**[P2] SortMenu has no keyboard-close path and no listbox semantics.**
Why it matters: The outside-click handler only listens for `mousedown` — there's no `Escape` handler, and the option list has no `role="listbox"`/`option`, so it presents to assistive tech as an unlabeled group of buttons despite behaving like a single-select menu.
Fix: Add an `Escape` key handler that closes the menu and returns focus to the trigger; add `role="listbox"` to the panel and `role="option"`/`aria-selected` to each row (the valid pairing this time, since `option` is one of the roles that supports `aria-selected`).
Suggested command: `/impeccable audit`

**[P2] The 17-item flat category sidebar has no search or grouping.**
Why it matters: All 17 categories render simultaneously with no way to narrow the list — a scan-cost problem today, and one that only worsens as the real catalog grows past mock-data scale.
Fix: Not urgent at current scale; worth a filter/search input above the accordion once the category count or usage suggests it's needed.
Suggested command: `/impeccable layout`

**[P3] Product grid column count diverges from the documented spec, undocumented.**
Why it matters: `BrowseProductCard`'s grid runs 4 columns at `xl`; DESIGN.md's Layout section specifies 5–6 columns at `lg` for product grids elsewhere in the app. Likely a deliberate accommodation for the sidebar's width, but nothing states that — a future editor could "fix" it back to spec without realizing it was intentional.
Fix: Either match the documented column counts if there's room, or add a one-line comment/DESIGN.md note explaining the Browse-specific exception.
Suggested command: `/impeccable polish`

## Persona Red Flags

**Alex (time-pressed shopper):** Drills into Bakery → a specific empty subcategory expecting savings, hits the dead-end "Show both stores" button (P1) — real mid-task friction right when efficiency matters most.

**Sam (keyboard/screen-reader user):** Opens `SortMenu` with Enter, can Tab through options, but has no way to dismiss it with Escape and gets no listbox semantics — the menu partially traps keyboard navigation flow.

**Casey (first-time, low-trust visitor):** The "Best at Coles" language reads clearly and the round-1 P0 stayed fixed — but hitting the P1 empty-state's inaccurate diagnosis right after landing on a category would read as the app being wrong, which cuts against exactly the "we show you the truth" trust pitch the product is built on.

## Minor Observations

- The item-count `<span>` still renders an empty string (not "0 items") at zero results.
- The `resultsKey`-driven entrance stagger replays on every filter click, including rapid successive toggles — worth a debounce check if fast filtering ever feels twitchy in practice.
- The `ring-offset-2`-without-explicit-`ring-offset-color` question on the Add-to-cart button (noted above) is the one place the two assessments read the evidence differently — worth a two-minute real-browser glance next time one's available, low stakes either way.

## Questions to Consider

- What if category/subcategory joins the URL now that store/sort already did — was leaving it out a deliberate scope cut, or just missed?
- What if two shoppers share a Browse link — should the whole filter state, not half of it, be reconstructible?
- What happens to the flat 17-category sidebar once the catalog is real and categories multiply — does search need to exist before that day, not after?
