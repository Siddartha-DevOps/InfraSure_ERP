"""Dependency-free tests for the AI engine logic (run: python test_engine.py)."""
from engine import compliance_score, detect_anomalies, extract_document_fields


def test_amount_outlier_detected():
    records = [
        {"finance_id": "a", "amount": 1000},
        {"finance_id": "b", "amount": 1100},
        {"finance_id": "c", "amount": 900},
        {"finance_id": "d", "amount": 50000},  # outlier
    ]
    anomalies = detect_anomalies(records)
    types = {a["type"] for a in anomalies}
    assert "AMOUNT_OUTLIER" in types, anomalies
    assert any(a["finance_id"] == "d" for a in anomalies), anomalies


def test_overdue_unpaid_flagged():
    records = [{"finance_id": "x", "amount": 100, "overdue": True, "paid_date": None}]
    anomalies = detect_anomalies(records)
    assert any(a["type"] == "OVERDUE_UNPAID" for a in anomalies), anomalies


def test_compliance_score_levels():
    high = compliance_score(
        {
            "gst_filing_compliance": 100,
            "tds_filing_compliance": 100,
            "ra_bill_approval_rate": 100,
            "safety_audit_completion": 100,
            "pf_esi_filing_rate": 100,
            "rera_filing_rate": 100,
        }
    )
    assert high["score"] == 100 and high["risk_level"] == "LOW", high

    low = compliance_score(
        {
            "gst_filing_compliance": 10,
            "tds_filing_compliance": 20,
            "ra_bill_approval_rate": 0,
            "safety_audit_completion": 30,
            "pf_esi_filing_rate": 10,
            "rera_filing_rate": 0,
        }
    )
    assert low["risk_level"] == "HIGH", low
    assert len(low["weak_factors"]) == 6, low


def test_ocr_stub():
    out = extract_document_fields("Highway-Contract.pdf")
    assert out["fields"]["document_type"] == "CONTRACT", out


if __name__ == "__main__":
    test_amount_outlier_detected()
    test_overdue_unpaid_flagged()
    test_compliance_score_levels()
    test_ocr_stub()
    print("✅ all AI engine tests passed")
