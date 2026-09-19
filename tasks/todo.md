# Tareas

## Hecho

- [x] Frontend React + Vite + TypeScript con proxy `/api` a `localhost:8000`
- [x] Brief del reto documentado en `docs/reto-embat.md`
- [x] Dataset completo (9 CSV) en `data/raw/`; invoices y transactions por Git LFS
- [x] Paleta de Embat -> `frontend/src/styles/tokens.css` y `docs/paleta-embat.md`
- [x] Motor de scoring completo (ingesta, target, features, modelos, SHAP, API, dashboard) -> `pipeline/`, ver `pipeline/README.md`
- [x] Producto + comprador definidos: Pulso, radar de salud financiera para tesorero/CFO, vendible por Embat
- [x] Demo navegable: frontend React (`frontend/`) + dashboard Streamlit, ambos contra la API real (`pipeline/src/api/pulso.py`)
- [x] Limpieza de repo: borrados `backend/` y `db/` (nadie los usaba; el motor lee Parquet y sirve `pipeline/data/serve.db`), CI en `.github/workflows/ci.yml`
- [x] Despliegue: front en Cloudflare (`wrangler.jsonc`) y motor en Fly.io (`pipeline/fly.toml`)

## Siguiente

- [ ] Día de la evaluación: puntuar el test oculto con `python -m src.predict --raw <csv> --out <salida>` y subir al leaderboard
- [ ] Migrar al front de Pulso todo lo que enseña el Streamlit (cartera, alertas, ficha, benchmarks, simulador, modelo) y borrarlo después
- [ ] Señales en directo: reproducir mes a mes las alertas (máquina del tiempo)
- [ ] Ensayar el pitch de la demo (cuenta tanto como el producto, según el brief)

## Notas

- El trabajo anterior sigue en el historial de git. Para recuperar algo:
  `git checkout <commit> -- <ruta>` (p. ej. el plan y la auditoria estan en `96b27cf`).
