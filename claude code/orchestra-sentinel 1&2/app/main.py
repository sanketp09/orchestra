from fastapi import FastAPI

from app.api.routes import purchase_orders, site_walk

app = FastAPI(title="Orchestra Sentinel")

app.include_router(site_walk.router)
app.include_router(purchase_orders.router)


@app.get("/health")
async def health():
    return {"status": "ok"}
