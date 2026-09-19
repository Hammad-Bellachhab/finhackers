# finhackers

## Estructura

```
frontend/   SPA React + Vite + TypeScript
docs/       reto de Embat, diccionario de datos, paleta
```

El motor de scoring está por construir.

## Frontend (puerto 5173)

```bash
cd frontend
npm install
npm run dev
```

Vite hace proxy de `/api` a `localhost:8000`, que es donde tiene que escuchar el motor.
