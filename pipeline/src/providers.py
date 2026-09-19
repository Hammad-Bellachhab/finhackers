"""Proveedores financieros: bancos y conectores con los que está conectada cada empresa.

Es la cartera vista del lado del prestamista: un banco, las empresas que le tiene colocadas
y cómo respira cada una. Solo depende de las dos dimensiones de productos del crudo y de las
filas de salud que ya calcula el motor, así que se puede probar sin modelo ni base de datos.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

from src import config as C

BAND_ORDER = ["riesgo", "vigilar", "sana", "sólida"]


def bank_products() -> pd.DataFrame:
    """Productos (bancarios y de financiación) de cada empresa con su banco y conector.

    Los dos ficheros son dimensiones pequeñas y no pasan por el panel mensual, así que se leen
    del crudo. `granted`/`outstanding` vienen con signo de pasivo: se sirven en positivo.
    """
    cols = ["company_id", "bank_name", "service", "type"]
    bank = pd.read_csv(C.RAW_DIR / "banking_products.csv", usecols=cols)
    debt = pd.read_csv(C.RAW_DIR / "debt_products.csv", usecols=[*cols, "granted", "outstanding"])
    p = pd.concat([bank.assign(granted=np.nan, outstanding=np.nan), debt], ignore_index=True)
    p["bank_name"] = p["bank_name"].fillna("Sin identificar")
    p["service"] = p["service"].fillna("—")
    for c in ("granted", "outstanding"):
        p[c] = pd.to_numeric(p[c], errors="coerce").abs().fillna(0.0)
    return p


def providers(rows: list[dict], T: str) -> dict:
    """Un proveedor financiero por banco: con qué conector entra, qué productos tiene colocados
    y cómo respira cada empresa suya (la salud es la misma que sirve el resto del producto)."""
    health = {r["companyId"]: r for r in rows}
    p = bank_products()
    p = p[p["company_id"].isin(health)]
    types = lambda g: [{"type": t, "n": int(n)} for t, n in g["type"].value_counts().items()]
    out = []
    for bank, g in p.groupby("bank_name", sort=False):
        companies = []
        for cid, h in g.groupby("company_id", sort=False):
            r = health[cid]
            companies.append({"companyId": cid, "name": cid, "score": r["score"], "band": r["band"],
                              "healthBand": r["healthBand"], "trend": r["trend"], "delta3m": r["delta3m"],
                              "products": int(len(h)), "types": types(h),
                              "granted": round(float(h["granted"].sum())), "outstanding": round(float(h["outstanding"].sum()))})
        companies.sort(key=lambda c: c["score"])
        bands = {b: sum(1 for c in companies if c["healthBand"] == b) for b in BAND_ORDER}
        n = len(companies)
        out.append({"name": bank, "services": sorted(g["service"].unique()), "companies": n,
                    "products": int(len(g)), "types": types(g), "bands": bands,
                    "meanHealth": round(sum(c["score"] for c in companies) / n, 1),
                    "riskShare": round(bands["riesgo"] / n, 4),
                    "slipping": sum(1 for c in companies if c["trend"] == "down"),
                    "improving": sum(1 for c in companies if c["trend"] == "up"),
                    "granted": round(float(g["granted"].sum())), "outstanding": round(float(g["outstanding"].sum())),
                    "rows": companies})
    out.sort(key=lambda x: -x["companies"])
    return {"providers": out, "month": T,
            "totals": {"providers": len(out), "companies": len(health),
                       "connectors": int(p["service"].nunique()), "products": int(len(p))}}
