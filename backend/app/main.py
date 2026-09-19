"""API minima de finhackers.

Arranque local:
    uvicorn app.main:app --reload --port 8000
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# Origenes del servidor de desarrollo de Vite.
DEV_ORIGINS = ["http://localhost:5173", "http://127.0.0.1:5173"]

app = FastAPI(title="finhackers API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=DEV_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)


class Health(BaseModel):
    status: str
    service: str
    version: str


@app.get("/api/health", response_model=Health)
def health() -> Health:
    return Health(status="ok", service="finhackers-api", version=app.version)
