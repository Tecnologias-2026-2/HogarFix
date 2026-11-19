// ISSUE 10. Catálogo de categorías y tarifas fijas.
// Las tarifas se consultan siempre a la capa de servicios; el frontend solo las muestra.
import { getCategorias } from "../services/api.js";
import { escapeHTML, formatCOP, showLoading, showError, doneLoading } from "../utils.js";

// Landing (index.html): actualiza los precios estáticos con los del catálogo.
const tarifaNodes = document.querySelectorAll("[data-tarifa]");
if (tarifaNodes.length) {
  getCategorias()
    .then((categorias) =>
      tarifaNodes.forEach((node) => {
        const categoria = categorias.find((item) => item.id === node.dataset.tarifa);
        if (categoria) node.textContent = formatCOP(categoria.tarifa);
      }),
    )
    .catch(() => {
      /* Si falla, se conservan los precios publicados en el HTML. */
    });
}

// Búsqueda (buscar.html): tarjetas de categoría con su tarifa fija.
const catalog = document.querySelector("#category-catalog");

async function loadCatalog() {
  showLoading(catalog, "Cargando categorías…");
  try {
    const categorias = await getCategorias();
    catalog.innerHTML = categorias
      .map(
        (item) => `
        <button class="category-card" type="button" data-category-card="${escapeHTML(item.id)}" aria-pressed="false">
          <span class="service-icon ${escapeHTML(item.color)}"><img src="${escapeHTML(item.icono)}" alt="" width="40" height="40" /></span>
          <span class="category-card-text">
            <strong>${escapeHTML(item.nombre)}</strong>
            <small>${escapeHTML(item.descripcion)}</small>
          </span>
          <span class="category-card-price"><small>Tarifa fija</small>${formatCOP(item.tarifa)}</span>
        </button>`,
      )
      .join("");
    doneLoading(catalog);
    // Al elegir una categoría se activa el mismo filtro que los chips.
    catalog.querySelectorAll("[data-category-card]").forEach((card) =>
      card.addEventListener("click", () => {
        document.querySelector(`.filter-chip[data-filter="${card.dataset.categoryCard}"]`)?.click();
      }),
    );
    document.dispatchEvent(new CustomEvent("hogarfix:categorias", { detail: categorias }));
  } catch (error) {
    showError(catalog, error.message, loadCatalog);
  }
}

if (catalog) loadCatalog();
