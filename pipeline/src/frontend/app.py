"""Capa 11 — Frontend (Streamlit). Criterio: un tesorero responde "¿de qué me preocupo hoy?" en < 10 s.

Vistas: Cartera · Ficha de empresa · Benchmarks · Simulador · Rendimiento del modelo.
Solo habla con la API (API_URL); no lee Parquet ni recalcula nada.

Arranque: streamlit run src/frontend/app.py
"""
from __future__ import annotations

import os

import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
import requests
import streamlit as st

API = os.environ.get("API_URL", "http://localhost:8000")
API_KEY = os.environ.get("API_KEY")
HEADERS = {"X-API-Key": API_KEY} if API_KEY else {}
BAND_COLOR = {"bajo": "#2e7d32", "medio": "#f9a825", "alto": "#ef6c00", "crítico": "#c62828"}
BLOCK_NAME = {"A": "Estructural", "B": "Comportamiento de pago", "C": "Liquidez", "D": "Concentración", "E": "Grupo / banco", "F": "Texto y calidad"}

st.set_page_config(page_title="Embat X-Ray · Salud financiera PYMEs", layout="wide", page_icon="📈")


@st.cache_data(ttl=60)
def get(path: str, **params):
    r = requests.get(f"{API}{path}", params={k: v for k, v in params.items() if v is not None}, headers=HEADERS, timeout=60)
    r.raise_for_status()
    return r.json()


def post(path: str, body: dict):
    r = requests.post(f"{API}{path}", json=body, headers=HEADERS, timeout=60)
    r.raise_for_status()
    return r.json()


def pct(x, d=0):
    return "—" if x is None or pd.isna(x) else f"{100 * x:.{d}f}%"


def badge(band: str) -> str:
    return f"<span style='background:{BAND_COLOR.get(band, '#777')};color:white;padding:2px 8px;border-radius:10px;font-size:0.8em'>{band}</span>"


# --------------------------------------------------------------------------------------
try:
    health = get("/health")
except Exception as e:
    st.error(f"No se puede contactar con la API en {API}: {e}\n\nArranca la API con `make api` (o `uvicorn src.api.main:app`).")
    st.stop()

st.sidebar.title("Embat X-Ray")
st.sidebar.caption(f"modelo **{health['model_version']}** · datos hasta **{health['latest_month']}** · BD {health['database']}")
view = st.sidebar.radio("Vista", ["Cartera", "Ficha de empresa", "Benchmarks", "Simulador", "Rendimiento del modelo"])
st.sidebar.markdown("---")
st.sidebar.caption("Score = probabilidad calibrada de deterioro financiero en los 6 meses siguientes al mes de referencia "
                   "(gap de 1 mes). Bandas: bajo < 10 % · medio < 25 % · alto < 50 % · crítico ≥ 50 %.")

# ======================================================================================
if view == "Cartera":
    st.title("Cartera — ¿de qué me preocupo hoy?")
    summ = get("/portfolio/summary")
    bands = {b["band"]: b["n"] for b in summ["bands"]}
    c1, c2, c3, c4, c5 = st.columns(5)
    c1.metric("Mes de referencia", summ["T"])
    for col, b in zip((c2, c3, c4, c5), ("crítico", "alto", "medio", "bajo")):
        col.metric(f"Empresas en {b}", bands.get(b, 0))
    f1, f2, f3, f4 = st.columns([1, 1, 1, 2])
    band = f1.selectbox("Banda", ["(todas)", "crítico", "alto", "medio", "bajo"])
    cohort = f2.selectbox("Cohorte tamaño", ["(todas)", "q1", "q2", "q3", "q4"], help="Cuartil de pagos operativos (q4 = mayores)")
    sort = f3.selectbox("Ordenar por", ["delta", "score", "percentile"], format_func=lambda s: {"delta": "Δ vs mes anterior (urgencia)", "score": "Score", "percentile": "Percentil"}[s])
    q = f4.text_input("Buscar empresa / grupo")
    data = get("/companies", band=None if band.startswith("(") else band, cohort=None if cohort.startswith("(") else cohort, sort=sort, q=q or None, limit=200)
    df = pd.DataFrame(data["items"])
    st.caption(f"{data['total']} empresas · se muestran {len(df)} · el **delta** importa más que el nivel: una empresa que sube 20 puntos es más urgente que una que lleva seis meses alta.")
    if len(df):
        show = df[["company_id", "group_id", "score", "delta_1m", "band", "percentile", "size_cohort", "erp", "main_bank", "has_invoices"]].copy()
        show["score"] = show["score"].map(lambda v: f"{100 * v:.1f}%")
        show["delta_1m"] = show["delta_1m"].map(lambda v: "—" if pd.isna(v) else f"{100 * v:+.1f} pp")
        show["percentile"] = show["percentile"].map(lambda v: f"{100 * v:.0f}")
        st.dataframe(show.rename(columns={"company_id": "Empresa", "group_id": "Grupo", "score": "Score", "delta_1m": "Δ 1 mes", "band": "Banda",
                                          "percentile": "Percentil", "size_cohort": "Cohorte", "erp": "ERP", "main_bank": "Banco", "has_invoices": "ERP conectado"}),
                     width="stretch", hide_index=True, height=520)
        m = pd.DataFrame(summ["by_month"])
        fig = go.Figure()
        fig.add_bar(x=m["T"], y=m["n_high"], name="empresas alto+crítico", marker_color="#ef6c00")
        fig.add_scatter(x=m["T"], y=100 * m["mean_score"], name="score medio (%)", yaxis="y2", line=dict(color="#37a"))
        fig.update_layout(height=280, margin=dict(t=30, b=10), yaxis2=dict(overlaying="y", side="right"), title="Evolución de la cartera")
        st.plotly_chart(fig, width="stretch")

# ======================================================================================
elif view == "Ficha de empresa":
    st.title("Ficha de empresa")
    top = get("/companies", sort="score", limit=500)["items"]
    ids = [x["company_id"] for x in top]
    cid = st.selectbox("Empresa", ids, index=0)
    c = get(f"/companies/{cid}")
    s = get(f"/companies/{cid}/score")
    h1, h2, h3, h4, h5 = st.columns(5)
    h1.metric("Score actual", pct(s["score"], 1), delta=None if s["delta_1m"] is None else f"{100 * s['delta_1m']:+.1f} pp", delta_color="inverse")
    h2.markdown(f"**Banda**<br>{badge(s['band'])}", unsafe_allow_html=True)
    h3.metric("Percentil (cartera)", f"{100 * s['percentile']:.0f}")
    h4.metric("Percentil (cohorte)", f"{100 * s['percentile_cohort']:.0f}")
    h5.metric("Modelo A (solo balance)", pct(s["score_A"], 1), help="Lo que vería un scoring tradicional con las mismas empresas")
    st.caption(f"Grupo {c['group_id']} ({int(c['group_size'] or 1)} empresas) · país {c['country']} · ERP {c['erp']} · banco principal {c['main_bank']} · "
               f"{int(c['n_bank_accounts'])} cuentas · {int(c['n_debt_products'])} productos de financiación · historial {int(c['months_in_panel'])} meses")

    left, right = st.columns([1.2, 1])
    with left:
        st.subheader("¿Por qué? — explicación SHAP")
        ex = pd.DataFrame(s["explanation"])
        if len(ex):
            ex["color"] = ex["shap"].map(lambda v: "#c62828" if v > 0 else "#2e7d32")
            fig = go.Figure(go.Bar(x=ex["shap"][::-1], y=ex["text"][::-1], orientation="h", marker_color=ex["color"][::-1]))
            fig.update_layout(height=360, margin=dict(t=10, b=10, l=10), xaxis_title="contribución al riesgo (log-odds)")
            st.plotly_chart(fig, width="stretch")
            st.caption("Rojo: empuja el riesgo hacia arriba · verde: lo reduce. " + " · ".join(f"{BLOCK_NAME.get(b, b)}" for b in ex["block"].unique()[:4]))
    with right:
        st.subheader("Evolución del score")
        ss = pd.DataFrame(c["score_series"])
        fig = go.Figure()
        fig.add_scatter(x=ss["T"], y=100 * ss["score"], name="Modelo B (comportamental)", line=dict(color="#37a", width=3))
        fig.add_scatter(x=ss["T"], y=100 * ss["score_A"], name="Modelo A (proxy FICO)", line=dict(color="#999", dash="dot"))
        real = ss[ss["realized_label"].notna()]
        if len(real):
            fig.add_scatter(x=real["T"], y=100 * real["realized_label"], name="deterioro observado (etiqueta)", mode="markers",
                            marker=dict(color="#c62828", size=7, symbol="x"))
        fig.update_layout(height=360, margin=dict(t=10, b=10), yaxis_title="probabilidad (%)", legend=dict(orientation="h", y=-0.2))
        st.plotly_chart(fig, width="stretch")
        st.caption("Meses con etiqueta conocida: score in-sample (el modelo final se entrena con todos los meses etiquetados). "
                   "Meses posteriores: fuera de muestra.")

    st.subheader("Series de tesorería")
    k = pd.DataFrame(c["kpi_series"])
    g1, g2, g3 = st.columns(3)
    with g1:
        fig = go.Figure()
        fig.add_bar(x=k["T"], y=k["inflow_oper"], name="cobros", marker_color="#2e7d32")
        fig.add_bar(x=k["T"], y=-k["outflow_oper"], name="pagos", marker_color="#c62828")
        fig.add_scatter(x=k["T"], y=k["cash_balance"], name="caja reconstruida", line=dict(color="#37a", width=3))
        fig.update_layout(barmode="relative", height=300, margin=dict(t=30, b=10), title="Caja y flujos", legend=dict(orientation="h", y=-0.25))
        st.plotly_chart(fig, width="stretch")
    with g2:
        fig = go.Figure()
        fig.add_scatter(x=k["T"], y=k["pay_dpd_mean_w3"], name="DPD pago a proveedores (3 m)", line=dict(color="#ef6c00"))
        fig.add_scatter(x=k["T"], y=k["rec_dpd_mean_w3"], name="DPD cobro de clientes (3 m)", line=dict(color="#6a1b9a"))
        fig.update_layout(height=300, margin=dict(t=30, b=10), title="Retrasos de pago (días)", legend=dict(orientation="h", y=-0.25))
        st.plotly_chart(fig, width="stretch")
    with g3:
        fig = go.Figure()
        fig.add_scatter(x=k["T"], y=100 * k["pay_open_overdue_share_w3"], name="% facturas a pagar vencidas", line=dict(color="#c62828"))
        fig.add_bar(x=k["T"], y=k["interest_n_w3"], name="liquidaciones de intereses (3 m)", marker_color="#999", yaxis="y2")
        fig.update_layout(height=300, margin=dict(t=30, b=10), title="Morosidad y descubierto", yaxis2=dict(overlaying="y", side="right"), legend=dict(orientation="h", y=-0.25))
        st.plotly_chart(fig, width="stretch")

# ======================================================================================
elif view == "Benchmarks":
    st.title("Benchmarks — posición frente a la cohorte")
    ids = [x["company_id"] for x in get("/companies", sort="score", limit=500)["items"]]
    cid = st.selectbox("Empresa", ids)
    b = get("/benchmarks", company_id=cid)
    coh = b["cohort"]
    if not b["rows"]:
        st.warning("Cohorte con menos de 10 empresas: no se muestra benchmark (regla de honestidad estadística).")
        st.stop()
    n = b["rows"][0]["n"]
    st.caption(f"Cohorte: tamaño **{coh['size_cohort']}** × país **{coh['country_group']}** × grupo **{coh['group_bucket']}** → **{n} empresas**"
               + (" · (respaldo: solo por tamaño, la celda fina tenía < 10 empresas)" if coh["fallback_to_size_only"] else ""))
    labels = {"score": ("Score de riesgo", True), "pay_dpd_mean_w3": ("DPD pago a proveedores (3 m)", True), "pay_open_overdue_share_w3": ("% facturas a pagar vencidas (3 m)", True),
              "io_ratio_w3": ("Ratio cobros/pagos (3 m)", False), "cash_months_of_outflow": ("Meses de gasto cubiertos por caja", False),
              "hhi_in": ("Concentración de clientes (HHI)", True), "interest_n_w3": ("Liquidaciones de intereses (3 m)", True)}
    rows = pd.DataFrame(b["rows"])
    cols = st.columns(2)
    for i, (_, r) in enumerate(rows.iterrows()):
        lbl, worse_high = labels.get(r["kpi"], (r["kpi"], True))
        own = (b["own"] or {}).get(r["kpi"])
        fig = go.Figure()
        fig.add_bar(x=[r["p75"] - r["p25"]], base=[r["p25"]], y=[lbl], orientation="h", marker_color="#cfd8dc", name="p25–p75")
        fig.add_scatter(x=[r["p50"]], y=[lbl], mode="markers", marker=dict(symbol="line-ns", size=25, color="#455a64", line=dict(width=3)), name="mediana")
        if own is not None:
            col = "#c62828" if (own > r["p75"]) == worse_high and own != r["p75"] else ("#2e7d32" if (own < r["p25"]) == worse_high and own != r["p25"] else "#f9a825")
            fig.add_scatter(x=[own], y=[lbl], mode="markers", marker=dict(size=16, color=col), name="esta empresa")
        fig.update_layout(height=140, margin=dict(t=10, b=10, l=10, r=10), showlegend=(i == 0), yaxis=dict(showticklabels=False), title=dict(text=lbl, font=dict(size=13)))
        cols[i % 2].plotly_chart(fig, width="stretch")
    st.caption("Barra gris: rango p25–p75 de la cohorte · marca: mediana · punto: esta empresa (rojo = peor que p75, verde = mejor que p25).")

# ======================================================================================
elif view == "Simulador":
    st.title("Simulador — ¿y si…?")
    ids = [x["company_id"] for x in get("/companies", sort="score", limit=500)["items"]]
    cid = st.selectbox("Empresa", ids)
    scen = get("/scenarios")
    c1, c2 = st.columns([1, 1])
    with c1:
        scenario = st.selectbox("Escenario", ["(ninguno)"] + list(scen), format_func=lambda k: scen.get(k, k))
        st.markdown("**Ajustes manuales** (se aplican sobre el escenario)")
        feats = get(f"/companies/{cid}/features")["features"]
        knobs = {"pay_dpd_mean_w3": ("Retraso medio de pago a proveedores 3 m (días)", -30, 120, 1.0),
                 "rec_dpd_mean_w3": ("Retraso medio de cobro de clientes 3 m (días)", -30, 120, 1.0),
                 "cash_months_of_outflow": ("Meses de gasto cubiertos por la caja", -3.0, 12.0, 0.1),
                 "io_ratio_w3": ("Ratio cobros/pagos 3 m", 0.0, 3.0, 0.05),
                 "top1_in_share": ("Peso del mayor cliente (0–1)", 0.0, 1.0, 0.01),
                 "interest_n_w3": ("Liquidaciones de intereses 3 m", 0, 15, 1.0)}
        overrides = {}
        for f, (lbl, lo, hi, step) in knobs.items():
            cur = feats.get(f)
            cur = float(min(max(float(cur), lo), hi)) if cur is not None else float(lo)
            v = st.slider(lbl, float(lo), float(hi), cur, float(step), key=f"k_{f}", help=None if feats.get(f) is not None else "sin dato para esta empresa")
            if abs(v - cur) > 1e-9:
                overrides[f] = v
    with c2:
        res = post("/simulate", {"company_id": cid, "scenario": None if scenario.startswith("(") else scenario, "overrides": overrides})
        a, b_ = res["before"], res["after"]
        m1, m2, m3 = st.columns(3)
        m1.metric("Score actual", pct(a["score"], 1)); m1.markdown(badge(a["band"]), unsafe_allow_html=True)
        m2.metric("Score simulado", pct(b_["score"], 1), delta=f"{100 * res['delta']:+.1f} pp", delta_color="inverse"); m2.markdown(badge(b_["band"]), unsafe_allow_html=True)
        m3.metric("Cambios aplicados", len(res["applied_changes"]))
        if res["applied_changes"]:
            with st.expander("Ver cambios aplicados a las features"):
                st.json(res["applied_changes"])
        ex = pd.DataFrame(res["explanation_after"])
        if len(ex):
            ex["color"] = ex["shap"].map(lambda v: "#c62828" if v > 0 else "#2e7d32")
            fig = go.Figure(go.Bar(x=ex["shap"][::-1], y=ex["text"][::-1], orientation="h", marker_color=ex["color"][::-1]))
            fig.update_layout(height=380, margin=dict(t=10, b=10), title="Explicación del score simulado")
            st.plotly_chart(fig, width="stretch")
    st.caption("El simulador modifica el vector de features de la empresa y vuelve a puntuar con el mismo pipeline (POST /simulate). "
               "Los escenarios son aproximaciones: mueven las variables que un tesorero controla o sufre.")

# ======================================================================================
elif view == "Rendimiento del modelo":
    st.title("Rendimiento del modelo — A vs B")
    info = get("/model/info")
    hold, lift = info["holdout"], info["lift"]
    st.markdown(f"**Tesis**: la tesorería diaria anticipa el deterioro que un scoring de balance no ve. "
                f"Modelo A = solo bloque estructural ({info['feature_blocks']['A']} variables, «lo que ve un banco»). "
                f"Modelo B = A + comportamiento ({info['n_features']} variables).")
    lg = lift["lgbm"]
    c1, c2, c3, c4 = st.columns(4)
    c1.metric("AUC-PR Modelo A (LightGBM)", f"{hold['lgbm_A']['auc_pr']:.3f}")
    c2.metric("AUC-PR Modelo B (LightGBM)", f"{hold['lgbm_B']['auc_pr']:.3f}", delta=f"+{lg['lift_mean']:.3f}")
    c3.metric("IC 95 % del lift (bootstrap)", f"[{lg['lift_ci'][0]:+.3f}, {lg['lift_ci'][1]:+.3f}]")
    c4.metric("Cuota SHAP bloques B–F", pct(info.get("shap_block_importance", {}).get("behavioural_share")))
    st.caption(f"Holdout = {hold['lgbm_B']['n']} filas empresa-mes de los últimos meses etiquetados, base rate {pct(hold['lgbm_B']['base_rate'])}; "
               f"entrenamiento con embargo de {info['label']['embargo_months']} meses (solo etiquetas conocibles en el mes evaluado). "
               f"Modelo principal servido: **{info['main_model']}** (ensemble LightGBM+CatBoost si mejoró en CV).")

    rows = []
    for k, v in hold.items():
        rows.append({"modelo": k, "AUC-PR": v["auc_pr"], "AUC-ROC": v["auc_roc"], "precision@50": v["p@50"], "recall@top10%": v["r@top10pct"], "Brier": v["brier"]})
    st.dataframe(pd.DataFrame(rows).round(3), hide_index=True, width="stretch")

    t1, t2 = st.columns(2)
    with t1:
        st.subheader("Estabilidad temporal (CV)")
        cv = pd.DataFrame([{"modelo": k, "AUC-PR medio": v["auc_pr_mean"], "desv.": v["auc_pr_std"]} for k, v in info["cv"].items()]).round(3)
        st.dataframe(cv, hide_index=True, width="stretch")
        cal = info["calibration"]
        st.metric("Brier (sin → con calibración Platt)", f"{cal['brier_raw']:.3f} → {cal['brier_cal']:.3f}")
    with t2:
        st.subheader("Ablación por bloques (Δ AUC-PR holdout)")
        ab = info.get("ablation", {})
        if ab:
            a = pd.DataFrame([{"experimento": k.replace("A_plus_", "A + ").replace("B_minus_", "B − "), "Δ vs referencia": v["delta_holdout"], "ref": v["reference"]} for k, v in ab.items()])
            fig = px.bar(a, x="experimento", y="Δ vs referencia", color="ref", color_discrete_map={"lgbm_A": "#173", "lgbm_B": "#c77"})
            fig.update_layout(height=320, margin=dict(t=10, b=10))
            st.plotly_chart(fig, width="stretch")
            st.caption("Verde: qué gana el baseline al añadir un bloque. Rojo: qué pierde el modelo completo al quitarlo (los bloques son parcialmente redundantes entre sí).")
    st.subheader("Importancia global (TreeSHAP) por bloque")
    bi = info.get("shap_block_importance", {}).get("by_block_share", {})
    if bi:
        d = pd.DataFrame({"bloque": [f"{k} · {BLOCK_NAME.get(k, k)}" for k in bi], "cuota": list(bi.values())})
        fig = px.bar(d, x="bloque", y="cuota", color="bloque", color_discrete_sequence=["#999", "#d55", "#37a", "#e93", "#8c5", "#a6a"])
        fig.update_layout(height=300, showlegend=False, margin=dict(t=10, b=10))
        st.plotly_chart(fig, width="stretch")
    tf = pd.DataFrame(info.get("top_features", []))
    if len(tf):
        st.dataframe(tf[["label", "block", "mean_abs_shap"]].head(20).round(4).rename(columns={"label": "variable", "block": "bloque", "mean_abs_shap": "media |SHAP|"}), hide_index=True, width="stretch")
    err = info.get("error_analysis", {})
    if err:
        st.subheader("Análisis de errores (holdout, top-15 % marcado como riesgo)")
        st.write(err.get("confusion_top15pct"))
        st.write("Componente de deterioro dominante en los falsos negativos:", err.get("fn_dominant_component"))
        st.info(err.get("reading"))
