// ISSUE 13. Confirmación del servicio y resumen de contratación (reserva.html).
import { getSolicitud, confirmarSolicitud } from "../services/api.js";
import {
  escapeHTML,
  formatCOP,
  formatDate,
  formatDateTime,
  getCurrentProfile,
  statusClass,
  showLoading,
  showError,
} from "../utils.js";

const panel = document.querySelector("#hiring-summary");

const HEADINGS = {
  Pendiente: {
    icon: "✓",
    eyebrow: "Solicitud enviada",
    title: "Esperando al profesional",
    text: "Tu solicitud fue registrada. Te avisaremos cuando el profesional la acepte para que confirmes la contratación.",
  },
  Aceptada: {
    icon: "!",
    eyebrow: "Solicitud aceptada",
    title: "Confirma tu servicio",
    text: "El profesional aceptó tu solicitud. Revisa el resumen y confirma la contratación.",
  },
  Confirmada: {
    icon: "✓",
    eyebrow: "Contratación confirmada",
    title: "¡Servicio confirmado!",
    text: "El profesional ya tiene la confirmación. Puedes guardar o imprimir este resumen.",
  },
};

function heading(status) {
  return (
    HEADINGS[status] || {
      icon: "i",
      eyebrow: "Resumen de contratación",
      title: `Servicio ${status.toLowerCase()}`,
      text: "Este es el resumen de tu solicitud.",
    }
  );
}

function render(solicitud) {
  const session = getCurrentProfile();
  const info = heading(solicitud.status);
  document.title = `${info.eyebrow} | HogarFix`;
  panel.innerHTML = `
    <span class="confirmation-check ${statusClass(solicitud.status)}" aria-hidden="true">${info.icon}</span>
    <p class="eyebrow">${escapeHTML(info.eyebrow)}</p>
    <h1>${escapeHTML(info.title)}</h1>
    <p class="muted-copy">${escapeHTML(info.text)}</p>

    <article class="invoice" aria-label="Resumen de contratación">
      <header class="invoice-head">
        <div><strong>HogarFix</strong><small>Resumen de contratación</small></div>
        <div class="invoice-number"><small>N.º de solicitud</small><strong>${escapeHTML(solicitud.id)}</strong></div>
      </header>
      <div class="invoice-parties">
        <section>
          <h2>Cliente</h2>
          <p>${escapeHTML(solicitud.clientName || [session?.firstName, session?.lastName].filter(Boolean).join(" "))}</p>
          <p>${escapeHTML(solicitud.ownerEmail || session?.email || "")}</p>
        </section>
        <section>
          <h2>Profesional</h2>
          <p>${escapeHTML(solicitud.provider)}</p>
          <p>${escapeHTML(solicitud.providerProfession || solicitud.service)}</p>
        </section>
      </div>
      <dl class="invoice-details">
        <div><dt>Categoría</dt><dd>${escapeHTML(solicitud.service)}</dd></div>
        <div><dt>Fecha</dt><dd>${escapeHTML(formatDate(solicitud.date))}</dd></div>
        <div><dt>Hora</dt><dd>${escapeHTML(solicitud.time)}</dd></div>
        <div><dt>Ubicación</dt><dd>${escapeHTML(solicitud.address)}</dd></div>
        <div class="invoice-wide"><dt>Trabajo solicitado</dt><dd>${escapeHTML(solicitud.detail)}</dd></div>
        <div><dt>Estado</dt><dd><span class="request-status ${statusClass(solicitud.status)}">● ${escapeHTML(solicitud.status)}</span></dd></div>
        <div><dt>Creada</dt><dd>${escapeHTML(formatDateTime(solicitud.createdAt))}</dd></div>
      </dl>
      <div class="invoice-total">
        <span>Tarifa fija · ${escapeHTML(solicitud.service)}</span>
        <strong>${formatCOP(solicitud.amount)}</strong>
      </div>
      <p class="invoice-note">La tarifa corresponde al precio fijo de la categoría y no puede modificarse.</p>
    </article>

    <p id="summary-message" class="form-feedback" role="status" aria-live="polite"></p>
    <div class="confirmation-actions">
      ${
        solicitud.status === "Aceptada"
          ? '<button class="button" type="button" id="confirm-hiring">Confirmar contratación</button>'
          : ""
      }
      <button class="button button-outline-blue" type="button" id="print-summary">Imprimir resumen</button>
      <a class="button button-outline-blue" href="solicitudes.html">Ver mis solicitudes</a>
    </div>`;

  panel.querySelector("#print-summary").addEventListener("click", () => window.print());
  panel.querySelector("#confirm-hiring")?.addEventListener("click", async (event) => {
    const button = event.currentTarget;
    const message = panel.querySelector("#summary-message");
    button.disabled = true;
    button.textContent = "Confirmando…";
    try {
      render(await confirmarSolicitud(solicitud.id));
    } catch (error) {
      message.textContent = error.message;
      button.disabled = false;
      button.textContent = "Confirmar contratación";
    }
  });
}

async function load() {
  const id = new URLSearchParams(location.search).get("id");
  if (!id) {
    showError(panel, "No indicaste qué solicitud quieres ver.");
    panel
      .querySelector(".error-state")
      .insertAdjacentHTML(
        "beforeend",
        '<a class="button button-small" href="solicitudes.html">Ver mis solicitudes</a>',
      );
    return;
  }
  showLoading(panel, "Cargando el resumen de tu solicitud…");
  try {
    render(await getSolicitud(id));
    panel.removeAttribute("aria-busy");
  } catch (error) {
    showError(panel, error.message, load);
  }
}

if (panel) load();
