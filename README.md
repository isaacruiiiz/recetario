# Las Recetas de Isaac

Recetario estático en HTML, CSS y JS (sistema de diseño del portfolio, tema claro). Sin dependencias: sólo Node para generar las páginas.

## Añadir una receta

1. Crea una carpeta en `recetas/` (el nombre será la URL: `recetas/pan-de-ajo/` → `/pan-de-ajo/`).
2. Dentro, un `receta.md` y la imagen:

```md
---
titulo: Pan de ajo
descripcion: Una frase que aparece en la tarjeta de la portada.
categoria: Salados          # varias: Salados, Entrantes
tiempo: 45 min              # opcional
raciones: 4 personas        # opcional
imagen: imagen.jpg          # opcional, archivo dentro de la carpeta
---

## Ingredientes

### Masa
- 300 g de harina

## Proceso

1. Primer paso.
2. Segundo paso.
```

Al hacer build se genera la página de la receta **y** su tarjeta en la portada (con buscador y filtros por categoría) automáticamente.

## Desarrollo

```bash
npm run build   # genera dist/
npm run dev     # build + servidor local
```

## Cloudflare Pages

- Build command: `node build.js`
- Build output directory: `dist`
- Framework preset: None

Cada `git push` vuelve a generar el sitio.
