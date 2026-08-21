from abc import ABC, abstractmethod
from typing import List, Dict, Any

class ExternalEventProvider(ABC):
    @abstractmethod
    def list_events(self) -> List[Dict[str, Any]]:
        """Return a list of external events available for assessment."""
        pass
