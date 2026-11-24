import {
  enviarMensajeSoporte,
  getNotificaciones,
  getPreguntasFrecuentes,
  marcarNotificacionLeida,
} from "../services/api.js";
import { escapeHTML, showError, showLoading, doneLoading } from "../utils.js";

const notificationList = document.querySelector("#notification-list");
if (notificationList) {
  const render = async () => {
    showLoading(notificationList, "Cargando notificaciones…");
    try {
      const notifications = await getNotificaciones();
      doneLoading(notificationList);
      notificationList.innerHTML = notifications.length ? notifications.map((item) => `
        <article class="flow-panel">
          <p>Tu solicitud cambió de <strong>${escapeHTML(item.fromStatus || "Nueva")}</strong> a <strong>${escapeHTML(item.toStatus || "Actualizada")}</strong>.</p>
          <small>Solicitud ${escapeHTML(item.requestId || "")}</small>
          ${item.readAt ? '<span class="request-status">Leída</span>' : `<button class="button button-small" type="button" data-notification-read="${escapeHTML(item.id)}">Marcar como leída</button>`}
        </article>`).join("") : '<p class="empty-state">No tienes notificaciones.</p>';
    } catch (error) { showError(notificationList, error.message, render); }
  };
  notificationList.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-notification-read]");
    if (!button) return;
    button.disabled = true;
    try { await marcarNotificacionLeida(button.dataset.notificationRead); await render(); }
    catch (error) { button.disabled = false; button.textContent = error.message; }
  });
  render();
}

const faqList = document.querySelector("#support-faq-list");
if (faqList) {
  const renderFaqs = async () => {
    showLoading(faqList, "Cargando preguntas frecuentes…");
    try {
      const faqs = await getPreguntasFrecuentes();
      doneLoading(faqList);
      faqList.innerHTML = faqs.map((faq) => `<details class="flow-panel"><summary>${escapeHTML(faq.question)}</summary><p>${escapeHTML(faq.answer)}</p></details>`).join("");
    } catch (error) { showError(faqList, error.message, renderFaqs); }
  };
  renderFaqs();
}

const supportForm = document.querySelector("#support-form");
supportForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const feedback = document.querySelector("#support-feedback");
  const button = supportForm.querySelector("[type=submit]");
  if (!supportForm.reportValidity()) return;
  button.disabled = true;
  feedback.textContent = "Enviando mensaje…";
  try {
    const form = new FormData(supportForm);
    await enviarMensajeSoporte({ subject: String(form.get("subject") || ""), message: String(form.get("message") || "") });
    supportForm.reset();
    feedback.textContent = "Tu mensaje quedó registrado. El equipo de soporte podrá revisarlo.";
  } catch (error) { feedback.textContent = error.message; }
  finally { button.disabled = false; }
});
