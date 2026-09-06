#!/usr/bin/env python3
"""Cross-retailer product matching: IDF-weighted token-set scoring.

Why this exists: the old name tier in build_api_db.py required *exact* equality
of norm_name(name, size) between two retailers. Measured over the real
master.db that produced ZERO coles<->woolworths links, because Coles omits the
brand from `name` while Woolworths includes it:

    coles       Fresh Full Cream Milk          2000ml
    woolworths  Woolworths Full Cream Milk 2L  2000ml

So the whole compare feature was resting on barcode overlap alone (8,684 pairs,
hard-capped by how many barcodes the two catalogues share).

This module scores candidates instead of demanding equality, and accepts only
MUTUAL best matches -- A's best is B and B's best is A. That guard is what keeps
precision up and, just as importantly, stops union-find chaining: without it a
fuzzy A~B plus B~C fuses unrelated A and C into one blob.

Shared by build_api_db.py (tier 3) and link_llm.py (tier 4 candidate generation).
"""
from __future__ import annotations

import math
import re
from collections import Counter, defaultdict

import canonical as C

# A token in more postings than this ("chicken", "organic") costs a lot to scan
# and discriminates almost nothing. Skipping them is what keeps a full
# both-directions pass at ~4s instead of minutes.
MAX_POSTINGS = 3000
TOP_CANDIDATES = 60          # per source row, by IDF mass, before exact scoring
ACCEPT = 0.5                 # mutual-best Jaccard required to auto-link
BAND_LO = 0.34               # below ACCEPT but plausible -> tier 4 (LLM) band
SIZE_TOL = 0.02              # 2% relative tolerance on parsed size

# Pure measurement tokens ("500g", "2", "6pk") carry no semantic signal -- size is
# handled as a hard filter instead, so drop them from the token set.
_MEASURE = re.compile(r"[\d.]+(g|ml|pk|ea)?$")


def tokens(name: str | None, size: str | None) -> frozenset[str]:
    """Semantic token set for a product name. Reuses canonical.norm_name()."""
    key = C.norm_name(name or "", size or "")
    return frozenset(
        w for w in key.split()
        if len(w) > 1 and not _MEASURE.fullmatch(w)
    )


def prepare(rows: list[dict]) -> None:
    """Attach `tok`, `sv`, `su` to each row in place. Idempotent."""
    for r in rows:
        if "tok" in r:
            continue
        sv, su = C.parse_size(r.get("size"), r.get("name"))
        r["sv"], r["su"] = sv, su
        r["tok"] = tokens(r.get("name"), r.get("size"))


def size_compatible(a: dict, b: dict) -> bool:
    """Hard filter. Unknown size on either side is permissive, not a match."""
    if a["sv"] is None or b["sv"] is None:
        return True
    if a["su"] != b["su"]:
        return False
    return abs(a["sv"] - b["sv"]) <= SIZE_TOL * max(a["sv"], b["sv"])


def _size_known(a: dict, b: dict) -> bool:
    return a["sv"] is not None and b["sv"] is not None


class Index:
    """Inverted token index over one store's rows, with IDF weights."""

    def __init__(self, rows: list[dict]) -> None:
        self.rows = rows
        self.postings: dict[str, list[int]] = defaultdict(list)
        df: Counter[str] = Counter()
        for i, r in enumerate(rows):
            for w in r["tok"]:
                self.postings[w].append(i)
                df[w] += 1
        n = max(len(rows), 1)
        self.idf = {w: math.log(n / (1 + c)) for w, c in df.items()}

    def rank(self, src: dict) -> list[tuple[float, int]]:
        """Scored candidates for `src`, best first. Score is Jaccard, size-adjusted."""
        if not src["tok"]:
            return []
        mass: Counter[int] = Counter()
        for w in src["tok"]:
            posting = self.postings.get(w)
            if not posting or len(posting) > MAX_POSTINGS:
                continue
            weight = self.idf.get(w, 0.0)
            for i in posting:
                mass[i] += weight
        out = []
        for i, _ in mass.most_common(TOP_CANDIDATES):
            dst = self.rows[i]
            if not size_compatible(src, dst):
                continue
            union = src["tok"] | dst["tok"]
            if not union:
                continue
            jaccard = len(src["tok"] & dst["tok"]) / len(union)
            # A confirmed size agreement is real evidence; an unknown size on
            # either side is not, so those score slightly lower and are pushed
            # toward the LLM band rather than auto-accepted.
            out.append((jaccard * (1.0 if _size_known(src, dst) else 0.925), i))
        out.sort(reverse=True)
        return out


def best_map(src_rows: list[dict], dst_rows: list[dict]) -> dict[str, tuple[float, str]]:
    """product_id -> (score, best dst product_id) in one direction."""
    idx = Index(dst_rows)
    out: dict[str, tuple[float, str]] = {}
    for r in src_rows:
        ranked = idx.rank(r)
        if ranked:
            score, i = ranked[0]
            out[r["product_id"]] = (score, dst_rows[i]["product_id"])
    return out


def mutual_pairs(
    a_rows: list[dict],
    b_rows: list[dict],
    accept: float = ACCEPT,
) -> list[tuple[str, str, float]]:
    """Mutual-best-match links between two stores: [(a_id, b_id, score)].

    Both directions are scored and only reciprocal winners survive. This is the
    precision guard -- it discards ~19% of one-way hits at the default
    threshold, and that slice is where the false positives concentrate.
    """
    prepare(a_rows)
    prepare(b_rows)
    a2b = best_map(a_rows, b_rows)
    b2a = best_map(b_rows, a_rows)
    pairs = []
    for a_id, (score, b_id) in a2b.items():
        if score < accept:
            continue
        back = b2a.get(b_id)
        if back and back[1] == a_id:
            pairs.append((a_id, b_id, score))
    return pairs


def ambiguous(
    a_rows: list[dict],
    b_rows: list[dict],
    lo: float = BAND_LO,
    hi: float = ACCEPT,
    top: int = 20,
) -> dict[str, list[tuple[float, str]]]:
    """Rows whose best score lands in the uncertain band -> tier 4 candidates.

    Returns a_id -> up to `top` (score, b_id) candidates for an LLM to adjudicate.
    """
    prepare(a_rows)
    prepare(b_rows)
    idx = Index(b_rows)
    out = {}
    for r in a_rows:
        ranked = idx.rank(r)
        if not ranked:
            continue
        if lo <= ranked[0][0] < hi:
            out[r["product_id"]] = [(s, b_rows[i]["product_id"]) for s, i in ranked[:top]]
    return out
