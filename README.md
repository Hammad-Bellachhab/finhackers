# finhackers

## Estructura

```
frontend/   SPA React + Vite + TypeScript
docs/       reto de Embat, diccionario de datos, paleta, diagrama ER
db/         esquema SQL + ETL para cargar el dataset en SQLite
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

## Base de datos relacional

Los 9 CSV del dataset se normalizan y se cargan en SQLite (esquema, ETL y
diagrama ER en [`db/README.md`](db/README.md) y
[`docs/er_diagram.md`](docs/er_diagram.md)):

```bash
python3 db/build_db.py --force   # requiere data/raw/ (ver docs/reto-embat.md)
```

## Frontend (puerto 5173)

```bash
cd frontend
npm install
npm run dev
```

Vite hace proxy de `/api` a `localhost:8000`, que es donde tiene que escuchar el motor.
