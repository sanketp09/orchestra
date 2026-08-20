from pydantic import BaseModel

class AgentError(BaseModel):
    code: str
    message: str
    retryable: bool
