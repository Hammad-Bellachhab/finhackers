"""Acceso de solo lectura a la base de datos servida (Capa 8). Nada de percentiles en la petición.

La columna de mes se llama "T" y va siempre entrecomillada en el SQL: PostgreSQL pliega los
identificadores sin comillas a minúsculas y SQLite los acepta igual.
"""
from __future__ import annotations

import json
from functools import lru_cache

import pandas as pd
from sqlalchemy import create_engine, text

from src import config as C


@lru_cache(maxsize=1)
def engine():
    return create_engine(C.DATABASE_URL, future=True, pool_pre_ping=True)


def q(sql: str, **params) -> pd.DataFrame:
    with engine().connect() as con:
        return pd.read_sql(text(sql), con, params=params)


def records(df: pd.DataFrame) -> list[dict]:
    return json.loads(df.to_json(orient="records", date_format="iso"))


def latest_month() -> str:
    return q('SELECT max("T") AS "T" FROM risk_score')["T"].iloc[0]


def model_info() -> dict:
    row = q("SELECT * FROM model_info ORDER BY trained_at DESC LIMIT 1").iloc[0].to_dict()
    for k in ("train_months", "label_config", "holdout_metrics", "lift", "cv_metrics", "ablation", "calibration",
              "shap_block_importance", "top_features", "error_analysis", "anticipation", "holdout_unseen_companies"):
        if isinstance(row.get(k), str):
            row[k] = json.loads(row[k])
    return row


def list_companies(T: str | None, band: str | None, cohort: str | None, country: str | None, search: str | None,
                   sort: str, limit: int, offset: int, trajectory: str | None = None, health_band: str | None = None) -> tuple[list[dict], int]:
    T = T or latest_month()
    where = ['r."T" = :T']
    params: dict = {"T": T, "limit": limit, "offset": offset}
    if band:
        where.append("r.band = :band"); params["band"] = band
    if cohort:
        where.append("c.size_cohort = :cohort"); params["cohort"] = cohort
    if country:
        where.append("c.country = :country"); params["country"] = country
    if search:
        where.append("(c.company_id LIKE :search OR c.group_id LIKE :search)"); params["search"] = f"%{search}%"
    if trajectory:
        where.append("r.trajectory = :traj"); params["traj"] = trajectory
    if health_band:
        where.append("r.health_band = :hband"); params["hband"] = health_band
    order = {"score": "r.score DESC", "delta": "r.delta_1m DESC", "delta_asc": "r.delta_1m ASC", "company": "c.company_id ASC",
             "percentile": "r.percentile DESC", "health": "r.health_smooth ASC", "health_desc": "r.health_smooth DESC",
             "health_delta": "r.health_delta_3m ASC", "health_delta_desc": "r.health_delta_3m DESC"}.get(sort, "r.score DESC")
    base = f"FROM risk_score r JOIN company c USING(company_id) WHERE {' AND '.join(where)}"
    total = int(q(f"SELECT count(*) AS n {base}", **params)["n"].iloc[0])
    rows = q(f'''SELECT c.company_id, c.group_id, c.country, c.erp, c.main_bank, c.size_cohort, c.group_size, c.has_invoices,
                        r."T", r.score, r.score_A, r.percentile, r.percentile_cohort, r.band, r.delta_1m, r.is_out_of_sample, r.realized_label,
                        r.health, r.health_smooth, r.health_band, r.trajectory, r.health_delta_1m, r.health_delta_3m,
                        r.is_blip, r.is_structural, r.is_exceptional, r.alert
                 {base} ORDER BY {order} NULLS LAST LIMIT :limit OFFSET :offset''', **params)
    return records(rows), total


def company(company_id: str) -> dict | None:
    c = q("SELECT * FROM company WHERE company_id = :cid", cid=company_id)
    if c.empty:
        return None
    out = c.iloc[0].to_dict()
    out["kpi_series"] = records(q('SELECT * FROM company_month_kpi WHERE company_id = :cid ORDER BY "T"', cid=company_id))
    out["score_series"] = records(q('SELECT "T", score, score_A, percentile, percentile_cohort, band, delta_1m, is_out_of_sample, '
                                    'realized_label, realized_D, health, health_smooth, health_band, trajectory, health_delta_1m, '
                                    'health_delta_3m, is_blip, is_structural, is_exceptional, alert '
                                    'FROM risk_score WHERE company_id = :cid ORDER BY "T"', cid=company_id))
    return out


def company_changes(company_id: str, T: str | None = None) -> list[dict]:
    T = T or latest_month()
    return records(q('SELECT "T", "T_prev", rank, feature, block, delta_shap, direction, before, after FROM score_change_explanation '
                     'WHERE company_id = :cid AND "T" = :T ORDER BY rank', cid=company_id, T=T))


def alerts(kind: str | None = None, limit: int = 100) -> list[dict]:
    if kind:
        return records(q('SELECT * FROM alerts WHERE alert = :k ORDER BY severity DESC, health_delta_1m ASC LIMIT :n', k=kind, n=limit))
    return records(q('SELECT * FROM alerts ORDER BY severity DESC, health_delta_1m ASC LIMIT :n', n=limit))


def company_score(company_id: str, T: str | None = None) -> dict | None:
    T = T or latest_month()
    r = q('SELECT * FROM risk_score WHERE company_id = :cid AND "T" = :T', cid=company_id, T=T)
    if r.empty:
        return None
    out = r.iloc[0].to_dict()
    out["explanation"] = records(q('SELECT rank, feature, block, value, shap, direction, text FROM score_explanation '
                                   'WHERE company_id = :cid AND "T" = :T ORDER BY rank', cid=company_id, T=T))
    out["history"] = records(q('SELECT "T", score, band, delta_1m, is_out_of_sample, realized_label FROM risk_score '
                               'WHERE company_id = :cid ORDER BY "T"', cid=company_id))
    return out


def company_features(company_id: str, T: str | None = None) -> dict | None:
    T = T or latest_month()
    r = q('SELECT * FROM company_features WHERE company_id = :cid AND "T" = :T', cid=company_id, T=T)
    if r.empty:
        return None
    row = r.iloc[0].to_dict()
    return {k: (None if pd.isna(v) else v) for k, v in row.items() if k not in ("company_id", "T")}


def benchmarks(company_id: str | None, T: str | None, size_cohort: str | None, country_group: str | None, group_bucket: str | None) -> dict:
    T = T or latest_month()
    own = None
    if company_id:
        c = q("SELECT c.size_cohort, c.country, c.group_size FROM company c WHERE company_id = :cid", cid=company_id)
        if c.empty:
            return {"T": T, "cohort": None, "rows": [], "own": None}
        size_cohort = c["size_cohort"].iloc[0]
        country_group = c["country"].iloc[0] if c["country"].iloc[0] in ("ES", "UNK") else "OTHER"
        gs = c["group_size"].iloc[0] or 1
        group_bucket = "1" if gs <= 1 else ("2-5" if gs <= 5 else "6+")
        k = q('SELECT * FROM company_month_kpi WHERE company_id = :cid AND "T" = :T', cid=company_id, T=T)
        s = q('SELECT score FROM risk_score WHERE company_id = :cid AND "T" = :T', cid=company_id, T=T)
        own = {**({} if k.empty else {kk: (None if pd.isna(v) else float(v)) for kk, v in k.iloc[0].items() if kk not in ("company_id", "T")}),
               "score": None if s.empty else float(s["score"].iloc[0])}
    rows = q('SELECT * FROM benchmark WHERE "T" = :T AND size_cohort = :sc AND country_group = :cg AND group_bucket = :gb',
             T=T, sc=size_cohort, cg=country_group, gb=group_bucket)
    fallback = False
    if rows.empty:   # cohorte fina < 10 empresas → respaldo por tamaño
        rows = q('SELECT * FROM benchmark WHERE "T" = :T AND size_cohort = :sc AND country_group = \'ALL\'', T=T, sc=size_cohort)
        fallback = True
    return {"T": T, "cohort": {"size_cohort": size_cohort, "country_group": country_group, "group_bucket": group_bucket, "fallback_to_size_only": fallback},
            "rows": records(rows), "own": own}


def score_distribution(T: str | None = None) -> dict:
    T = T or latest_month()
    r = q('SELECT band, count(*) AS n, avg(score) AS mean_score FROM risk_score WHERE "T" = :T GROUP BY band', T=T)
    hb = q('SELECT health_band, count(*) AS n FROM risk_score WHERE "T" = :T GROUP BY health_band', T=T)
    tj = q('SELECT trajectory, count(*) AS n FROM risk_score WHERE "T" = :T GROUP BY trajectory', T=T)
    m = q('SELECT "T", avg(score) AS mean_score, sum(CASE WHEN band IN (\'alto\',\'crítico\') THEN 1 ELSE 0 END) AS n_high, '
          'count(*) AS n FROM risk_score GROUP BY "T" ORDER BY "T"')
    return {"T": T, "bands": records(r), "health_bands": records(hb), "trajectories": records(tj), "by_month": records(m)}


def log_inference(endpoint: str, company_id: str | None, score: float | None, version: str, payload: dict | None = None) -> None:
    with engine().begin() as con:
        con.execute(text("CREATE TABLE IF NOT EXISTS inference_log (ts TEXT, endpoint TEXT, company_id TEXT, score REAL, model_version TEXT, payload TEXT)"))
        con.execute(text("INSERT INTO inference_log VALUES (:ts, :e, :c, :s, :v, :p)"),
                    {"ts": pd.Timestamp.utcnow().isoformat(), "e": endpoint, "c": company_id, "s": score, "v": version,
                     "p": json.dumps(payload, default=str)[:4000] if payload else None})
