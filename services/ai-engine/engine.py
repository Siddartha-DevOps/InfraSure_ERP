"""Core AI/heuristic logic for InfraSure ERP (Phase 4).

Kept dependency-free (pure Python) so it is unit-testable without FastAPI and so
the service stays lightweight. The FastAPI layer in ``main.py`` is a thin wrapper.
"""
from __future__ import annotations

from typing import Any


def _median(values: list[float]) -> float:
    s = sorted(values)
    n = len(s)
    mid = n // 2
    return s[mid] if n % 2 else (s[mid - 1] + s[mid]) / 2


def detect_anomalies(records: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Flag anomalous finance records.

    Two signals: statistical amount outliers and overdue-unpaid bills. Outliers use
    a robust MAD-based modified z-score so a single extreme value can't mask itself
    (which a mean/std z-score suffers from on small samples).
    """
    anomalies: list[dict[str, Any]] = []
    amounts = [r["amount"] for r in records if isinstance(r.get("amount"), (int, float))]

    if len(amounts) >= 2:
        median = _median(amounts)
        mad = _median([abs(a - median) for a in amounts])
        for r in records:
            amt = r.get("amount")
            if not isinstance(amt, (int, float)) or mad == 0:
                continue
            # 0.6745 scales MAD to be comparable to a standard deviation.
            mz = 0.6745 * (amt - median) / mad
            if abs(mz) >= 3.5:
                anomalies.append(
                    {
                        "finance_id": r.get("finance_id"),
                        "type": "AMOUNT_OUTLIER",
                        "severity": "HIGH" if abs(mz) >= 7 else "MEDIUM",
                        "detail": f"Amount {amt:.0f} is a robust outlier vs the median ({median:.0f}).",
                    }
                )

    for r in records:
        if r.get("overdue") and not r.get("paid_date"):
            anomalies.append(
                {
                    "finance_id": r.get("finance_id"),
                    "type": "OVERDUE_UNPAID",
                    "severity": "HIGH",
                    "detail": "Invoice is past its due date and still unpaid.",
                }
            )

    return anomalies


# Weighting for the predictive compliance score (must sum to 1.0).
_WEIGHTS = {
    "gst_filing_compliance": 0.2,
    "tds_filing_compliance": 0.15,
    "ra_bill_approval_rate": 0.15,
    "safety_audit_completion": 0.2,
    "pf_esi_filing_rate": 0.15,
    "rera_filing_rate": 0.15,
}


def compliance_score(metrics: dict[str, float]) -> dict[str, Any]:
    """Weighted predictive compliance score (0-100) + risk level + weak factors."""
    score = 0.0
    total_weight = 0.0
    for key, weight in _WEIGHTS.items():
        value = metrics.get(key)
        if value is None:
            continue
        score += float(value) * weight
        total_weight += weight

    normalized = round(score / total_weight, 1) if total_weight else 0.0

    if normalized >= 85:
        risk = "LOW"
    elif normalized >= 60:
        risk = "MEDIUM"
    else:
        risk = "HIGH"

    # Surface the metrics dragging the score down (below 70%).
    factors = sorted(
        (
            {"metric": k, "value": float(metrics[k])}
            for k in _WEIGHTS
            if isinstance(metrics.get(k), (int, float)) and metrics[k] < 70
        ),
        key=lambda f: f["value"],
    )

    return {"score": normalized, "risk_level": risk, "weak_factors": factors}


def extract_document_fields(filename: str, text: str | None = None) -> dict[str, Any]:
    """OCR stub — returns placeholder extracted fields.

    A real implementation would call Tesseract / a cloud OCR API on the file.
    """
    return {
        "filename": filename,
        "engine": "stub",
        "fields": {
            "document_type": "CONTRACT" if "contract" in filename.lower() else "UNKNOWN",
            "detected_dates": [],
            "detected_amounts": [],
        },
        "note": "OCR stub — configure a real OCR backend in Phase 4 hardening.",
    }
