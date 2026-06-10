"""InfraSure ERP — AI compliance engine (Phase 4).

FastAPI microservice exposing anomaly detection, predictive compliance scoring,
and an OCR stub. The Node GraphQL API calls these endpoints (see apps/api/src/ai.js)
and degrades gracefully if this service is unavailable.
"""
from __future__ import annotations

from typing import Any, Optional

from fastapi import FastAPI
from pydantic import BaseModel

from engine import compliance_score, detect_anomalies, extract_document_fields

app = FastAPI(title="InfraSure AI Engine", version="0.1.0")


class AnomalyRequest(BaseModel):
    records: list[dict[str, Any]] = []


class ScoreRequest(BaseModel):
    metrics: dict[str, float] = {}


class OcrRequest(BaseModel):
    filename: str
    text: Optional[str] = None


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "ai-engine"}


@app.post("/anomalies")
def anomalies(req: AnomalyRequest) -> dict[str, Any]:
    found = detect_anomalies(req.records)
    return {"count": len(found), "anomalies": found}


@app.post("/compliance-score")
def score(req: ScoreRequest) -> dict[str, Any]:
    return compliance_score(req.metrics)


@app.post("/ocr")
def ocr(req: OcrRequest) -> dict[str, Any]:
    return extract_document_fields(req.filename, req.text)
