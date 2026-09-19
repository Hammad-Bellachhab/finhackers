# Tareas

## Hecho

- [x] Frontend React + Vite + TypeScript con proxy `/api` a `localhost:8000`
- [x] Brief del reto documentado en `docs/reto-embat.md`
- [x] Dataset completo (9 CSV, 646 MB) en `data/raw/`, fuera de git
- [x] Paleta de Embat -> `frontend/src/styles/tokens.css` y `docs/paleta-embat.md`
- [x] Dataset normalizado a esquema relacional (SQLite) -> `db/schema.sql`, `db/build_db.py`, `docs/er_diagram.md`
- [x] Motor de scoring completo (ingesta, target, features, modelos, SHAP, API, dashboard) -> `pipeline/`, ver `pipeline/README.md`
- [x] Producto + comprador definidos: Pulso, radar de salud financiera para tesorero/CFO, vendible por Embat
- [x] Demo navegable: frontend React (`frontend/`) + dashboard Streamlit, ambos contra la API real (`pipeline/src/api/pulso.py`)
- [x] Limpieza de repo: borrado `backend/` (esqueleto huérfano, ya no lo usa nadie), añadido `.github/workflows/ci.yml`
      (el README de `pipeline/` ya lo mencionaba pero no existía), aclarado en el README raíz que `db/finhackers.db`
      (catálogo 1:1 del CSV) y `pipeline/data/serve.db` (datos + modelo aplicado) son bases distintas

## Siguiente

- [ ] Enganchar el test oculto oficial de los organizadores en cuanto se publique (correr `predict.py` /
      `evaluate_test.py` de `pipeline/` contra ese CSV y subir al leaderboard) — de momento solo hay test simulado
      propio (82 empresas reservadas)
- [ ] Ensayar el pitch de la demo (cuenta tanto como el producto, según el brief)

## Notas

- El trabajo anterior sigue en el historial de git. Para recuperar algo:
  `git checkout <commit> -- <ruta>` (p. ej. el plan y la auditoria estan en `96b27cf`).
