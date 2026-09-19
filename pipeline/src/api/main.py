"""Capas 9 + 10 — Un único servicio FastAPI (menos contenedores en la demo), con módulos separados:
    inference.py  → modelo (carga única, score, SHAP, simulación)
    db.py         → lectura de la base de datos servida
    main.py       → endpoints, validación Pydantic, logging, rate limit sencillo

Arranque:  uvicorn src.api.main:app --host 0.0.0.0 --port 8000
"""
from __future__ import annotations

import logging
import os
import time
from collections import defaultdict, deque
from contextlib import asynccontextmanager
from typing import Any

from fastapi import Depends, FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, Field

from src import config as C
from src.api import db
from src.api.inference import SCENARIOS, InferenceService

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
log = logging.getLogger("api")
API_KEY = os.environ.get("API_KEY")                 # opcional: si se define, se exige cabecera X-API-Key
RATE_LIMIT = int(os.environ.get("RATE_LIMIT_PER_MIN", 240))
_hits: dict[str, deque] = defaultdict(deque)
STATE: dict[str, Any] = {}


@asynccontextmanager
async def lifespan(app: FastAPI):
    t0 = time.time()
    STATE["svc"] = InferenceService()               # pipeline cargado UNA vez
    log.info("modelo %s cargado en %.1fs", STATE["svc"].version, time.time() - t0)
    yield
    STATE.clear()


app = FastAPI(title="Embat X-Ray — scoring de salud financiera de PYMEs", version="1.0.0", lifespan=lifespan,
              description="Probabilidad calibrada de deterioro financiero a 6 meses a partir de la actividad de tesorería.")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


def svc() -> InferenceService:
    if "svc" not in STATE:
        raise HTTPException(503, "modelo no cargado")
    return STATE["svc"]


async def guard(request: Request):
    """Auth por API key (opcional) + rate limit por IP (ventana deslizante de 60 s)."""
    if API_KEY and request.headers.get("x-api-key") != API_KEY:
        raise HTTPException(401, "API key inválida")
    ip = request.client.host if request.client else "?"
    now = time.time()
    dq = _hits[ip]
    while dq and now - dq[0] > 60:
        dq.popleft()
    if len(dq) >= RATE_LIMIT:
        raise HTTPException(429, "rate limit")
    dq.append(now)


@app.middleware("http")
async def access_log(request: Request, call_next):
    t0 = time.time()
    resp = await call_next(request)
    log.info("%s %s → %d (%.0f ms)", request.method, request.url.path, resp.status_code, 1000 * (time.time() - t0))
    return resp


# --------------------------------------------------------------------------------------
# Esquemas
# --------------------------------------------------------------------------------------
class ScoreRequest(BaseModel):
    features: dict[str, Any] = Field(..., description="Vector de features (nombres de la Capa 4). Lo que falte se trata como NaN.")
    company_id: str | None = None


class SimulateRequest(BaseModel):
    company_id: str
    T: str | None = Field(None, description="Mes 'YYYY-MM' de partida; por defecto el último")
    scenario: str | None = Field(None, description=f"Uno de: {', '.join(SCENARIOS)}")
    overrides: dict[str, float] = Field(default_factory=dict, description="Cambios directos feature → valor")


class PlanRequest(BaseModel):
    T: str | None = Field(None, description="Mes 'YYYY-MM' de partida; por defecto el último")
    targets: dict[str, float] = Field(default_factory=dict,
                                      description="metricId → valor objetivo. Solo las palancas activas; las descartadas simplemente no vienen.")


# --------------------------------------------------------------------------------------
# Endpoints
# --------------------------------------------------------------------------------------
@app.get("/", include_in_schema=False)
def root():
    return RedirectResponse("/docs")


@app.get("/health")
def health():
    s = STATE.get("svc")
    return {"status": "ok" if s else "loading", "model_version": s.version if s else None, "main_model": s.md["main_model"] if s else None,
            "loaded_at": s.loaded_at if s else None, "database": C.DATABASE_URL.split("://")[0], "latest_month": db.latest_month()}


@app.get("/model/info", dependencies=[Depends(guard)])
def model_info(s: InferenceService = Depends(svc)):
    info = s.info()
    try:
        row = db.model_info()
        info["shap_block_importance"] = row["shap_block_importance"]
        info["top_features"] = row["top_features"]
        info["error_analysis"] = row["error_analysis"]
        info["anticipation"] = row.get("anticipation", {})
        info["holdout_unseen_companies"] = row.get("holdout_unseen_companies", {})
        info["last_labeled_month"] = row["last_labeled_month"]
        info["last_scored_month"] = row["last_scored_month"]
    except Exception as e:                           # la BD puede no estar aún
        info["db_warning"] = str(e)
    return info


@app.get("/companies", dependencies=[Depends(guard)])
def companies(T: str | None = None, band: str | None = None, cohort: str | None = None, country: str | None = None,
              q: str | None = None, trajectory: str | None = None, health_band: str | None = None,
              sort: str = Query("score", pattern="^(score|delta|delta_asc|company|percentile|health|health_desc|health_delta|health_delta_desc)$"),
              limit: int = Query(50, ge=1, le=500), offset: int = Query(0, ge=0)):
    rows, total = db.list_companies(T, band, cohort, country, q, sort, limit, offset, trajectory, health_band)
    return {"T": T or db.latest_month(), "total": total, "limit": limit, "offset": offset, "items": rows}


@app.get("/companies/{company_id}", dependencies=[Depends(guard)])
def company(company_id: str):
    c = db.company(company_id)
    if not c:
        raise HTTPException(404, "empresa no encontrada")
    return c


@app.get("/companies/{company_id}/score", dependencies=[Depends(guard)])
def company_score(company_id: str, T: str | None = None):
    r = db.company_score(company_id, T)
    if not r:
        raise HTTPException(404, "sin score para esa empresa / mes")
    return r


@app.get("/companies/{company_id}/changes", dependencies=[Depends(guard)])
def company_changes(company_id: str, T: str | None = None):
    """Qué señales explican el cambio de score entre el mes anterior y T (reto: pregunta 5)."""
    return {"company_id": company_id, "T": T or db.latest_month(), "changes": db.company_changes(company_id, T)}


@app.get("/alerts", dependencies=[Depends(guard)])
def alerts(kind: str | None = None, limit: int = Query(100, ge=1, le=2000)):
    """Monitor proactivo: caídas estructurales, caídas bruscas, deterioros incipientes, mejoras y sólidas (último mes)."""
    return {"T": db.latest_month(), "items": db.alerts(kind, limit)}


@app.get("/companies/{company_id}/features", dependencies=[Depends(guard)])
def company_features(company_id: str, T: str | None = None):
    f = db.company_features(company_id, T)
    if f is None:
        raise HTTPException(404, "sin features para esa empresa / mes")
    return {"company_id": company_id, "T": T or db.latest_month(), "features": f}


@app.get("/benchmarks", dependencies=[Depends(guard)])
def benchmarks(company_id: str | None = None, T: str | None = None, size_cohort: str | None = None,
               country_group: str | None = None, group_bucket: str | None = None):
    if not company_id and not size_cohort:
        raise HTTPException(422, "indica company_id o size_cohort")
    return db.benchmarks(company_id, T, size_cohort, country_group or "ALL", group_bucket or "ALL")


@app.get("/portfolio/summary", dependencies=[Depends(guard)])
def portfolio_summary(T: str | None = None):
    return db.score_distribution(T)


@app.post("/score", dependencies=[Depends(guard)])
def score(req: ScoreRequest, s: InferenceService = Depends(svc)):
    out = s.score(req.features)
    db.log_inference("/score", req.company_id, out["score"], s.version, {"n_features": len(req.features)})
    return out


@app.post("/simulate", dependencies=[Depends(guard)])
def simulate(req: SimulateRequest, s: InferenceService = Depends(svc)):
    base = db.company_features(req.company_id, req.T)
    if base is None:
        raise HTTPException(404, "empresa / mes sin features")
    try:
        out = s.simulate(base, req.overrides, req.scenario)
    except KeyError:
        raise HTTPException(422, f"escenario desconocido; válidos: {list(SCENARIOS)}")
    out["company_id"], out["T"] = req.company_id, req.T or db.latest_month()
    db.log_inference("/simulate", req.company_id, out["after"]["score"], s.version, {"scenario": req.scenario, "overrides": req.overrides})
    return out


@app.post("/companies/{company_id}/plan", dependencies=[Depends(guard)])
def plan(company_id: str, req: PlanRequest, s: InferenceService = Depends(svc)):
    """Plan de mejora: qué le baja el score y a cuánto lo deja mover las palancas que siguen activas.

    Las palancas descartadas por el usuario no llegan en `targets`, así que el plan se recalcula
    solo con las demás. El score sale de repuntuar el ensemble con todas aplicadas a la vez, no de
    sumar efectos por separado.
    """
    base = db.company_features(company_id, req.T)
    if base is None:
        raise HTTPException(404, "empresa / mes sin features")
    try:
        out = s.plan(base, req.targets)
    except ValueError as e:
        raise HTTPException(422, str(e))
    out["companyId"], out["T"] = company_id, req.T or db.latest_month()
    db.log_inference("/plan", company_id, 1 - out["planHealth"] / 100, s.version, {"targets": req.targets})
    return out


@app.get("/scenarios", dependencies=[Depends(guard)])
def scenarios():
    return {k: v["label"] for k, v in SCENARIOS.items()}
