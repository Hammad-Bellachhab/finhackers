"""TellMe, la IA de Embat: resume cartera y empresas en lenguaje llano (PRD docs/superpowers/specs/2026-09-19-agente-ia-prd.md §2-3).

Lee el JSON que ya exporta src/pulso.py y escribe, sin servidor:
  frontend/public/data/tellme/portfolio.json   y   frontend/public/data/companies/{id}/tellme.json
Cadena de "agentes": Analista (Gemini con responseSchema) → Validador (código: cifras que no están en los datos
fuera, 3-6 insights, si no, reintenta una vez) → Redactor (la misma llamada: titular, resumen y glosario llanos).
Reanudable: se salta las empresas que ya tienen tellme.json (salvo --force).

Uso:  GEMINI_API_KEY=… python -m src.tellme [--limit N] [--only COMP_0058,…] [--portfolio-only] [--workers 6] [--force]
      python -m src.tellme --selftest        (prueba el validador sin llamar a Gemini)
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone

import requests

from src.pulso import OUT, write

MODEL = os.environ.get("GEMINI_MODEL", "gemini-flash-latest")
URL = f"https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent"
KINDS = ["trend", "anomaly", "risk", "opportunity", "action"]
SEVERITIES = ["info", "watch", "alert"]
KEY = ""   # GEMINI_API_KEY, la pone main(); nunca se imprime

# Esquema del contrato (frontend/src/api/types.ts). id, scope, companyId, generatedAt y model los pone el código.
S, A = {"type": "STRING"}, lambda items: {"type": "ARRAY", "items": items}
OBJ = lambda **p: {"type": "OBJECT", "properties": p, "required": list(p)}
SCHEMA = OBJ(headline=S, summary=S,
           insights=A({**OBJ(kind={**S, "enum": KINDS}, severity={**S, "enum": SEVERITIES}, title=S, explanation=S,
                           evidence=A(OBJ(label=S, value=S)), action=S), "required": ["kind", "severity", "title", "explanation", "evidence"]}),
           glossary=A(OBJ(term=S, plain=S)))

SYSTEM = """Eres TellMe, la analista financiera de Embat. Explicas la salud financiera de pymes a alguien SIN formación financiera.
La salud va de 0 a 100 (100 = mejor). Bandas: sólida/sana (bien), vigilar, riesgo. "prob_deterioro_pct" = probabilidad de que empeore en los próximos meses.

Reglas de datos (se comprueban con código; si las rompes, el insight se descarta):
- Usa SOLO cifras que aparezcan en el JSON. Puedes redondear (72,4 → 72) y pasar ratios a % (0,74 → 74 %), nada más.
- No sumes, restes ni calcules cifras nuevas: los cambios ya vienen calculados (cambio_salud_1m, cambio_salud_3m…).
- Escribe importes completos como en los datos (452.800 €), sin "mil" ni "M".
- evidence: 1-3 pares etiqueta/valor copiados de los datos.

Qué contar, por importancia (3 a 6 insights):
1. ¿Está sana ahora? 2. ¿Mejora o empeora? Trayectoria, no foto. 3. ¿Bache puntual o caída estructural? (mira la previsión y su nota)
4. ¿Por qué ha cambiado? (factores y qué ha cambiado) 5. ¿Qué se espera en los próximos meses? 6. Un siguiente paso concreto:
al menos un insight kind="action" con el campo action (qué hacer, en una frase).
Equilibrio: reconoce las mejoras igual que los deterioros. Si va bien, dilo y no inventes riesgos.
kind: trend = evolución; anomaly = algo brusco o raro; risk = riesgo; opportunity = algo bueno que aprovechar; action = qué hacer.
severity: alert = actuar ya; watch = vigilar; info = para saber.

Estilo (eres también la redactora): español, de tú, frases cortas y concretas, sin jerga.
Cifras a la española: decimales con coma (72,4), miles con punto (452.800 €); una bajada se dice "baja 1,2 puntos", no "-1,2".
Etiquetas de evidence en español llano ("Salud media ahora"), nunca nombres de campo con guion bajo.
Nunca digas "SHAP", "modelo", "p", "AUC" ni nombres técnicos de variables: di "lo que más pesa", "la previsión".
headline: una frase de menos de 15 palabras. summary: 2-3 frases. glossary: 2-5 términos que salgan en tu texto
(p. ej. "días en cobrar", "ciclo de caja") explicados en una frase llana."""


# --------------------------------------------------------------------------------------
# Resúmenes (lo justo para el analista, no los ficheros enteros)
# --------------------------------------------------------------------------------------
def load(path):
    return json.loads((OUT / path).read_text(encoding="utf-8"))


r1, r2 = lambda v: None if v is None else round(v, 1), lambda v: None if v is None else round(v, 2)
KPI = {"cash_months_of_outflow": "Meses de gasto cubiertos por la caja", "pay_dpd_mean_w3": "Retraso de pago a proveedores (3 m, días)",
       "pay_open_overdue_share_w3": "Facturas a pagar vencidas (3 m, ratio)", "io_ratio_w3": "Ratio cobros / pagos (3 m)",
       "hhi_in": "Concentración de clientes (0-1)", "interest_n_w3": "Liquidaciones de intereses (3 m)"}


def company_digest(cid: str) -> dict:
    d = f"companies/{cid}/"
    s, f, dec, p = load(d + "score.json"), load(d + "forecast.json"), load(d + "decisions.json"), load(d + "profile.json")
    series, b = s["series"], p["benchmark"]
    return {
        "empresa": cid, "mes": p["now"]["month"],
        "perfil": {"pais": p["facts"]["country"], "tamano": p["facts"]["sizeCohort"], "meses_de_datos": p["facts"]["months"]},
        "salud_0a100": s["score"], "banda": p["now"]["healthBand"], "trayectoria": p["now"]["trajectory"],
        "senal": p["now"]["signal"] or "ninguna", "cambio_salud_1m": s["delta1m"], "cambio_salud_3m": s["delta3m"],
        "cambio_salud_desde_" + series[0]["month"]: r1(series[-1]["score"] - series[0]["score"]),
        "prob_deterioro_pct": r1(100 * p["now"]["p"]),
        "salud_mensual": {x["month"]: x["score"] for x in series},
        "prevision": {"salud_en_" + f["horizon"][-1]["month"]: f["horizon"][-1]["score"],
                      "rango": [f["bandLow"][-1]["score"], f["bandHigh"][-1]["score"]],
                      "cambio_previsto": r1(f["horizon"][-1]["score"] - s["score"]),
                      "tipo": "caída estructural" if f["stability"] == "structural" else "sin caída sostenida", "nota": f["stabilityNote"],
                      "aviso_anticipado": f["detection"]},
        "factores_que_mas_pesan": [{"factor": x["label"], "puntos_de_salud": x["impact"], "desde": x["since"]} for x in s["drivers"]],
        "que_ha_cambiado": [f"{x['before']} → {x['after']} ({x['direction']})" for x in p["changes"]],
        "metricas": [{"metrica": m["label"], "valor": r1(m["value"] * 100) if m["unit"] == "pct" else r1(m["value"]),
                      "referencia": r1(m["reference"] * 100) if m["unit"] == "pct" else r1(m["reference"]),
                      "unidad": {"pct": "%", "days": "días"}.get(m["unit"], m["unit"]), "estado": m["status"]} for m in s["metrics"]],
        "tesoreria_ultimos_3m": [{"mes": t["month"], "caja_eur": t["cash"], "cobros_eur": t["inflow"], "pagos_eur": t["outflow"],
                                 "retraso_pago_dias": t["payDelay"], "retraso_cobro_dias": t["collectDelay"]} for t in p["treasury"][-3:]],
        "frente_a_empresas_parecidas": [{"kpi": KPI[r["kpi"]], "tuyo": r2(b["own"].get(r["kpi"])), "mediana": r2(r["p50"]),
                                         "p25": r2(r["p25"]), "p75": r2(r["p75"])} for r in b["rows"] if r["kpi"] in KPI],
        "decisiones_sugeridas": [{"accion": x["title"], "motivo": x["rationale"], "valor_actual": r1(x["currentValue"]),
                                  "objetivo": r1(x["targetValue"]), "puntos_de_salud_si_lo_haces": x["scoreImpact"]} for x in dec],
        "escenarios_que_pasaria_si": [{"escenario": x["label"], "puntos_de_salud": r1(x["after"] - x["before"])}
                                      for x in p["scenarios"] if x["after"] is not None and x["before"] is not None],
    }


def portfolio_digest() -> dict:
    p, al, ev = load("portfolio.json"), load("alerts.json"), load("evidence.json")
    rows, h = p["rows"], p["history"]
    mover = lambda r: {"empresa": r["companyId"], "salud": r["score"], "cambio_3m": r["delta3m"], "senal": r["signal"] or "ninguna",
                       "lo_que_mas_pesa": r["topDriver"]}
    by = sorted(rows, key=lambda r: r["delta3m"])
    grave = sorted(al, key=lambda a: (-a["severity"], a["delta"]))[:5]
    return {
        "mes": p["month"], "empresas": len(rows),
        "por_banda": dict(Counter(r["healthBand"] for r in rows)), "por_trayectoria": dict(Counter(r["trajectory"] for r in rows)),
        "senales": dict(Counter(r["signal"] or "ninguna" for r in rows)),
        "salud_media_ahora": h[-1]["meanHealth"], "salud_media_hace_12m": h[-13]["meanHealth"],
        "cambio_salud_media_12m": r1(h[-1]["meanHealth"] - h[-13]["meanHealth"]),
        "evolucion_12m": [{"mes": x["month"], "solidas": x["solid"], "sanas": x["healthy"], "vigilar": x["watch"], "riesgo": x["risk"],
                           "salud_media": x["meanHealth"]} for x in h[-12:]],
        "las_que_mas_suben_3m": [mover(r) for r in by[::-1][:5]], "las_que_mas_caen_3m": [mover(r) for r in by[:5]],
        "alertas_del_mes": {"total": len(al), "por_senal": dict(Counter(a["signal"] for a in al)),
                            "las_mas_graves": [{"empresa": a["companyId"], "senal": a["signal"], "salud": a["score"], "cambio_3m": a["delta"],
                                                "motivo": a["why"], "meses_de_anticipacion": a["monthsAhead"]} for a in grave]},
        "fiabilidad": {"empresas_no_vistas_al_entrenar": ev["holdout"]["companies"], "auc": ev["holdout"]["auc"],
                       "meses_de_anticipacion_mediana": ev["anticipation"]["medianMonths"], "deterioros_anticipados": ev["anticipation"]["detected"],
                       "acierto_en_mejoras_pct": r1(100 * ev["bothDirections"]["improvingRecall"]),
                       "deterioros_detectados_pct": r1(100 * ev["bothDirections"]["slippingRecall"]),
                       "baches_ignorados_bien": ev["stability"]["dipsCorrectlyIgnored"],
                       "caidas_estructurales_detectadas": ev["stability"]["structuralCaught"]},
    }


# --------------------------------------------------------------------------------------
# Validador (código puro): ninguna cifra que no esté en los datos
# --------------------------------------------------------------------------------------
NUM = re.compile(r"\d+(?:[.,]\d+)*")


def numbers(text: str) -> list[tuple[float, float]]:
    """(valor, tolerancia) de cada cifra; "72,0", "1.418.780" y "1,418,780" valen igual. Sin signo: "−1" y "-1" son lo mismo."""
    out = []
    for tok in NUM.findall(text):
        for s in {tok.replace(",", ""), tok.replace(".", "").replace(",", ".")}:   # notación inglesa y española
            try:
                v = float(s)
            except ValueError:
                continue
            out.append((v, 0.5 * 10 ** -(len(s.split(".")[1]) if "." in s else 0) + 1e-9))
    return out


def grounded(text: str, known: set[float]) -> bool:
    """Cada cifra del texto sale de los datos (redondeada, o un ratio pasado a %)."""
    for tok in NUM.findall(text):
        cands = numbers(tok)
        if not any(abs(k - v) <= tol or abs(100 * k - v) <= tol for v, tol in cands for k in known):
            return False
    return True


def validate(out, digest: dict) -> list[dict] | None:
    """Insights válidos (3-6) o None si la respuesta no sirve. Descarta los que citan cifras que no están en los datos."""
    if not isinstance(out, dict) or not all(isinstance(out.get(k), str) and out[k].strip() for k in ("headline", "summary")):
        return None
    known = {v for v, _ in numbers(json.dumps(digest, ensure_ascii=False))}
    if not grounded(out["headline"] + " " + out["summary"], known):
        return None
    ok = []
    for i in out.get("insights") or []:
        texts = [i.get("title"), i.get("explanation"), *(e.get("value") for e in i.get("evidence") or [] if isinstance(e, dict))]
        if (i.get("kind") in KINDS and i.get("severity") in SEVERITIES and all(isinstance(t, str) and t.strip() for t in texts)
                and i.get("evidence") and grounded(" ".join(texts + [i.get("action") or ""]), known)):
            ok.append({"id": f"i{len(ok) + 1}", **{k: i[k] for k in ("kind", "severity", "title", "explanation")},
                       "evidence": [{"label": e["label"], "value": e["value"]} for e in i["evidence"]],
                       **({"action": i["action"]} if (i.get("action") or "").strip() else {})})
    return ok[:6] if len(ok) >= 3 else None


# --------------------------------------------------------------------------------------
# Analista + redactor (Gemini)
# --------------------------------------------------------------------------------------
def gemini(digest: dict) -> dict:
    body = {"systemInstruction": {"parts": [{"text": SYSTEM}]},
            "contents": [{"role": "user", "parts": [{"text": "Datos (JSON):\n" + json.dumps(digest, ensure_ascii=False)}]}],
            "generationConfig": {"responseMimeType": "application/json", "responseSchema": SCHEMA, "temperature": 0.3}}
    for k in range(6):
        try:   # la key va en cabecera, no en la URL: así no sale en trazas ni errores de requests
            r = requests.post(URL, json=body, headers={"x-goog-api-key": KEY}, timeout=90)
        except requests.RequestException:
            r = None
        if r is not None and r.status_code == 200:
            return json.loads(r.json()["candidates"][0]["content"]["parts"][0]["text"])
        if r is not None and r.status_code not in (429, 500, 502, 503, 504):
            raise RuntimeError(f"Gemini {r.status_code}: {r.text[:300]}")
        time.sleep(2 ** k + k)   # 429/5xx/red: espera y reintenta
    raise RuntimeError("Gemini no responde tras 6 intentos")


def analyse(digest: dict, scope: str, cid: str | None = None) -> dict:
    for _ in range(2):   # una respuesta que no pasa el validador se repite una vez
        try:
            out = gemini(digest)
        except (KeyError, IndexError, ValueError):   # candidato vacío o JSON roto: cuenta como mal formada
            continue
        ins = validate(out, digest)
        if ins is not None:
            return {"scope": scope, **({"companyId": cid} if cid else {}), "headline": out["headline"], "summary": out["summary"],
                    "insights": ins, "glossary": [g for g in out.get("glossary") or [] if g.get("term") and g.get("plain")],
                    "generatedAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"), "model": MODEL}
    raise RuntimeError("respuesta no válida dos veces")


def run_company(cid: str) -> str | None:
    try:
        write(OUT / "companies" / cid / "tellme.json", analyse(company_digest(cid), "company", cid))
    except Exception as e:   # una empresa que falla no para el lote: se queda sin fichero y se reintenta al relanzar
        return f"{cid}: {e}"


# --------------------------------------------------------------------------------------
def selftest() -> None:
    d = {"dso": 72.4, "caja": 1418780.0, "uso_lineas": 0.742, "cambio": -18.9, "mes": "2026-08"}
    known = {v for v, _ in numbers(json.dumps(d))}
    assert grounded("Tardas 72 días (72,4 d; 72.4)", known) and grounded("1.418.780 € y 1,418,780 €", known)
    assert grounded("usas el 74 % de tus líneas; la salud cae −18,9 puntos en 2026-08", known)
    assert not grounded("Tardas 95 días", known) and not grounded("caja de 1.500.000 €", known)
    ins = lambda n, v: {"kind": "risk", "severity": "watch", "title": "abcdefghij"[n], "explanation": "e", "evidence": [{"label": "l", "value": v}]}
    good = {"headline": "Cobras en 72 días", "summary": "s", "insights": [ins(1, "72 d"), ins(2, "74 %"), ins(3, "99 días"), ins(4, "1.418.780 €")]}
    v = validate(good, d)
    assert [i["title"] for i in v] == ["b", "c", "e"] and [i["id"] for i in v] == ["i1", "i2", "i3"]   # el de 99 días fuera
    assert validate({**good, "insights": good["insights"][:3]}, d) is None                       # quedan 2 < 3
    assert validate({**good, "headline": "Cobras en 99 días"}, d) is None                         # titular inventado
    assert len(validate({**good, "insights": [ins(i, "72") for i in range(9)]}, d)) == 6          # máximo 6
    assert validate({**good, "insights": [{**ins(1, "72"), "kind": "otro"}] * 3}, d) is None      # enum mal
    print("selftest OK")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--limit", type=int)
    ap.add_argument("--only", help="ids separados por comas")
    ap.add_argument("--portfolio-only", action="store_true")
    ap.add_argument("--workers", type=int, default=6)
    ap.add_argument("--force", action="store_true", help="regenera aunque ya exista tellme.json")
    ap.add_argument("--selftest", action="store_true")
    a = ap.parse_args()
    if a.selftest:
        return selftest()
    global KEY
    KEY = os.environ.get("GEMINI_API_KEY") or sys.exit("Falta GEMINI_API_KEY en el entorno (export GEMINI_API_KEY=…).")

    if not a.only:
        t = time.time()
        write(OUT / "tellme" / "portfolio.json", analyse(portfolio_digest(), "portfolio"))
        print(f"cartera OK ({time.time() - t:.1f} s)")
    if a.portfolio_only:
        return
    ids = a.only.split(",") if a.only else [r["companyId"] for r in load("portfolio.json")["rows"]]
    ids = [c for c in ids if a.force or not (OUT / "companies" / c / "tellme.json").exists()][: a.limit]
    print(f"{len(ids)} empresas por analizar con {a.workers} en paralelo")
    fails, t = [], time.time()
    with ThreadPoolExecutor(a.workers) as ex:
        for n, err in enumerate(ex.map(run_company, ids), 1):
            if err:
                fails.append(err)
                print("  fallo", err)
            if n % 50 == 0 or n == len(ids):
                print(f"{n}/{len(ids)}  ({time.time() - t:.0f} s, {len(fails)} fallos)")
    if fails:
        print(f"{len(fails)} sin analizar: relanza el mismo comando para reintentarlas.")


if __name__ == "__main__":
    main()
