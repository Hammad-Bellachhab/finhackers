"""Orquestador del flujo offline (equivalente multiplataforma de `make all`).

    python -m src.pipeline all                 # ingest → schema → split → labels → features → train → evaluate → db → test
    python -m src.pipeline labels features     # solo algunos pasos, en orden
"""
from __future__ import annotations

import sys
import time

STEPS = ["ingest", "schema", "split", "labels", "features", "train", "evaluate", "db", "test", "sensitivity"]
ALL = STEPS[:-1]   # sensitivity es opcional (≈ 9 min más)


def run(step: str) -> None:
    if step == "ingest":
        from src.ingest import run as f
    elif step == "schema":
        from src.schema import build_company_month as f
    elif step == "split":
        from src.split_test import run as f
    elif step == "labels":
        from src.labels import build_labels as f
    elif step == "features":
        from src.features import build_features as f
    elif step == "train":
        from src.train import run as f
    elif step == "evaluate":
        from src.evaluate import run as f
    elif step == "db":
        from src.serve_db import run as f
    elif step == "test":
        from src.evaluate_test import run as f
    elif step == "sensitivity":
        from src.sensitivity import main as f
    else:
        raise SystemExit(f"paso desconocido: {step} (válidos: {STEPS})")
    t0 = time.time()
    print(f"\n===== [{step}] =====", flush=True)
    f()
    print(f"===== [{step}] {time.time() - t0:.0f}s =====", flush=True)


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    args = sys.argv[1:] or ["all"]
    steps = ALL if args == ["all"] else args
    t0 = time.time()
    for s in steps:
        run(s)
    print(f"\n[pipeline] completado en {(time.time() - t0) / 60:.1f} min")
