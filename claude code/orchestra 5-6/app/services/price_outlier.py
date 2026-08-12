"""
Deterministic, non-LLM price outlier detection for a single bid package.

For a line item with at least MIN_SAMPLE_FOR_ZSCORE bids, a standard z-score is used.
Below that, a naive IQR-of-quartiles approach is unreliable with so few points (a single
extreme value can inflate the very quartile meant to bound it — with n=5 and quartiles
computed as medians of 2-point halves, an extreme outlier directly drags its own quartile
outward). Instead the small-sample branch uses the modified z-score from Iglewicz & Hoaglin
(1993): 0.6745 * (x - median) / MAD, which stays robust down to very small samples.

The `z_score` field on PriceOutlier is populated with whichever score was computed —
callers don't need to know which branch ran, only whether `flagged` is true.
"""
from __future__ import annotations

import statistics

from app.models.bids import Bid, BidLineItem
from app.schemas.bids import PriceOutlier

Z_THRESHOLD = 2.0
MODIFIED_Z_THRESHOLD = 3.5
MIN_SAMPLE_FOR_ZSCORE = 8


def _standard_z_scores(prices: list[float]) -> list[float]:
    mean = statistics.mean(prices)
    stdev = statistics.pstdev(prices)
    if stdev == 0:
        return [0.0 for _ in prices]
    return [(p - mean) / stdev for p in prices]


def _modified_z_scores(prices: list[float]) -> list[float]:
    median = statistics.median(prices)
    abs_devs = [abs(p - median) for p in prices]
    mad = statistics.median(abs_devs)
    if mad == 0:
        # Most prices are identical; fall back to mean absolute deviation so a single
        # differing price doesn't cause a division by zero.
        mad = statistics.mean(abs_devs) or 1e-9
    return [0.6745 * (p - median) / mad for p in prices]


def detect_price_outliers(bids: list[Bid], line_items: list[BidLineItem]) -> list[PriceOutlier]:
    bid_ids_in_package = {b.id for b in bids}
    relevant_items = [li for li in line_items if li.bid_id in bid_ids_in_package]

    by_item_name: dict[str, list[BidLineItem]] = {}
    for li in relevant_items:
        by_item_name.setdefault(li.item_name, []).append(li)

    results: list[PriceOutlier] = []

    for item_name, items in by_item_name.items():
        if len(items) < 2:
            continue  # nothing to compare against

        prices = [li.unit_price for li in items]
        use_standard_z = len(prices) >= MIN_SAMPLE_FOR_ZSCORE
        scores = _standard_z_scores(prices) if use_standard_z else _modified_z_scores(prices)
        threshold = Z_THRESHOLD if use_standard_z else MODIFIED_Z_THRESHOLD

        for li, score in zip(items, scores):
            results.append(
                PriceOutlier(
                    bid_id=li.bid_id,
                    line_item=item_name,
                    z_score=round(score, 3),
                    flagged=abs(score) > threshold,
                )
            )

    return results
