# Decisiones

Registro de decisiones tomadas sin supervisión. Una línea de justificación cada una.

## Bloque 1: scaffold

- Se continúa el scaffold existente (index.html, tokens.css, global.css, theme/) en vez de rehacerlo: ya cumplía el prompt y el build estaba a un paso de pasar. Faltaban `main.tsx`, `App.tsx` y `theme-toggle.css`.
- `--ink-muted` está al 65% y `--ink-secondary` al 70% (el prompt sugería 65% y 40%): el 40% no llega a contraste AA para texto. El 40% queda como `--ink-faint`, solo para elementos que no son texto.
- `--accent-text` mezcla el latón con `--ink` en el tema claro para llegar a AA como texto sobre superficie clara; en oscuro se usa el latón tal cual. El latón puro solo se usa como línea de gráfico y borde.
- Sin router externo (no está entre las dependencias permitidas): navegación por hash (`#/`, `#/empresa/:id`) con un hook propio.
- `overnight.log` de la raíz no se añade a git: es salida del arnés, no del proyecto.
- Git no tenía identidad configurada; los commits usan `git -c user.name=hackaton -c user.email=mbellachhab25@gmail.com` (la misma del commit previo) sin modificar la config del repo.
