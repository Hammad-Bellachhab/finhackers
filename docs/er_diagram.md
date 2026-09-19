# Modelo relacional — HackSpain X-Ray

Esquema normalizado a partir de los 9 CSV crudos (`data/raw/`). DDL completo en
[`db/schema.sql`](../db/schema.sql), script de carga en [`db/build_db.py`](../db/build_db.py).

## Diagrama entidad-relación

```mermaid
erDiagram
    GROUPS ||--o{ COMPANIES : "agrupa"
    COMPANIES ||--o{ PRODUCTS : "posee"
    COMPANIES ||--o{ TRANSACTIONS : "genera"
    COMPANIES ||--o{ INVOICES : "emite/recibe"
    COMPANIES ||--o{ BALANCES : "tiene"
    COMPANIES ||--o{ DEBT_SCHEDULE_CONFIG : "tiene"

    PRODUCTS ||--o| DEBT_PRODUCT_DETAILS : "detalle si kind=debt"
    PRODUCTS ||--o{ TRANSACTIONS : "mueve"
    PRODUCTS ||--o| BALANCES : "saldo"
    PRODUCTS ||--o| DEBT_SCHEDULE_CONFIG : "cuadro de amortizacion"
    PRODUCTS ||--o{ DEBT_SCHEDULE_CONFIG : "cuenta de liquidacion (settlement)"

    COUNTERPARTIES ||--o{ TRANSACTIONS : "contraparte de"
    COUNTERPARTIES ||--o{ INVOICES : "contraparte de"

    GROUPS {
        text group_id PK
        text erp
        int n_companies_in_sample
    }
    COMPANIES {
        text company_id PK
        text group_id FK
        text country
        text currency
        text erp
        text created_at
    }
    PRODUCTS {
        text product_id PK
        text company_id FK
        text kind "banking | debt"
        text type
        text label
        text bank_name
        text service
        text currency
        text created_at
    }
    DEBT_PRODUCT_DETAILS {
        text product_id PK_FK
        real granted
        real outstanding
        real liquidity
    }
    DEBT_SCHEDULE_CONFIG {
        text product_id PK_FK
        text company_id FK
        text settlement_product_id FK
        text amortization_type
        text interest_calc_method
        text amortising_frequency
        real granted_balance
        real outstanding_balance
        int total_periods
        text next_payment_date
        text last_payment_date
        real annual_interest_rate_or_spread
        text interest_type
    }
    BALANCES {
        text product_id PK_FK
        text company_id FK
        text date
        real balance
        real available
        real granted
        real liquidity
        real countable
    }
    TRANSACTIONS {
        text transaction_id PK
        text company_id FK
        text product_id FK
        text date
        text value_date
        real amount
        text status
        text category
        text description
        text counterparty_id FK
    }
    INVOICES {
        text operation_id PK
        text company_id FK
        text document_type
        text issuance_date
        text due_date
        text payment_date
        real amount
        real pending_amount
        text status
        text concept
        text counterparty_id FK
    }
    COUNTERPARTIES {
        text counterparty_id PK
    }
```

## Qué relación se sacó de dónde

Ninguno de los CSV trae claves foráneas declaradas; las relaciones se infirieron
del diccionario de datos y se verificaron por solape de IDs sobre el dataset
completo:

| Relación | Cómo se detectó / verificó |
|---|---|
| `groups 1:N companies` | `companies.group_id` → `groups.group_id`. 1.286 empresas, 0 huérfanas. |
| `companies 1:N products` | `banking_products.company_id` / `debt_products.company_id` → `companies.company_id`. 8.226 productos, 0 huérfanos. |
| `products 1:1 debt_product_details` | `banking_products.csv` y `debt_products.csv` comparten espacio de `product_id` (verificado: 5.987 + 2.239 IDs, solape 0) → superset `products` + subtype `debt_product_details` solo para `kind='debt'`. |
| `products 1:0..1 debt_schedule_config` | `debt_schedule_config.product_id` → `products.product_id` (el préstamo). |
| `products 1:0..N debt_schedule_config` (settlement) | `debt_schedule_config.settlement_product_id` → `products.product_id` (la cuenta bancaria desde la que se liquida la cuota). |
| `products 1:0..1 balances` | `balances.product_id` → `products.product_id`, foto a 2026-09-01. |
| `companies/products 1:N transactions` | `transactions.company_id`, `transactions.product_id`. |
| `companies 1:N invoices` | `invoices.company_id`. |
| `counterparties 1:N transactions/invoices` | `counterparty_id` no viene en fichero propio: es una dimensión **derivada**, construida escaneando los IDs distintos en `transactions.csv` e `invoices.csv` (docs/reto-embat.md confirma que comparten espacio de IDs). |

## Calidad de datos detectada al normalizar

El script deja constancia (`PRAGMA foreign_key_check`) de un hueco real en el
dataset crudo: algunos `product_id` se usan en `transactions.csv`,
`balances.csv` y `debt_schedule_config.csv` pero **no existen** en
`banking_products.csv` / `debt_products.csv`. Sobre la carga completa:

- 1.314 filas de `transactions` (~0,05% de 2.556.437)
- 29 filas de `balances` (~0,36% de 7.996)
- 2 filas de `debt_schedule_config` (de 87)

Todas son `product_id` por encima del máximo (`PRODUCT_08226`) que sí aparece
en los ficheros de producto — probablemente productos fuera del recorte de la
muestra. Se cargan igualmente (la base no fuerza `PRAGMA foreign_keys=ON`
durante la carga) para no perder esas filas, pero quedan documentadas aquí
para quien construya features sobre `products` y haga `JOIN` con `transactions`
o `balances`: ese `JOIN` perderá esas filas si es `INNER`.
