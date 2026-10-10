from datetime import date
from typing import Literal
from pydantic import BaseModel, Field

RiskLevel = Literal['low','moderate','high','critical','unavailable']
ScientificStatus = Literal['exploratory','documented','expert_reviewed','validated','deprecated']

class SourceRef(BaseModel):
    source_id: str

class RiskResult(BaseModel):
    schema_version: Literal['1.0'] = '1.0'
    cell_id: str
    valid_date: date
    production_id: str
    indicator_id: str
    hazard: dict
    exposure: dict | None = None
    sensitivity: dict | None = None
    risk: dict
    confidence: dict
    rule: dict
    provenance: list[dict] = Field(min_length=1)
    quality: dict
