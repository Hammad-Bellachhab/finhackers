# Progreso

## Bloque 1: scaffold (hecho y verificado)

- Vite + React 18 + TypeScript estricto (`strict`, `noUncheckedIndexedAccess`, sin `any`).
- Tokens de diseño como variables CSS: color por tema, escala tipográfica, espaciado de 4 px, radios, movimiento.
- Fraunces, IBM Plex Sans e IBM Plex Mono cargadas desde Google Fonts en `index.html`.
- Toggle de tema "Índice de tesorería" / "Terminal Embat" con persistencia en `localStorage`; el script de `index.html` aplica el tema guardado antes de pintar.
- Verificado: `npm run build` termina sin errores.

## Bloque 2: capa de datos (hecho y verificado)

- `src/api/types.ts`: interfaces del prompt, extensiones y la interfaz `ScoringApi` (una función por endpoint).
- `src/api/mockApi.ts` + `src/api/mock/`: implementación con latencia de 300-600 ms, 1.286 empresas con nombres españoles únicos, 250 grupos, 24 meses de score y KPIs, AUC-PR 0,71.
- `src/api/index.ts` es la única puerta de entrada; ningún fichero fuera de `src/api/` importa datos mock (comprobado con grep).
- Verificado: `npm run build` sin errores, y una ejecución en Node del mock: 1.286 empresas, 1.286 nombres distintos, bandas 705/383/198, área de la curva PR 0,709 (B) y 0,550 (A), explicaciones en lenguaje natural correctas, 404 en id inexistente.
