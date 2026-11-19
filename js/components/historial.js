// ISSUE 14. Historial de servicios del cliente (solicitudes.html) y resumen del panel (app.html).
import { getSolicitudes } from "../services/api.js";
import {
  escapeHTML,
  formatCOP,
  formatDate,
  formatDateTime,
  statusClass,
  showLoading,
  showError,
  doneLoading,
} from "../utils.js";

const REFRESH_MS = 30000;
// "Canceladas" agrupa las solicitudes que canceló el cliente y las que rechazó el profesional.
const FILTER_GROUPS = { Cancelada: ["Cancelada", "Rechazada"] };

/* ---------- solicitudes.html ---------- */

const list = document.querySelector("#request-list");

function requestCard(item) {
  const actions = [
    item.status === "Aceptada"
      ? `<a class="button button-small" href="reserva.html?id=${encodeURIComponent(item.id)}">Confirmar servicio</a>`
      : `<a href="reserva.html?id=${encodeURIComponent(item.id)}">Ver resumen</a>`,
    `<a href="chat.html?persona=${encodeURIComponent(item.provider)}">▢ Chat</a>`,
  ].join("");
  return `
    <article class="client-request-card">
      <div class="client-request-head">
        <div><h2>${escapeHTML(item.service)}</h2><p>${escapeHTML(item.provider)} · ${escapeHTML(item.id)}</p></div>
        <span class="request-status ${statusClass(item.status)}">● ${escapeHTML(item.status)}</span>
      </div>
      <div class="client-request-meta">
        <span>📅 ${escapeHTML(formatDate(item.date))}</span>
        <span>🕐 ${escapeHTML(item.time)}</span>
        <strong>${formatCOP(item.amount)}</strong>
      </div>
      <p class="client-request-description">${escapeHTML(item.detail || "Solicitud de servicio para el hogar.")}</p>
      <details class="client-request-details">
        <summary>Ver detalles</summary>
        <dl>
          <div><dt>Dirección</dt><dd>${escapeHTML(item.address)}</dd></div>
          <div><dt>Tarifa fija</dt><dd>${formatCOP(item.amount)}</dd></div>
          <div><dt>Solicitada</dt><dd>${escapeHTML(formatDateTime(item.createdAt))}</dd></div>
          ${item.confirmedAt ? `<div><dt>Confirmada</dt><dd>${escapeHTML(formatDateTime(item.confirmedAt))}</dd></div>` : ""}
        </dl>
      </details>
      <div class="client-request-actions">${actions}</div>
    </article>`;
}

if (list) {
  const params = new URLSearchParams(location.search);
  const dateForm = document.querySelector("#date-filters");
  const buttons = [...document.querySelectorAll("[data-request-filter]")];
  const count = document.querySelector("#request-count");
  const updated = document.querySelector("#request-updated");
  let requests = [];
  let status = params.get("estado") || "Todas";

  const render = () => {
    const { from, to, order } = Object.fromEntries(new FormData(dateForm));
    const allowed = FILTER_GROUPS[status] || [status];
    const filtered = requests
      .filter((item) => status === "Todas" || allowed.includes(item.status))
      .filter((item) => (!from || item.date >= from) && (!to || item.date <= to))
      .sort((a, b) => {
        const diff = `${a.date}${a.createdAt}`.localeCompare(`${b.date}${b.createdAt}`);
        return order === "asc" ? diff : -diff;
      });
    buttons.forEach((button) =>
      button.setAttribute("aria-pressed", String(button.dataset.requestFilter === status)),
    );
    count.textContent = `${filtered.length} de ${requests.length} solicitudes`;
    list.innerHTML = filtered.length
      ? filtered.map(requestCard).join("")
      : requests.length
        ? '<p class="empty-state">No hay solicitudes con estos filtros.</p>'
        : '<p class="empty-state">Aún no tienes solicitudes. <a href="buscar.html">Busca un servicio</a></p>';
  };

  const load = async ({ silent = false } = {}) => {
    if (!silent) showLoading(list, "Cargando tus solicitudes…");
    try {
      requests = await getSolicitudes();
      doneLoading(list);
      updated.textContent = `Actualizado a las ${new Date().toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}`;
      render();
    } catch (error) {
      if (!silent) showError(list, error.message, () => load());
      else updated.textContent = "No se pudo actualizar. Se reintentará en unos segundos.";
    }
  };

  buttons.forEach((button) =>
    button.addEventListener("click", () => {
      status = button.dataset.requestFilter;
      render();
    }),
  );
  dateForm.addEventListener("input", render);
  dateForm.addEventListener("reset", () => setTimeout(render));
  dateForm.addEventListener("submit", (event) => event.preventDefault());

  // Mantener los estados al día: cambios en otra pestaña, volver a la pestaña y cada 30 s.
  window.addEventListener("storage", (event) => {
    if (event.key === "hogarfix.requests.v1") load({ silent: true });
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") load({ silent: true });
  });
  setInterval(() => load({ silent: true }), REFRESH_MS);

  load();
}

/* ---------- app.html (panel del cliente) ---------- */

const activeList = document.querySelector("#active-request-list");

if (activeList) {
  const counters = {
    "client-pending-count": ["Pendiente", "Aceptada"],
    "client-inprogress-count": ["Confirmada", "En proceso"],
    "client-completed-count": ["Completada"],
    "client-cancelled-count": ["Cancelada", "Rechazada"],
  };
  showLoading(activeList, "Cargando solicitudes…");
  Object.keys(counters).forEach((id) => {
    const node = document.getElementById(id);
    if (node) node.textContent = "–";
  });
  getSolicitudes()
    .then((requests) => {
      const active = requests
        .filter((item) => !["Completada", "Cancelada", "Rechazada"].includes(item.status))
        .slice(0, 3);
      doneLoading(activeList);
      activeList.innerHTML = active.length
        ? active
            .map(
              (item) =>
                `<a class="active-request" href="reserva.html?id=${encodeURIComponent(item.id)}"><span class="category-icon">⌂</span><span><strong>${escapeHTML(item.service)}</strong><small>${escapeHTML(item.provider)} · ${escapeHTML(formatDate(item.date))}</small></span><span class="request-status ${statusClass(item.status)}">● ${escapeHTML(item.status)}</span></a>`,
            )
            .join("")
        : '<p class="empty-state">No tienes solicitudes activas. <a href="buscar.html">Busca un servicio</a></p>';
      Object.entries(counters).forEach(([id, statuses]) => {
        const node = document.getElementById(id);
        if (node)
          node.textContent = requests.filter((item) => statuses.includes(item.status)).length;
      });
    })
    .catch((error) => showError(activeList, error.message, () => location.reload()));
}
