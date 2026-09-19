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
- [x] Despliegue: todo estático en Cloudflare (`wrangler.jsonc`); datos precalculados con `python -m src.pulso`
- [x] Pestaña **Proveedores**: bancos y conectores con los que está conectada cada empresa, y al desplegar cada
      proveedor, sus empresas con velocímetro y puntuación (`pipeline/src/providers.py` → `providers.json`,
      `frontend/src/providers/`, velocímetro reutilizable en `frontend/src/shared/Gauge.tsx`).
      Los proveedores comerciales (facturas) no entran: en el dataset ninguna contraparte se comparte entre dos
      empresas (124.030 contrapartes, todas de una sola empresa), así que esa relación no existe.

## Siguiente

- [ ] Día de la evaluación: puntuar el test oculto con `python -m src.predict --raw <csv> --out <salida>` y subir al leaderboard
- [ ] Migrar al front de Pulso todo lo que enseña el Streamlit (cartera, alertas, ficha, benchmarks, simulador, modelo) y borrarlo después
- [ ] Señales en directo: reproducir mes a mes las alertas (máquina del tiempo)
- [ ] Ensayar el pitch de la demo (cuenta tanto como el producto, según el brief)

## En curso — "Cómo subir tu score" (simulador de palancas con restricciones)

Sección nueva en la vista Empresa que va del diagnóstico a la acción: qué le baja el score y qué
palancas lo arreglan, cada una graduable y descartable. Absorbe la sección "Qué hacer" actual.

Decidido con el usuario: mejor plan con las palancas que queden activas · slider por palanca
(no on/off) · score exacto vía FastAPI · la sección absorbe "Qué hacer", "Qué lo ha movido" se queda.

### Backend
- [x] 1. Extraer `metric_values` / `overrides_for` / `METRIC_META` de `src/pulso.py` a `src/metrics.py`
      (hoy la API no puede usarlos sin importar el exportador entero). Test de ida y vuelta métrica→features.
- [x] 2. `POST /companies/{id}/plan` en `src/api/main.py`: recibe `{targets: {metricId: valor}}`,
      acumula overrides de todas las palancas activas y repuntúa **una sola vez** con el ensemble.
      Devuelve salud base, salud del plan, delta exacto y el marginal de cada palanca. Tests.
- [x] 3. `drags`: los drivers negativos del mes, ya en puntos de salud, y qué métrica los corrige.

### Frontend
- [x] 4. Contrato en `src/api/types.ts` (`Plan`, `PlanLever`, `Drag`) + `getPlan()` en `src/api/index.ts`,
      con **degradación a `simulate.json`** si el backend no responde (la demo no puede caerse).
- [x] 5. `src/company/ImproveSection.tsx`: "Te hunde" + palancas con slider y botón de descartar
      (patrón `aria-pressed` de `AlertsView`, no checkbox) + resumen del plan. Tokens semánticos.
- [x] 6. Montar en `CompanyView.tsx` y retirar `DecisionsSection` (absorbida); mover sus tests.

### Pendiente de decisión tuya
- [ ] Regenerar los JSON estáticos (`python -m src.pulso`) para que el camino degradado use la
      rejilla con la palanca de caja ya corregida. **Ojo**: `pulso.export()` hace `rmtree` de
      `frontend/public/data/`, lo que borraría los 1.286 `tellme.json` de Gemini. Hay que salvarlos
      antes o regenerarlos después.

### Verificación
- [x] 7. `npm test` y `npm run lint` en verde; tests de pytest del endpoint nuevo.
- [x] 8. Probarlo en el navegador: descartar una palanca y ver que el plan se recalcula.

## Notas

- El trabajo anterior sigue en el historial de git. Para recuperar algo:
  `git checkout <commit> -- <ruta>` (p. ej. el plan y la auditoria estan en `96b27cf`).
