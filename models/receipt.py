# Receipt model definition matching 03-DATABASE-SCHEMA.md

class Receipt:
    def __init__(self, id: str, decision_id: str, confidence: float, reasoning: str, evidence_ids: list):
        self.id = id
        self.decision_id = decision_id
        self.confidence = confidence
        self.reasoning = reasoning
        self.evidence_ids = evidence_ids
