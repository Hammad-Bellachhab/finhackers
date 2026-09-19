# Base de datos relacional

Esquema normalizado del dataset HackSpain X-Ray (9 CSV → SQLite). Ver el
diagrama y el razonamiento de cada relación en
[`docs/er_diagram.md`](../docs/er_diagram.md).

## Construir la base

Requiere tener el dataset descomprimido en `data/raw/` (ver
`docs/reto-embat.md`).

```bash
python3 db/build_db.py --force
```

Tarda ~2 minutos y genera `db/finhackers.db` (~1,2 GB — fuera de git, ver
`.gitignore`). Al final imprime cualquier violación de integridad referencial
encontrada en el CSV de origen (ver "Calidad de datos" en `docs/er_diagram.md`).

## Ficheros

- `schema.sql` — DDL con las 9 tablas normalizadas, comentado con las
  decisiones de diseño.
- `build_db.py` — ETL: lee los CSV en streaming (no carga los 2,5M/900k
  registros de `transactions`/`invoices` en memoria), normaliza tipos
  (vacío → NULL, numéricos → float/int) y carga por lotes.

## Tablas

| Tabla | Origen | Filas |
|---|---|---:|
| `groups` | groups.csv | 250 |
| `companies` | companies.csv | 1.286 |
| `products` | banking_products.csv + debt_products.csv | 8.226 |
| `debt_product_details` | debt_products.csv (columnas granted/outstanding/liquidity) | 2.239 |
| `debt_schedule_config` | debt_schedule_config.csv | 87 |
| `balances` | balances.csv | 7.996 |
| `counterparties` | derivada de transactions.csv + invoices.csv | 129.701 |
| `transactions` | transactions.csv | 2.556.437 |
| `invoices` | invoices.csv | 897.894 |

## Consultar

```bash
sqlite3 db/finhackers.db
sqlite3> .tables
sqlite3> SELECT type, COUNT(*) FROM products GROUP BY type;
```
