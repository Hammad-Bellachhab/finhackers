# Progreso — TellMe + marca Embat (PRD: docs/superpowers/specs/2026-09-19-agente-ia-prd.md)

Si la sesión se corta, retomar desde el primer paso sin marcar.

- [x] 0. Análisis, PRD y confirmación del usuario (sin sub-pestañas, sin Worker, IA = TellMe, marca Embat)
- [x] 1. Contrato TellMe en `frontend/src/api/types.ts` + `getTellMe` con mock en `api/index.ts`
- [x] 1b. Logo `frontend/public/embat.svg` y fuente Haffer (`frontend/public/fonts-haffer-*.woff2`)
- [x] 2. Guía visual (ui-designer) → `docs/superpowers/specs/2026-09-19-pulso-visual.md`
- [x] 3a. `pipeline/src/tellme.py` (ai-engineer)
- [x] 3b. Marca Embat + tarjetas TellMe en el front (frontend-developer)
- [x] 4. TellMe generado: 1.286/1.286 empresas + cartera, 0 fallos (58 min)
- [x] 5a. Revisión ui-finish-gate-reviewer: aplicados 2,3(favicon),4,6,7,9,10,11. No aplicados: 1 (tabular-nums rompe decimales en Haffer), 8 (escala tipográfica, cosmético), 5/12 (a11y menor)
- [x] 5. Preview local lista en http://localhost:5173 (pendiente: visto bueno del usuario) — **el usuario la aprueba antes de push**
- [x] 6. Checklist "ningún dato perdido" (tasks/checklist-datos.md): todas las secciones en las 5 pestañas, 0 errores
- [ ] 7. Commit + push (lo hace el usuario)

## Notas
- Gemini: key OK; modelos disponibles incluyen gemini-flash-latest, gemini-3.5-flash. ~2 s por llamada.
- 3a: `python -m src.tellme` (--selftest sin Gemini); cartera + COMP_0058/0001/0032 generados en ~11 s con 6 en paralelo; la key va en cabecera `x-goog-api-key`, no en la URL.
- Cabecera: 'Embat · X-Ray' (el usuario dijo que el nombre no es Pulso; la IA es TellMe).
- TellMe cambia COMP_xxxx por nombres en el front (api/index.ts getTellMe).

## Chat con TellMe (notch abajo centrado)
- [x] Worker `worker/index.js` (`POST /api/ask`), key como secreto del Worker (`.dev.vars` en local, fuera de git)
- [x] `wrangler.jsonc`: main + binding ASSETS + run_worker_first /api/*; Vite proxy /api → :8787
- [x] Front: `shared/AskTellMe.tsx` + `ask-tellme.css`, contexto = empresa abierta o cartera
- [x] Probado en local (wrangler dev + Vite): cartera y COMP_0058 responden con datos reales
- [ ] Producción: `npx wrangler secret put GEMINI_API_KEY` (usuario) + push
