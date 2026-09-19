"""Tests del agregado de proveedores financieros (src/providers.py).

Se monta un crudo mínimo en un directorio temporal: lo que importa es que un banco sume bien
sus empresas, no repita ninguna, sirva los importes en positivo y ordene la lista por salud.
"""
from __future__ import annotations

import pandas as pd
import pytest

from src import providers as P

BANKING = pd.DataFrame([
    # product_id, company_id, bank_name, service, type
    ("P1", "COMP_1", "Santander", "santander_emp", "checking"),
    ("P2", "COMP_1", "Santander", "santander_emp", "card"),
    ("P3", "COMP_2", "Santander", "santander_emp_mx", "checking"),
    ("P4", "COMP_3", "Paypal", "paypal", "wallet"),
    ("P5", "COMP_9", "Santander", "santander_emp", "checking"),   # empresa sin salud: se descarta
], columns=["product_id", "company_id", "bank_name", "service", "type"])

DEBT = pd.DataFrame([
    ("D1", "COMP_1", "Santander", "santander_emp", "loan", -100000.0, -80000.0),
    ("D2", "COMP_2", "Santander", "santander_emp_mx", "lineofcredit", None, -20000.0),
], columns=["product_id", "company_id", "bank_name", "service", "type", "granted", "outstanding"])

ROWS = [
    {"companyId": "COMP_1", "score": 82.0, "band": "healthy", "healthBand": "sana", "trend": "flat", "delta3m": 1.0},
    {"companyId": "COMP_2", "score": 40.0, "band": "risk", "healthBand": "riesgo", "trend": "down", "delta3m": -12.0},
    {"companyId": "COMP_3", "score": 95.0, "band": "healthy", "healthBand": "sólida", "trend": "up", "delta3m": 3.0},
]


@pytest.fixture
def out(tmp_path, monkeypatch):
    BANKING.to_csv(tmp_path / "banking_products.csv", index=False)
    DEBT.to_csv(tmp_path / "debt_products.csv", index=False)
    monkeypatch.setattr(P.C, "RAW_DIR", tmp_path)
    return P.providers(ROWS, "2026-08")


def by_name(out, name):
    return next(p for p in out["providers"] if p["name"] == name)


def test_agrupa_por_banco_y_lista_sus_conectores(out):
    assert [p["name"] for p in out["providers"]] == ["Santander", "Paypal"]   # ordenado por nº de empresas
    assert by_name(out, "Santander")["services"] == ["santander_emp", "santander_emp_mx"]


def test_no_cuenta_dos_veces_una_empresa_con_varios_productos(out):
    s = by_name(out, "Santander")
    assert s["companies"] == 2                     # COMP_1 tiene tres productos, pero es una empresa
    assert s["products"] == 5
    assert len({c["companyId"] for c in s["rows"]}) == 2


def test_descarta_empresas_sin_salud(out):
    assert "COMP_9" not in {c["companyId"] for p in out["providers"] for c in p["rows"]}
    assert out["totals"]["companies"] == 3


def test_salud_media_bandas_y_riesgo(out):
    s = by_name(out, "Santander")
    assert s["meanHealth"] == 61.0                 # (82 + 40) / 2
    assert s["bands"] == {"riesgo": 1, "vigilar": 0, "sana": 1, "sólida": 0}
    assert s["riskShare"] == 0.5
    assert s["slipping"] == 1 and s["improving"] == 0


def test_importes_en_positivo_y_sin_nulos(out):
    s = by_name(out, "Santander")
    assert s["granted"] == 100000 and s["outstanding"] == 100000
    assert by_name(out, "Paypal")["granted"] == 0  # los productos no financieros no aportan importe


def test_empresas_ordenadas_de_menos_a_mas_salud(out):
    s = by_name(out, "Santander")
    assert [c["companyId"] for c in s["rows"]] == ["COMP_2", "COMP_1"]
    peor = s["rows"][0]
    assert peor["products"] == 2 and peor["outstanding"] == 20000
    assert peor["types"] == [{"type": "checking", "n": 1}, {"type": "lineofcredit", "n": 1}]


def test_totales(out):
    assert out["month"] == "2026-08"
    assert out["totals"] == {"providers": 2, "companies": 3, "connectors": 3, "products": 6}
