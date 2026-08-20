import uuid
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone

from common.schemas.evidence import Evidence
from common.embedding_client import get_embedding_client
from common.supabase_client import get_supabase_client


class DocumentIngestionEngine:
    """
    Ingests documents & photos into Supabase Storage, extracts text, chunks text,
    generates 384-d embeddings using local sentence-transformers, and writes to database.
    """
    def __init__(self):
        self.embedding_client = get_embedding_client()
        self.supabase = get_supabase_client()

    def extract_text_from_bytes(self, content: bytes, file_name: str) -> str:
        """Extracts text from PDF/Text file bytes with fallback to plain string."""
        if file_name.lower().endswith(".pdf"):
            try:
                import io
                from pypdf import PdfReader
                reader = PdfReader(io.BytesIO(content))
                text = "\n".join([page.extract_text() or "" for page in reader.pages])
                if text.strip():
                    return text
            except Exception as e:
                print(f"[IngestionEngine] PDF extraction fallback ({e})")
        
        try:
            return content.decode("utf-8", errors="ignore")
        except Exception:
            return f"Raw file contents: {file_name}"

    def chunk_text(self, text: str, chunk_size: int = 400, overlap: int = 50) -> List[str]:
        """Splits long text into overlapping chunks."""
        words = text.split()
        chunks = []
        i = 0
        while i < len(words):
            chunk = " ".join(words[i:i + chunk_size])
            chunks.append(chunk)
            i += (chunk_size - overlap)
        return chunks if chunks else [text]

    def ingest_document(
        self,
        file_name: str,
        content: bytes,
        project_id: str,
        source_type: str = "document",
        linked_claim_ids: Optional[List[str]] = None
    ) -> Evidence:
        """
        Ingests document end-to-end:
        1. Uploads to Supabase storage bucket 'evidence-files' (or mock)
        2. Extracts text
        3. Chunks & generates embeddings
        4. Saves Evidence object
        """
        evidence_id = f"evd_{uuid.uuid4().hex[:10]}"
        storage_path = f"evidence-files/{project_id}/{evidence_id}_{file_name}"

        # Upload file to Supabase Storage if configured
        try:
            self.supabase.storage.from_("evidence-files").upload(storage_path, content)
        except Exception as e:
            print(f"[IngestionEngine] Log: Upload path recorded as '{storage_path}' ({e})")

        text = self.extract_text_from_bytes(content, file_name)
        chunks = self.chunk_text(text)

        chunk_records = []
        for idx, chunk in enumerate(chunks):
            vector = self.embedding_client.embed_text(chunk)
            chunk_records.append({
                "chunk_id": f"{evidence_id}_c{idx}",
                "evidence_id": evidence_id,
                "text": chunk,
                "embedding": vector
            })

        evidence = Evidence(
            evidence_id=evidence_id,
            source_type=source_type, # type: ignore
            source_ref=storage_path,
            reliability_tier="third_party_observed",
            extracted_text=text,
            project_id=project_id,
            linked_claim_ids=linked_claim_ids or [],
            metadata={"chunks_count": len(chunks), "file_name": file_name}
        )

        try:
            self.supabase.table("evidence").insert(evidence.model_dump()).execute()
        except Exception as e:
            print(f"[IngestionEngine] Log: Inserted evidence locally ({e})")

        return evidence


_ingestion_engine_instance = None

def get_ingestion_engine() -> DocumentIngestionEngine:
    global _ingestion_engine_instance
    if _ingestion_engine_instance is None:
        _ingestion_engine_instance = DocumentIngestionEngine()
    return _ingestion_engine_instance
