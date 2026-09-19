"""Las siete métricas de tesorería sobre las que se puede actuar, y su traducción a features.

Vivían dentro de `src/pulso.py` (el exportador de JSON estático). La API las necesita para el
simulador de palancas, y no puede importar pulso sin arrastrar su estado global, así que están
aquí: pulso y la API leen las mismas definiciones y no pueden divergir.

Cada métrica sale de features que el modelo usa de verdad; por eso mover una métrica mueve el
score real y no una aproximación.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

# label, unidad, dirección buena (+1 = más es mejor), umbral fijo (None = mediana propia de 12 m)
METRIC_META = {
    "dso": ("Días en cobrar", "days", -1, None),
    "dpo": ("Días en pagar", "days", 0, None),              # 0: alejarse de su mediana en cualquier sentido es malo
    "ccc": ("Ciclo de caja", "days", -1, None),
    "dscr": ("Cobertura del servicio de deuda", "ratio", +1, 1.25),
    "cash_days": ("Días de caja", "days", +1, 60.0),
    "credit_usage": ("Uso de líneas", "pct", -1, 0.8),
    "concentration": ("Concentración de clientes", "pct", -1, 0.3),
}


# Rasgos de perfil (banco, ERP, antigüedad…): el modelo los usa, pero no son algo que la empresa
# pueda mover. Se excluyen de todo lo que se presente como accionable.
PROFILE = {"country", "currency", "erp_any", "main_bank", "size_cohort",
           "tenure_months", "months_in_panel", "group_size", "country_missing", "erp_missing", "has_invoices"}

# Qué palanca corrige cada feature: el inverso de overrides_for. Permite decir, de cada cosa que
# le hunde el score, con qué métrica se arregla — y cuáles no tienen arreglo por esta vía.
FEATURE_METRIC = {
    "cash_conversion_days_w6": "dso", "rec_dpd_mean_w3": "dso", "rec_dpd_mean_w6": "dso",
    "pay_dpd_mean_w3": "dpo", "pay_dpd_mean_w6": "dpo", "pay_term_days_w6": "dpo",
    "debt_service_ratio_w6": "dscr",
    "days_of_cash": "cash_days", "cash_months_of_outflow": "cash_days", "cash_min_w6_norm": "cash_days",
    "credit_util_T": "credit_usage", "credit_util_max_w6": "credit_usage",
    "top1_in_share": "concentration",
}


def num(v, default=np.nan) -> float:
    return default if v is None or pd.isna(v) else float(v)


def metric_values(f: dict) -> dict[str, float]:
    dso = num(f.get("cash_conversion_days_w6"))
    dpo = num(f.get("pay_term_days_w6")) + num(f.get("pay_dpd_mean_w6"), 0)
    dsr = num(f.get("debt_service_ratio_w6"), 0)
    return {"dso": dso, "dpo": dpo, "ccc": dso - dpo,
            "dscr": 1 / dsr if dsr > 0 else np.nan,              # sin deuda que servir no hay DSCR
            "cash_days": num(f.get("days_of_cash")), "credit_usage": num(f.get("credit_util_T")),
            "concentration": num(f.get("top1_in_share"))}


def overrides_for(metric_id: str, f: dict, value: float) -> dict[str, float]:
    """Qué features cambian si la métrica pasa a `value`."""
    if metric_id not in METRIC_META:
        raise ValueError(f"métrica desconocida: {metric_id}")
    d = value - metric_values(f)[metric_id]
    shift = lambda *ks: {k: num(f.get(k), 0) + d for k in ks}
    if metric_id in ("dso", "ccc"):
        return shift("cash_conversion_days_w6", "rec_dpd_mean_w3", "rec_dpd_mean_w6")
    if metric_id == "dpo":
        return shift("pay_dpd_mean_w3", "pay_dpd_mean_w6")
    if metric_id == "dscr":
        return {"debt_service_ratio_w6": 1 / max(value, 0.05)}
    if metric_id == "cash_days":
        # No basta con subir la caja de hoy: el modelo mira sobre todo el *suelo* de caja de los
        # últimos 6 meses (cash_min_w6_norm). Moviendo solo days_of_cash, sostener 60 días de caja
        # salía a 0 puntos cuando de verdad vale ~3, y la palanca parecía inútil.
        meses, ahora = value / 30, num(f.get("cash_months_of_outflow"), 0)
        suelo = num(f.get("cash_min_w6_norm"), 0)
        return {"days_of_cash": value, "cash_months_of_outflow": meses,
                # el suelo mejora tanto como el colchón, pero nunca queda por encima de él
                "cash_min_w6_norm": min(meses, suelo + (meses - ahora))}
    if metric_id == "credit_usage":
        return {"credit_util_T": value, "credit_util_max_w6": max(value, num(f.get("credit_util_max_w6"), 0))}
    if metric_id == "concentration":
        return {"top1_in_share": value}
    raise ValueError(f"métrica desconocida: {metric_id}")


def metrics(feats: pd.DataFrame) -> list[dict]:
    """feats: company_features de la empresa, ordenadas por mes (la última es la actual)."""
    hist = pd.DataFrame([metric_values(r) for r in feats.to_dict("records")])
    out = []
    for mid, (label, unit, good, fixed) in METRIC_META.items():
        v = hist[mid].iloc[-1]
        if pd.isna(v):
            continue
        ref = fixed if fixed is not None else float(hist[mid].tail(12).median())
        gap = (v - ref) * good if good else -abs(v - ref)   # < 0 = peor que la referencia
        tol = {"days": 10, "ratio": 0.1, "pct": 0.1}[unit]
        status = "ok" if gap >= 0 else ("watch" if gap > -tol else "breach")
        out.append({"id": mid, "label": label, "value": round(float(v), 3), "unit": unit, "reference": round(ref, 3), "status": status})
    return out


def slider_range(value: float, reference: float, unit: str) -> tuple[float, float]:
    """Recorrido del slider de una métrica. Lo comparten la rejilla precalculada de pulso y el
    front (si divergen, el fallback estático deja de casar con el backend)."""
    lo = max(0.0, reference * 0.5)
    hi = max(value, reference) * 1.5
    return lo, hi
