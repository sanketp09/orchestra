import os
import json
import requests
from typing import Any, Dict
from dotenv import load_dotenv

class GrokClient:
    def __init__(self):
        # Load .env to ensure variables are present
        import pathlib
        env_path = pathlib.Path(__file__).resolve().parents[1] / ".env"
        load_dotenv(dotenv_path=env_path)
        
        self.api_key = os.getenv("XAI_API_KEY")
        if not self.api_key:
            raise ValueError("XAI_API_KEY must be set in .env")
        
        # Check key prefix: 'gsk_' is for Groq, 'xai-' is for x.ai (Grok)
        if self.api_key.startswith("gsk_"):
            self.endpoint = "https://api.groq.com/openai/v1/chat/completions"
            self.model = "groq/compound-mini"
        else:
            self.endpoint = "https://api.x.ai/v1/chat/completions"
            # Use 'grok-2' as default stable model for x.ai (grok-beta is deprecated)
            self.model = "grok-2"

        self.headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

    def _post(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        response = requests.post(self.endpoint, headers=self.headers, json=payload, timeout=30)
        response.raise_for_status()
        return response.json()

    def chat(self, messages: list, response_schema: Dict[str, Any] = None) -> Dict[str, Any]:
        """Send a chat request to the LLM.
        If response_schema is provided, we request structured JSON output.
        """
        payload = {
            "model": self.model,
            "messages": messages,
            "temperature": 0.0,
        }
        if response_schema:
            # Set JSON mode format correctly (supported by both Groq and x.ai)
            payload["response_format"] = {"type": "json_object"}
        
        result = self._post(payload)
        content = result.get("choices", [{}])[0].get("message", {}).get("content", "")
        
        if response_schema:
            try:
                return json.loads(content)
            except json.JSONDecodeError:
                # Return raw content for fallback handling
                return {"_raw": content}
        return {"content": content}

    def reason(self, system_prompt: str, user_prompt: str, response_schema: Dict[str, Any] = None) -> Dict[str, Any]:
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ]
        return self.chat(messages, response_schema)

