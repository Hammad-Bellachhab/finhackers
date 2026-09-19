# PRD — TellMe (agente de IA) + marca Embat

*2026-09-19 · Estado: **confirmado, en ejecución** · Progreso: `tasks/progress-agente-ia.md`*

## 1. Objetivo

Que alguien sin formación financiera entienda en segundos qué le pasa a una empresa y a la
cartera, sin perder nada del contenido actual ni salirnos del reto (score bidireccional,
trayectoria, explicación, anticipación, monitor, producto).

- **TellMe** (el nombre de la IA de Embat) resume, explica tendencias y anomalías en lenguaje
  llano y propone acciones.
- **La web pasa a la marca Embat**: logo, tipografía Haffer, paleta y estilo copiados de
  embat.io (`assets para cursor/`). Tema claro.
- **Se mantienen nuestras pestañas y nuestro contenido**: Cartera · Alertas · Empresa ·
  Evidencia · Modelo. Nada de sub-pestañas nuevas.

## 2. Arquitectura (sin servidor)

```
pipeline/src/tellme.py ──(GEMINI_API_KEY, solo en local)──> Gemini (JSON con esquema)
        │ lee frontend/public/data/**  (lo que ya exporta src/pulso.py)
        ▼ valida → escribe
frontend/public/data/tellme/portfolio.json
frontend/public/data/companies/{id}/tellme.json
        ▼
Cloudflare sirve todo estático (igual que hoy)
```

- La key vive en tu `~/.zshrc`. Nunca va al front, a git ni a Cloudflare.
- **Cadena de "agentes" dentro de `tellme.py`**:
  1. **Analista**: Gemini con `responseSchema`, así la salida siempre tiene la forma del contrato.
  2. **Validador** (código): descarta cualquier insight cuyas cifras no aparezcan en los datos
     de entrada, y cualquier respuesta mal formada.
  3. **Redactor**: la misma llamada escribe titular, resumen y glosario en lenguaje llano.
- **Reanudable**: se salta las empresas que ya tienen `tellme.json`. Si se corta, se relanza.
- **Concurrencia limitada** y reintentos con espera, por los límites de Gemini.
- Modelo en `GEMINI_MODEL` (por defecto `gemini-flash-latest`).
- **Chat en vivo: fuera.** Sin servidor no se puede sin exponer la key. Se añade con un Worker
  si algún día hace falta.

## 3. Contrato (lo único que comparten los dos agentes)

Tipos en `frontend/src/api/types.ts` y lectura en `frontend/src/api/index.ts`
(`getTellMe`), con un mock para trabajar sin datos reales.

```ts
type InsightKind = 'trend' | 'anomaly' | 'risk' | 'opportunity' | 'action'
type Severity = 'info' | 'watch' | 'alert'
type Insight = {
  id: string; kind: InsightKind; severity: Severity
  title: string; explanation: string
  evidence: { label: string; value: string }[]
  action?: string
}
type TellMe = {
  scope: 'company' | 'portfolio'; companyId?: string
  headline: string; summary: string
  insights: Insight[]                       // 3-6, por importancia
  glossary: { term: string; plain: string }[]
  generatedAt: string; model: string
}
// /data/tellme/portfolio.json   y   /data/companies/{id}/tellme.json
// Si el fichero no existe: 404 → el front enseña "TellMe aún no ha analizado esta empresa".
```

## 4. Front

- Cabecera con el logo de Embat y la navegación de siempre.
- **Tarjeta TellMe** arriba en Cartera (cartera) y en Empresa (esa empresa): titular, resumen,
  insights con su evidencia y acción, y glosario plegable.
- Estilo embat.io: fondo blanco, texto `#050B2C`, acción `#3878F6`, secundario `#E7EFFF`,
  bordes sutiles, sombras ligeras, mucho aire, Haffer.
- Se sustituyen los bordes laterales de color de las tarjetas (marcados por el revisor de diseño).
- Estados de carga, vacío y error en todo.
- Todo el contenido actual se mantiene, en el mismo sitio.

## 5. Equipo (the-agency)

| Agente | Tarea | Zona |
|---|---|---|
| `ai-engineer` | `pipeline/src/tellme.py`: prompts, esquema, validador, reanudable | `pipeline/` |
| `ui-designer` → `frontend-developer` | Marca Embat y tarjetas TellMe | `frontend/src/` |
| `ui-finish-gate-reviewer` | Revisión antes de enseñarte la preview | — |

## 6. Plan

Ver `tasks/progress-agente-ia.md`. **Preview en local antes de cualquier push.**
