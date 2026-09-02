---
target: browse page (CategoriesPage + BrowseLayout/BrowsePage/CategorySidebar/BrowseProductCard)
total_score: 20
max_score: 32
na_heuristics: 7,10
p0_count: 1
p1_count: 2
timestamp: 2026-09-01T13-38-25Z
slug: frontend-src-pages-browsepage-tsx
---
### Design Health Score

| # | Heuristic | Score | Key Issue |
|---|---|---|---|
| 1 | Visibility of System Status | 3 | Skeletons present on both pages; no per-item pending state on add-to-basket beyond the 420ms pop animation |
| 2 | Match Between System and Real World | 3 | Retailer logos and "Load more" read naturally for an AU grocery shopper |
| 3 | User Control and Freedom | 3 | Filters clear via URL params; no single "clear all filters" affordance once retailer + sort are both set |
| 4 | Consistency and Standards | 1 | `text-blue-600` hardcoded on the cheapest-price label breaks the Two-Color Rule; `CategoriesPage`'s card grid uses `rounded-xl`/`rounded-lg` and a spaced gap-grid where DESIGN.md names this exact page as the example of its Hairline Gutter Rule |
| 5 | Error Prevention | 3 | N/A pricing renders gracefully; no guard against rapid double-click add/remove |
| 6 | Recognition Rather Than Recall | 3 | Persistent "Category — Subcategory" heading reduces recall burden |
| 7 | Flexibility and Efficiency | n/a | Operate-mode browsing; power-user shortcuts don't apply to a first-pass MVP |
| 8 | Aesthetic and Minimalist Design | 2 | `SortMenu` ships 7 options for a product whose own PRODUCT.md lists sorting as explicitly out of Browse MVP scope |
| 9 | Help Recognize/Diagnose/Recover from Errors | 2 | Empty state is flat prose with no path back to another category |
| 10 | Help and Documentation | n/a | Not expected on a browse/compare grid |
| **Total** | | **20/32** | **Acceptable (62.5%)** |

### Design Specificity Verdict

**LLM assessment**: The chrome is distinctly BasketWise, but the product card's interior now leans on real retailer brand marks rather than the "Provisions Ledger" system's numbered-index language, and a stray `text-blue-600` belongs to no design system at all.

**Deterministic scan**: `detect.mjs` returned clean (exit 0) across all 7 target files. Manual mechanical review caught the `text-blue-600` drift at `BrowseProductCard.tsx:119`. The raw hex values in `CategoriesPage.tsx` are NOT drift — DESIGN.md explicitly specifies that stripe pattern as canonical placeholder imagery (a false positive a less-informed reviewer might flag). Focus-visible coverage and the `getCategories()`/`getProducts()` data-fetching pattern were both checked and found fully consistent across all files.

**Visual overlays**: Not available — no browser automation tool exposed in this session.

### Overall Impression

Mechanics (routing, data flow, focus states, cancellation handling) are solid and the earlier audit's fixes are holding. The gap is surface expression drifting from BasketWise's own documented system, plus a scope mismatch where sort/filter exists despite the product's MVP contract calling it out of scope.

### What's Working

- `RetailerFilter`/`SortMenu` correctly use the pill/square radius vocabulary from DESIGN.md.
- The staggered fade-up on product cards is restrained, not flashy overreach.
- Focus-visible and data-fetching consistency are both clean.

### Priority Issues

**[P0] Hardcoded `text-blue-600` on the cheapest-price label** — Violates the Two-Color Rule at the single most price-sensitive moment in the flow. Fix: replace with `bw-green` or a deliberate new token backed by a DESIGN.md decision. Suggested command: `/impeccable harden`

**[P1] `CategoriesPage` skips the Hairline Gutter Rule DESIGN.md names it as the example of** — DESIGN.md cites "category grid" as the pattern that should use `bg-bw-line`+`gap-px`; current implementation uses spaced gaps and radii reserved for the Browse-product-card exception. This was a deliberate change from an explicit user brief, so DESIGN.md needs to record it as a second named exception. Suggested command: `/impeccable document` or `/impeccable layout`

**[P1] Sort/filter functionality exists despite PRODUCT.md marking it out of MVP scope** — PRODUCT.md states sorting/retailer-filtering are explicitly out of scope until the core flow works; both are fully built. Suggested command: `/impeccable distill`

**[P2] Full-color retailer logos introduce brand saturation the design system doesn't reconcile** — Real trademarks, reasonable to keep, but DESIGN.md's Two-Color Rule doesn't carve out an exception for third-party brand marks. Suggested command: `/impeccable document`

**[P3] Empty state has no recovery path** — Static prose with no CTA back to another category or to clear filters. Suggested command: `/impeccable onboard`

### Persona Red Flags

**Sam (Accessibility-dependent)**: Retailer logo `alt` text says only the retailer name — no indication of "cheapest" status, which is currently carried entirely by color and font-size, invisible to assistive tech.

**Jordan (First-timer)**: 17 flat categories plus 7 sort options is more simultaneous decisions than the product's "reduce shopper effort" principle promises for a newcomer.

**Riley (Stress-tester)**: Add/remove toggle has no debounce — fires immediately on every click with only a cosmetic pop as feedback, risking state thrash under fast clicking.

### Minor Observations

- `CategoriesPage`'s loading skeleton renders 10 tiles but there are 17 real categories.
- The "Save $X" badge's `title` tooltip is desktop-hover-only, invisible on mobile/touch.
- Item-count text disappears entirely during loading rather than reserving its space.

### Questions to Consider

- Should the highest-stakes decision moment (cheapest retailer) lean on trademarked brand marks instead of the system's own visual language, or is that trade worth it for recognition?
- Was sort/filter built now because research showed it's needed, or because it was easy to add while the scope note said otherwise?
