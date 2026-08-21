# README.md for Atlas MVP

## Overview

Atlas is an **External Procurement Risk Intelligence** micro‑service built with **FastAPI**. It receives an `AgentTask` from ORCHESTRA, evaluates external events, commodity exposure, shipping risk and geopolitical risk, and returns a structured `AgentResult`.

Key features:
- Four real capabilities (`assess_external_event`, `check_commodity_exposure`, `check_shipping_risk`, `check_geopolitical_risk`).
- Uses the **GROK** API (XAI) for LLM reasoning – the only LLM used.
- Persists receipts, evidence and belief edges in the **shared Supabase** project.
- Simple Streamlit UI for manual testing.
- Fully typed with **Pydantic** models and environment‑based configuration.

## Project structure
```
atlas/
│   .env               # (not committed) – SUPABASE_URL, SUPABASE_ANON_KEY, XAI_API_KEY
│   .gitignore
│   README.md
│   requirements.txt
│   main.py
│
├── schemas/
│   ├── task.py
│   ├── result.py
│   └── external_risk.py
│
├── capabilities/
│   ├── external_event.py
│   ├── commodity.py
│   ├── shipping.py
│   └── geopolitical.py
│
├── services/
│   ├── grok_service.py
│   ├── relevance_engine.py
│   ├── receipt_service.py
│   └── supabase_service.py
│
├── providers/
│   ├── base.py
│   ├── seeded_events.py
│   ├── commodity.py
│   ├── shipping.py
│   └── geopolitical.py
│
├── ui/
│   └── app.py
│
└── tests/
    ├── test_external_event.py
    ├── test_commodity.py
    ├── test_shipping.py
    └── test_geopolitical.py
```

## Running the service
```bash
# install dependencies
pip install -r requirements.txt

# start FastAPI
uvicorn main:app --reload
```

The API documentation (Swagger) will be available at `http://localhost:8000/docs`.

## Running the UI
```bash
streamlit run ui/app.py
```
The UI is reachable at `http://localhost:8501`.

---
*All secrets are loaded from `.env` and never exposed in logs or UI.*
