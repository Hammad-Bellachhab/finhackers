# finhackers

Reto X-Ray de Embat, HackSpain 2026. Un score de salud financiera y, encima, **Pulso**:
tu score gratis, el de las empresas con las que trabajas de pago.

- El reto y el dataset: `docs/reto-embat.md`
- El diseño del producto: `docs/superpowers/specs/2026-09-19-pulso-design.md`
- La paleta: `docs/paleta-embat.md`

## Estructura

```
backend/    API FastAPI + herramientas de datos y modelo
frontend/   SPA React + Vite + TypeScript
docs/       reto, diccionario de datos, paleta, diseño
data/raw/   el dataset (fuera de git, 646 MB)
```

## Arranque

Dos terminales.

**Backend** (puerto 8000):

```bash
cd backend
python -m venv .venv
.venv/Scripts/activate           # PowerShell: .venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

**Frontend** (puerto 5173):

```bash
cd frontend
npm install
npm run dev
```

Abre http://localhost:5173. Vite hace proxy de `/api` al backend, así que en el código del
front no hay URLs absolutas.

## El dataset

No está en git: son 646 MB, y `transactions.csv` (472 MB) e `invoices.csv` (172 MB) superan el
límite por fichero de GitHub. Descomprime `output_hackspain_data.zip` en `data/raw/`.

Se consulta con DuckDB, que lee los CSV grandes sin cargarlos en memoria:

```python
import duckdb
duckdb.sql("SELECT count(*) FROM read_csv_auto('data/raw/transactions.csv')")
# 2.556.437 registros en ~1 s
```

Tres avisos que evitan errores silenciosos (detalle en `docs/reto-embat.md`): hay saltos de
línea dentro de campos entrecomillados, así que no se cuenta por líneas; `balances.csv` es una
foto única, no una serie; y las empresas se agrupan en holdings, con riesgo de leakage entre
train y test.

## Estado

El motor de scoring está en construcción. El front avanza contra datos mock detrás del
contrato de API de la sección 5 del diseño, para poder cablearlo después sin tocar pantallas.
