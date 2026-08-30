---
target: browse page (variant-a1.html)
total_score: 23
max_score: 40
na_heuristics: 
p0_count: 2
p1_count: 2
timestamp: 2026-08-30T08-58-52Z
slug: impeccable-browse-variants-variant-a1-html
---
Method: dual-agent (A: general-purpose · B: general-purpose)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Add-to-cart swaps button text and increments the basket count, but neither is announced to assistive tech |
| 2 | Match System / Real World | 2 | "Coles"/"Woolworths" chips filter by *which store is cheaper*, not *which store stocks it* — the literal retailer label reads as "shop here" |
| 3 | User Control and Freedom | 2 | Collapsing an already-open category (re-clicking its header) silently resets the subcategory selection to "All" |
| 4 | Consistency and Standards | 3 | Dropdown, chip, and card patterns reuse the same tokens/components consistently across the file |
| 5 | Error Prevention | 3 | No destructive actions to guard; empty state has one-click recovery, but nothing warns before landing there |
| 6 | Recognition Rather Than Recall | 3 | Once a category's accordion collapses, the active subcategory is shown nowhere — no breadcrumb |
| 7 | Flexibility and Efficiency | 1 | No search, no keyboard shortcuts, no persisted filters; reaching one of 17 categories is click-only |
| 8 | Aesthetic and Minimalist Design | 3 | Strong DESIGN.md fidelity; cards are dense (6 info elements) but hierarchy stays legible |
| 9 | Error Recovery | 2 | Empty-state copy is the only (reactive) hint about the preferred-store semantic |
| 10 | Help and Documentation | 1 | Header "Help" link is a dead `#` anchor; no tooltip explains the store-chip semantic anywhere |
| **Total** | | **23/40** | **Acceptable** |

## Design Specificity Verdict

**LLM assessment:** This is not a generic e-commerce browser wearing a skin. The Newsreader/Archivo pairing, hairline-only borders, diagonal-stripe placeholder photography with monospace captions, and the two-saturated-color discipline (green for action, mustard only on the save badge and basket count) are distinctly "The Provisions Ledger." The side-by-side price-compare card with a highlighted best-price column and checkmark is a genuinely category-specific pattern a generic category browser wouldn't need. But the *behavior* underneath — a 17-item accordion sidebar, a sort dropdown, filter chips — is boilerplate e-commerce IA, and the one place BasketWise's actual differentiator ("no retailer commissions," "the cheaper option is never hidden") should surface in interaction — the store filter chips — instead does something silently non-obvious. The visual skin is authored for this product; the interaction model for its core value prop is not.

**Deterministic scan:** `detect.mjs` ran in degraded/regex-fallback mode (HTML/CSS parser modules unavailable) and returned exit code 2 with 12 findings, all advisory/warning severity: 11 `design-system-font-size` advisories (12px/9.5px/10px/18px/20px/22px sizes read as "off type ramp") and one `design-system-font` warning (`Menlo` monospace, undeclared in DESIGN.md, used only for the placeholder-image caption text). No color-system violations, no `box-shadow` (DESIGN.md's Flat-By-Default Rule holds), and all border-radius values conform to the three allowed values (0 / 2px / 9999px). Assessment B's manual supplementary pass (grepping the file directly, since the detector's regex fallback undercounts) found three hardcoded hex literals bypassing the token system (`#9b9a8f` caption text, `#f4f8f5` best-price tint, `#fff` on the add-to-cart button) and, more materially, hand-computed WCAG contrast: `--subtle` (#8a897e) on white/page resolves to **~3.52:1**, failing AA's 4.5:1 for normal text — affecting `.result-count`, `.card-meta`, `.store-name`, and `.only-at`.

**Visual overlays:** Unavailable this run — no browser automation tool is exposed in this session, so no live-page overlay was injected. Both assessments confirmed this and worked from static source analysis instead; treat the findings above as code-verified, not visually confirmed.

## Overall Impression

The visual system is doing real, specific work — this reads as BasketWise, not a template. The gap is entirely in interaction: two behaviors (the store-chip semantic, and the collapse-resets-subcategory bug) actively work against the user at the exact moments they should feel most in control, and a real accessibility gap (missing ARIA state, failing contrast on secondary text) sits underneath a page that otherwise looks polished. The single biggest opportunity: the store filter chips are the one control most directly tied to BasketWise's stated positioning ("no retailer commissions," "the cheaper option is never hidden") — right now they're also the most likely to be misread as broken.

## What's Working

- **Best-price card treatment** (`.price-col.best` + green border/text + checkmark) communicates the core value prop without relying on color alone — legible and accessible by construction.
- **Empty-state copy and recovery** ("Show both stores") is specific and actionable rather than a generic "no results" dead end.
- **The sort control** has a clear icon, a legible current-value label, and a sensibly grouped option list (Name, Price, Savings × two directions each).
- **System discipline holds up under a deterministic scan** — no shadow violations, no off-ramp radius values, consistent component reuse across dropdown/chip/card patterns.

## Priority Issues

**[P0] Store filter chips silently mean "cheaper here," not "sold here."**
Why it matters: `passesPreferredStore()` in `shared.js` filters to items where the clicked store is the *cheaper* option, but the button just says "Coles" / "Woolworths" with an `aria-label` of "Filter by preferred store" — nothing in the visible copy signals this. A shopper clicking "Coles" expecting to see everything Coles stocks instead gets a filtered, possibly near-empty grid, at exactly the moment the product should be proving its no-hidden-cheaper-option promise. This reads as broken, not as a feature.
Fix: Relabel the chips around the actual behavior (e.g. "Best at Coles" / "Best at Woolworths") or add a one-line subtitle under the chip group stating the semantic plainly.
Suggested command: `/impeccable clarify`

**[P0] Collapsing a category resets its subcategory selection.**
Why it matters: In `setupCategorySidebar`, the header click handler always calls `onSelect({category: cat, sub: 'All'})`, even when the click is just toggling an already-expanded category closed (not switching categories). A user who drilled into a subcategory loses that refinement the moment they collapse the accordion to scan other categories — a silent data-loss bug that punishes normal browsing behavior.
Fix: Only reset `sub` to `'All'` when the category actually changes; toggling collapse/expand on the *same* category should leave `state.sub` untouched.
Suggested command: `/impeccable harden`

**[P1] Interactive controls don't expose their state to assistive tech.**
Why it matters: The store-filter buttons (`#store-group button[data-store]`) rely on a `.active` CSS class with no `aria-pressed`; the category accordion headers (`.cat-accordion-header` in `shared.js`) rely on `.expanded`/`.selected` classes with no `aria-expanded`/`aria-selected`; and adding to cart updates `#basket-count` with no `aria-live` region. A screen-reader user gets no confirmation which store filter or category is active, or that "Add to cart" succeeded.
Fix: Add `aria-pressed` to the store chips, `aria-expanded`/`aria-selected` to the accordion headers (mirroring the pattern already used correctly on the sort dropdown trigger), and `aria-live="polite"` on the basket count.
Suggested command: `/impeccable audit`

**[P1] Secondary text fails WCAG AA contrast.**
Why it matters: `--subtle` (#8a897e) on the page/surface background computes to ~3.52:1, below the 4.5:1 AA minimum for normal text — and it's used on `.result-count`, `.card-meta`, `.store-name`, and `.only-at`, all under 12px. This isn't one stray label; it's the default color for secondary text across the card.
Fix: Move these selectors to `--muted` (#6e6d63, ~5.21:1, passes AA) or `--body`, reserving `--subtle` for genuinely decorative/tertiary use only.
Suggested command: `/impeccable audit`

**[P2] Twelve of seventeen sidebar categories are empty-state dead ends with no forewarning.**
Why it matters: Only 5 categories in `data.js` have mock products; the rest render straight to "No items here yet." A stress-tester (or any real user exploring the sidebar) hits this repeatedly with zero signal before clicking. In a comp this is expected — but if any of this sidebar list ships toward real data incrementally, the same gap will recur category by category.
Fix: Once real/partial data exists, surface a lightweight signal (item count, or a muted state) on categories with no items yet, sourced from `Object.keys(PRODUCTS)`.
Suggested command: `/impeccable onboard`

## Persona Red Flags

**Alex (Power User):** No search box anywhere on the page — reaching one category out of 17 means accordion-clicking through the sidebar one at a time. The "Coles" chip's cheaper-only semantic will misfire his mental model on first use, and there's no way to verify what happened without inspecting behavior directly.

**Sam (Accessibility-Dependent):** Add-to-cart has no live-region announcement (P1). `.card-meta`/`.only-at`/`.store-name` measurably fail AA contrast (P1). The store-chip semantic gap compounds specifically for Sam: a sighted user can at least see "the grid got smaller," but a screen-reader user filtering by "Coles" gets an unannounced, unexplained shrink in results with no `aria-pressed` state to even confirm the filter took effect.

**Riley (Stress Tester):** Expand "Meat, Poultry & Seafood," pick a subcategory, then click the category header again to collapse it while scanning the sidebar — the subcategory choice silently vanishes (P0). Twelve of seventeen category clicks land on the empty state with no prior signal in the sidebar that they will.

## Minor Observations

- `#result-count` renders an empty string on a zero-result grid instead of "0 items," breaking the otherwise consistent "1 item"/"N items" pattern.
- Header "Groceries," "Meals," and "Help" nav links are dead `#` anchors.
- `.card-name` has `min-height:34px` but no line-clamp/ellipsis handling — long product names are unverified against the fixed-height layout.
- Three hardcoded hex literals bypass the token system (`#9b9a8f` placeholder caption text, `#f4f8f5` best-price tint, `#fff` on `.add-btn`) — low-stakes since they're consistent with the placeholder-imagery convention already established in DESIGN.md, but should still resolve to named tokens for a production pass.
- The detector's 11 font-size advisories are likely not real drift: the same sizes (9.5px–12.5px range) recur consistently across `shared.js`/`tokens.css` for `.sub-chip`, `.dd-trigger`, `.sort-option-row`, etc. — this reads as an intentional sub-ramp the detector's regex fallback can't cross-reference, not isolated one-off sizing.

## Questions to Consider

- What if the store chips were reframed around the actual mental model ("Best deal here" toggle) instead of bare retailer names, removing the mismatch at the source instead of patching it with a caption?
- What if the sidebar surfaced category item-counts (or a quiet "coming soon" tag) so a category never surprises a user with an empty grid?
- What if "Add to cart" triggered a brief inline confirmation in the Ledger's own voice (a stamped line-item, say) instead of just a button-fill swap — turning a P1 accessibility gap into a moment of brand personality?
