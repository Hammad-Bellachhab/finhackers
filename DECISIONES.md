# Decisiones

Registro de decisiones tomadas sin supervisión. Una línea de justificación cada una.

## Bloque 1: scaffold

- Se continúa el scaffold existente (index.html, tokens.css, global.css, theme/) en vez de rehacerlo: ya cumplía el prompt y el build estaba a un paso de pasar. Faltaban `main.tsx`, `App.tsx` y `theme-toggle.css`.
- `--ink-muted` está al 65% y `--ink-secondary` al 70% (el prompt sugería 65% y 40%): el 40% no llega a contraste AA para texto. El 40% queda como `--ink-faint`, solo para elementos que no son texto.
- `--accent-text` mezcla el latón con `--ink` en el tema claro para llegar a AA como texto sobre superficie clara; en oscuro se usa el latón tal cual. El latón puro solo se usa como línea de gráfico y borde.
- Sin router externo (no está entre las dependencias permitidas): navegación por hash (`#/`, `#/empresa/:id`) con un hook propio.
- `overnight.log` de la raíz no se añade a git: es salida del arnés, no del proyecto.
- Git no tenía identidad configurada; los commits usan `git -c user.name=hackaton -c user.email=mbellachhab25@gmail.com` (la misma del commit previo) sin modificar la config del repo.

## Bloque 2: capa de datos

- Endpoints añadidos a los del prompt porque las vistas los necesitan: `GET /companies/{id}/kpis` (series de los gráficos), `GET /companies/filters` (sectores y grupos), `GET /portfolio/summary` (resumen de la cabecera de cartera). Todo va por `ScoringApi`.
- Interfaces del prompt intactas; las extensiones son tipos nuevos (`CompanyDetail`, `PortfolioRow`, `BenchmarkResult`, `ModelInfo`...). `Company` no lleva campos extra.
- El score es un entero de 0 a 100 (probabilidad de deterioro por 100). Bandas: bajo < 33, medio 33-57, alto ≥ 58 (~15 % superior, la prevalencia del 15 % de `arquitectura.pdf`). Un delta positivo significa más riesgo.
- "Sube rápido" = delta ≥ 10 puntos en el mes (78 de 1.286 empresas); con 8 salían 135, demasiadas para destacar.
- Percentil = % de la cartera con score menor, tope 99 (más alto = más arriesgada).
- Dataset determinista (semilla fija) y coherente: una serie latente de estrés por empresa genera a la vez el score, el DPD, la liquidez, los cobros/pagos y las facturas vencidas. El estrés de grupo se contagia a las filiales (contagio intragrupo del PDF).
- 250 grupos con cola larga (1 a 19 filiales) y 1.286 empresas, como en el PDF. Meses: los 24 que terminan en el mes actual.
- Benchmarks: el prompt pide cohorte tamaño × país × grupo, pero con 250 grupos casi ninguna cohorte triple llega a 10. Se devuelven dos cohortes por métrica: tamaño × país (suele ser ≥ 10) y grupo (suele ser < 10, se muestra "no disponible"). Umbral de 10 en `MIN_COHORT_SIZE`.
- `ModelInfo` incluye ya lo de la vista 3 (comparación A/B con IC, curva PR, ablación por bloques A-F, SHAP global) para que el contrato quede completo. Curva PR paramétrica con área = AUC-PR objetivo (0,55 y 0,71). Los números de IC, ablación y SHAP son inventados con rangos creíbles.
- La explicación es una frase generada a partir del factor dominante con los KPIs reales de la empresa; las contribuciones son una aproximación, no SHAP real.
- El dataset se construye al cargar `mockApi` para que no cuente dentro de la latencia simulada de 300-600 ms.
