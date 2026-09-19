# 05 · Source Map

Responsable: **Felipe**. Para cada dato **MISSING** de [01-data-inventory.md](01-data-inventory.md): de dónde
sacarlo de forma legítima. Costes y condiciones marcados "verificar" no están confirmados.

> Para el hackathon **ninguna de estas fuentes se usa**: el modelo se construye solo con el dataset.
> Este mapa es el plan de producto real (qué pediríamos a la empresa y con qué permiso).

## Cuatro vías de obtención

| Vía | Qué es | Ejemplos |
|---|---|---|
| **Declarado** | Lo aporta la empresa voluntariamente | sector, fecha de constitución, plantilla |
| **Conexión autorizada** | Embat ya lo recibe con permiso de la empresa | bancos (agregación / PSD2), ERP |
| **Fuente externa legítima** | Registros públicos o proveedores con contrato | Registro Mercantil, BORME, Banco de España, bureaus comerciales |
| **No obtenible** | No existe o no es accesible | consultas de crédito tipo FICO |

## Mapa

| Dato | Por qué | Fuente potencial | Cómo pedirlo | Formato / frecuencia | Permisos y privacidad | Coste | Fiabilidad / validación |
|---|---|---|---|---|---|---|---|
| **Ground truth del leaderboard + formato de submission** | sin él no se puede medir el entregable obligatorio | organización del reto | preguntar a los ingenieros de Embat en el aula | fichero de scores; una vez | — | 0 | la única verdad disponible — **P0** |
| Snapshots históricos de `granted` / `outstanding` | utilización mensual real, no supuesta | Embat (si guarda fotos mensuales) | preguntar al especialista de datos | serie mensual | ya autorizado | 0 | alta |
| Sector (CNAE) | cohortes de benchmark; el front lo muestra | declarado en el alta; Registro Mercantil | campo obligatorio en onboarding | código CNAE; una vez | dato público de la sociedad | 0 | alta si se valida con registro |
| Fecha de constitución | antigüedad real (FICO C) | Registro Mercantil / BORME | CIF en el alta y consulta | fecha; una vez | pública | tasas registrales bajas (verificar) | alta |
| Cuentas anuales (ingresos, activo, patrimonio) | contexto; permitiría un Altman Z de contraste | depósito de cuentas en Registro Mercantil; o subida por la empresa | subir PDF / consulta registral | anual, con 6-18 meses de retraso | pública | por documento (verificar) | alta pero tardía: justo la "foto" que el reto critica |
| Deuda en todo el sistema bancario | el 40,8 % paga cuotas y solo el 29,4 % tiene deuda conectada | informe CIRBE del Banco de España | la empresa lo solicita como titular y lo comparte | mensual | consentimiento explícito de la empresa | gratuito para el titular (verificar) | muy alta; valida la deuda no conectada |
| Al corriente con Hacienda y Seguridad Social | historial de pagos a la administración | certificados AEAT y TGSS (sede electrónica) | la empresa los descarga con certificado digital | a demanda | consentimiento | 0 | muy alta |
| Incidencias en ficheros de morosidad | impagos formales (FICO A) | bureaus comerciales (p. ej. RAI, ASNEF Empresas, Informa, Axesor) | contrato con el proveedor | a demanda | base legal necesaria; **autónomos son personas físicas: aplica RGPD** | por consulta (verificar) | alta |
| Concurso de acreedores | desenlace real para un modelo en producción | Registro Público Concursal, BORME | consulta por CIF | evento | pública | 0 | alta; es el ground truth que falta |
| Inventario (DIO) | CCC completo | conector ERP de Embat, si lo expone | preguntar a Embat | mensual | ya autorizado | 0 | media |
| Plantilla | contexto de nóminas | informe de plantilla media TGSS; o declarado | la empresa lo descarga | anual | consentimiento | 0 | alta |
| País | 82,1 % vacío | declarado en el alta | campo en onboarding | ISO; una vez | — | 0 | alta |
| Consultas de crédito | FICO D | **No obtenible**: no hay registro público de solicitudes para empresas. Sustituto: solicitudes dentro de nuestro propio producto (si es marketplace, las vemos) | — | — | — | — | — |
| Fecha de apertura de cuentas | antigüedad por producto | certificado bancario | a petición | una vez | consentimiento | 0 | alta; baja prioridad |

## Reglas

- No se accede a nada sensible solo porque sea técnicamente posible: toda fuente externa exige consentimiento o base legal documentada.
- Cada fuente nueva entra al inventario con su clase (OBSERVED si viene tal cual) y a [08](08-data-quality-report.md) con su auditoría.
