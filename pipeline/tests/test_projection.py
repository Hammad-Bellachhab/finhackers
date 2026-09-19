"""Tests de la proyección por montecarlo empírico (src/projection.py).

Lo que se comprueba aquí es lo que distingue este método de la recta que había antes: que el
futuro que enseña sale de empresas parecidas y no de una fórmula, que no se proyecta con el
futuro de la propia empresa, y que el resultado es el mismo dos veces seguidas (el front lo
sirve precalculado, así que un montecarlo que baile rompería la reproducibilidad del repo).
"""
from __future__ import annotations

import numpy as np
import pandas as pd
import pytest

from src import projection as proj

MONTHS = [f"2025-{m:02d}" for m in range(1, 13)] + [f"2026-{m:02d}" for m in range(1, 13)]


def panel(series: dict[str, list[float]]) -> pd.DataFrame:
    """Panel sintético: {empresa: salud mes a mes}. La salud sin suavizar = la suavizada + 0."""
    rows = [{"company_id": cid, "T": MONTHS[i], "health": v, "health_smooth": v}
            for cid, vs in series.items() for i, v in enumerate(vs)]
    return pd.DataFrame(rows)


def flat(level: float, n: int = 24) -> list[float]:
    return [level] * n


def falling(start: float, step: float, n: int = 24) -> list[float]:
    return [start - step * i for i in range(n)]


def v_shape(start: float, step: float, n: int = 24) -> list[float]:
    """Cae la primera mitad y se recupera la segunda: el patrón que una recta nunca ve venir."""
    half = n // 2
    return [start - step * i for i in range(half)] + [start - step * half + step * i for i in range(n - half)]


def test_el_estado_resume_nivel_sorpresa_e_inercia():
    smooth = np.array([50.0, 52.0, 54.0, 60.0, 61.0])
    health = np.array([50.0, 52.0, 54.0, 60.0, 55.0])
    st = proj.state_of(health, smooth)
    assert st[-1, 0] == 61.0                     # nivel
    assert st[-1, 1] == pytest.approx(-6.0)      # sorpresa: el mes viene peor de lo que dice la EMA
    assert st[-1, 2] == pytest.approx(1.0)       # inercia 1 m
    assert st[-1, 3] == pytest.approx(9.0)       # inercia 3 m


def test_el_pool_solo_guarda_meses_con_pasado_e_historia_completa():
    df = panel({"A": flat(70.0, 14), "B": flat(70.0, 9)})
    pool = proj.build_pool(df, horizon=6)
    # por empresa: len - horizonte - (MIN_HISTORY - 1)  →  A: 14-6-3 = 5, B: 9-6-3 = 0
    assert len(pool) == 5
    assert set(pool.company) == {"A"}
    assert pool.delta.shape == (5, 6)


def test_las_trayectorias_salen_de_empresas_parecidas_no_de_una_recta():
    """Dos poblaciones: las que están arriba siguen arriba, las que están abajo se hunden.

    Una empresa sana debe heredar el futuro de las sanas aunque el pool esté lleno de empresas
    que caen, que es justo lo que una recta global no sabe hacer.
    """
    df = panel({f"sana{i}": flat(85.0) for i in range(10)} |
               {f"mal{i}": falling(40.0, 2.0) for i in range(10)})
    pool = proj.build_pool(df)
    sana = proj.fan(pool, np.array([85.0, 0.0, 0.0, 0.0]))
    mal = proj.fan(pool, np.array([40.0, 0.0, -2.0, -6.0]))
    assert sana["median"][-1] == pytest.approx(85.0, abs=1.0)
    assert mal["median"][-1] < 35.0
    assert mal["probDrop5"] > 0.8 and sana["probDrop5"] < 0.05


def test_no_extrapola_la_caida_en_linea_recta_si_los_parecidos_se_recuperan():
    """El pool está lleno de uves tocando fondo: la recta sigue bajando, el montecarlo no.

    Es el caso que más caro sale en la demo: una empresa que ya ha hecho suelo y a la que la
    proyección anterior le pintaba otros 18 puntos de caída porque la recta no sabe frenar.
    """
    serie = v_shape(70.0, 3.0)                   # baja hasta 34 en el mes 12 y vuelve a subir
    df = panel({f"uve{i}": serie for i in range(20)})
    pool = proj.build_pool(df)
    fondo = 10                                   # salud 40, cayendo 3 al mes, quedan 2 meses de caída
    st = proj.state_of(np.array(serie), np.array(serie))[fondo]
    mc = proj.fan(pool, st)
    recta = proj.ols_fan(np.array(serie[:fondo + 1]))
    assert recta["median"][-1] < 25.0            # la recta se va a 22: nadie del panel acaba ahí
    assert mc["median"][-1] == pytest.approx(serie[fondo + 6], abs=1.0)   # 46: lo que de verdad pasa
    assert mc["median"][-1] > recta["median"][-1] + 20


def test_la_banda_esta_ordenada_y_dentro_de_0_100():
    df = panel({f"c{i}": falling(20.0, 3.0) for i in range(8)} | {f"d{i}": flat(98.0) for i in range(8)})
    pool = proj.build_pool(df)
    for st in (np.array([20.0, 0.0, -3.0, -9.0]), np.array([98.0, 0.0, 0.0, 0.0])):
        f = proj.fan(pool, st)
        assert np.all(f["low"] <= f["median"]) and np.all(f["median"] <= f["high"])
        assert f["low"].min() >= 0.0 and f["high"].max() <= 100.0


def test_una_empresa_no_se_proyecta_con_su_propio_futuro():
    """La única que cae es A; si A se mira a sí misma, se ve caer. Excluida, hereda a las demás."""
    serie = falling(60.0, 4.0)
    df = panel({"A": serie} | {f"otra{i}": flat(60.0) for i in range(12)})
    pool = proj.build_pool(df)
    st = proj.state_of(np.array(serie), np.array(serie))[10]
    # k pequeño: los únicos vecinos parecidos a A son los meses de la propia A, así que si no se
    # la excluye la proyección es literalmente su futuro copiado.
    con_trampa = proj.fan(pool, st, k=5, min_near=1)
    honesto = proj.fan(pool, st, exclude_company="A", k=5, min_near=1)
    assert con_trampa["median"][-1] < honesto["median"][-1] - 10


def test_el_montecarlo_es_reproducible():
    df = panel({f"c{i}": falling(80.0 - i, 1.0 + i / 10) for i in range(12)})
    pool = proj.build_pool(df)
    st = np.array([70.0, -1.0, -1.5, -4.0])
    a, b = proj.fan(pool, st), proj.fan(pool, st)
    assert np.array_equal(a["median"], b["median"]) and np.array_equal(a["low"], b["low"])


def test_el_backtest_compara_contra_la_recta_y_no_usa_las_reservadas_en_el_pool():
    df = panel({f"train{i}": v_shape(70.0, 2.0) for i in range(15)} |
               {f"test{i}": v_shape(70.0, 2.0) for i in range(5)})
    out = proj.backtest(df, {f"test{i}" for i in range(5)})
    assert out["n_test_companies"] == 5 and out["n_forecasts"] == 5 * (24 - 6 - 3)
    assert out["n_pool"] == 15 * (24 - 6 - 3)
    assert 0.0 <= out["montecarlo"]["coverage"] <= 1.0
    assert out["montecarlo"]["mae"] < out["ols_baseline"]["mae"]
