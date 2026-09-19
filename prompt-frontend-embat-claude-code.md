# Frontend — Sistema de scoring de salud financiera (Embat / HackSpain 2026)

## Alcance de esta tarea

Vas a construir SOLO el frontend, como app standalone en `frontend/`, contra datos
simulados con un contrato tipado que luego se sustituye por la API real sin tocar
componentes. No implementes backend, ingesta ni entrenamiento — si `arquitectura.pdf`
está en el repo, léelo solo para contexto de negocio (qué mide el score, qué es DPD,
qué son las 5 vistas), no para decisiones de arquitectura de datos.

El público de esta interfaz es un tesorero o CFO leyendo su cartera de empresas.
El criterio de diseño es que esa persona responda "¿de qué me preocupo hoy?" en
menos de diez segundos. No estás construyendo una landing page ni un dashboard SaaS
genérico: es una herramienta de trabajo densa en datos, de uso diario.

## No negociable: por qué existe cada decisión

Antes de tocar código, interioriza esto — no es estética porque sí:
- Un tesorero mira esta pantalla cada mañana. La densidad de información importa
  más que el aire en blanco decorativo de una landing.
- El **delta** (cuánto ha subido el riesgo este mes) es más urgente que el **nivel**
  absoluto. Una empresa que sube 20 puntos es más importante que una que lleva
  6 meses estable en rojo. El diseño debe reflejar esta jerarquía, no tratarlas igual.
- La explicación del modelo (SHAP) se enseña como una frase en lenguaje natural en
  la ficha de empresa, no como un gráfico técnico — eso queda para la vista de
  rendimiento del modelo, que es la única pensada para un jurado técnico.

## El pecado a evitar: que esto parezca "hecho por una IA"

Esto es lo más importante del prompt. Antes de escribir un componente, léete esta
lista completa. Un frontend "IA genérica" cae casi siempre en una de estas 5 familias
— evítalas todas, no solo la que ya conoces:

1. **Fondo crema (~#F4F1EA) + acento terracota (~#D97757).** Es la firma visual
   más repetida de las interfaces generadas hoy. No la uses ni te acerques.
2. **Fondo casi negro + un único acento verde ácido o vermellón brillante.**
3. **Look "broadsheet" de líneas finas y cero border-radius por todas partes.**
4. **El "kit de tarjetas SaaS":** contenido troceado en tarjetas idénticas, el
   mismo `border-radius` en todo sin importar la jerarquía, la misma sombra gris
   difusa (`rgba(0,0,0,.1)`) debajo de cada una, degradados decorativos de fondo.
5. **Chrome de plantilla que aparece dé igual el tema:** etiquetas ALL-CAPS con
   letter-spacing encima de cada sección; metadatos unidos con puntos medios
   ("Riesgo · Sector · País"); títulos tipo "PALABRA — fragmento" con raya larga;
   negro "casi negro" (#0B0B0B/#111) en vez del negro real de la paleta; y sobre
   todo — la flecha `→` al final de cada botón o link. Ni uno de estos.

Esta lista es intencionadamente estricta. La única excepción es el uso de
IBM Plex Mono para cifras (ver tipografía abajo): eso no es chrome decorativo,
es una decisión tomada para este proyecto concreto con una razón (dar textura
cuantitativa a AUC/DPD/percentiles), así que sí se usa — pero solo en cifras,
nunca como etiqueta decorativa de una sección.

Regla general: gasta tu presupuesto de "atrevimiento visual" en un solo sitio
(el número de score grande en Fraunces), y mantén todo lo demás disciplinado.
Antes de dar nada por terminado, haz capturas de cada vista y revísalas contra
esta lista de 5 puntos — si algo se parece a cualquiera de ellos, corrígelo.

## Sistema de diseño — ya decidido, no lo reinventes

### Tipografía (Google Fonts, cero fricción en Vite)

| Uso | Familia | Peso |
|---|---|---|
| Titulares, nombre de empresa, número de score grande | `Fraunces` | 500 / 600 |
| UI, tablas, cuerpo de texto, navegación | `IBM Plex Sans` | 400 / 500 / 600 |
| Toda cifra: score, AUC-PR, percentil, DPD, fechas en tabla | `IBM Plex Mono` | 400 / 500 |

Activa `font-variant-numeric: tabular-nums` en las cifras de la tabla de cartera
para que las columnas numéricas alineen de verdad. Define una escala tipográfica
explícita y cíñete a ella, no tamaños sueltos por componente:

```
--text-display   56px / 1.05   Fraunces 600   (score en la ficha de empresa)
--text-h1        32px / 1.15   Fraunces 600   (título de vista)
--text-h2        20px / 1.3    Fraunces 500   (título de sección/tarjeta)
--text-body      15px / 1.6    IBM Plex Sans 400
--text-small     13px / 1.5    IBM Plex Sans 400/500  (metadatos, labels)
--text-mono      14px / 1.4    IBM Plex Mono 500      (cifras destacadas)
--text-mono-sm   12px / 1.4    IBM Plex Mono 400      (cifras en tabla)
```

### Color — dos temas, mismo sistema desplazado, no dos pieles distintas

**Claro — "Índice de tesorería" (por defecto):**
```
--bg: #EEF1F4        --surface: #FFFFFF     --ink: #16233B
--accent: #B8863B    --risk-low: #4C8062    --risk-high: #A23B32
```

**Oscuro — "Terminal Embat":**
```
--bg: #0F1720        --surface: #1A232E     --text: #E8E6DE
--accent: #D9A857     --risk-low: #6FA37E    --risk-high: #C4695A
```

Estos 6 tokens por tema son los únicos colores con nombre. Deriva texto
secundario/muted y bordes reduciendo la opacidad del ink/text (ej. `ink` al 65%
para texto secundario, al 40% para muted, al 10% para bordes tipo hairline) —
no inventes grises nuevos ni uses los grises por defecto de Tailwind si lo usas.

Reglas de uso, no las rompas:
- **Acento (latón)** solo en UN sitio por pantalla: la acción principal o la línea
  de tendencia positiva de un gráfico. Si aparece dos veces en la misma vista, dejó
  de leerse como acento.
- **riesgo-bajo / riesgo-alto** son verde salvia apagado y rojo ladrillo, no
  semáforo saturado. Con cientos de filas en la tabla, un rojo neón por fila es
  ruido antes que información — úsalos con moderación (texto o borde fino, no
  fondos sólidos llenos en cada celda).
- El toggle de tema se etiqueta con los nombres reales — "Índice de tesorería" /
  "Terminal Embat" — no "Light mode / Dark mode" genérico. Persiste la elección
  en `localStorage`. Claro por defecto; si quieres, deja el modo oscuro como
  ambientación sugerida específicamente para la vista de Rendimiento del modelo
  (efecto "sala de máquinas" frente al jurado), pero el usuario debe poder
  cambiarlo en cualquier vista.

### Espaciado, radio y bordes

Unidad base 4px, escala 4/8/12/16/24/32/48/64 — nada de valores sueltos.
Radio contenido y con propósito, no un único `rounded-2xl` en todo:
`--radius-sm: 4px` (badges, inputs, botones), `--radius-md: 8px` (tarjetas,
contenedor de tabla). Las filas de la tabla llevan borde inferior de 1px
(`ink`/`text` al 10% de opacidad), sin radio — efecto libro de contabilidad, no
tarjeta. Evita `box-shadow` salvo una sombra muy sutil en overlays/modales; en
todo lo demás, el borde de 1px hace el trabajo de separar superficies.

### Tono de referencia (no copiar, solo calibrar el ojo)

Terminal financiera tipo Bloomberg cruzada con la contención de producto real de
Linear, Mercury o Ramp, y el contraste tipográfico editorial de prensa financiera
(serif con carácter para lo humano, mono para lo cuantitativo). Denso en datos,
no minimalista de landing.

## Arquitectura de información — 5 vistas, en este orden de prioridad

Construye en este orden. Entrega 1 y 2 funcionando con datos mock antes de tocar
el resto — con eso ya hay demo si se acaba el tiempo.

### 1. Cartera (prioridad máxima)
Tabla de todas las empresas (hasta 1.286 — pagina o virtualiza, no renderices
todo de golpe sin control de rendimiento), ordenada por riesgo por defecto.
Columnas: empresa, sector, score, percentil, **delta vs. mes anterior**, banda
de riesgo, última actualización. El delta se muestra con un indicador
direccional tipográfico pequeño en mono (▲/▼), coloreado con riesgo-bajo/alto
— esto es información funcional, no una flecha decorativa de botón, son cosas
distintas y ambas reglas aplican a la vez. Búsqueda por nombre, filtro por
banda de riesgo/sector/grupo. Clic en fila → ficha de empresa. Empresas que
suben rápido deben destacar visualmente aunque su nivel absoluto no sea el
más alto — el delta pesa más que el nivel.

### 2. Ficha de empresa (prioridad máxima)
Cabecera: nombre en Fraunces grande, sector/grupo/país como metadata pequeña.
Score actual grande + percentil + badges mono de referencia (ej. "AUC-PR 0.71").
Un gráfico de evolución del score a 24 meses (Recharts, sin rellenos degradados
tipo "glow"). Serie de liquidez y DPD medio — elige 2–3 gráficos bien pensados,
no un grid de 6 gráficos idénticos (eso también es chrome genérico). Explicación
SHAP como **una frase en lenguaje natural** generada a partir del factor
dominante (ej. "El retraso medio de pago ha pasado de 4 a 23 días en los
últimos tres meses"), nunca un gráfico SHAP crudo en esta vista.

### 3. Rendimiento del modelo (si llega tiempo — es la que convence a un jurado técnico)
Tabla comparativa Modelo A vs. Modelo B con intervalos de confianza. Curva
AUC-PR de ambos modelos superpuesta. Gráfico de ablación por bloques (barra
horizontal: cuánto aporta cada bloque de features). Importancia SHAP global:
si usas Recharts, un bar chart horizontal ordenado por |contribución| media,
coloreado por dirección (aumenta/reduce riesgo) es suficiente y más legible en
cinco minutos que un beeswarm real; si quieres beeswarm de verdad necesitas
visx o D3, evalúalo solo si sobra tiempo.

### 4. Benchmarks (si llega tiempo)
Posición de la empresa frente a su cohorte (tamaño × país × grupo), con el
tamaño de la cohorte siempre visible. Si la cohorte tiene menos de 10 empresas,
muestra explícitamente "no disponible", nunca un benchmark con muestra ínfima.

### 5. Simulador (si llega tiempo)
Formulario de escenario simple (ej. "el cliente principal paga X días más
tarde") → llamada mock a `/simulate` → score proyectado vs. actual como delta.

## Contrato de datos — mock ahora, API real después sin tocar componentes

Crea `src/api/` con interfaces TypeScript y un `mockApi` que las implementa con
datos realistas y latencia simulada (300–600ms). Ni un componente debe importar
datos mock directamente — todos pasan por estas funciones, así el día que exista
el backend real solo se cambia esta capa.

```ts
interface Company {
  id: string; name: string; sector: string; country: string; groupId: string;
}
interface RiskScore {
  companyId: string; date: string; score: number; percentile: number;
  band: 'bajo' | 'medio' | 'alto'; deltaVsPrevMonth: number; modelVersion: string;
}
interface ScoreExplanation {
  companyId: string; date: string;
  topFactors: { feature: string; contribution: number; direction: 'increases' | 'decreases' }[];
  naturalLanguageSummary: string;
}
interface CompanyMonthKpi {
  companyId: string; month: string; dpdMean: number; liquidityBalance: number;
  collectionsToPaymentsRatio: number; overdueInvoiceRatio: number;
}
interface Benchmark {
  cohortKey: string; cohortSize: number; p25: number; p50: number; p75: number; metric: string;
}
```

Endpoints a simular (mismos nombres que usará la API real):
`GET /companies?query&riskBand&sector&page`, `GET /companies/{id}`,
`GET /companies/{id}/score?history=true`, `GET /companies/{id}/explanation`,
`GET /benchmarks?companyId`, `POST /simulate`, `GET /model/info`.

Genera datos mock con nombres de empresa españoles plausibles (ferreterías,
talleres, distribuidoras, consultoras — nunca "Company A/B/C" ni Lorem Ipsum),
y con las magnitudes reales del proyecto: ~1.286 empresas, AUC-PR 0.71,
percentiles y DPD con rangos creíbles (ej. de 4 a 23 días en casos de deterioro).

## Microcopy

Voz activa y concreta: un botón dice "Guardar cambios", no "Enviar". Nombra las
cosas como las entiende un tesorero, no como las construye el sistema. Estados
vacíos como invitación a actuar ("No hay empresas que coincidan con estos
filtros — prueba a quitar uno"), nunca un icono triste genérico. Errores que
explican qué pasó y cómo seguir, sin disculparse. Sentence case en todos los
labels — nada de Title Case ni ALL CAPS.

## Requisitos técnicos

- Vite + React 18 + TypeScript estricto (nada de `any`). Recharts para gráficos.
  Si usas Tailwind, sobrescribe `theme.extend.colors` por completo con estos
  tokens — no dejes convivir el azul/índigo por defecto de Tailwind con esta
  paleta.
- Componentes organizados por dominio (`portfolio/`, `company-profile/`,
  `model-performance/`, `benchmarks/`, `simulator/`), no todo en `App.tsx`.
- Desktop-first pero responsive — la demo se ve en portátil/proyector, no en
  móvil, pero no debe romperse si alguien la abre en uno.
- Accesibilidad real: contraste AA en ambos temas (revisa en concreto el latón
  sobre superficie clara y sobre fondo oscuro — si falla contraste como fondo
  de badge, usa el acento como borde/texto en vez de relleno), foco de teclado
  visible, `<table>` semántica de verdad en la cartera, no divs.
- Movimiento sutil (150–200ms ease) solo donde responde a una acción del
  usuario (abrir ficha, cambiar de tema) — nunca fade-and-slide-up genérico en
  cada tarjeta al cargar, ni "bounce" en cada hover.
- Estados de carga con skeleton acorde al layout real de cada vista, no un
  spinner centrado genérico.

## Antes de dar esto por terminado

Haz capturas de las vistas 1 y 2 en ambos temas y revísalas contra la lista de
5 familias de "look IA" de más arriba, una por una. Si algo encaja en alguna,
corrígelo antes de seguir con las vistas 3–5.

## Entrega

- `frontend/README.md` con cómo levantarlo (`npm install && npm run dev`).
- Vistas 1 y 2 funcionando end-to-end con datos mock realistas, en ambos temas.
- Vistas 3–5 si el tiempo lo permite, en el orden dado.
- **Al terminar cada entrega, explícame en un mensaje corto y claro, paso a
  paso, cómo levantar el proyecto en local para verlo yo mismo** — comandos
  exactos, en qué puerto corre, qué debería estar viendo en cada vista. No
  asumas que ya conozco el flujo de Vite ni que sé dónde mirar.
