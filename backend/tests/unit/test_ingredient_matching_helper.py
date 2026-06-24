"""Unit tests for the shared normalised ingredient matcher."""
import pytest

from src.services.ingredient_matching import (
    canonical,
    find_matches,
    is_match,
    token_set,
)


class TestCanonical:
    @pytest.mark.parametrize(
        "name,expected",
        [
            ("Corn Starch", "cornstarch"),
            ("cornstarch", "cornstarch"),
            ("  Whole   Wheat  Flour ", "wholewheatflour"),
            ("Tomatoes", "tomato"),
            ("Potatoes", "potato"),
            ("Berries", "berry"),
            ("Eggs", "egg"),
            ("Dishes", "dish"),  # "shes" -> drop "es"
            ("Boxes", "box"),  # "xes" -> drop "es"
            ("All-Purpose Flour!", "allpurposeflour"),
        ],
    )
    def test_canonical_form(self, name: str, expected: str) -> None:
        assert canonical(name) == expected

    def test_empty_and_punctuation_only(self) -> None:
        assert canonical("") == ""
        assert canonical("   ") == ""
        assert canonical("!!!") == ""


class TestTokenSet:
    def test_singularised_tokens(self) -> None:
        assert token_set("Olive Oils") == {"olive", "oil"}

    def test_short_tokens_untouched(self) -> None:
        # "is" is <= 3 chars, so singularisation leaves it alone.
        assert "is" in token_set("this is")


class TestIsMatch:
    @pytest.mark.parametrize(
        "a,b",
        [
            ("Corn Starch", "cornstarch"),  # spacing
            ("Tomatoes", "tomato"),  # plural
            ("FLOUR", "flour"),  # case
            ("oil", "olive oil"),  # token subset (generic ⊆ specific)
            ("whole wheat flour", "wheat flour"),  # token subset (specific ⊇ generic)
            ("yoghurt", "yoghurt"),  # identical
        ],
    )
    def test_matches(self, a: str, b: str) -> None:
        assert is_match(a, b) is True
        assert is_match(b, a) is True  # symmetric

    @pytest.mark.parametrize(
        "a,b",
        [
            ("corn", "cornstarch"),  # the documented false-positive to avoid
            ("salt", "pepper"),
            ("flour", "water"),
            ("milk", "silk"),  # ratio below threshold
        ],
    )
    def test_non_matches(self, a: str, b: str) -> None:
        assert is_match(a, b) is False

    def test_empty_never_matches(self) -> None:
        assert is_match("", "flour") is False
        assert is_match("flour", "   ") is False

    def test_ratio_tier_catches_minor_typo(self) -> None:
        # Near-identical canonical strings clear the 0.9 ratio threshold.
        assert is_match("parmesan", "parmesann") is True


class TestFindMatches:
    def test_prefers_exact_canonical_tier_over_subset(self) -> None:
        candidates = ["Flour", "Whole Wheat Flour"]
        # "flour" is an exact canonical hit for "Flour" only; the subset match
        # ("Whole Wheat Flour") must not dilute the confident exact tier.
        assert find_matches("flour", candidates) == ["Flour"]

    def test_falls_back_to_subset_tier(self) -> None:
        candidates = ["Whole Wheat Flour", "Sugar"]
        assert find_matches("wheat flour", candidates) == ["Whole Wheat Flour"]

    def test_falls_back_to_ratio_tier(self) -> None:
        assert find_matches("parmesann", ["Parmesan", "Sugar"]) == ["Parmesan"]

    def test_no_match_returns_empty(self) -> None:
        assert find_matches("saffron", ["Flour", "Sugar"]) == []

    def test_blank_query_returns_empty(self) -> None:
        assert find_matches("   ", ["Flour"]) == []

    def test_key_accessor_for_objects(self) -> None:
        items = [{"name": "Corn Starch"}, {"name": "Sugar"}]
        assert find_matches("cornstarch", items, key=lambda i: i["name"]) == [
            {"name": "Corn Starch"}
        ]
