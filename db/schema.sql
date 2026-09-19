-- HackSpain X-Ray Track — esquema relacional normalizado
--
-- Fuente: data/raw/*.csv (ver docs/data_dictionary.md).
-- Motor objetivo: SQLite (mismo DDL es prácticamente portable a Postgres,
-- cambiando TEXT->VARCHAR/TIMESTAMP donde interese y activando FKs por defecto).
--
-- Decisiones de normalización:
--   1. banking_products.csv y debt_products.csv comparten el mismo espacio de
--      product_id (verificado: 5.987 + 2.239 = 8.226 IDs, sin solape) y las
--      mismas columnas comunes. Se modelan como una tabla `products` (superset)
--      + `debt_product_details` (subtype con las columnas exclusivas de deuda:
--      granted/outstanding/liquidity). Evita columnas siempre NULL para las
--      6.987 filas de banca.
--   2. `counterparty_id` aparece en transactions e invoices compartiendo el
--      mismo espacio de IDs (según docs/reto-embat.md). Se extrae como
--      dimensión propia `counterparties` para poder declarar la FK y cruzar
--      proveedor/cliente entre ambos hechos.
--   3. `groups` -> `companies` -> `products` es la jerarquía 1:N principal;
--      `transactions`, `invoices`, `balances` y `debt_schedule_config` cuelgan
--      de `companies`/`products` como tablas de hechos.
--   4. `debt_schedule_config.settlement_product_id` es una FK a `products`
--      (normalmente una cuenta bancaria de tipo `checking` desde la que se
--      paga la cuota), separada de `debt_schedule_config.product_id` (el
--      propio préstamo).

PRAGMA foreign_keys = ON;

-- ─────────────────────────────────────────────────────────────────────────
-- Dimensiones
-- ─────────────────────────────────────────────────────────────────────────

CREATE TABLE groups (
    group_id                TEXT PRIMARY KEY,
    erp                     TEXT,
    n_companies_in_sample   INTEGER
);

CREATE TABLE companies (
    company_id      TEXT PRIMARY KEY,
    group_id        TEXT REFERENCES groups(group_id),
    country         TEXT,               -- ISO code; a menudo NULL (ver diccionario)
    currency        TEXT,
    erp             TEXT,
    created_at      TEXT                -- ISO datetime
);

-- Dimensión derivada: no viene como fichero propio, se construye a partir de
-- los counterparty_id distintos vistos en transactions.csv e invoices.csv.
CREATE TABLE counterparties (
    counterparty_id TEXT PRIMARY KEY
);

-- Superset de banking_products.csv + debt_products.csv
CREATE TABLE products (
    product_id      TEXT PRIMARY KEY,
    company_id      TEXT NOT NULL REFERENCES companies(company_id),
    kind            TEXT NOT NULL CHECK (kind IN ('banking', 'debt')),
    label           TEXT,
    type            TEXT,              -- checking/card/.../loan/leasing/...
    bank_name       TEXT,
    service         TEXT,
    currency        TEXT,
    created_at      TEXT
);

-- Subtype: solo para products.kind = 'debt'
CREATE TABLE debt_product_details (
    product_id      TEXT PRIMARY KEY REFERENCES products(product_id),
    granted         REAL,               -- importe original de la facilidad
    outstanding     REAL,               -- saldo vivo actual
    liquidity       REAL                -- disponible, cuando se reporta
);

-- ─────────────────────────────────────────────────────────────────────────
-- Hechos / detalle
-- ─────────────────────────────────────────────────────────────────────────

CREATE TABLE debt_schedule_config (
    product_id                      TEXT PRIMARY KEY REFERENCES products(product_id),
    company_id                      TEXT NOT NULL REFERENCES companies(company_id),
    settlement_product_id           TEXT REFERENCES products(product_id),
    currency                        TEXT,
    amortization_type               TEXT,
    interest_calc_method            TEXT,
    amortising_frequency            TEXT,
    granted_balance                 REAL,
    outstanding_balance             REAL,
    total_periods                   INTEGER,
    next_payment_date               TEXT,
    last_payment_date               TEXT,
    annual_interest_rate_or_spread  REAL,
    interest_type                   TEXT
);

-- Foto de saldos a 2026-09-01 (o el snapshot previo más cercano), 1 fila/producto
CREATE TABLE balances (
    product_id      TEXT PRIMARY KEY REFERENCES products(product_id),
    company_id      TEXT NOT NULL REFERENCES companies(company_id),
    date            TEXT,
    balance         REAL,
    available       REAL,
    granted         REAL,
    liquidity       REAL,
    countable       REAL
);

CREATE TABLE transactions (
    transaction_id      TEXT PRIMARY KEY,
    company_id           TEXT NOT NULL REFERENCES companies(company_id),
    product_id            TEXT NOT NULL REFERENCES products(product_id),
    date                  TEXT,
    value_date            TEXT,
    amount                REAL,          -- negativo = salida, positivo = entrada
    exchange_rate         REAL,
    status                TEXT,
    accounting_status     TEXT,
    category              TEXT,
    description           TEXT,
    counterparty_id       TEXT REFERENCES counterparties(counterparty_id)
);

CREATE TABLE invoices (
    operation_id          TEXT PRIMARY KEY,
    company_id            TEXT NOT NULL REFERENCES companies(company_id),
    document_type         TEXT,
    issuance_date         TEXT,
    due_date              TEXT,
    payment_date          TEXT,
    amount                REAL,
    pending_amount        REAL,          -- 0 una vez cobrada/pagada del todo
    currency               TEXT,
    accounting_currency    TEXT,
    exchange_rate           REAL,
    status                   TEXT,
    concept                  TEXT,
    counterparty_id          TEXT REFERENCES counterparties(counterparty_id)
);

-- ─────────────────────────────────────────────────────────────────────────
-- Índices (además de las PK) para los join/filtro más comunes
-- ─────────────────────────────────────────────────────────────────────────

CREATE INDEX idx_companies_group            ON companies(group_id);
CREATE INDEX idx_products_company           ON products(company_id);
CREATE INDEX idx_products_kind_type         ON products(kind, type);
CREATE INDEX idx_debt_schedule_settlement   ON debt_schedule_config(settlement_product_id);
CREATE INDEX idx_balances_company           ON balances(company_id);
CREATE INDEX idx_transactions_company       ON transactions(company_id);
CREATE INDEX idx_transactions_product       ON transactions(product_id);
CREATE INDEX idx_transactions_counterparty  ON transactions(counterparty_id);
CREATE INDEX idx_transactions_date          ON transactions(date);
CREATE INDEX idx_invoices_company           ON invoices(company_id);
CREATE INDEX idx_invoices_counterparty      ON invoices(counterparty_id);
CREATE INDEX idx_invoices_due_date          ON invoices(due_date);
CREATE INDEX idx_invoices_status            ON invoices(status);
