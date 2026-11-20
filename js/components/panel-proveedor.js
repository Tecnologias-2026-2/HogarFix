// ISSUE #29. Panel y solicitudes del proveedor autenticado.
// Ya no se muestran solicitudes de prueba: solo las que los clientes enviaron a este proveedor.
import { getSolicitudesProveedor, cambiarEstadoSolicitud, getPerfil } from "../services/api.js";
import {
  escapeHTML,
  formatCOP,
  formatDate,
  statusClass,
  showLoading,
  showError,
  doneLoading,
} from "../utils.js";

const dashboard = document.querySelector("#provider-dashboard-requests");
const list = document.querySelector("#provider-request-list");
const detail = document.querySelector("#provider-request-detail");
const isProviderPage = dashboard || list || detail;

const ACTIONS = {
  Pendiente: [
    ["Aceptada", "✓ Aceptar", "button button-small"],
    ["Rechazada", "× Rechazar", "button button-small danger-button"],
  ],
  Confirmada: [["En proceso", "Marcar en proceso", "button button-small"]],
  "En proceso": [["Completada", "Marcar completo", "button button-small"]],
};

function timeAgo(iso) {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (!Number.isFinite(minutes)) return "";
  if (minutes < 1) return "Hace un momento";
  if (minutes < 60) return `Hace ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `Hace ${hours} ${hours === 1 ? "hora" : "horas"}`;
  const days = Math.round(hours / 24);
  return `Hace ${days} ${days === 1 ? "día" : "días"}`;
}

function card(item, isDetail = false) {
  const buttons = (ACTIONS[item.status] || [])
    .map(
      ([next, label, className]) =>
        `<button class="${className}" type="button" data-provider-action="${escapeHTML(next)}" data-id="${escapeHTML(item.id)}">${label}</button>`,
    )
    .join("");
  const waiting =
    item.status === "Aceptada"
      ? '<span class="waiting-note">Esperando confirmación del cliente</span>'
      : "";
  const payment = item.paymentMethod
    ? `<p class="provider-request-payment">Pago: ${escapeHTML(item.paymentMethod.nombre)} · ${escapeHTML(item.paymentStatus || "")}</p>`
    : "";
  return `
    <article class="provider-request-card ${isDetail ? "provider-request-detail-card" : ""}">
      <div class="provider-request-top">
        <div>
          <h3>${escapeHTML(item.clientName)}</h3>
          <p>${escapeHTML(item.service)} · ${escapeHTML(formatDate(item.date))} · ${escapeHTML(item.time)}</p>
          <p>${escapeHTML(item.address)}</p>
        </div>
        <div class="provider-request-price"><strong>${formatCOP(item.amount)}</strong><small>${escapeHTML(timeAgo(item.createdAt))}</small></div>
      </div>
      <p class="provider-request-description">${escapeHTML(item.detail)}</p>
      ${payment}
      <div class="provider-request-bottom">
        <span class="request-status ${statusClass(item.status)}">● ${escapeHTML(item.status)}</span>
        <div class="provider-request-actions">
          ${buttons}${waiting}
          ${isDetail ? "" : `<a href="detalle-proveedor.html?id=${encodeURIComponent(item.id)}">Ver detalles</a>`}
          <a href="mensajes-proveedor.html?chat=${encodeURIComponent(item.clientName)}">Chat</a>
        </div>
      </div>
      <p class="form-feedback" role="status" aria-live="polite"></p>
    </article>`;
}

const EMPTY_FIRST_TIME =
  '<div class="empty-state"><strong>Aún no tienes solicitudes.</strong><br />Cuando un cliente te solicite un servicio, aparecerá aquí.</div>';

let requests = [];

function count(statuses) {
  return requests.filter((item) => statuses.includes(item.status)).length;
}

function renderDashboard() {
  const set = (id, value) => {
    const node = document.getElementById(id);
    if (node) node.textContent = value;
  };
  set("provider-pending-count", count(["Pendiente"]));
  set("provider-confirmed-count", count(["Confirmada"]));
  set("provider-inprogress-count", count(["En proceso"]));
  set("provider-completed-count", count(["Completada"]));
  const now = new Date();
  const monthIncome = requests
    .filter((item) => item.status === "Completada")
    .filter((item) => {
      const date = new Date(item.updatedAt || item.createdAt);
      return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
    })
    .reduce((total, item) => total + Number(item.amount || 0), 0);
  set("provider-month-income", formatCOP(monthIncome));

  if (dashboard) {
    doneLoading(dashboard);
    const pending = requests.filter((item) => item.status === "Pendiente").slice(0, 2);
    dashboard.innerHTML = requests.length
      ? pending.map((item) => card(item)).join("") ||
        '<p class="empty-state">No tienes solicitudes nuevas.</p>'
      : EMPTY_FIRST_TIME;
  }
  const inProgress = document.querySelector("#provider-inprogress");
  if (inProgress)
    inProgress.innerHTML =
      requests
        .filter((item) => item.status === "En proceso")
        .map((item) => card(item))
        .join("") || '<p class="empty-state">No tienes servicios en proceso.</p>';
}

let activeFilter = new URLSearchParams(location.search).get("estado") || "Todas";

function renderList() {
  if (!list) return;
  doneLoading(list);
  document.querySelectorAll("[data-count]").forEach((node) => {
    const status = node.dataset.count;
    node.textContent = `(${status === "Todas" ? requests.length : count([status])})`;
  });
  document
    .querySelectorAll("[data-provider-filter]")
    .forEach((button) =>
      button.setAttribute("aria-pressed", String(button.dataset.providerFilter === activeFilter)),
    );
  const items = requests.filter((item) => activeFilter === "Todas" || item.status === activeFilter);
  list.innerHTML = requests.length
    ? items.map((item) => card(item)).join("") ||
      '<p class="empty-state">No hay solicitudes en este estado.</p>'
    : EMPTY_FIRST_TIME;
}

function renderDetail() {
  if (!detail) return;
  doneLoading(detail);
  const id = new URLSearchParams(location.search).get("id");
  const item = requests.find((request) => request.id === id);
  detail.innerHTML = item
    ? card(item, true)
    : '<p class="empty-state">No encontramos esa solicitud entre las tuyas. <a href="solicitudes-proveedor.html">Ver mis solicitudes</a></p>';
}

async function load() {
  [dashboard, list, detail].filter(Boolean).forEach((node) => showLoading(node));
  try {
    requests = (await getSolicitudesProveedor()).sort((a, b) =>
      String(b.createdAt).localeCompare(String(a.createdAt)),
    );
    renderDashboard();
    renderList();
    renderDetail();
  } catch (error) {
    [dashboard, list, detail]
      .filter(Boolean)
      .forEach((node) => showError(node, error.message, load));
  }
}

if (isProviderPage) {
  // Los contadores arrancan en cero mientras carga, nunca con datos de ejemplo.
  load();

  document.querySelectorAll("[data-provider-filter]").forEach((button) =>
    button.addEventListener("click", () => {
      activeFilter = button.dataset.providerFilter;
      renderList();
    }),
  );

  document.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-provider-action]");
    if (!button) return;
    const feedback = button.closest("article")?.querySelector(".form-feedback");
    button.disabled = true;
    try {
      await cambiarEstadoSolicitud(button.dataset.id, button.dataset.providerAction);
      await load();
    } catch (error) {
      button.disabled = false;
      if (feedback) feedback.textContent = error.message;
    }
  });

  window.addEventListener("storage", (event) => {
    if (event.key === "hogarfix.requests.v1") load();
  });

  // Aviso en el panel si el perfil todavía no tiene especialidades.
  const tip = document.querySelector("#provider-profile-tip");
  getPerfil()
    .then((perfil) => {
      const zone = document.querySelector("#provider-zone");
      if (zone && perfil.zone) zone.textContent = perfil.zone;
      if (tip && !perfil.categorias?.length)
        tip.innerHTML =
          '<p class="profile-tip">Para que los clientes te encuentren, <a href="mi-perfil-proveedor.html">completa tu perfil</a> y elige tus especialidades.</p>';
    })
    .catch(() => {});
}
