"""Tests del simulador de palancas: la traducción métrica → features y el mapa inverso.

La parte cara (repuntuar el ensemble) se prueba aparte; aquí va la lógica que decide qué se mueve
cuando el usuario baja una palanca, que es donde un error pasa desapercibido y falsea el plan entero.
"""
from __future__ import annotations

import numpy as np
import pytest

from src.metrics import FEATURE_METRIC, METRIC_META, metric_values, overrides_for

BASE = {
    "cash_conversion_days_w6": 58.0, "rec_dpd_mean_w3": 20.0, "rec_dpd_mean_w6": 18.0,
    "pay_term_days_w6": 30.0, "pay_dpd_mean_w3": 12.0, "pay_dpd_mean_w6": 13.0,
    "debt_service_ratio_w6": 0.8, "days_of_cash": 14.0, "cash_months_of_outflow": 0.47,
    "credit_util_T": 0.91, "credit_util_max_w6": 0.95, "top1_in_share": 0.53,
}


@pytest.mark.parametrize("mid", ["dso", "dpo", "cash_days", "credit_usage", "concentration", "dscr"])
def test_mover_una_palanca_deja_la_metrica_en_el_valor_pedido(mid):
    """Ida y vuelta: si pido que la métrica valga X, recalcularla sobre las features nuevas da X."""
    objetivo = {"dso": 42.0, "dpo": 45.0, "cash_days": 60.0,
                "credit_usage": 0.70, "concentration": 0.35, "dscr": 1.25}[mid]
    nuevo = {**BASE, **overrides_for(mid, BASE, objetivo)}
    assert metric_values(nuevo)[mid] == pytest.approx(objetivo, abs=1e-6)


def test_cobrar_antes_desplaza_las_tres_features_por_igual():
    ov = overrides_for("dso", BASE, 42.0)          # 58 → 42, o sea 16 días menos
    assert ov["cash_conversion_days_w6"] == pytest.approx(42.0)
    assert ov["rec_dpd_mean_w3"] == pytest.approx(4.0)
    assert ov["rec_dpd_mean_w6"] == pytest.approx(2.0)


def test_una_palanca_no_pisa_las_features_de_otra():
    """Dos palancas activas a la vez no pueden escribir sobre la misma feature sin saberlo:
    si se solapan, el plan combinado saldría mal."""
    dso = set(overrides_for("dso", BASE, 42.0))
    caja = set(overrides_for("cash_days", BASE, 60.0))
    credito = set(overrides_for("credit_usage", BASE, 0.7))
    assert dso.isdisjoint(caja) and dso.isdisjoint(credito) and caja.isdisjoint(credito)


def test_ciclo_de_caja_y_dso_comparten_features_a_proposito():
    """ccc = dso - dpo, así que mueve las mismas features que dso. Documentado aquí para que quede
    claro que el solape es intencionado y que el front no debe ofrecer las dos a la vez."""
    assert set(overrides_for("ccc", BASE, 10.0)) == set(overrides_for("dso", BASE, 10.0))


def test_metrica_desconocida_es_un_error_explicito():
    with pytest.raises(ValueError, match="métrica desconocida"):
        overrides_for("inventar", BASE, 1.0)


def test_el_mapa_inverso_cubre_todo_lo_que_se_puede_mover():
    """FEATURE_METRIC se usa para decir 'esto que te hunde lo arregla esta palanca'. Si una feature
    que una palanca mueve no está en el mapa, el front la enseña como problema sin solución."""
    movidas = set()
    for mid in METRIC_META:
        valor = 1.0 if mid in ("dscr", "credit_usage", "concentration") else 30.0
        movidas |= set(overrides_for(mid, BASE, valor))
    sin_mapear = movidas - set(FEATURE_METRIC)
    assert not sin_mapear, f"features sin palanca que las corrija: {sorted(sin_mapear)}"


def test_dscr_sin_deuda_no_existe():
    sin_deuda = {**BASE, "debt_service_ratio_w6": 0.0}
    assert np.isnan(metric_values(sin_deuda)["dscr"])


def test_la_palanca_de_caja_sube_tambien_el_suelo_de_caja():
    """El modelo pesa sobre todo el suelo de caja de los últimos 6 meses, no la foto de hoy.
    Si la palanca no lo mueve, recomendar 60 días de caja sale a cero puntos y parece inútil."""
    ov = overrides_for("cash_days", BASE, 60.0)
    assert ov["days_of_cash"] == 60.0
    assert ov["cash_months_of_outflow"] == pytest.approx(2.0)
    assert ov["cash_min_w6_norm"] > 0                    # antes ni se tocaba
    assert ov["cash_min_w6_norm"] <= ov["cash_months_of_outflow"]   # el suelo nunca supera el colchón


def test_bajar_la_caja_no_sube_el_suelo():
    """Simétrico: si el usuario baja la palanca, el suelo no puede mejorar."""
    suelo_ahora = BASE["cash_months_of_outflow"]
    ov = overrides_for("cash_days", {**BASE, "cash_min_w6_norm": suelo_ahora}, 6.0)
    assert ov["cash_min_w6_norm"] <= suelo_ahora
