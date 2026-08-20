import math
from typing import List

try:
    from sentence_transformers import SentenceTransformer
    HAS_SENTENCE_TRANSFORMERS = True
except ImportError:
    HAS_SENTENCE_TRANSFORMERS = False


class LocalEmbeddingClient:
    """
    Local sentence-transformers embedding generator using all-MiniLM-L6-v2.
    Runs on CPU without API keys or rate limits.
    """
    def __init__(self, model_name: str = "all-MiniLM-L6-v2"):
        self.model_name = model_name
        self.model = None
        if HAS_SENTENCE_TRANSFORMERS:
            try:
                self.model = SentenceTransformer(model_name)
            except Exception as e:
                print(f"[EmbeddingClient] Notice: Could not load model '{model_name}' ({e}). Fallback active.")

    def embed_text(self, text: str) -> List[float]:
        """Returns 384-dimensional vector embedding."""
        if self.model is not None:
            try:
                embedding = self.model.encode(text)
                return embedding.tolist()
            except Exception as e:
                print(f"[EmbeddingClient] Embedding failed ({e}). Using deterministic fallback vector.")

        # Fallback 384-d normalized vector based on character frequencies
        vector = [0.0] * 384
        for i, char in enumerate(text):
            idx = (ord(char) * (i + 1)) % 384
            vector[idx] += 1.0
        norm = math.sqrt(sum(x * x for x in vector)) or 1.0
        return [x / norm for x in vector]

    def similarity(self, vec_a: List[float], vec_b: List[float]) -> float:
        """Computes cosine similarity between two 384-d vectors."""
        dot = sum(a * b for a, b in zip(vec_a, vec_b))
        norm_a = math.sqrt(sum(a * a for a in vec_a)) or 1.0
        norm_b = math.sqrt(sum(b * b for b in vec_b)) or 1.0
        return dot / (norm_a * norm_b)


_embedding_instance = None

def get_embedding_client() -> LocalEmbeddingClient:
    global _embedding_instance
    if _embedding_instance is None:
        _embedding_instance = LocalEmbeddingClient()
    return _embedding_instance


def embed(text: str) -> List[float]:
    """Helper function to directly embed text using the default client."""
    return get_embedding_client().embed_text(text)

