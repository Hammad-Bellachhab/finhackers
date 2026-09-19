# Guía visual — Pulso con la marca de Embat + tarjetas TellMe

*2026-09-19 · Paso 2 de `tasks/progress-agente-ia.md` · PRD: `2026-09-19-agente-ia-prd.md`*

Objetivo: que Pulso se vea como embat.io (blanco, navy, azul de acción, Haffer, tarjetas limpias) **sin tocar
pestañas ni quitar contenido**. Casi todo sale de cambiar valores en `tokens.css`: los componentes ya usan
tokens semánticos. Se añaden pocos tokens nuevos y un componente (`TellMeCard`).

Referencia medida en `assets para cursor/firecrawl.css` (tema de Embat): radios 2/3/4/6/8/12 px, sombras
`0 1px 4px / 0 3px 12px / 0 8px 16px rgba(0,0,0,.09)`, fuente `HafferSQXH, Arial`, tracking de eyebrow `0.04em`,
titulares en peso 500 y sentence case, tarjetas gris casi blanco sin borde, el gradiente morado→azul reservado a TellMe
("See TellMe in action").

---

## 1. Tokens (`frontend/src/styles/tokens.css`)

Sustituir el bloque `:root` por este. Los nombres existentes se mantienen (cero cambios en componentes por ellos);
los nuevos van marcados `/* nuevo */`.

**Modo oscuro: borrar** los dos bloques oscuros (`@media (prefers-color-scheme: dark)` y `[data-theme="dark"]`).
No hay toggle en la app, y con el `@media` un portátil en oscuro vería Pulso en oscuro, contra "claro por defecto".
Los valores inverse de Embat siguen documentados en `docs/paleta-embat.md` si algún día hace falta.
En `index.css`: `html { color-scheme: light; }` (hoy es `light dark`).

```css
@font-face {
  font-family: "Haffer";
  src: url("/fonts-haffer-400.woff2") format("woff2");
  font-weight: 400; font-style: normal; font-display: swap;
}
/* Solo hay 400 y 500. El rango 500-800 hace que los 600/700 que ya hay en el CSS
   usen el fichero 500 en vez de un negrita sintética (fea en Haffer). */
@font-face {
  font-family: "Haffer";
  src: url("/fonts-haffer-500.woff2") format("woff2");
  font-weight: 500 800; font-style: normal; font-display: swap;
}

:root {
  /* ---- Marca (crudos) ---- */
  --embat-navy: #050b2c;
  --embat-blue: #3878f6;
  --embat-blue-light: #e7efff;
  --embat-purple: #8041d1;
  --embat-gradient: linear-gradient(275deg, #c357ec 4.22%, #b565f3 50%, #5c92fe 95.78%); /* solo TellMe */

  /* ---- Superficie y texto ---- */
  --color-bg: #ffffff;               /* página, navbar, tarjetas */
  --color-bg-subtle: #fbfbfc;
  --color-surface: #f6f8fb;          /* tiles internos (KPI, drivers, cambios) — antes #f3f4f6 */
  --color-surface-hover: #e7efff;    /* hover = Soft Blue */
  --color-surface-pressed: #eef1f6;  /* fondo de pill neutra */
  --color-border: #e3e7ef;           /* bordes de tarjeta y tabla (decorativo) */
  --color-border-strong: #c9cfdb;    /* separadores, pistas de benchmark, dashed */
  --color-border-control: #8a90a0;   /* nuevo: borde de input/select (3.2:1, WCAG 1.4.11) */

  --color-text: #050b2c;             /* Deep Navy */
  --color-text-subtle: #42444c;
  --color-text-muted: #5c6070;       /* antes #6e707c: fallaba 4.47:1 sobre surface */
  --color-text-disabled: #888996;
  --color-text-on-accent: #ffffff;

  /* ---- Acción ---- */
  --color-accent: #3878f6;           /* Action Blue: rellenos, iconos, indicador activo, focus, chart-1 */
  --color-accent-text: #1f5ad6;      /* nuevo: TEXTO azul (links, pestaña activa, chip activo) */
  --color-accent-hover: #0338bb;
  --color-accent-pressed: #002a9b;
  --color-accent-soft: #e7efff;      /* Soft Blue: secciones, hover, badges */
  --color-accent-border: #c9dafd;    /* nuevo: borde de la tarjeta TellMe */
  --focus-ring: 0 0 0 2px var(--color-bg), 0 0 0 4px var(--color-accent); /* nuevo */

  /* ---- Estado (afinado a la paleta; todos ≥4.5:1 como texto sobre blanco salvo --color-warning) ---- */
  --color-success: #127c3a;          /* antes #08ab39 (3.05:1, no valía como texto) */
  --color-success-soft: #e8f6ee;
  --color-success-strong: #0b5f2b;
  --color-warning: #b86e00;          /* solo gráfico/icono (3.99:1); para texto usar -strong */
  --color-warning-soft: #fff4dc;
  --color-warning-strong: #7a5a00;
  --color-danger: #c2401f;
  --color-danger-soft: #ffe9e3;
  --color-danger-strong: #931d00;

  --color-band-healthy: var(--color-success);
  --color-band-stable: var(--color-text-muted);
  --color-band-risk: var(--color-danger);
  --color-trend-up: #0b7d91;         /* aqua oscurecido: antes #3ec0d6 (2.16:1) */
  --color-trend-down: var(--color-warning);
  --color-trend-flat: var(--color-text-muted);

  /* ---- Gráficas (orden de uso). Verde fuera: queda reservado a "bien/sana". ---- */
  --chart-1: #3878f6;  /* azul acción */
  --chart-2: #8041d1;  /* morado Embat */
  --chart-3: #0b7d91;  /* aqua oscuro */
  --chart-4: #b86e00;  /* ámbar */
  --chart-5: #d23b72;  /* rosa Embat */
  --chart-6: #050b2c;  /* navy */
  /* Todos ≥3:1 sobre blanco (1.4.11). Rejilla: --color-border. */

  /* ---- Tipografía ---- */
  --font-sans: "Haffer", Arial, system-ui, -apple-system, "Segoe UI", sans-serif;
  --font-mono: ui-monospace, "SF Mono", "Cascadia Mono", monospace;
  --text-xs: 0.75rem;   /* 12 eyebrow, notas, labels de KPI */
  --text-sm: 0.875rem;  /* 14 cuerpo de UI, tablas */
  --text-md: 1rem;      /* 16 */
  --text-lg: 1.25rem;   /* 20 titular TellMe, h2 de sección */
  --text-xl: 1.75rem;   /* 28 h1 empresa */
  --text-kpi: 1.5rem;   /* 24 número de KPI */

  /* ---- Espacio (escala 4) ---- */
  --space-1: 4px; --space-2: 8px; --space-3: 12px; --space-4: 16px;
  --space-5: 24px; --space-6: 32px; --space-7: 48px; --space-8: 64px;

  /* ---- Forma (radios de Embat) ---- */
  --radius-sm: 6px;    /* inputs, chips de evidencia, botones */
  --radius: 8px;       /* tiles, tarjetas, paneles */
  --radius-lg: 12px;   /* tarjeta TellMe */
  --shadow-sm: 0 1px 2px rgb(5 11 44 / 5%);
  --shadow: 0 1px 4px rgb(5 11 44 / 8%);       /* tarjeta en reposo (level-1 de Embat) */
  --shadow-lg: 0 8px 16px rgb(5 11 44 / 9%);   /* nuevo: hover de elementos clicables */
  --ease: cubic-bezier(0.2, 0, 0, 1);          /* nuevo */
}
```

Contrastes comprobados (WCAG, calculados en esta sesión): navy/blanco 19.25 · muted `#5c6070` 6.25 en blanco, 5.87
en surface, 5.41 en Soft Blue · accent-text `#1f5ad6` 5.21 en Soft Blue · success 5.29 · danger 5.19 ·
warning-strong/soft ≈ 6 · trend-up 4.82. **Ojo:** `#3878f6` da 4.05:1 en blanco y 3.51:1 en Soft Blue: vale para
iconos, bordes, focus y texto ≥ 24 px, **no** para texto normal → por eso existe `--color-accent-text`.
Botón sólido con texto blanco: fondo `--color-accent-hover` (#0338bb) o texto ≥ 18.7 px/500 sobre `#3878f6`.

### Globales (en `index.css`)

```css
body { font-size: var(--text-sm); line-height: 1.5; }
h1, h2, h3 { font-weight: 500; color: var(--color-text); }
a { color: var(--color-accent-text); }
:focus-visible { outline: 2px solid var(--color-accent); outline-offset: 2px; }
tr:focus-visible { outline-offset: -2px; }
button, .chip, .count-button, .alert, .portfolio tbody tr {
  transition: background-color 150ms var(--ease), color 150ms var(--ease),
              border-color 150ms var(--ease), box-shadow 150ms var(--ease);
}
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: 0.01ms !important; animation-iteration-count: 1 !important;
                           transition-duration: 0.01ms !important; }
}
```

Encabezados de sección (`.page > h2`, `.section h2`): pasan de MAYÚSCULAS grises a titular de Embat:
`font-size: var(--text-lg); font-weight: 500; letter-spacing: -0.01em; color: var(--color-text);
text-transform: none; margin: var(--space-7) 0 var(--space-4);` (primer h2: `margin-top: 0`).
`.company-head h1`: `var(--text-xl)`, 500, `-0.02em`. `.score-value`: 2.5rem, 500, tabular.

---

## 2. Cabecera y navegación (`App.tsx` + `App.css`)

```
[logo Embat 93×20] | Pulso        Cartera  Alertas  Empresa  Evidencia  Modelo
─────────────────────────────────────────────────────────── (borde 1px)
                   ▔▔▔▔▔▔ (2px #3878f6 bajo la activa)
```

- `.topbar`: alto 64px, fondo `--color-bg`, `border-bottom: 1px solid var(--color-border)`, sticky (ya lo es),
  padding lateral `var(--space-5)` (16px < 640px), contenido alineado a `.page` (max-width 72rem, centrado).
- **Logo**: sustituir `<span className="mark">` por
  `<span className="logo" role="img" aria-label="Embat" />` con
  `.logo { width: 93px; height: 20px; background: var(--color-text); mask: url(/embat.svg) no-repeat center / contain; }`.
  (El SVG usa `currentColor`; en `<img>` saldría negro, con máscara sale navy exacto sin inlinear el SVG.) Borrar `.mark`.
- Separador: `1px × 20px`, `--color-border-strong`, margen `0 var(--space-3)`.
- **Producto**: `Pulso` en `--text-md`, peso 500, `--color-text` (cambiar `<strong>` por `<span className="product">`).
- **Pestañas**: `nav` con `margin-left: var(--space-6)`, `gap: var(--space-1)`, `align-self: stretch`
  (ocupan el alto de la barra), `overflow-x: auto`.
  - Botón: `font-size: var(--text-sm); font-weight: 500; color: var(--color-text-muted); padding: 0 var(--space-3);
    height: 100%; border-radius: 0; position: relative;`
  - Hover: `color: var(--color-text)` y fondo píldora Soft Blue interior (`::before` inset 12px 0, radius 6px,
    `--color-surface-hover`) — o, más simple, solo cambio de color. Elegir lo simple si hay prisa.
  - **Activa** (`.on`): `color: var(--color-accent-text)` + indicador `::after { left:12px; right:12px; bottom:-1px;
    height:2px; background: var(--color-accent); border-radius: 2px 2px 0 0 }`. Sin fondo.
  - Añadir `aria-current={vista === t.id ? 'page' : undefined}` (hoy el estado activo solo es visual).
  - Focus: el `:focus-visible` global con `outline-offset: -2px`.
- < 480px: ocultar separador y "Pulso"; logo + pestañas con scroll horizontal.

---

## 3. Componentes

### Tarjeta / panel (`.panel` en `shared.css` — todas las gráficas)
`background: var(--color-bg); border: 1px solid var(--color-border); border-radius: var(--radius);
box-shadow: var(--shadow); padding: var(--space-4) var(--space-5) var(--space-4);`
`.panel h3`: `--text-sm`, 500, navy, `margin-bottom: var(--space-3)`. `.panel-note`: `--text-xs`, muted,
`margin-top: var(--space-3)`. `grid-2`/`grid-3`: `gap: var(--space-4)`.
Dentro de un panel, los `.count` usan `--color-surface` (tile sobre tarjeta blanca, nunca tarjeta sobre tarjeta).
Mismo tratamiento de tarjeta blanca para `.decisions li`, `.bench`, `.anticipation-track` (y su
`.anticipation-gap span` pasa a `background: var(--color-bg)`) y `.simulator` (este conserva el dashed).

### Tile interior (`.drivers li`, `.changes li`, `.metric`, `.alert`, `.count`)
`background: var(--color-surface); border: 0; border-radius: var(--radius);` sin sombra.

### KPI tile (`.count`)
`padding: var(--space-3) var(--space-4); min-width: 8rem;`
`strong`: `var(--text-kpi)`, 500, navy, `letter-spacing: -0.01em`, tabular. `span`: `--text-xs`, muted, `margin-top: 2px`.
`.count-button` (toggle de Alertas): `background: var(--color-bg); border: 1px solid var(--color-border);`
hover `--color-surface-hover`; `.count-on`: `background: var(--color-accent-soft); border-color: var(--color-accent);`
y `span` en `--color-accent-text`. Ya lleva `aria-pressed` — bien.

### Tabla (`.portfolio`, `.data-table`)
- `th`: `--text-xs`, 500, muted, MAYÚSCULAS con `letter-spacing: 0.04em` (el tracking de Embat), padding
  `var(--space-2) var(--space-3)`, `border-bottom: 1px solid var(--color-border)`.
- `td`: `--text-sm`, padding `10px var(--space-3)` (fila ≈ 44 px), `border-bottom: 1px solid var(--color-border)`.
- Fila clicable: hover `--color-surface-hover`; focus con el outline global.
- Envolver las tablas de Cartera/Alertas en tarjeta blanca (`.table-scroll` con borde, radius, sombra, y
  `th:first-child/td:first-child { padding-left: var(--space-4) }`).
- `.row-main` (Modelo): `color: var(--color-accent-text)`, 500.

### Chip / filtro (`.chip`, `.filters-form`)
- `.chip`: alto 32px, `padding: 0 var(--space-3)`, `font-size: 0.8125rem`, 500, `border: 1px solid
  var(--color-border)`, `background: var(--color-bg)`, `color: var(--color-text-muted)`, radius 999px.
  Hover: `background: var(--color-surface-hover); color: var(--color-text)`.
  `.chip-on`: `background: var(--color-accent-soft); color: var(--color-accent-text); border-color: transparent;`
- Añadir `aria-pressed` a los chips de `PortfolioTable.tsx` (l. 56) y de escenarios (`ProfileSections.tsx` l. 230).
- `select`/`input` (`.filters-form`, `.company-picker`): alto 36px, `border: 1px solid var(--color-border-control)`,
  radius `--radius-sm`, focus `border-color: var(--color-accent); box-shadow: var(--focus-ring); outline: none`.
  `range` del simulador: `accent-color: var(--color-accent)` (ya).

### Pill / badge (`.pill`, `.badge`, `.holdout`)
- Forma común: radius 999px, 500, `white-space: nowrap`. `.pill`: `--text-xs`, padding `2px 8px`.
  `.badge` (BandBadge): 0.8125rem, padding `2px 10px`.
- Colores: neutra `--color-surface-pressed` / `--color-text-subtle`; resto con las parejas `-soft`/`-strong`
  ya mapeadas (sin cambios de clase).
- `.holdout`: `border: 1px dashed var(--color-accent); color: var(--color-accent-text)`.
- Botón secundario (Reintentar de `ErrorNotice`, TellMe): alto 32px, radius `--radius-sm`, `border: 1px solid
  currentColor`, fondo transparente, 500.

### Gráficas (Recharts)
- Series por orden `--chart-1..6`. Bandas de salud: `HEALTH_BAND_COLOR` ya apunta a tokens (se re-tiñen solos).
- Rejilla `--color-border`, solo horizontal (`vertical={false}`, ya así). Ejes: `axis.tick` a `fontSize: 12`,
  fill `--color-text-muted`; `stroke: 'var(--color-border)'`.
- Tooltip (`charts.tsx`): añadir `boxShadow: 'var(--shadow-lg)'`, `borderRadius: 'var(--radius)'`, `fontSize: 12`.
- Línea principal `strokeWidth={2}`, `dot={false}` (ya). Leyenda `fontSize: 12`.
- `.figure` (PNGs de Modelo): se queda con fondo `#fff` — correcto en tema claro.

---

## 4. Tarjeta TellMe (nuevo `shared/TellMeCard.tsx` + estilos en `shared.css`)

Uso: `<TellMeCard companyId?={id} scopeLabel="…" />`; carga `getTellMe(companyId)` con `useAsync`.

### Anatomía

```
┌───────────────────────────────────────────────────────────────┐  radius 12, borde --color-accent-border
│ [✦] TellMe · Análisis de la cartera                           │  eyebrow  (--text-xs, muted; "TellMe" navy 500)
│                                                               │
│ 885 empresas sanas; 169 empiezan a torcerse                   │  headline  <h2> --text-lg 500 navy
│ Resumen en 2-3 frases…                                        │  summary   --text-sm, text-subtle, max 68ch
│───────────────────────────────────────────────────────────────│
│ [↗]  TENDENCIA  (Vigilar)                                     │  insight: icono 32px + eyebrow + badge
│      El cobro se alarga                                       │  título --text-sm 500 navy
│      Sus clientes tardan 19 días más…                         │  explicación --text-sm text-subtle
│      [Días en cobrar 72 d] [Mediana 12 m 53 d]                │  chips de evidencia
│      ┌ → Qué hacer: Revisar los plazos con los 3 clientes… ┐  │  acción (caja Soft Blue)
│───────────────────────────────────────────────────────────────│
│ [↘]  RIESGO  (Alerta) …                                       │
│                                                               │
│ ▸ Glosario (3 términos)                                       │  <details>
│───────────────────────────────────────────────────────────────│
│ Generado por TellMe · gemini-flash-latest · 19 sept 2026, 17:05 · Texto generado por IA: revisa las cifras. │
└───────────────────────────────────────────────────────────────┘
```

- **Contenedor** `.tellme`: `<section aria-labelledby>`; `background: linear-gradient(180deg, #f5f8ff 0, var(--color-bg) 160px);`
  `border: 1px solid var(--color-accent-border); border-radius: var(--radius-lg); box-shadow: var(--shadow);`
  `padding: var(--space-5)` (16px < 640px); `margin-bottom: var(--space-7)`. El lavado Soft Blue arriba marca "IA"
  sin franjas ni bordes de color.
  Entrada: `opacity 0→1, translateY(4px→0)`, 200ms `--ease` (anulado por reduced-motion).
- **Marca TellMe** `.tellme-mark`: 20×20, radius 6, `background: var(--embat-gradient)`, glifo `✦` blanco 12px,
  `aria-hidden`. Es el único sitio de la app con el gradiente (igual que en embat.io: gradiente = TellMe).
- **Eyebrow**: "TellMe" (navy 500) + " · Análisis de la cartera" / " · Análisis de {nombre}" (muted).
- **Headline**: `<h2>` con la clase `.tellme-headline` (anula el estilo de sección: `margin: var(--space-3) 0 var(--space-2)`).
- **Insights**: `<ul>` sin viñetas; cada `<li>` es un grid `32px 1fr`, `gap: var(--space-3)`,
  `padding: var(--space-4) 0`, separados por `border-top: 1px solid var(--color-border)`. **No son tarjetas
  dentro de tarjeta.** Orden de pintado: `alert` → `watch` → `info` (sort estable; no se oculta ninguno).
- **Cómo se ve kind y severity (sin borde lateral):**
  - *Kind* → glifo dentro del icono + palabra en el eyebrow (texto, no solo color):
    `trend ↗ Tendencia` · `anomaly ∿ Anomalía` · `risk ! Riesgo` · `opportunity + Oportunidad` · `action → Acción`.
    Glifo `aria-hidden`; el eyebrow es `--text-xs`, 500, muted, MAYÚSCULAS, `letter-spacing: 0.04em`.
  - *Severity* → **color del icono** (tile 32×32, radius 8, fondo soft + glifo strong) **y** badge de texto:
    | severity | tile | badge |
    |---|---|---|
    | `info` | `--color-accent-soft` / `--color-accent-text` | ninguno (silencio = normal) |
    | `watch` | `--color-warning-soft` / `--color-warning-strong` | `.pill` "Vigilar" warning |
    | `alert` | `--color-danger-soft` / `--color-danger-strong` | `.pill` "Alerta" danger |
    Excepción: `opportunity` con `info` → tile `--color-success-soft` / `--color-success-strong` (buena noticia).
- **Evidencia** `.tellme-evidence`: fila `flex-wrap`, `gap: var(--space-2)`, `margin-top: var(--space-2)`.
  Cada chip: `background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-sm);
  padding: 2px var(--space-2); font-size: var(--text-xs)`; `label` muted + `value` navy 500 tabular.
  Marcado: `<dl>` con pares `<div><dt/><dd/></div>` (lector de pantalla lee "Días en cobrar, 72 d").
- **Acción** (si existe) `.tellme-action`: `margin-top: var(--space-3); background: var(--color-accent-soft);
  border-radius: var(--radius-sm); padding: var(--space-2) var(--space-3); font-size: var(--text-sm);`
  `→` en `--color-accent` + "**Qué hacer:**" navy 500 + texto navy. No es enlace: sin subrayado, sin cursor pointer.
- **Glosario** (solo si `glossary.length > 0`): `<details>` nativo; `<summary>` "Glosario (n términos)",
  `--text-xs`, 500, `--color-accent-text`, chevron `▸` que rota 90° (150ms). Dentro `<dl>` en grid
  `max-content 1fr`, `gap: var(--space-1) var(--space-4)`: `dt` navy 500, `dd` muted, `margin: 0`.
- **Pie** `.tellme-footer`: `border-top: 1px solid var(--color-border); margin-top: var(--space-4);
  padding-top: var(--space-3); font-size: var(--text-xs); color: var(--color-text-muted)`.
  Texto: `Generado por TellMe · {model} · <time dateTime={generatedAt}>{fecha}</time> · Texto generado por IA a partir de los datos del motor; revisa las cifras.`
  Fecha con `new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium', timeStyle: 'short' })`.

### Estados (todos dentro del mismo marco `.tellme`, para que la página no salte)

| Estado | Contenido |
|---|---|
| **Cargando** | `aria-busy="true"`, `aria-label="TellMe está analizando"`. Eyebrow real (marca + "TellMe") + bloques `.skeleton`: titular 60% × 24px, resumen 2 líneas (90% y 70%) × 14px, 2 filas de insight (tile 32×32 + 2 barras). Alto ≈ 15rem. |
| **Aún no analizado** (404) | Marca + "TellMe" + párrafo muted: "TellMe aún no ha analizado esta empresa." / "…la cartera." + segunda línea `--text-xs`: "El análisis se genera con cada carga de datos." Sin botón, sin color de error. Padding reducido (`var(--space-4)`). |
| **Error** (otro) | Marca + "No se ha podido cargar el análisis de TellMe." (navy) + `error.message` muted + botón secundario "Reintentar". `role="alert"`. **No** usar `ErrorNotice` rojo: TellMe es complementario y un bloque rojo arriba de la página asusta más que el dato. |
| **Sin insights** | Titular + resumen + pie; se omite la lista. |

⚠ **Para el frontend-developer:** hoy `get()` en `api/index.ts` convierte 404 en `Error('Empresa no encontrada')`,
indistinguible de un fallo real. Hacer que `getTellMe` devuelva `null` en 404 (o lanzar un error marcado) y pintar
"Aún no analizado" con `null`. Arreglo en `getTellMe`, no en `get()` (las demás llamadas quieren el error).

---

## 5. Sustitución de los bordes laterales ("side-tab")

| Dónde | Hoy | Sustituto |
|---|---|---|
| `company.css` `.metric-ok/-watch/-breach` | `border-left: 3px` de color | Quitar el borde. En `PulseSection.tsx`, para `status !== 'ok'` añadir junto a la etiqueta un `.pill` de texto: `watch` → "Vigilar" (warning), `breach` → "Fuera de umbral" (danger). `ok` sin marca. Así el estado deja de depender solo del color (WCAG 1.4.1). |
| `company.css` `.change-down/-up` | `border-left: 3px` rojo/verde | Quitar el borde. Icono CSS antes del texto: `li::before { content: "▼" / "empeora: "; }` (alt-text CSS: el lector dice "empeora") en círculo 20px `--color-danger-soft` / `--color-danger-strong`; `.change-up::before { content: "▲" / "mejora: " }` con success. `li` pasa a `display: flex; gap: var(--space-2); align-items: baseline`. Sin cambios de JSX. |
| `portfolio.css` `.alert-improving/-slipping` (Monitor) | `border-left: 3px` aqua/ámbar | Quitar el borde. `::before` círculo 24px: `.alert-slipping::before { content: "▼" / ""; background: var(--color-warning-soft); color: var(--color-warning-strong) }`, `.alert-improving::before { content: "▲" / ""; background: #e3f3f6; color: var(--color-trend-up) }`. Alt vacío: el `Delta` con signo ya lo dice en texto. Hover: `--color-surface-hover`. |
| `portfolio.css` `.row-watch` (no marcado por el hook, mismo patrón) | `box-shadow: inset 3px 0 0` | Quitar. Fondo de fila tenue `background: color-mix(in srgb, var(--color-warning-soft) 55%, transparent)`; el `BandBadge` de esa fila ya muestra "Sana ▼" en texto/aria. Hover sigue siendo Soft Blue. |

---

## 6. Orden por pestaña (todo lo existente se queda; solo se añade TellMe)

- **Cartera**: `TellMeCard` (cartera) → "Se han movido solas" (Monitor) → "Las N empresas" (counts, leyenda,
  panel Evolución) → "Detalle" (filtros + tabla en tarjeta).
- **Alertas**: sin cambios de orden: h2 + leyenda → counts-toggle → tabla en tarjeta. Sin TellMe (no pedido).
- **Empresa**: buscador → `TellMeCard` (empresa; se monta cuando `score.data` existe, para poner el nombre en el
  eyebrow) → Pulse (cabecera, deltas, ScoreLine, "Qué lo ha movido", "Sus números") → Ficha (counts, datos,
  "Qué ha cambiado") → SHAP + Trayectoria → Series de tesorería → Frente a su cohorte → Escenarios →
  "Hacia dónde va" / "Cuándo se vio venir" → "Qué hacer" (+ simulador).
- **Evidencia**: sin cambios de orden (Si acierta · Las dos caras · Si llega a tiempo · Estabilidad).
- **Modelo**: sin cambios de orden (paneles, La tesis, Qué mira el modelo, Errores, Diagramas).

Ritmo vertical: `.page` `padding: var(--space-6) var(--space-5) var(--space-8)`; entre secciones
`var(--space-7)` (lo da el `margin-top` del h2); dentro de sección `var(--space-4)`.

---

## Checklist de implementación
1. `tokens.css` (bloque de arriba, borrar oscuro) + `index.css` (color-scheme, globales, focus, reduced-motion).
2. `App.tsx/App.css`: logo con máscara, "Pulso", pestañas con indicador y `aria-current`.
3. `shared.css`: panel tarjeta, pill/badge, botón secundario, estilos `.tellme*`; `charts.tsx`: tooltip/ejes.
4. `company.css` / `portfolio.css`: h2, tiles, tabla en tarjeta, chips, las 4 sustituciones de §5.
5. `TellMeCard.tsx` + `getTellMe` con 404 → null; montar en `PortfolioView` y `CompanyView`.
6. Verificar: Lighthouse/axe sin fallos de contraste; navegación por teclado por pestañas, chips, filas y
   `<details>`; macOS "Reducir movimiento" apaga skeleton y transiciones.
