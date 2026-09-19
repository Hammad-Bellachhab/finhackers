"""Tests unitarios de las piezas con más riesgo: ventanas/tendencias, anti-leakage del target,
codificación de categóricas y calibración."""
from __future__ import annotations

import numpy as np
import pandas as pd

from src import config as C
from src.features import roll, roll_slope, safe_div
from src.models import CategoryEncoder, PlattCalibrator
from src.train import embargo_months, temporal_folds


def test_roll_slope_recovers_linear_trend():
    months = [f"m{i}" for i in range(8)]
    M = pd.DataFrame([[1, 2, 3, 4, 5, 6, 7, 8], [5, 5, 5, 5, 5, 5, 5, 5], [np.nan, 1, np.nan, 3, np.nan, 5, np.nan, 7]], columns=months)
    s = roll_slope(M, 6)
    assert abs(s.iloc[0, -1] - 1.0) < 1e-9          # pendiente 1
    assert abs(s.iloc[1, -1]) < 1e-9                # constante → 0
    assert abs(s.iloc[2, -1] - 1.0) < 1e-9          # NaN intercalados, pendiente 1
    assert np.isnan(s.iloc[0, 1])                   # < 3 puntos → NaN


def test_roll_only_uses_past_columns():
    months = [f"m{i}" for i in range(5)]
    M = pd.DataFrame([[1, 2, 3, 4, 100]], columns=months)
    r = roll(M, 3, "sum")
    assert r.iloc[0, 3] == 2 + 3 + 4                # no ve el 100 del mes siguiente
    assert r.iloc[0, 4] == 3 + 4 + 100


def test_safe_div_handles_zero_and_nan():
    out = safe_div(np.array([1.0, 2.0, np.nan]), np.array([0.0, 4.0, 1.0]))
    assert np.isnan(out[0]) and out[1] == 0.5 and np.isnan(out[2])


def test_embargo_equals_gap_plus_outcome():
    assert embargo_months(6) == C.GAP_MONTHS + 6
    assert embargo_months(3) == C.GAP_MONTHS + 3


def test_temporal_folds_never_overlap_outcome_windows():
    df = pd.DataFrame({"t_idx": np.repeat(np.arange(17), 3), "y": 0})
    folds, holdout = temporal_folds(df, embargo=7)
    for f in folds + [holdout]:
        assert min(f["eval"]) - f["train_max"] >= 7, f     # T_eval >= T_train + GAP + OUTCOME
    assert max(holdout["eval"]) == 16 and len(holdout["eval"]) == C.HOLDOUT_MONTHS
    evals = [t for f in folds for t in f["eval"]]
    assert all(t < min(holdout["eval"]) for t in evals)     # el holdout no se usa en CV


def test_category_encoder_maps_unknown_to_other():
    X = pd.DataFrame({"a": [1.0, 2.0], "c": ["x", "y"]})
    enc = CategoryEncoder(["c"], output="category").fit(X)
    Xt = enc.transform(pd.DataFrame({"a": [3.0], "c": ["zzz"]}))
    assert str(Xt["c"].iloc[0]) == "__other__" and list(Xt.columns) == ["a", "c"]


def test_platt_calibrator_is_monotonic():
    rng = np.random.default_rng(0)
    p = rng.uniform(0.01, 0.99, 2000)
    y = (rng.uniform(size=2000) < p ** 2).astype(int)   # modelo sobreconfiado
    cal = PlattCalibrator().fit(p, y)
    grid = np.linspace(0.01, 0.99, 20)
    out = cal.transform(grid)
    assert np.all(np.diff(out) > 0)
    assert cal.a_ > 0
    assert cal.transform(np.array([0.5]))[0] < 0.5       # corrige la sobreconfianza en el centro


def test_label_weights_sum_to_one():
    assert abs(sum(C.LABEL_WEIGHTS.values()) - 1.0) < 1e-9


def test_health_trajectory_rules():
    from src.health import add_health
    months = [f"2025-{m:02d}" for m in range(1, 13)]
    # empresa que se deteriora de forma sostenida, otra estable, otra con un bache de un mes
    p_down = [0.05, 0.05, 0.05, 0.08, 0.15, 0.25, 0.35, 0.45, 0.55, 0.60, 0.65, 0.70]
    p_flat = [0.05] * 12
    p_blip = [0.05, 0.05, 0.05, 0.05, 0.05, 0.40, 0.06, 0.05, 0.05, 0.05, 0.05, 0.05]
    df = pd.DataFrame({"company_id": ["down"] * 12 + ["flat"] * 12 + ["blip"] * 12, "T": months * 3, "p": p_down + p_flat + p_blip})
    h = add_health(df, "p")
    last = h.groupby("company_id").tail(1).set_index("company_id")
    assert last.loc["down", "trajectory"] == "deteriorándose" and last.loc["down", "is_structural"]
    assert last.loc["flat", "trajectory"] == "estable" and last.loc["flat", "is_exceptional"] and last.loc["flat", "health_band"] == "sólida"
    blip_rows = h[h.company_id == "blip"]
    assert blip_rows["is_blip"].any() and last.loc["blip", "trajectory"] == "estable"
    assert (h["health"] == 100 * (1 - h["p"])).all()
