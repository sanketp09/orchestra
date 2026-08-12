# Entity model definition matching 03-DATABASE-SCHEMA.md

class Entity:
    def __init__(self, id: str, name: str, entity_type: str, metadata: dict = None):
        self.id = id
        self.name = name
        self.entity_type = entity_type
        self.metadata = metadata or {}
