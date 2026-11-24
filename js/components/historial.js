// ISSUE 14. Historial de servicios del cliente (solicitudes.html) y resumen del panel (app.html).
import {
  calificarSolicitud,
  cancelarSolicitud,
  getCalificacionSolicitud,
  getSolicitudes,
  USE_REQUESTS_BACKEND,
} from "../services/api.js";
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
  const ratingAction = USE_REQUESTS_BACKEND && item.status === "Completada"
    ? `<button class="button button-small" type="button" data-rating-open="${escapeHTML(item.id)}">Calificar servicio</button><div class="rating-form-slot" data-rating-slot="${escapeHTML(item.id)}"></div>`
    : "";
  const cancelAction = ["Pendiente", "Aceptada"].includes(item.status)
    ? `<button class="button button-small danger-button" type="button" data-cancel-request="${escapeHTML(item.id)}">Cancelar solicitud</button>`
    : "";
  const actions = [
    item.status === "Aceptada"
      ? `<a class="button button-small" href="reserva.html?id=${encodeURIComponent(item.id)}">Confirmar servicio</a>`
      : `<a href="reserva.html?id=${encodeURIComponent(item.id)}">Ver resumen</a>`,
    `<a href="chat.html?persona=${encodeURIComponent(item.provider)}">▢ Chat</a>`,
    ratingAction,
    cancelAction,
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
          <div><dt>Pago</dt><dd>${escapeHTML(item.paymentMethod ? `${item.paymentMethod.nombre} · ${item.paymentStatus}` : "No indicado")}</dd></div>
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

  list.addEventListener("click", async (event) => {
    const cancelButton = event.target.closest("[data-cancel-request]");
    if (cancelButton) {
      if (!window.confirm("¿Quieres cancelar esta solicitud?")) return;
      cancelButton.disabled = true;
      try {
        await cancelarSolicitud(cancelButton.dataset.cancelRequest);
        await load();
      } catch (error) {
        cancelButton.disabled = false;
        const feedback = document.createElement("p");
        feedback.className = "form-feedback is-error";
        feedback.textContent = error.message;
        cancelButton.after(feedback);
      }
      return;
    }
    const button = event.target.closest("[data-rating-open]");
    if (!button) return;
    const requestId = button.dataset.ratingOpen;
    const slot = list.querySelector(`[data-rating-slot="${CSS.escape(requestId)}"]`);
    if (!slot) return;
    button.disabled = true;
    slot.textContent = "Cargando calificación…";
    try {
      const existing = await getCalificacionSolicitud(requestId);
      if (existing) {
        slot.innerHTML = `<p class="form-feedback is-success">Ya calificaste este servicio: ${"★".repeat(existing.rating)} (${existing.rating}/5).</p>`;
        button.hidden = true;
        return;
      }
      slot.innerHTML = `
        <form class="rating-form" data-rating-form="${escapeHTML(requestId)}">
          <label>Calificación
            <select name="rating" required>
              <option value="">Selecciona de 1 a 5 estrellas</option>
              <option value="5">5 estrellas</option><option value="4">4 estrellas</option>
              <option value="3">3 estrellas</option><option value="2">2 estrellas</option>
              <option value="1">1 estrella</option>
            </select>
          </label>
          <label>Comentario
            <textarea name="comment" maxlength="1000" rows="3" placeholder="Cuéntanos cómo fue el servicio"></textarea>
          </label>
          <button class="button button-small" type="submit">Enviar calificación</button>
          <p class="form-feedback" role="status" aria-live="polite"></p>
        </form>`;
    } catch (error) {
      slot.textContent = error.message;
      button.disabled = false;
    }
  });

  list.addEventListener("submit", async (event) => {
    const form = event.target.closest("[data-rating-form]");
    if (!form) return;
    event.preventDefault();
    const submit = form.querySelector('[type="submit"]');
    const feedback = form.querySelector(".form-feedback");
    const rating = Number(form.elements.rating.value);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      feedback.textContent = "Selecciona una calificación de 1 a 5 estrellas.";
      return;
    }
    submit.disabled = true;
    feedback.textContent = "Guardando tu calificación…";
    try {
      const result = await calificarSolicitud(form.dataset.ratingForm, {
        rating,
        comment: form.elements.comment.value,
      });
      form.innerHTML = `<p class="form-feedback is-success">Gracias por calificar el servicio: ${"★".repeat(result.rating)} (${result.rating}/5).</p>`;
    } catch (error) {
      feedback.textContent = error.message;
      submit.disabled = false;
    }
  });

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
