# Frontend 02. Arquitectura

## Estructura de `frontend/src`

```
src/
├── api/               Contrato tipado (types.ts), mockApi y dataset determinista
├── app/               Shell, rutas por hash y estilos globales de la app
├── portfolio/         Vista Cartera: resumen, filtros, tabla, paginación
├── company-profile/   Ficha de empresa: cabecera, gráficos, resumen del score
├── shared/            Formato es-ES, badges de banda, delta, hooks
├── styles/            Tokens de diseño (color, tipografía, espaciado) y CSS global
└── theme/             Toggle de tema claro/oscuro con persistencia
```

## Capa de datos

`src/api/types.ts` define las interfaces del dominio (`Company`, `RiskScore`, `ScoreExplanation`, `CompanyMonthKpi`, ...) y la interfaz `ScoringApi`, con una función por endpoint.

`src/api/index.ts` es la única puerta de entrada. Cambiar el mock por un backend real consiste en sustituir la implementación que exporta.

## Mock determinista

- 1.286 empresas con nombres españoles únicos y 250 grupos con cola larga (1 a 19 filiales)
- 24 meses de score y KPIs por empresa
- Una serie latente de estrés por empresa genera a la vez score, DPD, liquidez, cobros/pagos y facturas vencidas
- El estrés de grupo se contagia a las filiales
- Latencia simulada de 300-600 ms para ejercitar los estados de carga

## Score y bandas

El score es un entero de 0 a 100 (probabilidad de deterioro por 100).

| Banda | Score |
| --- | --- |
| Bajo | < 33 |
| Medio | 33-57 |
| Alto | ≥ 58 |

Un delta positivo significa más riesgo. "Sube rápido" es un delta ≥ 10 puntos en el mes.

## Diseño

- Tokens como variables CSS, con un conjunto de valores por tema
- Fraunces, IBM Plex Sans e IBM Plex Mono
- Contraste AA calculado para los tokens de texto en ambos temas

El detalle y la justificación de cada elección están en [03-decisiones.md](03-decisiones.md).
