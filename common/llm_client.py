import os
import json
import asyncio
import copy
from datetime import datetime, timezone
from typing import Optional, Literal, Dict, Any, List
from concurrent.futures import ThreadPoolExecutor

from pydantic import BaseModel, ValidationError
from openai import (
    AsyncOpenAI,
    APIConnectionError,
    APITimeoutError,
    APIStatusError,
    RateLimitError
)


def run_async(coro):
    """
    Safely runs an async coroutine synchronously, even when inside a running
    event loop (such as FastAPI). Spawns a separate thread to run the loop.
    """
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        loop = None

    if loop and loop.is_running():
        with ThreadPoolExecutor(max_workers=1) as executor:
            future = executor.submit(asyncio.run, coro)
            return future.result()
    else:
        return asyncio.run(coro)


def clean_json_schema_for_openai(schema: dict) -> dict:
    """
    Recursively formats a JSON schema dict to comply with OpenAI strict schema rules:
    - Sets additionalProperties to False.
    - Lists all properties in the required array.
    - Removes disallowed keywords like 'default', '$schema', '$id', 'title'.
    """
    s = copy.deepcopy(schema)
    
    # Strip root-level metadata keys OpenAI rejects
    for key in ["$schema", "$id", "title"]:
        s.pop(key, None)
        
    def walk(node):
        if not isinstance(node, dict):
            return
        
        # If it is an object definition
        if node.get("type") == "object" or "properties" in node:
            node["type"] = "object"
            node["additionalProperties"] = False
            
            # Remove defaults and make all properties required
            if "properties" in node and node["properties"]:
                node["required"] = list(node["properties"].keys())
                for prop_name, prop_val in node["properties"].items():
                    if isinstance(prop_val, dict):
                        prop_val.pop("default", None)
                        # Walk nested property definition
                        walk(prop_val)
                        
        # Recurse through all values
        for k, v in list(node.items()):
            if isinstance(v, dict):
                walk(v)
            elif isinstance(v, list):
                for item in v:
                    walk(item)
                    
    walk(s)
    return s


class UnifiedLLMClient:
    """
    Unified LLM Wrapper supporting OpenAI as the sole active runtime provider.
    Other provider selections are ignored.
    """
    def __init__(self):
        self.openai_key = os.environ.get("OPENAI_API_KEY")
        self.openai_model = os.environ.get("OPENAI_MODEL", "gpt-5-mini")
        
        # Read timeout and retry configuration
        try:
            self.timeout = float(os.environ.get("LLM_TIMEOUT_SECONDS", "30.0"))
        except ValueError:
            self.timeout = 30.0
            
        try:
            self.max_retries = int(os.environ.get("LLM_MAX_RETRIES", "2"))
        except ValueError:
            self.max_retries = 2

        # Initialize AsyncOpenAI client
        # Do not fail on initialization if key is missing (mocking tests),
        # fail explicitly only when a request is made.
        self.client = AsyncOpenAI(api_key=self.openai_key or "missing_key")

    def _ensure_api_key(self):
        if not self.openai_key:
            raise ValueError("OPENAI_API_KEY environment variable is missing. Please configure it in your environment or .env file.")

    async def generate_async(
        self,
        prompt: str,
        system_instruction: Optional[str] = None,
        temperature: float = 0.2
    ) -> str:
        self._ensure_api_key()
        
        messages = []
        if system_instruction:
            messages.append({"role": "system", "content": system_instruction})
        messages.append({"role": "user", "content": prompt})

        # OpenAI reasoning models (gpt-5, o1, etc.) do not support temperature parameters
        kwargs = {}
        if "gpt-5" not in self.openai_model.lower() and not self.openai_model.lower().startswith("o1"):
            kwargs["temperature"] = temperature

        retries = 0
        while True:
            try:
                response = await self.client.chat.completions.create(
                    model=self.openai_model,
                    messages=messages,
                    timeout=self.timeout,
                    **kwargs
                )
                return response.choices[0].message.content or ""
            except (APIConnectionError, APITimeoutError, RateLimitError) as e:
                if retries < self.max_retries:
                    retries += 1
                    continue
                raise
            except APIStatusError as e:
                # Retry only on transient 5xx server errors
                if e.status_code >= 500:
                    if retries < self.max_retries:
                        retries += 1
                        continue
                raise


    def generate(
        self,
        prompt: str,
        system_instruction: Optional[str] = None,
        provider: str = "openai",
        temperature: float = 0.2
    ) -> str:
        """
        Synchronous wrapper calling the async generator.
        """
        return run_async(self.generate_async(prompt, system_instruction, temperature))

    async def generate_structured_async(
        self,
        prompt: str,
        schema: Any,
        model: Optional[str] = None
    ) -> Dict[str, Any]:
        self._ensure_api_key()
        
        model_name = model or self.openai_model
        
        # Convert Pydantic class to schema dict if passed directly
        if hasattr(schema, "model_json_schema"):
            schema_dict = schema.model_json_schema()
        elif hasattr(schema, "schema"):
            schema_dict = schema.schema()
        else:
            schema_dict = schema

        cleaned_schema = clean_json_schema_for_openai(schema_dict)

        retries = 0
        while True:
            try:
                response = await self.client.chat.completions.create(
                    model=model_name,
                    messages=[{"role": "user", "content": prompt}],
                    response_format={
                        "type": "json_schema",
                        "json_schema": {
                            "name": "StructuredResponse",
                            "schema": cleaned_schema,
                            "strict": True
                        }
                    },
                    timeout=self.timeout
                )
                content = response.choices[0].message.content or "{}"
                return json.loads(content)
                    
            except (APIConnectionError, APITimeoutError, RateLimitError) as e:
                if retries < self.max_retries:
                    retries += 1
                    continue
                raise
            except APIStatusError as e:
                if e.status_code >= 500:
                    if retries < self.max_retries:
                        retries += 1
                        continue
                raise

    def generate_structured(
        self,
        prompt: str,
        schema: Any,
        provider: str = "openai",
        model: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Synchronous wrapper calling the async structured generator.
        """
        return run_async(self.generate_structured_async(prompt, schema, model))


_llm_client_instance = None

def get_llm_client() -> UnifiedLLMClient:
    global _llm_client_instance
    if _llm_client_instance is None:
        _llm_client_instance = UnifiedLLMClient()
    return _llm_client_instance

def generate_structured(
    prompt: str,
    schema: Any,
    provider: str = "openai",
    model: Optional[str] = None
) -> Dict[str, Any]:
    return get_llm_client().generate_structured(prompt, schema, provider, model)
