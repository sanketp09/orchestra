import json
from pathlib import Path
from typing import Dict, List, Optional, Any
from pydantic import BaseModel, Field


class RegistryCapability(BaseModel):
    """
    Richer metadata structure loaded from capabilities.json manifest
    to support plan validation, planner reasoning, and endpoint resolution.
    """
    id: str
    name: str
    description: str
    use_when: List[str] = Field(default_factory=list)
    endpoint: str
    method: str = "POST"
    input_schema: str = "AgentTask"
    payload_schema: dict[str, Any] = Field(default_factory=dict)
    output_schema: str = "AgentResult"
    requires: List[str] = Field(default_factory=list)
    requires_any: List[str] = Field(default_factory=list)
    produces: List[str] = Field(default_factory=list)
    availability: str = "available"
    specialist: str                  # Resolved parent specialist (e.g. "sentinel")
    canonical_endpoint: str          # Resolved canonical execute route (e.g. "/sentinel/execute")


class CapabilityRegistry:
    """
    Registry for loading and querying registered specialist capabilities.
    Loads capabilities from the capabilities.json manifest file.
    """
    def __init__(self, manifest_path: Optional[Path] = None):
        self.capabilities: Dict[str, RegistryCapability] = {}
        self._load_manifest(manifest_path)

    def _load_manifest(self, manifest_path: Optional[Path]):
        if not manifest_path:
            # Resolve default manifest paths relative to this file
            root_dir = Path(__file__).resolve().parent.parent
            possible_paths = [
                root_dir / "specialists" / "capabilities.json",
                root_dir / "capabilities.json"
            ]
            for p in possible_paths:
                if p.exists():
                    manifest_path = p
                    break

        if not manifest_path or not manifest_path.exists():
            raise FileNotFoundError("Could not find the capabilities.json manifest file.")

        with open(manifest_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        for spec in data.get("specialists", []):
            spec_name = spec.get("name")
            spec_availability = spec.get("availability", "available")
            for cap in spec.get("capabilities", []):
                cap_id = cap.get("id")
                if not cap_id:
                    continue

                # The canonical execute route is always /{specialist_name}/execute
                canonical_endpoint = f"/{spec_name}/execute"

                rc = RegistryCapability(
                    id=cap_id,
                    name=cap.get("name", cap_id),
                    description=cap.get("description", ""),
                    use_when=cap.get("use_when", []),
                    endpoint=cap.get("endpoint", ""),
                    method=cap.get("method", "POST"),
                    input_schema=cap.get("input_schema", "AgentTask"),
                    payload_schema=cap.get("payload_schema", {}),
                    output_schema=cap.get("output_schema", "AgentResult"),
                    requires=cap.get("requires", []),
                    requires_any=cap.get("requires_any", []),
                    produces=cap.get("produces", []),
                    availability=cap.get("availability", spec_availability),
                    specialist=spec_name,
                    canonical_endpoint=canonical_endpoint
                )
                self.capabilities[cap_id] = rc

    def get(self, capability_id: str) -> RegistryCapability:
        """
        Retrieves a capability by ID. Raises KeyError if not found.
        """
        if capability_id not in self.capabilities:
            raise KeyError(f"Unknown capability: '{capability_id}' not found in registry.")
        return self.capabilities[capability_id]

    def list_capabilities(self) -> List[RegistryCapability]:
        """
        Lists all registered capabilities.
        """
        return list(self.capabilities.values())
