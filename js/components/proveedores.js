// ISSUE 12. Visualización de proveedores (búsqueda y perfil).
import { getProveedores, getProveedor } from "../services/api.js";
import { escapeHTML, stars, showLoading, showError, doneLoading } from "../utils.js";

/* ---------- buscar.html ---------- */

const grid = document.querySelector("#provider-grid");
const searchForm = document.querySelector("#provider-search-form");

function providerCard(item) {
  const status = item.available
    ? '<dd class="status-available">● Disponible</dd>'
    : '<dd class="status-busy">● Ocupado</dd>';
  return `
    <article class="search-provider-card"
      data-name="${escapeHTML(item.name)}"
      data-service="${escapeHTML(item.profession)} ${escapeHTML(item.services.join(" "))}"
      data-category="${escapeHTML(item.categorias.join(" "))}"
      data-available="${item.available}">
      <div class="search-provider-top">
        <img class="search-provider-avatar" src="assets/provider-avatar.svg" alt="" />
        <div><h2>${escapeHTML(item.name)}</h2><p>${escapeHTML(item.profession)}</p></div>
        <span class="presence-dot${item.available ? "" : " offline"}" aria-label="${item.available ? "Disponible" : "Ocupado"}"></span>
      </div>
      <dl class="provider-facts">
        <div><dt>Ranking:</dt><dd class="provider-rating"><span aria-label="${item.rating} de 5 estrellas">${stars(item.rating)}</span> ${Number(item.rating).toFixed(1)}</dd></div>
        <div><dt>Servicio:</dt><dd>${escapeHTML(item.services.join(", "))}</dd></div>
        <div><dt>Distancia:</dt><dd><img src="assets/provider-pin.svg" alt="" /> ${escapeHTML(item.distanceKm)} Km Aprox.</dd></div>
        <div><dt>Estado:</dt>${status}</div>
      </dl>
      <a class="button profile-button" href="perfil-proveedor.html?id=${encodeURIComponent(item.id)}">Ver Perfil</a>
    </article>`;
}

function setupFilters() {
  const params = new URLSearchParams(location.search);
  const queryInput = document.querySelector("#service-query");
  const availableOnly = document.querySelector("#available-only");
  const resultCount = document.querySelector("#result-count");
  const noResults = document.querySelector("#no-results");
  const chips = [...document.querySelectorAll(".filter-chip")];
  let activeCategory = params.get("categoria") || "";
  queryInput.value = params.get("q") || "";

  const update = () => {
    const query = queryInput.value.trim().toLocaleLowerCase("es");
    const cards = [...grid.querySelectorAll(".search-provider-card")];
    let count = 0;
    cards.forEach((card) => {
      const text = `${card.dataset.name} ${card.dataset.service}`.toLocaleLowerCase("es");
      const matches =
        (!query || text.includes(query)) &&
        (!activeCategory || card.dataset.category.split(" ").includes(activeCategory)) &&
        (!availableOnly.checked || card.dataset.available === "true");
      card.hidden = !matches;
      if (matches) count += 1;
    });
    resultCount.textContent = `(${count} ${count === 1 ? "resultado" : "resultados"})`;
    noResults.hidden = count !== 0;
    chips.forEach((chip) =>
      chip.setAttribute("aria-pressed", String(chip.dataset.filter === activeCategory)),
    );
    document
      .querySelectorAll("[data-category-card]")
      .forEach((card) =>
        card.setAttribute("aria-pressed", String(card.dataset.categoryCard === activeCategory)),
      );
  };

  searchForm.addEventListener("submit", (event) => {
    event.preventDefault();
    update();
  });
  queryInput.addEventListener("input", update);
  availableOnly.addEventListener("change", update);
  chips.forEach((chip) =>
    chip.addEventListener("click", () => {
      activeCategory = activeCategory === chip.dataset.filter ? "" : chip.dataset.filter;
      update();
    }),
  );
  // El catálogo se pinta de forma asíncrona: al terminar, sincroniza su estado activo.
  document.addEventListener("hogarfix:categorias", update);
  return update;
}

async function loadProviders(update) {
  showLoading(grid, "Cargando profesionales…");
  document.querySelector("#result-count").textContent = "";
  try {
    const proveedores = await getProveedores();
    grid.innerHTML = proveedores.map(providerCard).join("");
    doneLoading(grid);
    update();
  } catch (error) {
    showError(grid, error.message, () => loadProviders(update));
  }
}

if (grid && searchForm) loadProviders(setupFilters());

/* ---------- perfil-proveedor.html ---------- */

const profileLayout = document.querySelector(".provider-profile-layout");

async function loadProfile() {
  const id = new URLSearchParams(location.search).get("id") || "carlos-ramirez";
  profileLayout.classList.add("is-loading");
  profileLayout.setAttribute("aria-busy", "true");
  try {
    const proveedor = await getProveedor(id);
    const fill = (selector, value) =>
      document.querySelectorAll(selector).forEach((node) => (node.textContent = value));
    fill("[data-provider-name]", proveedor.name);
    fill("[data-provider-profession]", proveedor.profession);
    fill("[data-provider-rating]", Number(proveedor.rating).toFixed(1));
    fill("[data-provider-jobs]", proveedor.jobs);
    fill("[data-provider-reviews]", proveedor.reviews);
    fill("[data-provider-service]", proveedor.services.join(" · "));
    fill("[data-provider-zone]", `📍 ${proveedor.zone}`);
    fill("[data-provider-bio]", proveedor.bio);
    fill("[data-provider-availability]", proveedor.availability);
    document.title = `${proveedor.name} | HogarFix`;
    const chat = document.querySelector("[data-provider-chat]");
    if (chat) chat.href = `chat.html?persona=${encodeURIComponent(proveedor.name)}`;

    const reviews = document.querySelector("#provider-reviews");
    if (reviews) {
      reviews.innerHTML = proveedor.resenas?.length
        ? proveedor.resenas
            .map(
              (item) =>
                `<article class="mini-review"><strong>${stars(item.estrellas)} ${item.estrellas.toFixed(1)} · ${escapeHTML(item.autor)}</strong><p>${escapeHTML(item.comentario)}</p></article>`,
            )
            .join("")
        : '<p class="muted-copy">Este profesional aún no tiene reseñas.</p>';
    }
    profileLayout.classList.remove("is-loading");
    profileLayout.removeAttribute("aria-busy");
    document.dispatchEvent(new CustomEvent("hogarfix:proveedor", { detail: proveedor }));
  } catch (error) {
    profileLayout.classList.remove("is-loading");
    showError(profileLayout, error.message, () => location.reload());
    const back = document.createElement("a");
    back.className = "button button-small";
    back.href = "buscar.html";
    back.textContent = "Volver a la búsqueda";
    profileLayout.querySelector(".error-state")?.append(back);
  }
}

if (profileLayout) loadProfile();
