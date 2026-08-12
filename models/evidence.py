# Evidence model definition matching 03-DATABASE-SCHEMA.md

class Evidence:
    def __init__(self, id: str, source: str, reliability_tier: str, content: str, entity_id: str = None):
        self.id = id
        self.source = source
        self.reliability_tier = reliability_tier
        self.content = content
        self.entity_id = entity_id
