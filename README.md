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

## Bases de datos: hay dos, con propósitos distintos

- **`db/finhackers.db`** — catálogo relacional 1:1 de los 9 CSV crudos (groups,
  companies, products, transactions, invoices, balances...), normalizado con
  PK/FK. Sirve para explorar el dataset con SQL tal cual viene, sin lógica de
  negocio encima. Esquema, ETL y diagrama ER en [`db/README.md`](db/README.md)
  y [`docs/er_diagram.md`](docs/er_diagram.md):

  ```bash
  python3 db/build_db.py --force   # requiere data/raw/ (ver docs/reto-embat.md)
  ```

- **`pipeline/data/serve.db`** — la base que sirve el motor de scoring en
  producción (API + dashboard): panel empresa×mes, features, `risk_score`,
  explicaciones SHAP, alertas y benchmarks ya calculados. Se genera con
  `python -m src.pipeline all` dentro de `pipeline/` (ver abajo). No es el
  mismo dato que `db/finhackers.db`: aquí ya hay modelo aplicado.

## Frontend (puerto 5173)

```bash
cd frontend
npm install
npm run dev
```

Vite hace proxy de `/api` a `localhost:8000`, que es donde tiene que escuchar el motor.
