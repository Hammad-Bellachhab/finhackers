"""Configuración central del proyecto.

Todo lo que es una *decisión* (ventanas, umbrales, pesos del target, semillas) vive aquí,
para que el README pueda citarla y el análisis de sensibilidad la pueda variar por entorno.
"""
from __future__ import annotations

import os
from pathlib import Path

# --------------------------------------------------------------------------------------
# Rutas
# --------------------------------------------------------------------------------------
ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = Path(os.environ.get("DATA_DIR", ROOT / "data"))
# Los CSV originales pueden estar en ../output/ (repo finhackers), data/raw/, la raíz de pipeline/ o donde diga RAW_DIR.
def _find_raw_dir() -> Path:
    if os.environ.get("RAW_DIR"):
        return Path(os.environ["RAW_DIR"])
    for cand in (ROOT.parent / "output", ROOT / "data" / "raw", ROOT):
        if (cand / "companies.csv").exists():
            return cand
    return ROOT.parent / "output"


RAW_DIR = _find_raw_dir()
PARQUET_DIR = DATA_DIR / "parquet"
QUALITY_DIR = DATA_DIR / "quality"
MODELS_DIR = Path(os.environ.get("MODELS_DIR", ROOT / "models"))
REGISTRY_DIR = MODELS_DIR / "registry"
REPORTS_DIR = Path(os.environ.get("REPORTS_DIR", ROOT / "reports"))
SERVE_DB_PATH = DATA_DIR / "serve.db"
DATABASE_URL = os.environ.get("DATABASE_URL", f"sqlite:///{SERVE_DB_PATH.as_posix()}")

RAW_FILES = [
    "groups", "companies", "banking_products", "debt_products",
    "debt_schedule_config", "balances", "invoices", "transactions",
]

# --------------------------------------------------------------------------------------
# Reproducibilidad
# --------------------------------------------------------------------------------------
SEED = int(os.environ.get("SEED", 42))

# --------------------------------------------------------------------------------------
# Marco temporal (Capa 3, Figura 3 del documento de arquitectura)
# --------------------------------------------------------------------------------------
DATA_START = "2024-09-01"
DATA_END = "2026-09-01"          # exclusivo: 2026-09 solo tiene un día de datos y se descarta
SNAPSHOT_DATE = "2026-09-01"     # fecha de la foto de balances / estado de facturas
FIRST_MONTH = "2024-09"          # primer mes del panel
LAST_MONTH = "2026-08"           # último mes completo del panel (T máximo para scoring)

OBS_MONTHS = 12                  # ventana de observación (features)
GAP_MONTHS = int(os.environ.get("GAP_MONTHS", 1))          # gap anti-contaminación
OUTCOME_MONTHS = int(os.environ.get("OUTCOME_MONTHS", 6))  # ventana de resultado (decisión abierta: 3 ó 6)
TARGET_PERCENTILE = float(os.environ.get("TARGET_PERCENTILE", 0.85))  # decisión abierta: 0.85 ó 0.90

# DPD a partir del cual una factura a pagar se considera "morosa"
DPD_BAD_DAYS = 30
# Caída de cobros (ventana de resultado vs. 6 meses previos) que se considera colapso
COLLECTION_DROP = 0.40
# Meses seguidos sin transacciones que se consideran cese de actividad
INACTIVITY_MONTHS = 2

# Pesos del índice compuesto de deterioro D = sum_k w_k z_ik (se renormalizan si falta algún componente)
LABEL_WEIGHTS = {
    "late_pay_rate": 0.30,       # morosidad emergente (facturas a pagar con DPD > 30)
    "neg_cash_share": 0.25,      # iliquidez sostenida (meses con caja reconstruida < 0)
    "collection_drop": 0.20,     # colapso de cobros
    "credit_util": 0.10,         # estrés de deuda (utilización de líneas de crédito reconstruida)
    "inactivity": 0.15,          # cese de actividad
}

# --------------------------------------------------------------------------------------
# Validación temporal (Capa 5)
# --------------------------------------------------------------------------------------
# Embargo entre el último T de entrenamiento y el primer T de evaluación: T_eval >= T_train + GAP + OUTCOME,
# es decir, para evaluar T solo se usan etiquetas que ya se conocerían en T (ver src/train.py).
EMBARGO_MONTHS = GAP_MONTHS + OUTCOME_MONTHS
HOLDOUT_MONTHS = int(os.environ.get("HOLDOUT_MONTHS", 2))   # últimos meses etiquetados reservados
N_CV_FOLDS = 3

# --------------------------------------------------------------------------------------
# Servicio
# --------------------------------------------------------------------------------------
RISK_BANDS = [(0.0, 0.10, "bajo"), (0.10, 0.25, "medio"), (0.25, 0.50, "alto"), (0.50, 1.01, "crítico")]
MIN_COHORT_SIZE = 10   # no se muestra benchmark con cohortes menores (Capa 8)
TOP_N_SHAP = 8

# Términos de estrés en texto libre (Bloque F)
STRESS_TERMS_REGEX = r"devol|impag|embarg|reclam|recobro|demora|requerim|aplaz|descubierto|excedido|mora\b"


def month_range(first: str = FIRST_MONTH, last: str = LAST_MONTH) -> list[str]:
    """Lista de meses 'YYYY-MM' entre first y last, ambos incluidos."""
    import pandas as pd
    return [p.strftime("%Y-%m") for p in pd.period_range(first, last, freq="M")]


def ensure_dirs() -> None:
    for d in (PARQUET_DIR, QUALITY_DIR, REGISTRY_DIR, REPORTS_DIR):
        d.mkdir(parents=True, exist_ok=True)
