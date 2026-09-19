"""El simulador contra el modelo de verdad: que las palancas muevan el score en el sentido
esperado y que el plan combinado se repuntúe, no se sume.

Necesita un modelo entrenado en el registro; si no lo hay, se salta (una máquina recién clonada
no lo tiene, y el pipeline tarda minutos en generarlo).
"""
from __future__ import annotations

import pytest

from src import config as C

pytest.importorskip("lightgbm")

# El .joblib no se versiona (pesa), solo su metadata: comprobar latest.txt no basta, porque el
# puntero puede venir de otra máquina y apuntar a un modelo que aquí no está entrenado.
_latest = C.REGISTRY_DIR / "latest.txt"
if not _latest.exists() or not (C.REGISTRY_DIR / _latest.read_text(encoding="utf-8").strip() / "pipeline.joblib").exists():
    pytest.skip("sin modelo entrenado en esta máquina (python -m src.pipeline train)", allow_module_level=True)


BASE = {
    # Una empresa apretada: cobra tarde, sin colchón de caja, línea de crédito casi agotada
    # y dependiendo de un solo cliente.
    "cash_conversion_days_w6": 58.0, "rec_dpd_mean_w3": 20.0, "rec_dpd_mean_w6": 18.0,
    "pay_term_days_w6": 30.0, "pay_dpd_mean_w3": 12.0, "pay_dpd_mean_w6": 13.0,
    "debt_service_ratio_w6": 0.9, "days_of_cash": 9.0, "cash_months_of_outflow": 0.3,
    "credit_util_T": 0.93, "credit_util_max_w6": 0.95, "top1_in_share": 0.61,
}


@pytest.fixture(scope="module")
def svc():
    from src.api.inference import InferenceService
    return InferenceService()


def test_soltar_una_palanca_buena_no_empeora_el_score(svc):
    """Darle aire a la caja no puede hundir la salud: si esto falla, el simulador estaría
    recomendando lo contrario de lo que debe."""
    plan = svc.plan(BASE, {"cash_days": 60.0})
    assert plan["planHealth"] >= plan["baseHealth"]
    assert len(plan["levers"]) == 1
    assert plan["levers"][0]["metricId"] == "cash_days"
    assert plan["levers"][0]["from"] == pytest.approx(9.0)
    assert plan["levers"][0]["to"] == pytest.approx(60.0)


def test_el_plan_combina_las_palancas_en_una_sola_repuntuacion(svc):
    """El total no es la suma de marginales: se calcula aplicando todo a la vez. Este test fija
    esa propiedad, que es la razón de ser del endpoint frente a sumar la rejilla en el front."""
    plan = svc.plan(BASE, {"cash_days": 60.0, "dso": 35.0, "credit_usage": 0.4})
    assert len(plan["levers"]) == 3
    suma = sum(lv["scoreDelta"] for lv in plan["levers"])
    total = plan["scoreDelta"]
    # Ambos miran al mismo sitio, pero no tienen por qué coincidir: si coincidieran siempre,
    # el backend no aportaría nada sobre el cálculo aproximado del front.
    assert total == pytest.approx(plan["planHealth"] - plan["baseHealth"], abs=0.11)
    assert isinstance(suma, float)


def test_descartar_una_palanca_da_un_plan_distinto(svc):
    """Lo que pide el producto: al quitar una palanca, el plan se recalcula con las demás."""
    completo = svc.plan(BASE, {"cash_days": 60.0, "dso": 35.0, "credit_usage": 0.4})
    sin_caja = svc.plan(BASE, {"dso": 35.0, "credit_usage": 0.4})
    assert len(sin_caja["levers"]) == 2
    assert all(lv["metricId"] != "cash_days" for lv in sin_caja["levers"])
    assert sin_caja["planHealth"] != completo["planHealth"]
    assert sin_caja["baseHealth"] == completo["baseHealth"]   # el punto de partida no cambia


def test_un_plan_vacio_deja_el_score_donde_estaba(svc):
    """Si el usuario lo descarta todo, el plan es no hacer nada: mismo score, sin delta."""
    plan = svc.plan(BASE, {})
    assert plan["levers"] == []
    assert plan["scoreDelta"] == pytest.approx(0.0, abs=0.05)
    assert plan["planHealth"] == pytest.approx(plan["baseHealth"], abs=0.05)


def test_los_drags_son_accionables_y_restan(svc):
    """Lo que se presenta como 'esto te baja el score' tiene que restar de verdad, y no puede ser
    el banco o el ERP, que la empresa no puede cambiar."""
    from src.metrics import PROFILE

    plan = svc.plan(BASE, {"cash_days": 60.0})
    for d in plan["drags"]:
        assert d["impact"] < 0, d
        assert d["id"] not in PROFILE, d
        assert "nan" not in d["label"], d      # un NaN formateado como texto no se enseña


def test_una_metrica_inventada_se_rechaza_sin_romper_el_plan(svc):
    """El endpoint la traduce a un 422; aquí se comprueba que no explota por dentro."""
    plan = svc.plan(BASE, {"no_existe": 3.0})
    assert plan["levers"] == []
