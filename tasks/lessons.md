# Lecciones

## 2026-09-19 — El producto no es el modelo de negocio

**Corrección**: me centré demasiado en cómo se monetiza (paywall, quién paga, suscripción) y
monté el producto entero alrededor de una sola idea, la red de contrapartes.

**Regla**: el reto pide comprador identificado, pero eso se responde en **una frase**, no con
una mecánica de pago en pantalla. Un paywall en una demo resta: ocupa sitio, no demuestra
señal y no puntúa en ninguno de los tres bloques de la rúbrica.

**Además**: no dejar que todo el producto gire sobre un único eje. Si ese eje falla —por datos
o por tiempo— no queda nada. Varias capas apoyadas en el mismo score aguantan mejor.

## 2026-09-19 — Verificar que los datos sostienen la idea, antes de diseñar sobre ella

**Patrón**: propuse un producto apoyado en las contrapartes sin haber comprobado si los
`counterparty_id` cruzan con `company_id`. Iba a construir sobre una suposición.

**Regla**: antes de proponer un producto que dependa de una relación entre datos, comprobar
que esa relación existe. Y si el usuario prefiere no gastar tiempo en comprobarlo, diseñar la
versión que funciona en ambos casos, diciéndolo explícitamente.

**Caso vivo**: el Altman Z-score es el estándar de scoring de crédito, pero **no se puede
calcular con este dataset**: no hay balance ni cuenta de resultados, solo flujos. Detectarlo
antes de diseñar con él evita rehacerlo el domingo.

## 2026-09-19 — Coordinación: no soy el único que toca la rama

**Patrón**: hice push y fue rechazado; un compañero había subido dos commits a `clean-start`,
el segundo borrando el backend.

**Regla**: ante un push rechazado, nunca forzar. Mirar qué hay en el remoto, entender la
intención de los commits ajenos, rebase encima, y avisar al usuario de lo que hizo el otro —
especialmente si borra trabajo. Restaurar algo que otra persona borró a propósito es una
decisión del usuario, no mía, y conviene avisar de que hay que comunicárselo al equipo.

## 2026-09-19 — Distinguir la propiedad del modelo de la forma de los datos

**Corrección**: equilibré la cartera mock a 50/50 entre empresas que mejoran y que empeoran,
razonando que el reto evalúa "las dos caras". El usuario señaló que no tiene por qué: es
normal que la mayoría vaya bien.

**Regla**: "las dos caras" es una propiedad del **modelo** —detectar mejora y deterioro con
la misma sensibilidad, que se mide en la pantalla Evidencia— no de la **distribución de la
población**. Antes de retocar los datos para que cumplan un criterio, comprobar si el criterio
habla de los datos o del sistema que los lee.

**Cómo aplicarlo**: los datos mock imitan la realidad; las métricas demuestran el modelo. No
se maquillan los datos para que las métricas salgan bonitas.

## 2026-09-19 — Un componente que recarga por interacción no puede vaciarse mientras recarga

**Corrección**: al arrastrar el slider del simulador de palancas, la página saltaba arriba y
abajo. Lo había probado clic a clic y en tests, pero no arrastrando, que es como se usa.

**Causa**: `frontend/src/shared/useAsync.ts` hace `setState({data: null, loading: true})` en cada
recarga. Eso está bien cuando la recarga viene de cambiar de pantalla, pero cuando la dispara el
propio usuario desde un control, el contenido se desmonta, el documento encoge —medido: 338 px— y
todo lo de debajo salta bajo el cursor.

**Regla**: si un componente recarga datos por una interacción *dentro de la propia pantalla*
(slider, filtro, chip, select), tiene que conservar el último valor mientras llega el siguiente,
o reservar la altura. Cambiar el contenido por un "Cargando…" es aceptable al entrar en una
pantalla, nunca mientras el usuario manipula un control.

**Cómo verificarlo**: medir `document.documentElement.scrollHeight` durante la interacción, no
mirar la pantalla. Un arrastre continuo (20+ pasos) revela lo que un clic suelto no enseña.

