import {
  USE_REQUESTS_BACKEND,
  cambiarEstadoSolicitud,
  getProviderEligibility,
  getSolicitudProveedor,
  getSolicitudesProveedor,
} from "../services/api.js";
import {
  doneLoading,
  escapeHTML,
  formatCOP,
  formatDate,
  showError,
  showLoading,
  statusClass,
} from "../utils.js";

const dashboard = document.querySelector("#provider-dashboard-requests");
const inProgress = document.querySelector("#provider-inprogress");
const list = document.querySelector("#provider-request-list");
const detail = document.querySelector("#provider-request-detail");
const incomeList = document.querySelector("#provider-completed-list");
const eligibilityBanner = document.querySelector("#provider-eligibility-banner");
const isProviderPage = dashboard || inProgress || list || detail || incomeList;

const ACTIONS = {
  Pendiente: [
    ["Aceptada", "✓ Aceptar", "button button-small"],
    ["Rechazada", "× Rechazar", "button button-small danger-button"],
  ],
  Confirmada: [["En proceso", "Marcar en proceso", "button button-small"]],
  "En proceso": [["Completada", "Marcar completo", "button button-small"]],
};

function timeAgo(value) {
  const minutes = Math.round((Date.now() - new Date(value).getTime()) / 60000);
  if (!Number.isFinite(minutes)) return "";
  if (minutes < 1) return "Hace un momento";
  if (minutes < 60) return `Hace ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `Hace ${hours} ${hours === 1 ? "hora" : "horas"}`;
  const days = Math.round(hours / 24);
  return `Hace ${days} ${days === 1 ? "día" : "días"}`;
}

let requests = [];
let eligibility = null;
let eligibilityError = "";
let detailRequest = null;
let detailError = "";
let activeFilter = new URLSearchParams(location.search).get("estado") || "Todas";

function renderEligibility() {
  if (!eligibilityBanner) return;
  eligibilityBanner.hidden = false;
  eligibilityBanner.classList.remove("error-copy", "is-success");
  if (eligibilityError) {
    eligibilityBanner.classList.add("error-copy");
    eligibilityBanner.textContent = `No se pudo verificar tu elegibilidad: ${eligibilityError} No aceptes solicitudes hasta poder verificarla.`;
    return;
  }
  if (!eligibility) {
    eligibilityBanner.classList.add("error-copy");
    eligibilityBanner.textContent = "No se pudo verificar tu elegibilidad. No aceptes solicitudes hasta poder verificarla.";
    return;
  }
  if (eligibility.eligible) {
    eligibilityBanner.classList.add("is-success");
    eligibilityBanner.textContent = "Tu cuenta está habilitada para ofrecer servicios y recibir solicitudes.";
    return;
  }
  eligibilityBanner.textContent = `Aún no puedes ofrecer servicios ni recibir nuevas solicitudes. ${(eligibility.reasons || []).join(" ")}`;
}

function card(item, isDetail = false) {
  const buttons = (ACTIONS[item.status] || [])
    .filter(([next]) => next !== "Aceptada" || eligibility?.eligible === true)
    .map(
      ([next, label, className]) =>
        `<button class="${className}" type="button" data-provider-action="${escapeHTML(next)}" data-id="${escapeHTML(item.id)}">${label}</button>`,
    )
    .join("");
  const waiting =
    item.status === "Aceptada"
      ? '<span class="waiting-note">Esperando confirmación del cliente</span>'
      : "";
  const eligibilityNote =
    item.status === "Pendiente" && eligibility?.eligible !== true
      ? '<span class="waiting-note">La aceptación requiere que tu elegibilidad esté verificada.</span>'
      : "";
  return `
    <article class="provider-request-card ${isDetail ? "provider-request-detail-card" : ""}">
      <div class="provider-request-top">
        <div>
          <h3>${escapeHTML(item.clientName || "Cliente")}</h3>
          <p>${escapeHTML(item.service)} · ${escapeHTML(formatDate(item.date))} · ${escapeHTML(item.time)}</p>
          <p>${escapeHTML(item.address)}</p>
        </div>
        <div class="provider-request-price"><strong>${formatCOP(item.amount)}</strong><small>${escapeHTML(timeAgo(item.createdAt))}</small></div>
      </div>
      <p class="provider-request-description">${escapeHTML(item.detail)}</p>
      <div class="provider-request-bottom">
        <span class="request-status ${statusClass(item.status)}">● ${escapeHTML(item.status)}</span>
        <div class="provider-request-actions">
          ${buttons}${waiting}${eligibilityNote}
          ${isDetail ? "" : `<a href="detalle-proveedor.html?id=${encodeURIComponent(item.id)}">Ver detalles</a>`}
          <a href="mensajes-proveedor.html?chat=${encodeURIComponent(item.clientName || "")}">Chat</a>
        </div>
      </div>
      <p class="form-feedback" role="status" aria-live="polite"></p>
    </article>`;
}

function count(statuses) {
  return requests.filter((item) => statuses.includes(item.status)).length;
}

function setText(id, value) {
  const node = document.getElementById(id);
  if (node) node.textContent = value;
}

function completedAt(item) {
  return item.completedAt || item.updatedAt || item.createdAt;
}

function monthParts(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(date);
  return Object.fromEntries(parts.map(({ type, value: part }) => [type, Number(part)]));
}

function isCurrentMonth(value, now = new Date()) {
  const target = monthParts(value);
  const current = monthParts(now);
  return Boolean(target && current && target.year === current.year && target.month === current.month);
}

function renderDashboard() {
  setText("provider-pending-count", count(["Pendiente"]));
  setText("provider-accepted-count", count(["Aceptada"]));
  setText("provider-inprogress-count", count(["En proceso"]));
  setText("provider-completed-count", count(["Completada"]));
  const monthIncome = requests
    .filter((item) => item.status === "Completada" && isCurrentMonth(completedAt(item)))
    .reduce((total, item) => total + Number(item.amount || 0), 0);
  setText("provider-month-income", formatCOP(monthIncome));

  if (dashboard) {
    doneLoading(dashboard);
    const pending = requests.filter((item) => item.status === "Pendiente").slice(0, 2);
    dashboard.innerHTML = pending.length
      ? pending.map((item) => card(item)).join("")
      : '<p class="empty-state">No tienes solicitudes nuevas.</p>';
  }
  if (inProgress) {
    doneLoading(inProgress);
    inProgress.innerHTML =
      requests
        .filter((item) => item.status === "En proceso")
        .map((item) => card(item))
        .join("") || '<p class="empty-state">No tienes servicios en proceso.</p>';
  }
}

function renderList() {
  if (!list) return;
  doneLoading(list);
  document.querySelectorAll("[data-count]").forEach((node) => {
    const status = node.dataset.count;
    node.textContent = `(${status === "Todas" ? requests.length : count([status])})`;
  });
  document.querySelectorAll("[data-provider-filter]").forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.providerFilter === activeFilter));
  });
  const items = requests.filter(
    (item) => activeFilter === "Todas" || item.status === activeFilter,
  );
  list.innerHTML = items.length
    ? items.map((item) => card(item)).join("")
    : requests.length
      ? '<p class="empty-state">No hay solicitudes en este estado.</p>'
      : '<p class="empty-state">Aún no tienes solicitudes asignadas.</p>';
}

function renderDetail() {
  if (!detail) return;
  if (detailError) {
    showError(detail, detailError, load);
    return;
  }
  doneLoading(detail);
  detail.innerHTML = detailRequest
    ? card(detailRequest, true)
    : '<p class="empty-state">No encontramos esa solicitud entre las asignadas a tu cuenta. <a href="solicitudes-proveedor.html">Ver mis solicitudes</a></p>';
}

function monthKey(year, month) {
  return `${year}-${String(month).padStart(2, "0")}`;
}

function compactCOP(amount) {
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)} M`;
  if (amount >= 1_000) return `$${Math.round(amount / 1_000)} mil`;
  return formatCOP(amount);
}

function renderIncome() {
  if (!incomeList) return;
  const completed = requests.filter((item) => item.status === "Completada");
  const monthTotal = completed
    .filter((item) => isCurrentMonth(completedAt(item)))
    .reduce((total, item) => total + Number(item.amount || 0), 0);
  setText(
    "provider-total-income",
    formatCOP(completed.reduce((total, item) => total + Number(item.amount || 0), 0)),
  );
  setText("provider-total-income-note", "En las solicitudes devueltas por la API");
  setText("provider-month-income-total", formatCOP(monthTotal));
  setText(
    "provider-month-completed-count",
    `${completed.filter((item) => isCurrentMonth(completedAt(item))).length} completados en las solicitudes cargadas`,
  );

  const ratingCard = document.querySelector("#provider-rating-card");
  if (ratingCard) {
    const rating = ratingCard.querySelector("strong");
    const note = ratingCard.querySelector("small");
    if (rating) rating.textContent = "No disponible";
    if (note) note.textContent = "El backend aún no expone reseñas.";
  }

  const chart = document.querySelector("#provider-income-chart");
  if (chart) {
    const current = monthParts(new Date());
    const currentIndex = current.year * 12 + current.month - 1;
    const months = Array.from({ length: 5 }, (_, index) => {
      const monthIndex = currentIndex - 4 + index;
      const year = Math.floor(monthIndex / 12);
      const month = (monthIndex % 12) + 1;
      const date = new Date(Date.UTC(year, month - 1, 15, 12));
      return {
        year,
        month,
        label: new Intl.DateTimeFormat("es-CO", { month: "short", timeZone: "America/Bogota" })
          .format(date)
          .replace(".", ""),
        amount: 0,
      };
    });
    const totals = new Map(months.map((month) => [monthKey(month.year, month.month), month]));
    completed.forEach((item) => {
      const parts = monthParts(completedAt(item));
      const month = parts && totals.get(monthKey(parts.year, parts.month));
      if (month) month.amount += Number(item.amount || 0);
    });
    const max = Math.max(1, ...months.map((month) => month.amount));
    chart.innerHTML = months
      .map(
        (month) =>
          `<div><i style="height: ${month.amount ? Math.max(8, Math.round((month.amount / max) * 100)) : 0}%"></i><span>${escapeHTML(compactCOP(month.amount))}</span><small>${escapeHTML(month.label)}</small></div>`,
      )
      .join("");
    chart.setAttribute(
      "aria-label",
      `Valores registrados por servicios completados: ${months
        .map((month) => `${month.label} ${formatCOP(month.amount)}`)
        .join(", ")}`,
    );
  }

  const period = document.querySelector("#income-period")?.value || "all";
  const items = completed
    .filter((item) => period !== "month" || isCurrentMonth(completedAt(item)))
    .sort((a, b) => String(completedAt(b)).localeCompare(String(completedAt(a))));
  doneLoading(incomeList);
  incomeList.innerHTML = items.length
    ? items
        .map(
          (item) => `
            <article class="flow-panel earnings-row">
              <div>
                <strong>${escapeHTML(item.clientName || "Cliente")}</strong>
                <p>${escapeHTML(item.service)} · ${escapeHTML(formatDate(item.date))}</p>
              </div>
              <span class="request-status ${statusClass(item.status)}">${escapeHTML(item.status)}</span>
              <strong>${formatCOP(item.amount)}</strong>
            </article>`,
        )
        .join("")
    : '<p class="empty-state">No hay servicios completados en este periodo.</p>';
}

async function load() {
  const requestTargets = [dashboard, inProgress, list, incomeList].filter(Boolean);
  requestTargets.forEach((target) => showLoading(target));
  if (detail) showLoading(detail);
  const requestPromise = requestTargets.length ? getSolicitudesProveedor() : Promise.resolve([]);
  const requestId = new URLSearchParams(location.search).get("id");
  const detailPromise = detail
    ? requestId
      ? getSolicitudProveedor(requestId)
      : Promise.reject(new Error("No indicaste qué solicitud quieres consultar."))
    : Promise.resolve(null);
  const [requestsResult, eligibilityResult, detailResult] = await Promise.allSettled([
    requestPromise,
    getProviderEligibility(),
    detailPromise,
  ]);

  if (eligibilityResult.status === "fulfilled") {
    const result = eligibilityResult.value?.eligibility;
    if (typeof result?.eligible === "boolean") {
      eligibility = result;
      eligibilityError = "";
    } else {
      eligibility = null;
      eligibilityError = "El servidor devolvió un estado de elegibilidad inválido.";
    }
  } else {
    eligibility = null;
    eligibilityError = eligibilityResult.reason?.message || "Error desconocido.";
  }
  renderEligibility();

  if (requestsResult.status === "fulfilled") {
    requests = requestsResult.value.sort((a, b) =>
      String(b.createdAt).localeCompare(String(a.createdAt)),
    );
    renderDashboard();
    renderList();
    renderIncome();
  } else {
    requestTargets.forEach((target) =>
      showError(target, requestsResult.reason?.message || "No se pudieron cargar las solicitudes.", load),
    );
  }

  if (detail) {
    if (detailResult.status === "fulfilled") {
      detailRequest = detailResult.value;
      detailError = "";
      renderDetail();
    } else {
      detailError = detailResult.reason?.message || "No se pudo cargar la solicitud.";
      renderDetail();
    }
  }
}

if (isProviderPage && USE_REQUESTS_BACKEND) {
  ["provider-pending-count", "provider-accepted-count", "provider-inprogress-count", "provider-completed-count"]
    .forEach((id) => setText(id, "–"));
  setText("provider-month-income", "–");
  setText("provider-total-income", "–");
  setText("provider-total-income-note", "En las solicitudes devueltas por la API");
  setText("provider-month-income-total", "–");
  setText("provider-month-completed-count", "Cargando…");
  const dataNote = document.querySelector("#provider-request-data-note");
  if (dataNote) {
    dataNote.textContent =
      "Los resúmenes usan solo las solicitudes devueltas por la API (máximo 50) y muestran tarifas, no pagos procesados.";
    dataNote.hidden = false;
  }
  const chart = document.querySelector("#provider-income-chart");
  if (chart) {
    chart.replaceChildren();
    chart.setAttribute("aria-label", "Cargando valores de servicios completados.");
  }
  const ratingCard = document.querySelector("#provider-rating-card");
  if (ratingCard) {
    const rating = ratingCard.querySelector("strong");
    const note = ratingCard.querySelector("small");
    if (rating) rating.textContent = "No disponible";
    if (note) note.textContent = "El backend aún no expone reseñas.";
  }
  document.querySelector("#provider-eligibility-banner")?.removeAttribute("hidden");

  document.querySelectorAll("[data-provider-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      activeFilter = button.dataset.providerFilter;
      renderList();
    });
  });
  document.querySelector("#income-period")?.addEventListener("change", renderIncome);
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
      if (feedback) feedback.textContent = error.message || "No se pudo actualizar la solicitud.";
    }
  });
  load();
}
