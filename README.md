# finhackers

Esqueleto minimo: API FastAPI + SPA React (Vite + TypeScript).

## Estructura

```
backend/    API FastAPI (app/main.py)
frontend/   SPA React + Vite + TypeScript
analysis/   auditoria de datos (audit.py)
docs/plan/  plan operativo del scoring: inventario, features, relaciones, modelo, tickets
```

Plan del modelo y reparto de tickets: [docs/plan/00-plan-operativo.md](docs/plan/00-plan-operativo.md).
Informe de calidad de datos: `python analysis/audit.py data/raw > docs/plan/08-data-quality-report.md` (requiere pandas).

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

Abre http://localhost:5173. La portada consulta `/api/health`; Vite hace proxy
de `/api` al backend, asi que no hay URLs absolutas en el codigo del front.

## Verificacion rapida

```bash
curl http://localhost:8000/api/health   # {"status":"ok",...}
```
