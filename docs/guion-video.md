# Guión del vídeo (3 minutos) — Embat X-Ray

Formato: grabación de pantalla + voz en off. Ritmo de narración: ~150 palabras/minuto → el texto cabe en 3:00 con
respiraciones. Las cifras salen de `pipeline/README.md` y `pipeline/reports/`; no hay ninguna inventada.
Producto que se vende: **X-Ray tal como está desplegado**; **Pulso Crédito** se cuenta al final como lo que abre.

| Tiempo | Qué se ve en pantalla | Voz en off |
|---|---|---|
| **0:00–0:20** **El problema** | Fondo limpio con dos tarjetas: "Northbrook Foods 45 → 65" y "Velasco Industrial 82 → 68". Al final se enciende "M24: 65 vs 68". | Dos empresas, tres puntos de diferencia en su rating. Una viene de 45 y sube; la otra viene de 82 y cae. En la foto de hoy son iguales; en seis meses, no. Y todo lo que se mira de una pyme es una foto: cuentas que llegan tarde y ratings que se revisan una vez al año. |
| **0:20–0:45** **Qué hemos construido** | Landing de Embat → clic en X-Ray → landing de X-Ray con las tres tarjetas (0 a 100 · Avisa antes · Explica cada cambio). | X-Ray lee veinticuatro meses de tesorería —movimientos, facturas, deuda, saldos— de mil doscientas ochenta y seis empresas, y cada mes responde cuatro cosas: cómo está la empresa, de cero a cien; hacia dónde va; por qué ha cambiado; y qué puede hacer. |
| **0:45–1:25** **Las decisiones que importan** | Esquema animado de la línea temporal: ventana de observación → gap de 1 mes → ventana de resultado de 6 meses. Después, tres tarjetas cortas: "saldo reconstruido hacia atrás", "factura tal como se veía en T", "datos sucios = señal". | El dataset no traía etiqueta, así que definimos qué es deteriorarse: cinco síntomas en los seis meses siguientes —morosidad, caja en negativo, caída de cobros, crédito al límite, cese de actividad—, normalizados por tamaño; el quince por ciento peor es la etiqueta. Segundo: saldos y facturas vencidas eran una foto de hoy. Reconstruimos el saldo de cada mes hacia atrás y cada factura tal como se veía ese mes. Sin eso, el modelo habría copiado el futuro. Regla dura: nada posterior al mes T entra como variable. Validación temporal con siete meses de embargo, y ochenta y dos empresas apartadas que el modelo nunca ha visto. |
| **1:25–1:50** **Lo que hemos medido** | Pestaña **Global › Modelo**: "La tesis" con la comparativa A (solo balance) vs B (+ comportamiento). Sobreimpresos grandes: "+0,16 AUC-PR en empresas nunca vistas" · "80 % de los deterioros anticipados, 4 meses de mediana". | La tesis: el comportamiento predice mejor que el balance. En las ochenta y dos empresas nunca vistas, el modelo con comportamiento gana dieciséis puntos de AUC-PR al que solo mira balance. El balance memoriza empresas; el comportamiento generaliza. Anticipamos el ochenta por ciento de los deterioros reales, con cuatro meses de margen. De las que marcamos en riesgo se deteriora una de cada dos; de las sólidas, tres de cada cien. |
| **1:50–2:35** **La demo** | **Cartera** (tabla con salud y trayectoria, filtro rápido "Torciéndose") → **Alertas** ("se han movido solas este mes") → clic en una empresa → **Empresa**: salud + trayectoria, "Qué lo ha movido" (barras SHAP), "Hacia dónde va" (banda p10–p90), "Cuándo se vio venir", **"Cómo subir tu score"** moviendo un slider y viendo el número cambiar, y una pregunta a **TellMe**. Termina en **Proveedores**. | La demo, pública. La cartera: salud y trayectoria de cada empresa; un mes malo no la mueve, dos seguidos sí: bache o caída. El monitor levanta la mano solo: quién se ha movido este mes. Entramos en una: qué le ha movido el número, señal por señal. Hacia dónde va: una banda a seis meses sacada de dos mil trayectorias de empresas que estuvieron en su situación, cobertura medida del ochenta y uno por ciento. Cuándo se vio venir. Y cómo subir el score: cada palanca es un slider y el modelo repuntúa en directo. Lo que no se entienda, TellMe lo explica en llano. |
| **2:35–2:55** **Producto y comprador** | Tarjeta: "Embat vende X-Ray como módulo · coste marginal cero". Fundido a "Pulso Crédito — la línea de crédito que respira": tres iconos: la pyme comparte **su score, no sus movimientos** · límite y precio que se recalculan cada mes · aviso antes del recorte. | Quién paga: Embat ya tiene esta tesorería; X-Ray es el módulo que la convierte en decisión, a coste marginal cero. Y lo que abre: Pulso Crédito. La pyme comparte su score —nunca sus movimientos— con su banco, y a cambio tiene una línea de crédito que respira: límite y precio recalculados cada mes, y aviso antes del recorte. Lo paga el prestamista, porque por primera vez ve el riesgo moverse. |
| **2:55–3:00** **Cierre** | Logo X-Ray · `https://finhackers.hammad-bellachhab.workers.dev/` · URL del repo. | Esto no existe hoy para una pyme. Y está medido. Repo, README y demo en el enlace. |

## Palabras y tiempo

Narración ≈ 450 palabras → 3:00 a 150 ppm. Si al ensayar sobra tiempo, recortar por este orden: 1) en "Decisiones", la
frase de la validación temporal pasa a rótulo en pantalla; 2) en "Demo", fusionar "Cuándo se vio venir" con "Hacia dónde
va"; 3) en "Medido", la frase "De las que marcamos en riesgo…" pasa a sobreimpreso.

## Tomas a grabar (checklist)

1. Landing Embat → X-Ray → "Entrar a la demo" (una toma continua, ratón lento).
2. Global › Modelo: scroll hasta la comparativa A vs B; pausa de 3 s.
3. Global › Cartera: filtro rápido "Torciéndose" u orden "Mayor caída en 3 m (urgencia)"; hover en una fila.
4. Global › Alertas: scroll de la lista del mes.
5. Cliente › Empresa de una empresa con historia clara (deterioro anticipado): salud, "Qué lo ha movido", "Hacia dónde
   va", "Cuándo se vio venir", "Cómo subir tu score" (mover un slider y esperar el número), una pregunta a TellMe.
6. Cliente › Proveedores (3 s, solo para cerrar).
7. Pantallas estáticas (Figma/Canva/Slides): dos empresas del problema; línea temporal T/gap/ventana; tarjetas de
   reconstrucción; sobreimpresos de cifras; tarjeta Pulso Crédito; cierre con URLs.

## Cifras que se citan (fuente)

| Cifra | Fuente |
|---|---|
| 1.286 empresas, 24 meses | `docs/reto-embat.md` |
| Índice D: 5 síntomas, 15 % peor, cohortes de tamaño | `pipeline/README.md` § Capa 3 |
| Embargo 7 meses, 82 empresas de test | `pipeline/README.md` § Capa 5, `data/test_companies/` |
| Test simulado: B 0,823/0,448 vs A 0,790/0,281, lift +0,16 [+0,07; +0,25] | `pipeline/reports/` (evaluate_test) |
| Empresas apartadas en train: B 0,813 vs A 0,612 → "el balance memoriza" | `pipeline/README.md` § Capa 6 |
| 80 % anticipados, mediana 4 meses | `pipeline/reports/anticipation.json` |
| Riesgo 53 % se deteriora, sólida 3 % | `pipeline/reports/` (evaluate_test) |
| Proyección: 2.000 trayectorias, cobertura 80,9 % | `pipeline/reports/projection_backtest.json` |
| EMA α=0,5 (bache vs caída) | `pipeline/src/health.py`, `config.py` |
