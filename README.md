# finhackers

## Estructura

```
frontend/   SPA React + Vite + TypeScript
docs/       reto de Embat, diccionario de datos, paleta, diagrama ER
db/         esquema SQL + ETL para cargar el dataset en SQLite
```

El motor de scoring está por construir.

## Base de datos relacional

Los 9 CSV del dataset se normalizan y se cargan en SQLite (esquema, ETL y
diagrama ER en [`db/README.md`](db/README.md) y
[`docs/er_diagram.md`](docs/er_diagram.md)):

```bash
python3 db/build_db.py --force   # requiere data/raw/ (ver docs/reto-embat.md)
```

## Frontend (puerto 5173)

```bash
cd frontend
npm install
npm run dev
```

Vite hace proxy de `/api` a `localhost:8000`, que es donde tiene que escuchar el motor.
