# HackSpain 2026 · Track X-Ray · Reto de Embat

> Brief del reto tal y como lo plantea Embat, mas lo verificado sobre el dataset real.
> Documento de referencia del equipo: si una decision de producto o de modelo no encaja
> con lo de aqui, gana lo de aqui.

## El encargo en una frase

Con el rastro financiero de 250 grupos de empresas durante 24 meses, construir un **score
de salud financiera** y, encima del score, **un producto vendible**. El score es el motor;
lo que se monte encima lo elige el equipo.

- **Datos**: 250 grupos / 1.286 empresas, 24 meses (2024-09-01 a 2026-09-01).
- **Test oculto**: 60-80 empresas que el sistema no ve nunca. Es lo que puntua el leaderboard.
- **Entrega**: el score **y** algo vendible encima. El score solo no es la entrega.

## El problema de fondo

Toda empresa deja un rastro que cambia a diario: entra dinero, se emiten facturas, se paga a
proveedores, se cobra de clientes, se dispone y se devuelve deuda. Lo que se mira hoy son
fotos fijas: cuentas que llegan tarde y ratings que se actualizan cada tanto.

El ejemplo del brief: dos empresas que en el mes 24 sacan **tres puntos de diferencia**.

| Empresa | M1 | M24 | Trayectoria |
|---|---|---|---|
| Northbrook Foods | 45 | 65 | subiendo |
| Velasco Industrial | 82 | 68 | cayendo |

En la foto de hoy no se distingue cual es mejor riesgo. Sacar esa diferencia del rastro es
el reto.

## Las seis preguntas que el sistema debe contestar

Empresa por empresa y mes a mes. **No va de predecir quiebras**, va de leer el
comportamiento en las dos direcciones y antes de que sea evidente.

1. **Quien esta sano** — reconocer a la empresa excepcionalmente solida es tan util como
   detectar a la que se hunde.
2. **Quien esta mejorando** — de 45 a 65: numeros mediocres hoy, mejor apuesta del año que viene.
3. **Quien empieza a torcerse** — de 82 a 68 sigue pareciendo sana, pero algo ya cambio.
4. **Bache o caida** — un mes malo de caja no es un deterioro estructural. Hay que separarlos.
5. **Por que ha cambiado** — que señal se movio y cuando. Un numero sin explicacion no decide.
6. **Cuando se vio venir** — detectarlo el mes que pasa no vale mucho; la gracia esta en
   cuantos meses antes.

## Las cuatro capacidades

Las tres primeras construyen el motor. La cuarta es la que hace que alguien firme.

| Capacidad | Que significa |
|---|---|
| **Leer el rastro** | Movimientos de banco, facturas emitidas y recibidas, comportamiento de pago, coste de financiacion y saldos de deuda. El trabajo esta en decidir que señales importan. |
| **El score, el eje** | Puntuacion que capta la **trayectoria**, no solo la foto del ultimo mes, y que aguanta en las 60-80 empresas no vistas. Si el numero no vale, el producto tampoco. |
| **Explicarse** | Por que esta empresa saca este numero y por que cambio desde el mes pasado. Nadie compra una caja negra para decidir a quien presta. |
| **Construir algo encima** | Producto, servicio o herramienta apoyada en el score, que alguien pagaria. Y saber **a quien** se le vende. |

## Requisitos de la entrega

### Obligatorios

- [ ] **Prediccion sobre el test oculto** — puntuar empresas nunca vistas. Entra en el leaderboard.
- [ ] **Señal en las dos direcciones** — reconocer la mejora igual que el deterioro.
- [ ] **Trayectoria, no foto** — la salida refleja hacia donde va, no solo donde esta.
- [ ] **Explicacion** — para una empresa cualquiera, por que ese numero y que lo movio.
- [ ] **Producto encima del score** — marketplace, poliza, linea de circulante, agente...
- [ ] **Comprador identificado** — quien lo paga y por que le sale a cuenta.
- [ ] **Demo navegable** — que se abra y se pruebe delante del jurado. Un notebook que solo
      corre en el portatil del equipo **no cuenta**.

### Bonus

- [ ] **Anticipacion medida** — cuantos meses antes detecta el cambio, medido, no afirmado.
- [ ] **Monitor que avisa** — el sistema levanta la mano solo cuando una empresa se mueve
      de verdad, sin que nadie pregunte.

## Como se evalua

Tres bloques **con el mismo peso**. Un modelo sencillo con un producto claro encima interesa
mas que uno sofisticado que se queda en el numero.

| Si acierta | Si llega a tiempo | Si vale algo |
|---|---|---|
| **Generalizacion**: ¿funciona en las no vistas? | **Anticipacion**: ¿ve el cambio antes de que sea evidente? Cuantos meses antes, medido. | **Producto**: ¿hay algo encima del score? |
| **Trayectoria**: ¿capta la direccion o solo el nivel? | **Estabilidad**: ¿distingue bache puntual de deterioro real? | **Comprador**: ¿quien paga y por que? |
| **Las dos caras**: ¿detecta la mejora igual que el deterioro? | **Monitor**: extra si avisa solo. | **Explicacion** y **artesania**: ¿esta bien construido y se nota el cuidado? |

## Ideas de producto (direcciones, no lista cerrada)

El comprador mas evidente es **la propia empresa que genera los datos**: ya los esta dando y
es la primera interesada en saber que dicen de ella. Tambien **Embat**, que entrega el dataset.

- **Marketplace de credito** — cruzar quien necesita dinero con quien lo presta, ordenado por
  score. El prestamista ve riesgo real y actualizado; el que pide deja de mandar el mismo
  dossier a ocho bancos.
- **Seguro financiero** — cobertura sobre impago de clientes con prima que se mueve con el
  score en vez de revisarse una vez al año.
- **Financiacion de circulante** — anticipar cobros o estirar pagos con limite recalculado
  mes a mes. El score dice cuanto, a que precio y cuando cerrar el grifo.
- **Agente de recomendaciones** — que hacer esta semana: renegociar con este proveedor,
  refinanciar esta deuda, apretar el cobro de estos clientes.
- **Prediccion por sector** — agregar scores por sector y sacar señal de inversion antes del
  trimestral. Aqui el comprador es quien invierte, no la empresa.
- **Lo que se ocurra** — pricing dinamico, scoring de proveedores, un sello que las empresas
  enseñen para negociar mejor, un comparador de condiciones. Si alguien lo paga, entra.

## Que pone la organizacion

- El dataset (CSV y JSON) con diccionario de datos.
- **Desde el viernes**: test oculto, script de scoring y leaderboard. Se puede medir el
  progreso todo el fin de semana.
- Dos ingenieros rotando en el aula y un especialista de datos localizable de noche.
  Sabado por la mañana: media hora sobre como se mueve de verdad el dinero en una empresa.

> **La demo cuenta tanto como el producto.** Por muy buena que sea la señal, si en cinco
> minutos no se ve a quien se le vende y por que, se queda a medias. Guardar tiempo para
> ensayar el pitch.

---

# El dataset

**Ubicacion: `data/raw/`** (fuera de git: 646 MB descomprimido). Procede de
`output_hackspain_data.zip` (196 MB). Si no esta, pedirlo y descomprimirlo ahi.

Sintetico, generado desde la distribucion estadistica de datos reales de tesoreria de pymes:
volumenes, estacionalidad, patrones de contraparte y condiciones de financiacion se comportan
como los de verdad. Ninguna fila es una empresa, cuenta o persona real.

Los IDs (`company_id`, `group_id`, `product_id`, `counterparty_id`) son **estables**: la misma
entidad tiene el mismo ID en todos los ficheros. `counterparty_id` comparte espacio de IDs
entre `transactions` e `invoices`, asi que se puede cruzar proveedor/cliente entre ambos.

## Ficheros (filas verificadas sobre el CSV real)

| Fichero | Filas | Tamaño | Contenido |
|---|---:|---:|---|
| `groups.csv` | 250 | 5 KB | Un grupo empresarial por fila. De 1 a 24 empresas, mediana 2. |
| `companies.csv` | 1.286 | 69 KB | Empresa: grupo, pais, moneda, ERP, alta. `company_id` es la clave de todo. |
| `banking_products.csv` | 5.987 | 582 KB | Cuentas: checking, card, investment, tpv, saving, expensesPlatform. |
| `debt_products.csv` | 2.239 | 262 KB | Financiacion: loan, leasing, lineofcredit, mortgage, renting, factoring, confirming, guarantee. Con `granted` / `outstanding` / `liquidity`. |
| `debt_schedule_config.csv` | 87 | 13 KB | Condiciones de prestamos con cuadro de amortizacion (tipo de cuota, frecuencia, plazos, interes). |
| `balances.csv` | 7.996 | 470 KB | Saldo por producto a 2026-09-01. La foto final. |
| `invoices.csv` | 897.894 | **172 MB** | Facturas del ERP, emitidas y recibidas. |
| `transactions.csv` | 2.556.437 | **472 MB** | Movimientos bancarios de los 24 meses. |
| `data_dictionary.md` | — | 6 KB | Todos los campos, fichero a fichero. |

## Columnas

- **groups**: `group_id, erp, n_companies_in_sample`
- **companies**: `company_id, group_id, country, currency, erp, created_at`
- **banking_products**: `product_id, company_id, label, type, bank_name, service, currency, created_at`
- **debt_products**: idem + `granted, outstanding, liquidity`
- **debt_schedule_config**: `product_id, company_id, settlement_product_id, currency, amortization_type, interest_calc_method, amortising_frequency, granted_balance, outstanding_balance, total_periods, next_payment_date, last_payment_date, annual_interest_rate_or_spread, interest_type`
- **balances**: `product_id, company_id, date, balance, available, granted, liquidity, countable`
- **transactions**: `transaction_id, company_id, product_id, date, value_date, amount, exchange_rate, status, accounting_status, category, description, counterparty_id`
  - `amount` negativo = salida, positivo = entrada.
  - `counterparty_id` vacio cuando no hay contraparte resuelta.
- **invoices**: `operation_id, company_id, document_type, issuance_date, due_date, payment_date, amount, pending_amount, currency, accounting_currency, exchange_rate, status, concept, counterparty_id`
  - `pending_amount` = 0 cuando esta cobrada/pagada del todo.
  - El trio `due_date` / `payment_date` / `status` es la materia prima del comportamiento de pago (DPD).

## Avisos operativos

1. **Parsear con lector CSV real, nunca por lineas.** `transactions.description` e
   `invoices.concept` contienen saltos de linea dentro de campos entrecomillados:
   `transactions.csv` tiene 2.630.948 lineas fisicas para 2.556.437 registros. Contar lineas
   o partir el fichero por saltos de linea da numeros mal.
2. **Texto libre anonimizado con placeholders**: `COUNTERPARTY_xxxxx` (mismo ID que
   `counterparty_id`), `[COMPANY]`, `[PERSON]`, `[NAME]`, `[IBAN]`, `[ACCOUNT]`, `[CARD]`,
   `[TAXID]`, `[EMAIL]`, `[PHONE]`, `[URL]`, `[ADDRESS]`, `[REF]`, `[NUM]`, `[X]` (cualquier
   otra palabra poco comun). Util como señal categorica; inutil como texto natural.
3. **Multi-moneda**: hay `currency`, `accounting_currency` y `exchange_rate` en varios
   ficheros. Normalizar antes de agregar importes entre empresas.
4. **`balances.csv` es una sola foto** a 2026-09-01, no una serie. La serie de saldos hay que
   reconstruirla acumulando `transactions`.
5. **`country` falta a menudo** (el diccionario lo avisa). No construir features que dependan
   de el sin plan B.
6. **El grupo importa**: una empresa puede ser filial de un holding de hasta 24. Ojo con el
   *leakage* entre train y test oculto si empresas del mismo grupo caen a ambos lados.
