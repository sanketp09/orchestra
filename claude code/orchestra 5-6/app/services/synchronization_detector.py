"""
Deterministic, non-LLM pattern-matching across PAST bid packages for two collusion
signatures. Neither signal requires a model call — both are simple, explainable
arithmetic over historical bids, which is what makes them trustworthy as evidence.
"""
from __future__ import annotations

from collections import defaultdict
from itertools import combinations

from app.models.bids import Bid, BidLineItem
from app.schemas.bids import SynchronizationSignal

# "Clean" cover-bid multiples to check losing-bid line item prices against, relative to
# the winning bid's price on the same item. Tight tolerance because the whole signature
# is that the ratio looks deliberately round, not coincidentally close.
ROUND_MULTIPLES = [1.05, 1.10, 1.15, 1.20, 1.25]
MULTIPLE_TOLERANCE = 0.005  # within 0.5%

MIN_PACKAGES_FOR_ROTATION = 3
MAX_ROTATING_VENDORS = 4


def _winner_by_package(bids: list[Bid]) -> dict[str, Bid]:
    by_package: dict[str, list[Bid]] = defaultdict(list)
    for b in bids:
        by_package[b.package_id].append(b)
    return {
        package_id: min(pkg_bids, key=lambda b: b.total_price)
        for package_id, pkg_bids in by_package.items()
        if pkg_bids
    }


def _detect_exact_multiple_signals(
    bids: list[Bid],
    line_items: list[BidLineItem],
    winners_by_package: dict[str, Bid],
) -> list[SynchronizationSignal]:
    items_by_bid: dict[str, list[BidLineItem]] = defaultdict(list)
    for li in line_items:
        items_by_bid[li.bid_id].append(li)

    pair_counts: dict[tuple[str, str], int] = defaultdict(int)
    pair_examples: dict[tuple[str, str], str] = {}

    for package_id, winner in winners_by_package.items():
        winner_prices = {li.item_name: li.unit_price for li in items_by_bid.get(winner.id, [])}
        losing_bids = [b for b in bids if b.package_id == package_id and b.id != winner.id]

        for losing_bid in losing_bids:
            for li in items_by_bid.get(losing_bid.id, []):
                winning_price = winner_prices.get(li.item_name)
                if not winning_price:
                    continue

                ratio = li.unit_price / winning_price
                for multiple in ROUND_MULTIPLES:
                    if abs(ratio - multiple) <= MULTIPLE_TOLERANCE:
                        pair = tuple(sorted([winner.vendor_id, losing_bid.vendor_id]))
                        pair_counts[pair] += 1
                        pair_examples[pair] = (
                            f"line item '{li.item_name}' priced at exact {multiple}x "
                            f"the winning bid"
                        )
                        break

    return [
        SynchronizationSignal(
            vendor_a=pair[0],
            vendor_b=pair[1],
            pattern=pair_examples[pair],
            packages_observed=count,
            confidence=min(0.5 + 0.15 * count, 0.95),
        )
        for pair, count in pair_counts.items()
    ]


def _detect_rotating_winners(winners_by_package: dict[str, Bid]) -> list[SynchronizationSignal]:
    ordered = sorted(winners_by_package.items(), key=lambda kv: kv[1].submitted_at)
    if len(ordered) < MIN_PACKAGES_FOR_ROTATION:
        return []

    winner_sequence = [bid.vendor_id for _, bid in ordered]
    distinct_winners = set(winner_sequence)

    # A rotation is suspicious when a small closed set of vendors (2-4) keeps trading the
    # win in close to round-robin order across several packages.
    if not (2 <= len(distinct_winners) <= MAX_ROTATING_VENDORS):
        return []

    no_consecutive_repeat = all(
        winner_sequence[i] != winner_sequence[i + 1] for i in range(len(winner_sequence) - 1)
    )
    wins_per_vendor = {v: winner_sequence.count(v) for v in distinct_winners}
    everyone_wins_repeatedly = all(count >= 2 for count in wins_per_vendor.values())

    if not (no_consecutive_repeat and everyone_wins_repeatedly):
        return []

    return [
        SynchronizationSignal(
            vendor_a=vendor_a,
            vendor_b=vendor_b,
            pattern=f"alternating winner pattern across {len(ordered)} packages",
            packages_observed=len(ordered),
            confidence=0.55,
        )
        for vendor_a, vendor_b in combinations(sorted(distinct_winners), 2)
    ]


def detect_synchronization(
    historical_bids: list[Bid],
    line_items: list[BidLineItem],
) -> list[SynchronizationSignal]:
    winners_by_package = _winner_by_package(historical_bids)
    signals = _detect_exact_multiple_signals(historical_bids, line_items, winners_by_package)
    signals += _detect_rotating_winners(winners_by_package)
    return signals
