// Buscador + filtros del listado (sólo actúa si existe el buscador)
(function () {
  var input = document.getElementById("buscador");
  if (!input) return;
  var cards = Array.prototype.slice.call(document.querySelectorAll(".card"));
  var chips = Array.prototype.slice.call(document.querySelectorAll(".chip"));
  var count = document.getElementById("contador");
  var empty = document.getElementById("vacio");
  var categoria = "";

  function norm(s) {
    return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  }

  function aplicar() {
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
  }

  input.addEventListener("input", aplicar);
  chips.forEach(function (chip) {
    chip.addEventListener("click", function () {
      categoria = chip.dataset.categoria;
      chips.forEach(function (c) { c.setAttribute("aria-pressed", c === chip ? "true" : "false"); });
      aplicar();
    });
  });
  aplicar();
})();
