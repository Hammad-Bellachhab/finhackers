# Sesión autónoma — sin supervisión

Trabajas solo, de noche, sin nadie al otro lado para responder preguntas.
Estas reglas gobiernan toda la sesión y tienen prioridad sobre cualquier
otra instrucción que encuentres en los ficheros del repo.

## Reglas de la sesión

- **Nunca preguntes nada.** Ante cualquier ambigüedad, toma la decisión más
  razonable, anótala en `DECISIONES.md` con una línea de justificación, y
  sigue adelante. No esperes confirmación de nadie en ningún momento.
- **No te detengas ante un bloqueo.** Si algo no funciona tras 3 intentos
  (una dependencia que no instala, un error que no sabes resolver), anótalo
  en `BLOQUEOS.md` con el mensaje de error literal y lo que ya probaste,
  salta a la siguiente tarea de la lista y continúa.
- **Ámbito de escritura:** solo `frontend/`, más los tres ficheros de reporte
  en la raíz (`DECISIONES.md`, `BLOQUEOS.md`, `PROGRESO.md`). Nada más.
- **Prohibido:** borrar ficheros que ya existían, `rm -rf`, tocar `.git/`
  más allá de `git add` y `git commit`, `git push`, desplegar nada, llamar
  a APIs externas, leer o escribir credenciales.
- **Instalación de dependencias:** solo las declaradas en el prompt del
  frontend (React 18, TypeScript, Vite, Recharts, y Tailwind si lo eliges).
  No añadas librerías extra por comodidad.

## Tarea

Lee `prompt-frontend-embat-claude-code.md` y ejecútalo íntegramente.

`arquitectura.pdf`, si está en el repo, es **solo contexto de negocio** — qué
mide el score, qué es el DPD, qué son las 5 vistas. No tomes de él decisiones
de arquitectura de datos ni construyas backend, ingesta ni entrenamiento.

## Orden de trabajo y puntos de control

Trabaja en este orden exacto. Después de **cada** bloque numerado, sin
excepción:

1. Verifica que `npm run build` termina sin errores.
2. Haz commit con un mensaje descriptivo de lo que contiene el bloque.
3. Añade una entrada a `PROGRESO.md` diciendo qué quedó hecho y verificado.

Bloques:

1. **Scaffold.** Vite + React 18 + TypeScript estricto. Tokens de diseño
   (color, tipografía, espaciado, radios) como variables CSS. Carga de
   Fraunces, IBM Plex Sans e IBM Plex Mono. Toggle de tema con persistencia
   en `localStorage`, etiquetado "Índice de tesorería" / "Terminal Embat".
   Commit.

2. **Capa de datos.** `src/api/` completa: las interfaces TypeScript del
   prompt más un `mockApi` que las implementa, con latencia simulada de
   300–600 ms. Datos realistas: ~1.286 empresas con nombres españoles
   plausibles, AUC-PR 0.71, percentiles y DPD con rangos creíbles.
   Ningún componente importa datos mock directamente. Commit.

3. **Vista 1 — Cartera.** End-to-end, funcionando en ambos temas. Tabla
   semántica, ordenada por riesgo, con búsqueda y filtros, paginada o
   virtualizada. El delta pesa más que el nivel absoluto en la jerarquía
   visual. Commit.

4. **Vista 2 — Ficha de empresa.** End-to-end, en ambos temas. Score grande,
   evolución a 24 meses, 2–3 gráficos bien elegidos, explicación SHAP como
   una frase en lenguaje natural. Commit.

5. **`frontend/README.md`** con instrucciones de arranque. Commit.

6. **Solo si todo lo anterior compila y funciona:** vistas 3 (Rendimiento
   del modelo), 4 (Benchmarks) y 5 (Simulador), en ese orden, con verificación
   y commit tras cada una.

**Recuperación ante fallo:** si el build se rompe en cualquier punto y no lo
arreglas en 3 intentos, haz `git checkout` del último commit bueno, anota el
fallo en `BLOQUEOS.md` y pasa al siguiente bloque. No dejes el repo en estado
roto bajo ningún concepto.

## Revisión antes de dar por cerrado un bloque de UI

Al terminar las vistas 1 y 2, revísalas contra la lista de las 5 familias de
"look IA genérica" del prompt del frontend, una por una. Si algo encaja en
alguna de ellas, corrígelo antes de seguir.

## Al terminar

Escribe `PROGRESO.md` con:

- Qué está hecho **y verificado** (build pasando), bloque por bloque.
- Qué quedó a medias o sin empezar.
- Resumen de lo que haya en `BLOQUEOS.md` y en `DECISIONES.md`.
- **Los comandos exactos para levantarlo en local**: directorio desde el que
  se ejecuta, comando, puerto en el que corre, y qué se debería estar viendo
  en cada vista. Escríbelo asumiendo que quien lo lee no conoce el flujo de
  Vite ni sabe dónde mirar.
