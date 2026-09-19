# finhackers

## Estructura

```
frontend/   SPA React + Vite + TypeScript
docs/       reto de Embat, diccionario de datos, paleta, diseño de Pulso
data/raw/   los 9 CSV del reto (invoices y transactions en Git LFS)
pipeline/   motor de scoring: datos → etiqueta → features → modelos → SHAP → BD → API (puerto 8000) → dashboard
```

## Motor de scoring (`pipeline/`)

Sistema de ML que estima la probabilidad de deterioro financiero a 6 meses a partir de la tesorería y la traduce a
salud (0–100), trayectoria y alertas, con explicación por empresa. Todo documentado en
[`pipeline/README.md`](pipeline/README.md) (resultados, decisiones, test simulado con 82 empresas nunca vistas).

```bash
cd pipeline
pip install -r requirements.txt
python -m src.pipeline all                        # ≈ 8 min: reconstruye todo desde data/raw/
python -m uvicorn src.api.main:app --port 8000    # API del motor (docs en http://localhost:8000/docs)
python -m streamlit run src/frontend/app.py       # dashboard de referencia en http://localhost:8501
python -m src.predict --raw <csv> --out <salida>  # puntuar empresas nuevas
```

## Despliegue

Todo en Cloudflare, sin servidor: el motor precalcula cada respuesta del front a JSON y Cloudflare sirve
el front con esos archivos (`wrangler.jsonc`). Se despliega solo en cada push a `main`.

```bash
cd pipeline
python -m src.pipeline all   # si cambian datos o modelo
python -m src.pulso          # → frontend/public/data/ (≈ 4 min); commit + push y Cloudflare publica
```

## Frontend (puerto 5173)

```bash
cd frontend
npm install
npm run dev
```

El front lee los JSON de `frontend/public/data/` (los genera `python -m src.pulso`); no necesita el motor encendido.
