# Tareas

## Hecho

- [x] Rama `clean-start` desde `main` y borrado total del contenido anterior
- [x] Backend FastAPI minimo con `GET /api/health` y CORS para el dev server
- [x] Frontend React + Vite + TypeScript con proxy `/api` al backend
- [x] Verificado que ambos servicios levantan y se comunican
- [x] Brief del reto documentado en `docs/reto-embat.md`
- [x] Dataset completo (9 CSV, 646 MB) en `data/raw/`, fuera de git
- [x] Stack de datos instalado: duckdb, polars, pandas, scikit-learn, lightgbm, shap
- [x] Paleta de Embat extraida de su design system -> `frontend/src/styles/tokens.css`
      y `docs/paleta-embat.md`, verificada en claro y oscuro

- [x] FASE 0: auditoria de datos (`analysis/audit.py`) y plan operativo en `docs/plan/`

## Siguiente

- [ ] Decidir **que producto** se monta encima del score y **quien lo paga** (sin responsable aun)
- [ ] Definir las pantallas de la demo navegable
- [ ] Tickets de modelo, datos y features: ver `docs/plan/00-plan-operativo.md` (empezar por T0.2 y T1.1)

## Notas

- El trabajo anterior (pipeline de ML, dataset, docs) sigue en la rama `main`.
  Para recuperar algo: `git checkout main -- <ruta>`.
- DuckDB lee `transactions.csv` (472 MB, 2.556.437 registros) en ~1 s. Es la via
  para explorar; no cargar los CSV grandes en memoria con pandas.
