"""Smoke test end-to-end: datos sintéticos → ingest → schema → labels → features → train → evaluate → db → API.

Se ejecuta en un directorio temporal con RAW_DIR / DATA_DIR / MODELS_DIR / REPORTS_DIR redirigidos por
entorno, de modo que nunca toca los artefactos reales. Verifica que el pipeline completo no se rompe,
que la etiqueta tiene positivos, que el registro contiene metadata.json y que la API responde.
"""
from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path

import pandas as pd
import pytest

ROOT = Path(__file__).resolve().parents[1]


def run_step(module: str, env: dict) -> None:
    r = subprocess.run([sys.executable, "-m", module], cwd=ROOT, env=env, capture_output=True, text=True, timeout=900)
    assert r.returncode == 0, f"{module} falló:\nSTDOUT:\n{r.stdout[-3000:]}\nSTDERR:\n{r.stderr[-3000:]}"


@pytest.fixture(scope="module")
def env(tmp_path_factory):
    base = tmp_path_factory.mktemp("smoke")
    raw = base / "raw"
    sys.path.insert(0, str(ROOT / "tests"))
    from make_sample_data import make
    make(raw, n_companies=48)
    e = dict(os.environ)
    e.update({"RAW_DIR": str(raw), "DATA_DIR": str(base / "data"), "MODELS_DIR": str(base / "models"), "REPORTS_DIR": str(base / "reports"),
              "DATABASE_URL": f"sqlite:///{(base / 'serve.db').as_posix()}", "PYTHONIOENCODING": "utf-8", "HOLDOUT_MONTHS": "2",
              "N_TEST_COMPANIES": "8"})
    return e


def test_full_pipeline(env):
    for module in ("src.ingest", "src.schema", "src.split_test", "src.labels", "src.features", "src.train", "src.evaluate",
                   "src.serve_db", "src.evaluate_test"):
        run_step(module, env)
    ids = (Path(env["DATA_DIR"]) / "test_companies" / "company_ids.txt").read_text().split()
    assert len(ids) >= 8
    test_eval = json.loads((Path(env["REPORTS_DIR"]) / "test_companies_eval.json").read_text())
    assert test_eval["n_test_companies"] == len(ids) and 0 <= test_eval["model_B"]["auc_roc"] <= 1
    quality = json.loads((Path(env["DATA_DIR"]) / "quality" / "quality_report_latest.json").read_text())
    assert quality["tables"]["transactions"]["rows"] > 0
    labels_meta = json.loads((Path(env["REPORTS_DIR"]) / "labels_meta.json").read_text())
    assert 0.05 < labels_meta["positive_rate"] < 0.30
    version = (Path(env["MODELS_DIR"]) / "registry" / "latest.txt").read_text().strip()
    md = json.loads((Path(env["MODELS_DIR"]) / "registry" / version / "metadata.json").read_text())
    assert md["n_test_companies_excluded"] == len(ids)
    for key in ("dataset_hash", "seed", "hyperparameters", "input_schema", "metrics"):
        assert key in md
    assert (Path(env["MODELS_DIR"]) / "registry" / version / "pipeline.joblib").exists()
    assert (Path(env["MODELS_DIR"]) / "registry" / version / "lgbm_B.txt").exists()
    assert md["metrics"]["holdout"]["lgbm_B"]["auc_roc"] > 0.5


def test_api_on_smoke_artifacts(env):
    code = """
import os, sys, json
from fastapi.testclient import TestClient
from src.api.main import app
with TestClient(app) as c:
    assert c.get('/health').json()['status'] == 'ok'
    info = c.get('/model/info').json(); assert 'holdout' in info
    items = c.get('/companies?limit=5').json()['items']; assert len(items) == 5
    cid = items[0]['company_id']
    s = c.get(f'/companies/{cid}/score').json(); assert 0 <= s['score'] <= 1 and len(s['explanation']) > 0
    b = c.get(f'/benchmarks?company_id={cid}').json(); assert 'cohort' in b
    sim = c.post('/simulate', json={'company_id': cid, 'scenario': 'overdraft_2_months'}).json(); assert 'after' in sim
    assert 'health_smooth' in items[0] and items[0]['trajectory'] in ('mejorando', 'estable', 'deteriorándose')
    assert 'items' in c.get('/alerts').json()
    assert 'changes' in c.get(f'/companies/{cid}/changes').json()
    assert 'anticipation' in c.get('/model/info').json()
    feats = c.get(f'/companies/{cid}/features').json()['features']
    sc = c.post('/score', json={'features': feats}).json(); assert abs(sc['score'] - s['score']) < 1e-6
    assert c.get('/companies/NOPE').status_code == 404
print('API OK')
"""
    r = subprocess.run([sys.executable, "-c", code], cwd=ROOT, env=env, capture_output=True, text=True, timeout=300)
    assert r.returncode == 0, f"API smoke falló:\n{r.stdout[-2000:]}\n{r.stderr[-3000:]}"
    assert "API OK" in r.stdout


def test_predict_on_new_companies(env):
    """Test oculto: predict.py sobre CSVs (aquí, los sintéticos) con el modelo registrado en el smoke."""
    out = Path(env["DATA_DIR"]).parent / "pred"
    r = subprocess.run([sys.executable, "-m", "src.predict", "--raw", env["RAW_DIR"], "--out", str(out)],
                       cwd=ROOT, env=env, capture_output=True, text=True, timeout=600)
    assert r.returncode == 0, "predict falló:\n" + r.stdout[-2000:] + "\n" + r.stderr[-3000:]
    latest = pd.read_csv(out / "predictions_latest.csv")
    assert {"company_id", "health_smooth", "health_band", "trajectory", "p_deterioro", "razones_principales"} <= set(latest.columns)
    assert latest["health_smooth"].between(0, 100).all() and latest["company_id"].is_unique
    assert (out / "changes.csv").exists() and (out / "summary.json").exists()
