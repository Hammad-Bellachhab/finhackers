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

## Siguiente

- [ ] Decidir **que producto** se monta encima del score (requisito obligatorio)
- [ ] Definir las pantallas de la demo navegable
- [ ] Construir la capa de features mes a mes desde `transactions` / `invoices`
- [ ] Definir la etiqueta del score (no hay target dado: hay que construirlo)
- [ ] Modelo + explicabilidad (SHAP) y metrica de anticipacion

## Notas

- El trabajo anterior (pipeline de ML, dataset, docs) sigue en la rama `main`.
  Para recuperar algo: `git checkout main -- <ruta>`.
- DuckDB lee `transactions.csv` (472 MB, 2.556.437 registros) en ~1 s. Es la via
  para explorar; no cargar los CSV grandes en memoria con pandas.
