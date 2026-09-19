"""Test simulado: reserva un conjunto de empresas que el modelo NO verá nunca.

    python -m src.split_test            # ~80 empresas (N_TEST_COMPANIES), grupos enteros, semilla fija

Escribe en data/test_companies/ los 8 CSV con solo esas empresas (el mismo formato que entregaría el reto)
y company_ids.txt con la lista. A partir de ahí, labels.py ajusta la etiqueta solo con el resto, train.py
las excluye del entrenamiento y evaluate_test.py las puntúa con predict.py como si fueran el test oculto.

Se cogen grupos empresariales enteros para que ninguna empresa hermana quede a ambos lados (contagio intragrupo).
"""
from __future__ import annotations

import sys

import duckdb
import numpy as np
import pandas as pd

from src import config as C


def run(n_companies: int = C.N_TEST_COMPANIES, seed: int = C.SEED) -> list[str]:
    C.TEST_COMPANIES_DIR.mkdir(parents=True, exist_ok=True)
    comp = pd.read_csv(C.RAW_DIR / "companies.csv", usecols=["company_id", "group_id"])
    rng = np.random.default_rng(seed)
    groups = np.array(sorted(comp["group_id"].fillna(comp["company_id"]).unique()), dtype=object)
    rng.shuffle(groups)
    chosen, ids = [], []
    for g in groups:
        members = comp.loc[comp["group_id"].fillna(comp["company_id"]) == g, "company_id"].tolist()
        if len(members) > 12:                     # los holdings enormes distorsionarían un test de 80 empresas
            continue
        chosen.append(g); ids += members
        if len(ids) >= n_companies:
            break
    ids = sorted(ids)
    C.TEST_IDS_FILE.write_text("\n".join(ids) + "\n", encoding="utf-8")
    con = duckdb.connect()
    con.execute("CREATE TABLE sel AS SELECT * FROM (VALUES " + ",".join(f"('{i}')" for i in ids) + ") t(company_id)")
    for f in C.RAW_FILES:
        src = (C.RAW_DIR / f"{f}.csv").as_posix()
        dst = (C.TEST_COMPANIES_DIR / f"{f}.csv").as_posix()
        if f == "groups":
            con.execute(f"COPY (SELECT g.* FROM read_csv('{src}', all_varchar=true) g WHERE group_id IN "
                        f"(SELECT group_id FROM read_csv('{(C.RAW_DIR / 'companies.csv').as_posix()}', all_varchar=true) "
                        f"WHERE company_id IN (SELECT company_id FROM sel))) TO '{dst}' (HEADER)")
        else:
            con.execute(f"COPY (SELECT t.* FROM read_csv('{src}', all_varchar=true) t WHERE company_id IN (SELECT company_id FROM sel)) "
                        f"TO '{dst}' (HEADER)")
    print(f"[split] {len(ids)} empresas de {len(chosen)} grupos reservadas para test → {C.TEST_COMPANIES_DIR}")
    return ids


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    run()
