"""Query understanding for `GET /products?q=...`.

The old behaviour was a strict FTS5 prefix AND: every token had to match the
product name, so "1kg protein powder" returned nothing -- "1kg" is not a word in
"Whey Protein Powder Vanilla", it is that product's *size*. This module turns a
free-text query into three separate things:

  * size constraints  -- "1kg", "500 g", "2L" matched against products.size_value
                         / size_unit instead of the name text
  * text terms        -- matched through the existing FTS5 index
  * a fallback ladder -- strict AND, then AND without the size filter, then OR,
                         then OR over spell-corrected / de-pluralised terms

The first rung of the ladder that matches anything wins, so precision is kept
when the query is clean and recall is gained only when it is needed.

Everything expensive is precomputed: the search vocabulary used for typo
correction is built by scraper/tui/build_api_db.py into the `search_vocab`
table. If that table is missing (an older basketwise.db) the vocabulary is
derived once at startup from product names and held in memory -- never per
request.

User input never reaches FTS5 as syntax: every term is stripped to
alphanumerics and wrapped in double quotes, so operators like NEAR, OR, ^, -
and " are inert.
"""
from __future__ import annotations

import re
import sqlite3
from dataclasses import dataclass, field

# Canonical units used by the catalogue are g / ml / pk / ea (Source-of-truth
# §2.1). Everything a shopper might type maps onto one of those.
_UNIT_ALIASES: dict[str, tuple[float, str]] = {
    "mg": (0.001, "g"), "g": (1.0, "g"), "gr": (1.0, "g"), "gm": (1.0, "g"),
    "gms": (1.0, "g"), "gram": (1.0, "g"), "grams": (1.0, "g"),
    "kg": (1000.0, "g"), "kgs": (1000.0, "g"), "kilo": (1000.0, "g"),
    "kilos": (1000.0, "g"), "kilogram": (1000.0, "g"), "kilograms": (1000.0, "g"),
    "ml": (1.0, "ml"), "mls": (1.0, "ml"), "millilitre": (1.0, "ml"),
    "millilitres": (1.0, "ml"), "cc": (1.0, "ml"),
    "l": (1000.0, "ml"), "lt": (1000.0, "ml"), "ltr": (1000.0, "ml"),
    "litre": (1000.0, "ml"), "litres": (1000.0, "ml"),
    "liter": (1000.0, "ml"), "liters": (1000.0, "ml"),
    "pk": (1.0, "pk"), "pack": (1.0, "pk"), "packs": (1.0, "pk"),
    "pce": (1.0, "pk"), "pcs": (1.0, "pk"), "piece": (1.0, "pk"),
    "pieces": (1.0, "pk"), "ct": (1.0, "pk"), "count": (1.0, "pk"),
    "ea": (1.0, "ea"), "each": (1.0, "ea"),
}

# "1kg", "500g", "2.5 L" -- the number and unit fused into one token.
_FUSED_SIZE = re.compile(r"^(\d+(?:\.\d+)?)(" + "|".join(sorted(_UNIT_ALIASES, key=len, reverse=True)) + r")$")
_NUMBER = re.compile(r"^\d+(?:\.\d+)?$")
# Split on anything that is not a letter, digit or decimal point. This keeps
# "1kg" and "2.5l" whole while discarding every FTS5 operator character.
_SPLIT = re.compile(r"[^a-z0-9.]+")

# Sizes are matched with a small relative tolerance: retailers round "1.5L" and
# "1500ml" differently, and unit conversion introduces float dust.
SIZE_TOLERANCE = 0.02

# A term shorter than this is not worth spell-correcting -- the edit-distance
# neighbourhood of a 3-letter word is the whole dictionary.
_MIN_FUZZY_LEN = 4
_MAX_FUZZY_CANDIDATES = 60
# A term used by this few products is treated as possibly a typo even though it
# technically exists, but only a candidate this many times commoner can override it.
_RARE_DF = 12
_RARE_DOMINANCE = 20


@dataclass
class Query:
    """A parsed `q`: what to match on text, and what to match on size."""

    terms: list[str] = field(default_factory=list)
    sizes: list[tuple[float, str]] = field(default_factory=list)
    raw: str = ""

    def __bool__(self) -> bool:
        return bool(self.terms or self.sizes)


def parse(q: str) -> Query:
    """Split a raw query into text terms and normalised size constraints."""
    tokens = [t for t in _SPLIT.split(q.lower()) if t and t != "."]
    terms: list[str] = []
    sizes: list[tuple[float, str]] = []

    i = 0
    while i < len(tokens):
        tok = tokens[i].strip(".")
        if not tok:
            i += 1
            continue

        if (m := _FUSED_SIZE.match(tok)) is not None:
            sizes.append(_normalise_size(float(m.group(1)), m.group(2)))
            i += 1
            continue

        # "1 kg" / "500 g" -- number and unit as separate tokens.
        if _NUMBER.match(tok) and i + 1 < len(tokens):
            nxt = tokens[i + 1].strip(".")
            if nxt in _UNIT_ALIASES:
                sizes.append(_normalise_size(float(tok), nxt))
                i += 2
                continue

        # A bare number ("2" in "2 milk") is noise, not a term worth matching.
        if not _NUMBER.match(tok):
            terms.append(tok)
        i += 1

    return Query(terms=terms, sizes=sizes, raw=q.strip().lower())


def _normalise_size(value: float, unit: str) -> tuple[float, str]:
    factor, canonical = _UNIT_ALIASES[unit]
    return round(value * factor, 4), canonical


def fts_expr(terms: list[str], conjunction: str) -> str:
    """A safe FTS5 MATCH expression.

    Each term is reduced to alphanumerics and double-quoted, so nothing the user
    types can be read as FTS5 syntax. `conjunction` is 'AND' or 'OR' and is
    supplied by this module, never by the caller's input.
    """
    safe = [re.sub(r"[^a-z0-9]", "", t) for t in terms]
    return f" {conjunction} ".join(f'"{t}"*' for t in safe if t)


# --------------------------------------------------------------------------
# Vocabulary: precomputed spell-correction dictionary
# --------------------------------------------------------------------------

_TERM_RE = re.compile(r"[a-z0-9]+")

_vocab: dict[str, int] = {}          # term -> document frequency
_trigrams: dict[str, list[str]] = {}  # trigram -> terms containing it


def load_vocab(conn: sqlite3.Connection) -> int:
    """Load the typo-correction vocabulary. Called once, at API startup.

    Prefers the `search_vocab` table written by build_api_db.py. Falls back to
    scanning product names when serving an older database, so an un-rebuilt
    basketwise.db still gets fuzzy search.
    """
    _vocab.clear()
    _trigrams.clear()

    try:
        rows = conn.execute("SELECT term, df FROM search_vocab").fetchall()
        for r in rows:
            _vocab[r[0]] = r[1]
    except sqlite3.OperationalError:
        for r in conn.execute("SELECT name, brand FROM products"):
            for word in _TERM_RE.findall(f"{r[0] or ''} {r[1] or ''}".lower()):
                if len(word) >= 3:
                    _vocab[word] = _vocab.get(word, 0) + 1

    for term in _vocab:
        for tri in _term_trigrams(term):
            _trigrams.setdefault(tri, []).append(term)
    return len(_vocab)


def _term_trigrams(term: str) -> set[str]:
    padded = f"  {term} "
    return {padded[i:i + 3] for i in range(len(padded) - 2)}


def _edit_distance(a: str, b: str, cutoff: int) -> int:
    """Damerau-Levenshtein distance, abandoned once it provably exceeds `cutoff`.

    Transposition counts as one edit, not two. That matters more than it sounds:
    swapped adjacent letters are the most common typing slip, and under plain
    Levenshtein "mlik" is two edits from "milk" but only one from "mik" -- so the
    obvious correction loses to a rarer word.
    """
    if abs(len(a) - len(b)) > cutoff:
        return cutoff + 1
    prev2: list[int] | None = None
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        cur = [i]
        for j, cb in enumerate(b, 1):
            d = min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (ca != cb))
            if i > 1 and j > 1 and ca == b[j - 2] and a[i - 2] == cb:
                d = min(d, prev2[j - 2] + 1)
            cur.append(d)
        if min(cur) > cutoff:
            return cutoff + 1
        prev2, prev = prev, cur
    return prev[-1]


def variants(term: str) -> list[str]:
    """Plural/singular forms of a term that exist in the catalogue vocabulary.

    The FTS index is stemmed, but prefix queries ("apple"*) bypass stemming, so
    plural handling has to be explicit.
    """
    out: list[str] = []
    forms = [term]
    if term.endswith("ies") and len(term) > 4:
        forms.append(term[:-3] + "y")
    if term.endswith("es") and len(term) > 3:
        forms.append(term[:-2])
    if term.endswith("s") and len(term) > 3:
        forms.append(term[:-1])
    else:
        forms += [term + "s", term + "es"]
    for f in forms:
        if f != term and f in _vocab and f not in out:
            out.append(f)
    return out


def correct(term: str) -> str | None:
    """Nearest catalogue term to a misspelling, or None if nothing is close.

    Trigram overlap narrows the dictionary to a few dozen candidates; edit
    distance then picks among those. Both steps are pure in-memory work on a
    precomputed index, so this stays well under a millisecond.

    A term that is in the vocabulary is normally left alone, but "in the
    vocabulary" is a weak signal: one obscure product called "Pot au Chocolat"
    puts "chocolat" in the dictionary and would otherwise block the correction
    to "chocolate". So a term used by only a handful of products is still
    offered a correction, and only when the candidate is far more common
    (_RARE_DOMINANCE x) -- the correction is added alongside the original
    spelling, never instead of it.
    """
    if len(term) < _MIN_FUZZY_LEN:
        return None
    df = _vocab.get(term, 0)
    if df > _RARE_DF:
        return None

    counts: dict[str, int] = {}
    for tri in _term_trigrams(term):
        for cand in _trigrams.get(tri, ()):
            counts[cand] = counts.get(cand, 0) + 1
    if not counts:
        return None

    ranked = sorted(counts.items(), key=lambda kv: -kv[1])[:_MAX_FUZZY_CANDIDATES]
    cutoff = 1 if len(term) <= 5 else 2
    floor = df * _RARE_DOMINANCE   # 0 for an unknown term: any candidate beats it
    best: tuple[int, int, str] | None = None
    for cand, _overlap in ranked:
        if cand == term or _vocab.get(cand, 0) <= floor:
            continue
        d = _edit_distance(term, cand, cutoff)
        if d > cutoff:
            continue
        # Closest first; ties broken by how common the word is in the catalogue.
        key = (d, -_vocab.get(cand, 0), cand)
        if best is None or key < best:
            best = key
    return best[2] if best else None


def expand(terms: list[str]) -> list[list[str]]:
    """For each term, the alternatives worth trying: itself, plurals, a typo fix."""
    out = []
    for t in terms:
        alts = [t] + variants(t)
        if (fix := correct(t)) is not None:
            alts.append(fix)
            alts += [v for v in variants(fix) if v not in alts]
        out.append(alts)
    return out


# --------------------------------------------------------------------------
# Planning: turn a parsed query into SQL
# --------------------------------------------------------------------------

@dataclass
class Plan:
    """SQL fragments for one search, plus the total number of matches."""

    join: str = ""
    join_params: list = field(default_factory=list)
    where: list[str] = field(default_factory=list)
    where_params: list = field(default_factory=list)
    order: str = "p.retailer_count DESC, p.id"
    order_params: list = field(default_factory=list)
    total: int = 0


def _size_clause(size: tuple[float, str]) -> tuple[str, list]:
    value, unit = size
    # Relative tolerance with an absolute floor, so "1kg" still finds a 1005g
    # pack and "6pk" is not defeated by a stray .0.
    tol = max(value * SIZE_TOLERANCE, 0.5)
    return "(p.size_unit = ? AND ABS(p.size_value - ?) <= ?)", [unit, value, tol]


def canonical_terms(groups: list[list[str]]) -> list[str]:
    """The best-known spelling of each term: the alternative the catalogue uses most.

    "organik" -> "organic", "yoghurts" -> "yoghurt". Used for ranking only; the
    matching itself still accepts every alternative.
    """
    out = []
    for alts in groups:
        known = [a for a in alts if a in _vocab]
        out.append(max(known, key=lambda a: _vocab[a]) if known else alts[0])
    return out


def _order_sql(parsed: Query, groups: list[list[str]], scored: bool) -> tuple[str, list]:
    """Rank tiers, best first:

      1. the name IS the query
      2. the product is the requested size
      3. the name STARTS WITH the query
      4. how many query terms the name/brand contains, most first
      5. how many retailers stock it -- the sort search has always used
      6. FTS relevance, as the final tie-break

    Tier 4 is what makes the OR fallback a best-match rather than an any-match:
    a product hitting both words of "protein powder" outranks one hitting only
    the commoner word. Tiers 1 and 3 are tried against both what the user typed and its corrected
    spelling, so a typo'd query still gets exact-match ranking. The trailing
    `p.retailer_count DESC, p.id` keeps the sort total and deterministic, so the
    pagination contract is unchanged.
    """
    parts, params = [], []
    phrases = []
    if parsed.terms:
        for phrase in (" ".join(parsed.terms), " ".join(canonical_terms(groups))):
            if phrase and phrase not in phrases:
                phrases.append(phrase)

    if phrases:
        parts.append("CASE WHEN " + " OR ".join("LOWER(p.name) = ?" for _ in phrases)
                     + " THEN 0 ELSE 1 END")
        params += phrases

    if parsed.sizes:
        clause, size_params = _size_clause(parsed.sizes[0])
        parts.append(f"CASE WHEN {clause} THEN 0 ELSE 1 END")
        params += size_params

    if phrases:
        parts.append("CASE WHEN "
                     + " OR ".join("LOWER(p.name) LIKE ? ESCAPE '\\'" for _ in phrases)
                     + " THEN 0 ELSE 1 END")
        params += [_like_prefix(x) for x in phrases]

        # How many query terms the product actually hits, most first. On the OR
        # rung this is what stops a product matching one common word ("Baking
        # Powder" for "protein powder") outranking one that matches both.
        # Brand is included: people type "Bega cheese", and brand lives in the
        # FTS text but not in p.name.
        terms = canonical_terms(groups)
        haystack = "LOWER(p.name || ' ' || COALESCE(p.brand, ''))"
        parts.append("(" + " + ".join(
            f"CASE WHEN {haystack} LIKE ? ESCAPE '\\' THEN 1 ELSE 0 END" for _ in terms)
            + ") DESC")
        params += [_like_contains(t) for t in terms]

    parts.append("p.retailer_count DESC")
    if scored:
        parts.append("f.bm")          # FTS5 bm25: more negative is more relevant
    parts.append("p.id")
    return ", ".join(parts), params


def _like_escape(s: str) -> str:
    return s.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def _like_prefix(s: str) -> str:
    return _like_escape(s) + "%"


def _like_contains(s: str) -> str:
    return "%" + _like_escape(s) + "%"


def _rungs(parsed: Query, groups: list[list[str]]) -> list[tuple[str | None, bool]]:
    """The fallback ladder, most precise first: (MATCH expression, filter on size)."""
    # Every term must match, but each may match any of its plural/typo variants.
    strict = " AND ".join(
        f"({fts_expr(alts, 'OR')})" for alts in groups if fts_expr(alts, "OR"))
    loose = fts_expr([a for alts in groups for a in alts], "OR")

    ladder: list[tuple[str | None, bool]] = []
    if strict:
        if parsed.sizes:
            ladder.append((strict, True))
        ladder.append((strict, False))
    if loose and loose != strict:
        if parsed.sizes:
            ladder.append((loose, True))
        ladder.append((loose, False))
    if not ladder and parsed.sizes:
        ladder.append((None, True))   # size-only query, e.g. "2L"
    return ladder


def plan(conn: sqlite3.Connection, parsed: Query, base_where: list[str],
         base_params: list) -> Plan | None:
    """Walk the fallback ladder and return the first rung that matches anything.

    Returns None when the query cannot match at all -- the caller should answer
    with an empty list. Each rung costs one COUNT; a clean query stops at the
    first, so the common case is a single extra query.
    """
    groups = expand(parsed.terms)
    for match, use_size in _rungs(parsed, groups):
        where = list(base_where)
        where_params = list(base_params)
        join, join_params = "", []

        if match is not None:
            join = (" JOIN (SELECT id, bm25(products_fts) AS bm FROM products_fts "
                    "WHERE products_fts MATCH ?) f ON f.id = p.id")
            join_params = [match]
        if use_size:
            clause, size_params = _size_clause(parsed.sizes[0])
            where.append(clause)
            where_params += size_params

        clause_sql = (" WHERE " + " AND ".join(where)) if where else ""
        total = conn.execute(
            f"SELECT COUNT(*) FROM products p{join}{clause_sql}",
            (*join_params, *where_params)).fetchone()[0]
        if total:
            order, order_params = _order_sql(parsed, groups, scored=match is not None)
            return Plan(join, join_params, where, where_params, order, order_params, total)
    return None
