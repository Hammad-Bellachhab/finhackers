# Paleta de Embat

Extraida del design system publicado en `embat.io` (WordPress con tema propio `embat`).
Los valores salen de los tokens `--wp--preset--color--*` del `global-styles` de su web, no
de un muestreo a ojo de capturas.

**Implementacion: `frontend/src/styles/tokens.css`.** Ese fichero es la fuente de verdad del
front; esta pagina es la referencia legible.

> Se han descartado los tokens que WordPress trae de serie (`vivid-red`, `pale-pink`,
> `luminous-vivid-amber`, `cyan-bluish-gray`, `light-green-cyan`...). No son de Embat.

## Lo esencial

El color insignia es un **navy muy oscuro**, `#050b2c`, que hace de texto sobre fondo claro y
de fondo en modo oscuro. El color de accion es un **azul** `#3878f6`. Y la marca tiene un
**gradiente morado-azul** que usan en iconos y acentos.

| Rol | Claro | Oscuro |
|---|---|---|
| Navy de marca | `#050b2c` | `#050b2c` (fondo) |
| Azul de accion | `#3878f6` | `#5c92fe` |
| Gradiente | `linear-gradient(275deg, #c357ec 4.22%, #b565f3 50%, #5c92fe 95.78%)` | igual |

## Superficie y texto

| Token | Claro | Oscuro |
|---|---|---|
| Fondo | `#ffffff` | `#050b2c` |
| Fondo sutil | `#fbfbfc` | `#050b2c` |
| Superficie | `#f3f4f6` | `#232845` |
| Superficie pulsada | `#e8e8ed` | `#41465f` |
| Borde | `#e8e8ed` | `#373c56` |
| Borde fuerte | `#d2d2db` | `#696d80` |
| Texto | `#050b2c` | `#ffffff` |
| Texto secundario | `#6e707c` | `#afafbb` |
| Texto terciario | `#42444c` | `#d2d2db` |
| Texto deshabilitado | `#888996` | `#787d96` |

## Accion

| Token | Claro | Oscuro |
|---|---|---|
| Accent | `#3878f6` | `#5c92fe` |
| Hover | `#0338bb` | `#a5c4ff` |
| Pressed | `#002a9b` | `#c7daff` |
| Suave (fondo) | `#e7efff` | `#002a9b` |

## Estado

| Estado | Claro | Suave claro | Oscuro | Suave oscuro |
|---|---|---|---|---|
| Success | `#08ab39` | `#e7ffee` | `#80efa2` | `#007d25` |
| Warning | `#dfb631` | `#fff5de` | `#dfb631` | `#997800` |
| Danger | `#c2401f` | `#ffe7e0` | `#e5775b` | `#7d1900` |

## Acentos de marca

| Nombre | Claro | Oscuro |
|---|---|---|
| Purple | `#8041d1` | `#b083e8` |
| Purple medium | `#c357ec` | `#a154e9` |
| Aquamarine | `#3ec0d6` | `#5ed3e5` |
| Pink | `#d23b72` | `#e05a8a` |
| Warm | `#d6873e` | `#e59f5e` |
| Coral (highlight-2) | `#f7b2a8` | `#f7b2a8` |

## Bandas de score

Vocabulario propio del producto, mapeado sobre la paleta de Embat. El reto pide leer en las
**dos direcciones**, asi que la trayectoria (mejora / deterioro) no puede compartir color con
el nivel absoluto (sano / en riesgo).

| Banda | Color | Por que |
|---|---|---|
| Sano | `#08ab39` success | nivel alto |
| Mejorando | `#3ec0d6` aquamarine | trayectoria al alza, distinta del verde de nivel |
| Estable | `#6e707c` texto secundario | sin señal, no compite visualmente |
| Torciendose | `#dfb631` warning | el caso de 82 -> 68: aun sano, ya moviendose |
| En riesgo | `#c2401f` danger | nivel bajo |

## Categoricos para graficas

Orden de uso: `#3878f6`, `#8041d1`, `#3ec0d6`, `#d6873e`, `#d23b72`, `#08ab39`.

En oscuro: `#5c92fe`, `#b083e8`, `#5ed3e5`, `#e59f5e`, `#e05a8a`, `#80efa2`.

## Avisos

- El amarillo `#dfb631` sobre blanco tiene contraste bajo para texto pequeño (~2.1:1). Usarlo
  como relleno o borde, y para texto tirar de `#997800` (warning-strong).
- El coral `#f7b2a8` es decorativo, no de estado. No confundirlo con danger.
- El navy `#050b2c` es casi negro: en modo oscuro el fondo y el navy de marca coinciden, asi
  que la jerarquia la dan las superficies `#232845` y `#41465f`, no el color de marca.
