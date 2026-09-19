# Pulso — diseño

*Reto X-Ray de Embat, HackSpain 2026. Aprobado el 2026-09-19.*

> **Tu pulso, gratis. El de tu red, de pago.**

## 1. Contexto y restricciones

El reto pide un score de salud financiera **y un producto vendible encima**. El score solo no
es entrega valida. La evaluacion tiene tres bloques de igual peso (acierta / llega a tiempo /
vale algo), detallados en `docs/reto-embat.md`.

Tres restricciones fijan el diseño:

1. **Embat ya tiene el panel de tesoreria.** Su producto cubre posicion de caja consolidada,
   prevision de liquidez, conciliacion con IA, pagos, netting intercompañia y analisis de
   comportamiento de pago. Replicar cualquiera de esas cosas resta en vez de sumar.
2. **La rubrica es la especificacion del front.** Cada criterio tiene que ser visible en
   pantalla, no afirmado en un slide.
3. **El front va primero, contra datos mock**, con el contrato de API cerrado. El back se
   construye en paralelo y se cablea despues sin tocar componentes.

## 2. Producto

La empresa ve **su propio score gratis**. Paga por ver el score de **las empresas con las que
trabaja**: sus clientes y sus proveedores.

**Por que se vende:**

- La empresa ya le esta dando sus datos a Embat. Devolverle su score cuesta cero y es el gancho.
- Lo que se paga es **mirar hacia fuera**. Si tu mayor cliente se tuerce, eso es tu problema
  meses antes de que deje de pagarte, y hoy nadie te lo dice.
- **Efecto red**: cuantas mas empresas hay dentro, mas contrapartes se pueden puntuar y mejor.
  Es un foso que solo tiene quien ya agrega los datos de muchas. Un competidor con mejor modelo
  y sin red no lo puede copiar.
- **Comprador**: la empresa. Lo cobra Embat como modulo nuevo. La resta que lo justifica: un
  solo impago evitado de 180.000 € paga la suscripcion muchas veces, y el coste marginal para
  Embat es cero.

**La anticipacion es el argumento de venta**, no una metrica de concurso: "te avisamos cinco
meses antes de que tu cliente dejara de pagarte".

## 3. Trazabilidad rubrica -> pantalla

| Criterio de evaluacion | Donde se ve |
|---|---|
| Generalizacion | Marca de "no vista en entrenamiento" en la ficha + pantalla Evidencia |
| Trayectoria | El score es siempre una linea de 24 meses, nunca un numero suelto |
| Las dos caras | Mi red ordena mejora y deterioro con identico peso visual |
| Anticipacion | Diagrama detectado-vs-evidente en la ficha de contraparte, en meses |
| Estabilidad | Distintivo explicito bache / deterioro estructural, con aviso de "no actues" |
| Monitor (bonus) | Alertas que aparecen solas en la barra superior |
| Explicacion | Drivers con señal, direccion y fecha, en cada ficha |
| Producto y comprador | Es el propio modelo de negocio: el paywall esta en la pantalla |
| Artesania | Tres estados por vista, tema claro/oscuro, build verde |

## 4. Superficies

### 4.1 Mi pulso *(gratis)*

Tu score. Linea de 24 meses como elemento dominante, banda actual, delta contra el mes pasado
y contra hace tres, y las tres señales que mas lo movieron con su fecha.

Cubre *trayectoria* y *explicacion*.

### 4.2 Mi red *(de pago — el producto)*

Tus contrapartes puntuadas, **ordenadas por euros en riesgo, no por score**. Esa ordenacion es
la diferencia entre un dashboard y algo que se firma: no es "este cliente esta en 42", es
"este cliente esta en 42 y le tienes 180 k€ a 45 dias".

Dos direcciones con el mismo peso visual: los que se tuercen y los que mejoran. Un proveedor
que mejora es uno al que pedir mejores condiciones.

Filtros: rol (cliente / proveedor), direccion del movimiento, y solo-con-exposicion.

Cubre *las dos caras* y ancla el *producto*.

### 4.3 Ficha de contraparte *(el paywall)*

El score del tercero, sus drivers, y la pieza que mas vende: **el diagrama de anticipacion**,
que enfrenta el mes en que el sistema lo detecto contra el mes en que fue evidente en sus
numeros, y anota la distancia en meses.

Incluye el distintivo **bache vs. deterioro estructural**. El aviso de "esto es un bache, no
actues" vale tanto como la alarma: evita que la empresa rompa una relacion comercial sana.

Las primeras contrapartes se ven gratis; el resto pide suscripcion. El paywall es parte de la
demo, no un obstaculo: enseña el modelo de negocio funcionando.

Cubre *anticipacion*, *estabilidad* y *explicacion*.

### 4.4 Evidencia

La pantalla que demuestra el bloque "si acierta" en vivo: rendimiento sobre el holdout,
anticipacion media medida en meses, y el desglose de las dos caras por separado.

Casi todos los equipos dejan esto en slides. Enseñarlo funcionando es barato y pesa un tercio
de la nota.

### 4.5 Monitor *(bonus, transversal)*

Las alertas aparecen **solas** en la barra superior, sin que nadie pregunte. Cada alerta dice
que se movio, cuanto, y cuanta exposicion hay detras.

## 5. Contrato de API

El front consume estas cinco rutas. Los mock viven en `frontend/src/api/mock/` **detras de la
misma firma** que la API real: cablear el back es cambiar una constante, no reescribir vistas.

**Nivel y trayectoria son dos ejes independientes, y se representan por separado.** El ejemplo
del brief lo exige: Velasco baja de 82 a 68 y *sigue pareciendo sana*. Su nivel es `healthy` y
su tendencia es `down`. Colapsar ambos en una sola etiqueta perderia justo la lectura que el
reto pide. En pantalla se combinan ("sana, pero torciendose"), nunca se sustituyen.

```ts
type Band = 'healthy' | 'stable' | 'risk'      // nivel: donde esta hoy
type Trend = 'up' | 'down' | 'flat'            // trayectoria: hacia donde va

type ScorePoint = { month: string; score: number }          // month: 'YYYY-MM'

type Driver = {
  id: string
  label: string            // "El cobro se alarga"
  direction: Trend
  impact: number           // puntos de score aportados, con signo
  since: string            // 'YYYY-MM' — cuando empezo a moverse
  detail: string           // frase explicativa para humanos
}

type Exposure = {
  amount: number           // pendiente de cobro/pago, en moneda de la empresa
  currency: string
  overdueDays: number
  invoiceCount: number
}

// GET /api/companies/{id}/score
type CompanyScore = {
  companyId: string
  name: string
  score: number            // 0-100
  band: Band               // nivel
  trend: Trend             // trayectoria
  delta1m: number
  delta3m: number
  series: ScorePoint[]     // 24 puntos
  drivers: Driver[]
  heldOut: boolean         // true = el modelo no la vio nunca
}

// GET /api/companies/{id}/network
type NetworkEntry = {
  counterpartyId: string
  name: string
  role: 'customer' | 'supplier' | 'both'
  score: number
  band: Band
  trend: Trend
  delta3m: number
  exposure: Exposure
  eurosAtRisk: number      // exposure.amount ponderado por el riesgo del score.
                           // Criterio de orden por defecto de Mi red.
  locked: boolean          // detras del paywall
}
type NetworkResponse = { companyId: string; entries: NetworkEntry[] }

// GET /api/counterparties/{id}
type CounterpartyDetail = {
  counterpartyId: string
  name: string
  role: 'customer' | 'supplier' | 'both'
  score: number
  band: Band
  trend: Trend
  series: ScorePoint[]
  drivers: Driver[]
  detection: {
    detectedAt: string     // 'YYYY-MM' — cuando lo vio el sistema
    evidentAt: string      // 'YYYY-MM' — cuando fue evidente en sus numeros
    monthsAhead: number
  } | null
  stability: 'dip' | 'structural'
  exposure: Exposure
}

// GET /api/alerts
type Alert = {
  id: string
  subjectId: string
  subjectName: string
  subjectType: 'self' | 'counterparty'
  kind: 'improving' | 'slipping'
  score: number
  delta: number
  monthsAhead: number | null
  eurosAtRisk: number | null
  message: string
  createdAt: string        // ISO
}

// GET /api/evidence
type Evidence = {
  holdout: { companies: number; auc: number; spearman: number }
  anticipation: { medianMonths: number; p25: number; p75: number; detected: number }
  bothDirections: { improvingRecall: number; slippingRecall: number }
  stability: { dipsCorrectlyIgnored: number; structuralCaught: number }
}
```

**Nota de datos**: el dataset no trae nombres de empresa, solo IDs. Hace falta una capa de
nombres legibles y estables por `company_id` / `counterparty_id`; un ID crudo en pantalla
arruina la demo.

## 6. Arquitectura del front

```
frontend/src/
  api/          index.ts (fachada), types.ts (lo de arriba), mock/
  pulse/        Mi pulso
  network/      Mi red
  counterparty/ Ficha de contraparte
  evidence/     Evidencia
  monitor/      Alertas
  shared/       ScoreLine, BandBadge, Delta, Money, Empty/Error/Skeleton
  styles/       tokens.css (paleta de Embat), global
```

Una carpeta por superficie. Lo compartido solo cuando lo usan dos superficies, no antes.

**Graficas**: Recharts para las series de 24 meses. **SVG propio** para el diagrama de
anticipacion — es la pieza que tiene que impresionar y no sale de una libreria.

**Colores**: solo tokens semanticos, nunca hex literales, o se rompe el modo oscuro. Ver
`docs/paleta-embat.md`.

Los tokens de banda actuales mezclan nivel y trayectoria; hay que alinearlos con la separacion
de la seccion 5: `--color-band-healthy|stable|risk` para el nivel, y tokens de tendencia
`--color-trend-up|down|flat` para la direccion. El nivel se pinta como relleno de la insignia;
la tendencia, como flecha y color de la linea.

## 7. Estados y errores

Cada vista implementa sus **tres estados desde el principio**: cargando (esqueleto, no spinner),
vacio (con texto util), y fallo (con el error y un reintento).

En una demo ante jurado, una pantalla en blanco por un fetch caido cuesta mas que cualquier
error del modelo. El front nunca debe depender de que el back este vivo para pintar algo.

## 8. Verificacion

- `npm run build` (typecheck + build) verde en cada paso.
- Captura de cada pantalla en claro y oscuro, revisada de verdad, no asumida.
- Recorrido completo de la demo: Mi pulso -> Mi red -> ficha con anticipacion -> Evidencia,
  con el back caido, para probar que los estados de fallo aguantan.

## 9. Fuera de alcance

Decidido explicitamente, para que no vuelva a discutirse:

- **Prevision de caja y conciliacion**: es el producto actual de Embat. Replicarlo resta.
- **Selector de rol analista / empresa**: doblaria el front y dejaria las dos mitades a medio
  pulir. El usuario es la empresa.
- **Autenticacion real**: el paywall es una maqueta que enseña el modelo de negocio; no hay
  usuarios ni cobros de verdad.
