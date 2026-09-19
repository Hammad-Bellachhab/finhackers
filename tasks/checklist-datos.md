# Checklist "ningún dato perdido" (paso 6)

Inventario del front antes del rediseño (commit `30b5535`). Cada línea se marca cuando se
comprueba en la preview que sigue ahí.

## Cartera
- [x] Monitor "Se han movido solas" (4 que caen + 4 que mejoran, "visto N meses antes")
- [x] Recuentos: Sanas · Estables · En riesgo · Mejorando · Torciéndose · Test oculto
- [x] Bandas finas (sólida/sana/vigilar/riesgo) y nota de trayectoria
- [x] Gráfica "Evolución de la cartera" (barras por banda + salud media)
- [x] Tabla: chips (Todas/Mejorando/Torciéndose/Test oculto), filtros banda/tamaño/orden/búsqueda
- [x] Columnas: Empresa · Score · Nivel · 3 meses · 1 mes · Señal · P(deterioro) · Grupo · Tamaño · Señal dominante; marca test oculto; fila "sana pero cayendo"

## Alertas
- [x] 5 contadores-filtro por señal
- [x] Tabla: Empresa · Señal · Salud · 1 mes · 3 meses · Visto antes · Qué ha cambiado

## Empresa
- [x] Buscador de empresa
- [x] Cabecera: nombre, "No vista en entrenamiento", score grande, banda + tendencia, deltas 1 m / 3 m
- [x] Línea de score 24 meses
- [x] Qué lo ha movido (drivers con impacto y "se mueve desde")
- [x] Sus números (DSO, DPO, ciclo, DSCR, días de caja, uso de líneas, concentración) con estado
- [x] Ficha: salud, banda, trayectoria, señal, P(deterioro) + Δ pp, modelo A; datos del grupo/ERP/banco…
- [x] Qué ha cambiado este mes
- [x] ¿Por qué? SHAP (barras) + Trayectoria de salud (mensual, suavizada, modelo A, deterioro observado)
- [x] Series de tesorería: Caja y flujos · Retrasos de pago · Morosidad y descubierto
- [x] Frente a su cohorte (7 benchmarks p25/p50/p75)
- [x] ¿Y si…? 5 escenarios: salud antes/después, cambios aplicados, SHAP simulado
- [x] Hacia dónde va: previsión 6 m con banda, bache/estructural, cuándo se vio venir
- [x] Qué hacer: decisiones con € y puntos, aviso, simulador por métrica

## Evidencia
- [x] Si acierta (empresas no vistas, AUC, correlación de orden)
- [x] Las dos caras (detecta mejora / deterioro)
- [x] Si llega a tiempo (mediana, rango intercuartílico, casos)
- [x] Estabilidad (baches no confundidos, deterioros detectados)

## Modelo
- [x] La tesis + 4 KPIs + nota del holdout
- [x] Tabla de los 6 modelos
- [x] Anticipación (4 KPIs + histograma) · Generalización (3 KPIs + nota)
- [x] Validación cruzada + Brier · Ablación (gráfica)
- [x] Importancia por bloque (gráfica) · 20 variables (tabla)
- [x] Análisis de errores (4 KPIs + componente dominante + lectura)
- [x] 6 diagramas del entrenamiento

## Nuevo
- [x] Tarjeta TellMe en Cartera
- [x] Tarjeta TellMe en Empresa
- [x] Logo y tipografía de Embat, tema claro
