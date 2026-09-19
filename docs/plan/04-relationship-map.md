# 04 · Relationship Map

Responsable: **Yo** (formular y medir) · **Diego** (decide si entra al modelo).

Cada relación es una **hipótesis**, no un hecho. Entra al modelo solo si pasa el protocolo.

## Mapa

```
            PAGO (A)                         COBRO / INGRESOS (G)
   DPD, vencidas abiertas, ─── H3 ───  pendiente de cobros, DSO,
   nóminas/SS/impuestos    ─── H6      concentración, rotación (H4)
        │    │                                  │
       H1   H10 devoluciones                    │
        │                                       │
   DEUDA (B) ─────────── H2 ───────────── LIQUIDEZ (F)
   utilización, servicio              caja, cobertura, volatilidad
   de deuda, coste (H11)        H5 ── pendiente de pagos vs caja
        │
   GRUPO (H) ── H7 contagio            CALIDAD DEL DATO (I) ── H13
                                        TIEMPO: H8 bache/caída · H9 vs. su propia historia
```

## Hipótesis

| ID | Relación | Variables | Esperado | Test | Decisión |
|---|---|---|---|---|---|
| H1 | Utilización alta con pagos puntuales ≠ utilización alta con retrasos crecientes | F29 × F04 | con retrasos crecientes, peor desenlace | cuadrantes (mediana × mediana) vs O2/O3; término de interacción en regresión logística | entra si la interacción mejora la métrica ≥ umbral (abajo) |
| H2 | Deuda con capacidad de pago ≠ deuda sin ella | F27 × F21 | servicio alto + caja baja = peor | idem | idem |
| H3 | Retrasos con ingresos cayendo = estructural; con ingresos estables = operativo | F04 × F13 | el primero precede a O2/O4 | idem + lead time (M3) | idem |
| H4 | Concentración alta + pérdida de clientes | F17 × F18 | peor desenlace que cada una por separado | idem | idem |
| H5 | Pagos creciendo más rápido que la caja | pendiente `outflow_op` × F21 | tensión futura (O3) | idem | idem |
| H6 | **Orden de prelación**: primero se retrasa a proveedores, después impuestos/SS, al final nóminas | F02, F06, F05 | etapas sucesivas de deterioro | secuencia temporal en empresas con O3/O4: ¿qué señal se mueve primero y cuántos meses antes? | si se cumple, es explicación y anticipación, no solo feature |
| H7 | Contagio de grupo | F36 | score de hermanas predice el propio | correlación con desfase 1-3 meses, **solo con split por grupo** | entra si aporta sobre el resto y no fuga |
| H8 | Bache ≠ caída | M3 | una caída que persiste ≥ 3 meses o afecta a ≥ 2 pilares anticipa O2-O4; un bache no | tasa de desenlace por tipo de caída | define la regla de alertas del monitor |
| H9 | Desviación contra la propia historia | M5 vs. percentil transversal | la desviación propia anticipa antes en empresas estables | AUC de cada una por separado | entra como señal del monitor si anticipa más |
| H10 | Recibos devueltos como alerta temprana | F07 | preceden a O2 | lead time | idem H1 |
| H11 | Factoring/confirming: ¿tensión o sofisticación? | uso de factoring/confirming × F21 | desconocido | comparación de desenlaces con y sin | signo decidido por datos |
| H12 | El cese (sin movimientos desde antes de 2026-08) es desenlace, no feature | último movimiento | — | se usa como O4 | no entra como feature |
| H13 | Facturas vencidas > 365 días = higiene del ERP, no impago | antigüedad de vencidas × F25, F37 | coexisten con caja y pagos normales | comparar flujos de caja de empresas con y sin ellas | si se confirma, F01/F12 se recortan a vencidas ≤ 180 días |

## Protocolo de prueba (igual para todas)

1. **Desenlace**: proxies O1-O5 de [06-model-spec.md](06-model-spec.md) en T+1…T+6; cuando exista, el ground truth del leaderboard manda sobre los proxies.
2. **Base**: score V0 sin la relación.
3. **Variante**: V0 + la relación (feature o interacción).
4. **Métrica**: la de validación de 06 (Spearman con el desenlace y AUC por dirección), en validación cruzada **por grupo**.
5. **Umbral**: mejora media > 0 con IC 95 % por bootstrap (remuestreo de grupos) que no cruza 0 **y** sin empeorar la dirección contraria (mejora vs. deterioro).
6. **Fuga**: la variante pasa el test T2.3 (recalcular con datos truncados en T da lo mismo).
7. Resultado, entre o no, se anota en el Experiment Log (entregable 7, T4.2).
