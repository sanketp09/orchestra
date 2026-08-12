# Decision model definition matching 03-DATABASE-SCHEMA.md

class Decision:
    def __init__(self, id: str, title: str, category: str, value: float = None, previous_value: float = None):
        self.id = id
        self.title = title
        self.category = category
        self.value = value
        self.previous_value = previous_value
