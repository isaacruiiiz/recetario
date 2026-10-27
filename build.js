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
    if (i > 0) meta[line.slice(0, i).trim()] = line.slice(i + 1).trim();
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

// ---------- Plantillas ----------
const FONTS =
  '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>' +
  '<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&family=Outfit:wght@300;600&display=swap" rel="stylesheet">';

const page = ({ title, description, body, script }) => `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<meta name="theme-color" content="#ffffff">
${FONTS}
<link rel="stylesheet" href="/styles.css">
</head>
<body>
${body}
${script ? '<script src="/app.js" defer></script>' : ""}
</body>
</html>
`;

const ICON_SEARCH =
  '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#3d62b2" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>';
const ICON_DOWN =
  '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 512 512" aria-hidden="true"><path fill="none" stroke="#3d62b2" stroke-linecap="round" stroke-linejoin="round" stroke-width="48" d="m112 268l144 144l144-144M256 392V100"/></svg>';

const nav = (home) => `<nav class="nav"><div class="wrap">
<a class="brand" href="/">${SITE}</a>
${home ? "" : '<a class="ghost" href="/#recetas">Todas las recetas</a>'}
</div></nav>`;

const footer = `<footer class="footer"><div class="wrap">© ${new Date().getFullYear()} Isaac · Hecho con cariño y mantequilla</div></footer>`;

// ---------- Lectura de recetas ----------
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
        texto: norm([meta.titulo, meta.descripcion, meta.categoria, ingr ? ingr.lines.join(" ") : ""].join(" ")),
      };
    })
    .sort((a, b) => (b.fecha || "").localeCompare(a.fecha || "") || a.titulo.localeCompare(b.titulo, "es"));
}

const thumbSrc = (r) => (r.imagen ? `/${r.slug}/${r.imagen}` : "");

// ---------- Páginas ----------
function recipePage(r) {
  const meta = [...r.categorias.map((c) => `<span class="tag">${esc(c)}</span>`)];
  if (r.tiempo) meta.push(`<span class="tag">${esc(r.tiempo)}</span>`);
  if (r.raciones) meta.push(`<span class="tag">${esc(r.raciones)}</span>`);
  const cover = r.imagen
    ? `<div class="wrap"><div class="cover"><img src="${esc(thumbSrc(r))}" alt="${esc(r.titulo)}"></div></div>`
    : "";
  const ingr = r.ingr ? `<aside><h2>${esc(r.ingr.title)}</h2>${renderBlock(r.ingr.lines, true)}</aside>` : "";
  const resto = r.resto.map((s) => `<section><h2>${esc(s.title)}</h2>${renderBlock(s.lines, false)}</section>`).join("");
  const body = `${nav(false)}
<header class="recipe-head"><div class="wrap">
<a class="back" href="/#recetas"><span aria-hidden="true">←</span> Todas las recetas</a>
<div class="meta">${meta.join("")}</div>
<h1>${esc(r.titulo)}</h1>
${r.descripcion ? `<p class="lead">${esc(r.descripcion)}</p>` : ""}
</div></header>
${cover}
<main class="wrap recipe-body">${ingr}<div>${resto}</div></main>
${footer}`;
  return page({ title: `${r.titulo} · ${SITE}`, description: r.descripcion || r.titulo, body, script: true });
}

function card(r) {
  const img = r.imagen ? `<img src="${esc(thumbSrc(r))}" alt="" loading="lazy">` : "";
  return `<a class="card" href="/${esc(r.slug)}/" data-buscar="${esc(r.texto)}" data-categorias="${esc(r.categorias.join("|"))}">
<div class="thumb">${img}</div>
<div class="meta">${r.categorias.map((c) => `<span class="tag">${esc(c)}</span>`).join("")}</div>
<h3>${esc(r.titulo)}</h3>
<p>${esc(r.descripcion)}</p>
</a>`;
}

function homePage(recipes) {
  const cats = [...new Set(recipes.flatMap((r) => r.categorias))].sort((a, b) => a.localeCompare(b, "es"));
  const chips =
    `<button class="chip" type="button" data-categoria="" aria-pressed="true">Todas</button>` +
    cats.map((c) => `<button class="chip" type="button" data-categoria="${esc(c)}" aria-pressed="false">${esc(c)}</button>`).join("");
  const body = `${nav(true)}
<header class="wrap hero">
<div>
<h1>Las Recetas de <em>Isaac</em></h1>
<p class="tagline">Mi recetario personal: lo que cocino, con cantidades y paso a paso.</p>
</div>
<div class="controls">
<div class="search">${ICON_SEARCH}<label class="visually-hidden" for="buscador">Buscar recetas</label><input id="buscador" type="search" placeholder="Busca por nombre, ingrediente o tipo…" autocomplete="off"></div>
<div class="filters" role="group" aria-label="Filtrar por categoría">${chips}</div>
<a class="glass scroll-down" href="#recetas" aria-label="Ir a las recetas"><span class="gl-t">${ICON_DOWN}</span></a>
</div>
</header>
<main class="wrap" id="recetas">
<div class="list-head"><h2>Recetas</h2><span class="count" id="contador" aria-live="polite">${recipes.length} recetas</span></div>
<div class="grid">${recipes.map(card).join("\n")}</div>
<p class="empty" id="vacio" hidden>No hay recetas que coincidan con tu búsqueda.</p>
</main>
${footer}`;
  return page({ title: `${SITE}`, description: "Mi recetario personal: recetas con ingredientes y proceso.", body, script: true });
}

// ---------- Build ----------
fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(DIST, { recursive: true });
fs.copyFileSync(path.join(SRC, "styles.css"), path.join(DIST, "styles.css"));
fs.copyFileSync(path.join(SRC, "app.js"), path.join(DIST, "app.js"));

const recipes = loadRecipes();
recipes.forEach((r) => {
  const out = path.join(DIST, r.slug);
  fs.mkdirSync(out, { recursive: true });
  // copia imágenes y otros archivos de la receta (menos el .md)
  fs.readdirSync(r.dir).forEach((f) => {
    if (f !== "receta.md") fs.copyFileSync(path.join(r.dir, f), path.join(out, f));
  });
  fs.writeFileSync(path.join(out, "index.html"), recipePage(r));
});
fs.writeFileSync(path.join(DIST, "index.html"), homePage(recipes));
console.log(`✔ ${recipes.length} receta(s) generadas en dist/`);
