#!/usr/bin/env node
// Generador estático de "Las Recetas de Isaac". Sin dependencias.
// Cada carpeta de /recetas con un receta.md se convierte en una página (/<carpeta>/)
// y aparece automáticamente como tarjeta en la portada.
const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const RECETAS = path.join(ROOT, "recetas");
const SRC = path.join(ROOT, "src");
const DIST = path.join(ROOT, "dist");
const SITE = "Las Recetas de Isaac";
// Ruta base para GitHub Pages de proyecto (p. ej. BASE_PATH=/recetario). Vacía = raíz del dominio.
const BASE = (process.env.BASE_PATH || "").replace(/\/+$/, "");

const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const norm = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

// ---------- Markdown mínimo ----------
function inline(s) {
  return esc(s)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>");
}

function parseFrontmatter(raw) {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return { meta: {}, body: raw };
  const meta = {};
  m[1].split(/\r?\n/).forEach((line) => {
    const i = line.indexOf(":");
    if (i > 0) meta[line.slice(0, i).trim()] = line.slice(i + 1).replace(/\s+#.*$/, "").trim();
  });
  return { meta, body: m[2] };
}

// Divide el cuerpo en secciones por "## Título"
function sections(body) {
  const out = [];
  let cur = null;
  body.split(/\r?\n/).forEach((line) => {
    const h = line.match(/^##\s+(.+)$/);
    if (h) {
      cur = { title: h[1].trim(), lines: [] };
      out.push(cur);
    } else if (cur) cur.lines.push(line);
  });
  return out;
}

function renderBlock(lines, checkable) {
  let html = "";
  let list = null; // "ul" | "ol"
  const close = () => {
    if (list) html += `</${list}>`;
    list = null;
  };
  lines.forEach((line) => {
    let m;
    if ((m = line.match(/^###\s+(.+)$/))) {
      close();
      html += `<h3>${inline(m[1])}</h3>`;
    } else if ((m = line.match(/^[-*]\s+(.+)$/))) {
      if (list !== "ul") (close(), (html += "<ul>"), (list = "ul"));
      html += checkable
        ? `<li><label><input type="checkbox"><span>${inline(m[1])}</span></label></li>`
        : `<li>${inline(m[1])}</li>`;
    } else if ((m = line.match(/^\d+[.)]\s+(.+)$/))) {
      if (list !== "ol") (close(), (html += "<ol>"), (list = "ol"));
      html += `<li><span>${inline(m[1])}</span></li>`;
    } else if (line.trim()) {
      close();
      html += `<p>${inline(line.trim())}</p>`;
    } else close();
  });
  close();
  return html;
}

// ---------- Iconos ----------
const svg = (inner, size = 20, extra = "") =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"${extra}>${inner}</svg>`;
const ICON = {
  search: svg('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>', 22),
  clock: svg('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', 20),
  users: svg('<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>', 20),
  list: svg('<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>', 20),
  steps: svg('<path d="M10 6h11M10 12h11M10 18h11M4 6h1v4M4 10h2M6 18H4c0-1 2-2 2-3s-1-1.5-2-1"/>', 20),
  arrow: svg('<path d="M5 12h14M13 6l6 6-6 6"/>', 18),
  down: svg('<path d="M12 5v14M5 12l7 7 7-7"/>', 24),
  copy: svg('<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>', 18),
  reset: svg('<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>', 18),
  back: svg('<path d="M19 12H5M11 18l-6-6 6-6"/>', 18),
};
const MARK =
  '<svg class="mark" viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="15" fill="currentColor"/><path d="M16 16a2 2 0 0 1 2 2 4 4 0 0 1-4 4 6 6 0 0 1-6-6 8 8 0 0 1 8-8" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round"/></svg>';
const FAVICON =
  "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><circle cx='16' cy='16' r='15' fill='#3d62b2'/><path d='M16 16a2 2 0 0 1 2 2 4 4 0 0 1-4 4 6 6 0 0 1-6-6 8 8 0 0 1 8-8' fill='none' stroke='#fff' stroke-width='2' stroke-linecap='round'/></svg>";

// ---------- Plantillas ----------
const FONTS =
  '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>' +
  '<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&family=Outfit:wght@300;500;600&display=swap" rel="stylesheet">';

const page = ({ title, description, body }) => `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<meta name="theme-color" content="#ffffff">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:type" content="website">
<link rel="icon" href="data:image/svg+xml,${encodeURIComponent(FAVICON)}">
${FONTS}
<link rel="stylesheet" href="${BASE}/styles.css">
<script>document.documentElement.classList.add("js")</script>
</head>
<body>
${body}
<script src="${BASE}/app.js" defer></script>
</body>
</html>
`;

const nav = (home) => `<nav class="nav" id="nav"><div class="wrap">
<a class="brand" href="${BASE}/">${MARK}<span>${SITE}</span></a>
<a class="ghost" href="${BASE}/#recetas">Recetas</a>
</div></nav>`;

const footer = `<footer class="footer"><div class="wrap">
<a class="brand small" href="${BASE}/">${MARK}<span>${SITE}</span></a>
<span>© ${new Date().getFullYear()} Isaac · Hecho con cariño y mantequilla</span>
</div></footer>`;

// ---------- Lectura de recetas ----------
const countLines = (lines, re) => lines.filter((l) => re.test(l)).length;

function loadRecipes() {
  if (!fs.existsSync(RECETAS)) return [];
  return fs
    .readdirSync(RECETAS, { withFileTypes: true })
    .filter((d) => d.isDirectory() && fs.existsSync(path.join(RECETAS, d.name, "receta.md")))
    .map((d) => {
      const dir = path.join(RECETAS, d.name);
      const { meta, body } = parseFrontmatter(fs.readFileSync(path.join(dir, "receta.md"), "utf8"));
      const secs = sections(body);
      const ingr = secs.find((s) => /ingredient/i.test(s.title));
      const resto = secs.filter((s) => s !== ingr);
      const categorias = (meta.categoria || "")
        .split(",")
        .map((c) => c.trim())
        .filter(Boolean);
      return {
        slug: d.name,
        dir,
        titulo: meta.titulo || d.name,
        descripcion: meta.descripcion || "",
        categorias,
        tiempo: meta.tiempo || "",
        raciones: meta.raciones || "",
        imagen: meta.imagen || "",
        fecha: meta.fecha || "",
        ingr,
        resto,
        nIngr: ingr ? countLines(ingr.lines, /^[-*]\s+/) : 0,
        nPasos: resto.reduce((n, s) => n + countLines(s.lines, /^\d+[.)]\s+/), 0),
        texto: norm([meta.titulo, meta.descripcion, meta.categoria, ingr ? ingr.lines.join(" ") : ""].join(" ")),
      };
    })
    .sort((a, b) => (b.fecha || "").localeCompare(a.fecha || "") || a.titulo.localeCompare(b.titulo, "es"));
}

const thumbSrc = (r) => (r.imagen ? `${BASE}/${r.slug}/${r.imagen}` : "");
const isVector = (r) => /\.svg$/i.test(r.imagen);
const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;

// ---------- Páginas ----------
function sectionHtml(s) {
  const texto = s.lines.join(" ").trim();
  if (!texto || /^pendiente/i.test(texto)) {
    return `<section class="steps"><h2>${esc(s.title)}</h2><div class="pending"><strong>Todavía sin escribir.</strong> Esta receta aún no tiene el paso a paso; pronto estará aquí.</div></section>`;
  }
  return `<section class="steps"><h2>${esc(s.title)}</h2>${renderBlock(s.lines, false)}</section>`;
}

function fact(icon, label, value) {
  return `<div class="fact">${icon}<div><small>${esc(label)}</small><b>${esc(value)}</b></div></div>`;
}

function recipePage(r, all) {
  const tags = r.categorias.map((c) => `<span class="tag">${esc(c)}</span>`).join("");
  const facts = [];
  if (r.tiempo) facts.push(fact(ICON.clock, "Tiempo", r.tiempo));
  if (r.raciones) facts.push(fact(ICON.users, "Raciones", r.raciones));
  if (r.nIngr) facts.push(fact(ICON.list, "Ingredientes", String(r.nIngr)));
  if (r.nPasos) facts.push(fact(ICON.steps, "Pasos", String(r.nPasos)));

  const cover = r.imagen
    ? `<div class="wrap"><div class="cover reveal"><img class="${isVector(r) ? "contain" : ""}" src="${esc(thumbSrc(r))}" alt="${esc(r.titulo)}"></div></div>`
    : "";

  const ingr = r.ingr
    ? `<aside class="ingr reveal">
<div class="ingr-head"><h2>${esc(r.ingr.title)}</h2><span class="progress" id="progreso" aria-live="polite">0/${r.nIngr}</span></div>
<div class="bar" aria-hidden="true"><i id="barra"></i></div>
${renderBlock(r.ingr.lines, true)}
<div class="ingr-actions">
<button class="btn" type="button" id="copiar">${ICON.copy}<span>Copiar lista</span></button>
<button class="btn quiet" type="button" id="reiniciar">${ICON.reset}<span>Reiniciar</span></button>
</div>
</aside>`
    : "";
  const resto = r.resto.map(sectionHtml).join("");

  const otras = all
    .filter((o) => o.slug !== r.slug)
    .sort((a, b) => b.categorias.filter((c) => r.categorias.includes(c)).length - a.categorias.filter((c) => r.categorias.includes(c)).length)
    .slice(0, 3);
  const mas = otras.length
    ? `<section class="wrap more"><div class="list-head"><h2>Más recetas</h2></div><div class="grid">${otras.map(card).join("\n")}</div></section>`
    : "";

  const body = `${nav(false)}
<header class="wrap recipe-head">
<a class="back" href="${BASE}/#recetas">${ICON.back}<span>Todas las recetas</span></a>
<div class="meta">${tags}</div>
<h1>${esc(r.titulo)}</h1>
${r.descripcion ? `<p class="lead">${esc(r.descripcion)}</p>` : ""}
${facts.length ? `<div class="facts">${facts.join("")}</div>` : ""}
</header>
${cover}
<main class="wrap recipe-body">${ingr}<div class="proceso">${resto}</div></main>
${mas}
${footer}`;
  return page({ title: `${r.titulo} · ${SITE}`, description: r.descripcion || r.titulo, body });
}

function card(r) {
  const img = r.imagen ? `<img src="${esc(thumbSrc(r))}" alt="" loading="lazy">` : "";
  const tag = r.categorias[0] ? `<span class="tag tag-float">${esc(r.categorias[0])}</span>` : "";
  const info = [];
  if (r.tiempo) info.push(`<span class="info">${ICON.clock}${esc(r.tiempo)}</span>`);
  if (r.nIngr) info.push(`<span class="info">${ICON.list}${plural(r.nIngr, "ingrediente", "ingredientes")}</span>`);
  return `<a class="card reveal" href="${BASE}/${esc(r.slug)}/" data-buscar="${esc(r.texto)}" data-categorias="${esc(r.categorias.join("|"))}">
<div class="thumb">${img}${tag}</div>
<div class="card-body">
<h3>${esc(r.titulo)}</h3>
<p>${esc(r.descripcion)}</p>
<div class="card-foot">${info.join("")}<span class="go">Ver receta ${ICON.arrow}</span></div>
</div>
</a>`;
}

function homePage(recipes) {
  const cats = [...new Set(recipes.flatMap((r) => r.categorias))].sort((a, b) => a.localeCompare(b, "es"));
  const chips =
    `<button class="chip" type="button" data-categoria="" aria-pressed="true">Todas</button>` +
    cats.map((c) => `<button class="chip" type="button" data-categoria="${esc(c)}" aria-pressed="false">${esc(c)}</button>`).join("");
  const body = `${nav(true)}
<header class="hero">
<div class="wrap hero-inner">
<div class="hero-copy">
<p class="eyebrow"><span class="dot"></span>Recetario personal</p>
<h1>Las Recetas de <em>Isaac</em></h1>
<p class="tagline">Lo que cocino en casa, con cantidades exactas y paso a paso. Sin florituras.</p>
<p class="stats"><span><b>${recipes.length}</b> ${recipes.length === 1 ? "receta" : "recetas"}</span><span><b>${cats.length}</b> ${cats.length === 1 ? "categoría" : "categorías"}</span></p>
</div>
<div class="controls">
<div class="search">${ICON.search}<label class="visually-hidden" for="buscador">Buscar recetas</label><input id="buscador" type="search" placeholder="Busca recetas o ingredientes…" autocomplete="off" enterkeyhint="search"></div>
<div class="filters" role="group" aria-label="Filtrar por categoría">${chips}</div>
</div>
<a class="glass scroll-down" href="#recetas" aria-label="Ir a las recetas">${ICON.down}</a>
</div>
</header>
<main class="wrap" id="recetas">
<div class="list-head"><h2>Recetas</h2><span class="count" id="contador" aria-live="polite">${plural(recipes.length, "receta", "recetas")}</span></div>
<div class="grid">${recipes.map(card).join("\n")}</div>
<p class="empty" id="vacio" hidden>No hay recetas que coincidan con tu búsqueda.</p>
</main>
${footer}`;
  return page({ title: SITE, description: "Mi recetario personal: recetas con ingredientes y proceso.", body });
}

// ---------- Build ----------
fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(DIST, { recursive: true });
fs.copyFileSync(path.join(SRC, "styles.css"), path.join(DIST, "styles.css"));
fs.copyFileSync(path.join(SRC, "app.js"), path.join(DIST, "app.js"));
fs.writeFileSync(path.join(DIST, ".nojekyll"), "");

const recipes = loadRecipes();
recipes.forEach((r) => {
  const out = path.join(DIST, r.slug);
  fs.mkdirSync(out, { recursive: true });
  // copia imágenes y otros archivos de la receta (menos el .md)
  fs.readdirSync(r.dir).forEach((f) => {
    if (f !== "receta.md") fs.copyFileSync(path.join(r.dir, f), path.join(out, f));
  });
  fs.writeFileSync(path.join(out, "index.html"), recipePage(r, recipes));
});
fs.writeFileSync(path.join(DIST, "index.html"), homePage(recipes));
fs.writeFileSync(path.join(DIST, "404.html"), page({
  title: `No encontrada · ${SITE}`,
  description: "Página no encontrada",
  body: `${nav(false)}<main class="wrap"><div class="notfound"><h1>Esta receta<br>no existe <em>(aún)</em></h1><p class="tagline">Puede que el enlace esté mal escrito.</p><a class="btn solid" href="${BASE}/">Volver al recetario</a></div></main>${footer}`,
}));
console.log(`✔ ${recipes.length} receta(s) generadas en dist/`);
