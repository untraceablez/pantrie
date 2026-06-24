"""Normalized ingredient ↔ inventory name matching.

Shared by recipe makeability, client availability checks, and shopping-list
dedup so that all three agree on when two free-text ingredient names refer to
the same thing. Matching is tiered, highest-confidence first:

1. **Canonical equality** — lowercase, punctuation/whitespace stripped, simple
   plurals singularised, then joined without spaces. This makes spacing-only
   variants match (``"Corn Starch"`` == ``"cornstarch"``) and common plurals
   collapse (``"Tomatoes"`` == ``"tomato"``).
2. **Token subset** — every token of one name is a token of the other
   (``{oil} ⊆ {olive, oil}``), so a more specific inventory item satisfies a
   generic ingredient and vice-versa.
3. **Sequence ratio** — a high-threshold ``difflib`` ratio as a last resort for
   minor typos.

The tiers are intentionally conservative: ``"corn"`` does NOT match
``"cornstarch"`` (different single tokens, canonical strings differ, ratio
below threshold), which would be an undesirable false-positive.
"""
from __future__ import annotations

import re
from difflib import SequenceMatcher
from typing import Callable, Sequence, TypeVar

T = TypeVar("T")

# Punctuation becomes a separator; runs of whitespace collapse to one space.
_PUNCT_RE = re.compile(r"[^\w\s]")
_WS_RE = re.compile(r"\s+")

# Ratio tier threshold. High on purpose — it only catches near-identical typos,
# not loosely related words (e.g. "corn"/"cornstarch" scores ~0.57).
RATIO_THRESHOLD = 0.9


def _singularize(token: str) -> str:
    """Crudely singularise a single lowercase token (heuristic, not exhaustive).

    Applied identically to both sides of a comparison, so even an over-eager
    transformation still lets equivalent names match.
    """
    if len(token) <= 3:
        return token
    if token.endswith("ies"):
        return token[:-3] + "y"  # berries -> berry
    if token.endswith("oes"):
        return token[:-2]  # tomatoes -> tomato, potatoes -> potato
    if token.endswith(("ses", "xes", "zes", "ches", "shes")):
        return token[:-2]  # boxes -> box, dishes -> dish
    if token.endswith("s") and not token.endswith("ss"):
        return token[:-1]  # eggs -> egg (but not "glass")
    return token


def _clean_tokens(name: str) -> list[str]:
    cleaned = _PUNCT_RE.sub(" ", name.strip().lower())
    cleaned = _WS_RE.sub(" ", cleaned).strip()
    return [_singularize(tok) for tok in cleaned.split() if tok]


def token_set(name: str) -> frozenset[str]:
    """Singularised, normalised set of tokens in ``name``."""
    return frozenset(_clean_tokens(name))


def canonical(name: str) -> str:
    """Singularised tokens joined without spaces (spacing-insensitive key)."""
    return "".join(_clean_tokens(name))


def _ratio(a: str, b: str) -> float:
    return SequenceMatcher(None, a, b).ratio()


def is_match(a: str, b: str) -> bool:
    """Whether two free-text ingredient names refer to the same thing."""
    ca, cb = canonical(a), canonical(b)
    if not ca or not cb:
        return False
    if ca == cb:
        return True
    ta, tb = token_set(a), token_set(b)
    if ta and tb and (ta <= tb or tb <= ta):
        return True
    return _ratio(ca, cb) >= RATIO_THRESHOLD


def find_matches(
    query: str, candidates: Sequence[T], key: Callable[[T], str] = str
) -> list[T]:
    """Return the candidates that match ``query`` from the best non-empty tier.

    Exact canonical matches win outright; only if there are none do token-subset
    matches apply, and only then the ratio tier. Keeping tiers separate avoids
    diluting a confident exact hit with looser ones (which would otherwise make
    the result spuriously ambiguous).
    """
    cq = canonical(query)
    if not cq:
        return []
    tq = token_set(query)

    exact = [c for c in candidates if canonical(key(c)) == cq]
    if exact:
        return exact

    subset = [
        c
        for c in candidates
        if (tc := token_set(key(c))) and tq and (tq <= tc or tc <= tq)
    ]
    if subset:
        return subset

    return [c for c in candidates if _ratio(cq, canonical(key(c))) >= RATIO_THRESHOLD]
