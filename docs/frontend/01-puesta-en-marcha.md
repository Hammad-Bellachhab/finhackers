# Frontend 01. Puesta en marcha

## Requisitos

- Node.js 20 o superior
- npm

## Instalar y arrancar

```bash
git clone https://github.com/Hammad-Bellachhab/finhackers.git
cd finhackers/frontend
npm install
npm run dev
```

Vite muestra la URL local (por defecto `http://localhost:5173`).

## Scripts

| Script | Qué hace |
| --- | --- |
| `npm run dev` | Servidor de desarrollo con recarga en caliente |
| `npm run typecheck` | Comprobación de tipos sin emitir |
| `npm run build` | Typecheck + build de producción en `dist/` |
| `npm run preview` | Sirve el build de producción en local |

## Comprobación

`npm run build` debe terminar sin errores. Es el punto de control que se pasó tras cada bloque de [04-progreso.md](04-progreso.md).

## Rutas

La navegación es por hash, sin router externo:

| Ruta | Vista |
| --- | --- |
| `#/` | Cartera |
| `#/empresa/{id}` | Ficha de empresa |
