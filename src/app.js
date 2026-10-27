// Interacciones del recetario: buscador + filtros (portada), lista de ingredientes (receta),
// animaciones de entrada y sombra de la barra superior.
(function () {
  "use strict";

  // ---- Barra superior: sombra al hacer scroll ----
  var nav = document.getElementById("nav");
  if (nav) {
    var onScroll = function () { nav.classList.toggle("scrolled", window.scrollY > 8); };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }

  // ---- Animación de entrada ----
  var reveals = Array.prototype.slice.call(document.querySelectorAll(".reveal"));
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          e.target.classList.add("in"); io.unobserve(e.target);
          setTimeout(function () { e.target.style.transitionDelay = ""; }, 1000);
        }
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.05 });
    reveals.forEach(function (el, i) {
      el.style.transitionDelay = Math.min(i % 6, 5) * 60 + "ms";
      io.observe(el);
    });
  } else {
    reveals.forEach(function (el) { el.classList.add("in"); });
  }

  // ---- Portada: buscador + filtros ----
  var input = document.getElementById("buscador");
  if (input) {
    var cards = Array.prototype.slice.call(document.querySelectorAll("#recetas .card"));
    var chips = Array.prototype.slice.call(document.querySelectorAll(".chip"));
    var count = document.getElementById("contador");
    var empty = document.getElementById("vacio");
    var categoria = "";

    var norm = function (s) { return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, ""); };

    var aplicar = function () {
      var q = norm(input.value.trim());
      var visibles = 0;
      cards.forEach(function (c) {
        var okQ = !q || c.dataset.buscar.indexOf(q) !== -1;
        var okC = !categoria || c.dataset.categorias.split("|").indexOf(categoria) !== -1;
        c.hidden = !(okQ && okC);
        if (!c.hidden) visibles++;
      });
      count.textContent = visibles + (visibles === 1 ? " receta" : " recetas");
      empty.hidden = visibles !== 0;
    };

    input.addEventListener("input", aplicar);
    chips.forEach(function (chip) {
      chip.addEventListener("click", function () {
        categoria = chip.dataset.categoria;
        chips.forEach(function (c) { c.setAttribute("aria-pressed", c === chip ? "true" : "false"); });
        aplicar();
      });
    });
    aplicar();
  }

  // ---- Receta: ingredientes marcables, progreso, copiar ----
  var ingr = document.querySelector(".ingr");
  if (ingr) {
    var boxes = Array.prototype.slice.call(ingr.querySelectorAll('input[type="checkbox"]'));
    var progreso = document.getElementById("progreso");
    var barra = document.getElementById("barra");
    var key = "recetario:" + location.pathname;

    var guardado = [];
    try { guardado = JSON.parse(localStorage.getItem(key) || "[]"); } catch (e) {}
    boxes.forEach(function (b, i) { b.checked = guardado.indexOf(i) !== -1; });

    var actualizar = function () {
      var hechos = boxes.filter(function (b) { return b.checked; }).length;
      progreso.textContent = hechos + "/" + boxes.length;
      barra.style.width = (boxes.length ? (hechos / boxes.length) * 100 : 0) + "%";
      try {
        var marcados = [];
        boxes.forEach(function (b, i) { if (b.checked) marcados.push(i); });
        localStorage.setItem(key, JSON.stringify(marcados));
      } catch (e) {}
    };
    boxes.forEach(function (b) { b.addEventListener("change", actualizar); });
    actualizar();

    var reiniciar = document.getElementById("reiniciar");
    if (reiniciar) reiniciar.addEventListener("click", function () {
      boxes.forEach(function (b) { b.checked = false; });
      actualizar();
    });

    var copiar = document.getElementById("copiar");
    if (copiar) copiar.addEventListener("click", function () {
      var lineas = [];
      Array.prototype.forEach.call(ingr.querySelectorAll("h3, li"), function (el) {
        lineas.push(el.tagName === "H3" ? "\n" + el.textContent + ":" : "- " + el.textContent.trim());
      });
      var texto = document.querySelector(".recipe-head h1").textContent + "\n" + lineas.join("\n").trim();
      var etiqueta = copiar.querySelector("span");
      var listo = function () {
        etiqueta.textContent = "¡Copiada!";
        setTimeout(function () { etiqueta.textContent = "Copiar lista"; }, 1800);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(texto).then(listo, function () {});
      }
    });
  }

  // ---- Receta: marcar pasos hechos ----
  Array.prototype.forEach.call(document.querySelectorAll(".steps ol li"), function (li) {
    li.addEventListener("click", function () { li.classList.toggle("done"); });
  });
})();
