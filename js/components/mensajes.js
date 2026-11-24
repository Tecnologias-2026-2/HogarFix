// Chat entre el cliente y el proveedor de cada solicitud (chat.html y mensajes-proveedor.html).
// Con el backend activo, cada solicitud es una conversación: los mensajes se guardan en
// Firestore (solicitudes/{id}/messages) a través de GET/POST /api/solicitudes/:id/mensajes.
import {
  USE_REQUESTS_BACKEND,
  getSolicitudes,
  getSolicitudesProveedor,
  getMensajes,
  enviarMensaje,
} from "../services/api.js";
import { escapeHTML, formatDate, formatTime, showLoading, showError } from "../utils.js";

const REFRESH_MS = 5000;
const clientForm = document.querySelector("#chat-form");
const providerForm = document.querySelector("#provider-chat-form");
const form = clientForm || providerForm;

if (USE_REQUESTS_BACKEND && form) {
  const isClient = Boolean(clientForm);
  const list = isClient
    ? document.querySelector(".chat-sidebar")
    : document.querySelector(".provider-conversation-list");
  const messagesBox = document.querySelector(isClient ? "#chat-messages" : "#provider-chat-messages");
  const title = document.querySelector(isClient ? "#client-chat-name" : "#active-chat-person");
  const subtitle = isClient
    ? document.querySelector("#client-chat-profession")
    : title?.nextElementSibling;
  const input = form.elements.message;
  const submit = form.querySelector("[type=submit]");
  let requests = [];
  let active = null;
  let timer = null;
  let lastSignature = "";

  const otherName = (request) =>
    (isClient ? request.provider : request.clientName) || (isClient ? "Profesional" : "Cliente");
  const describe = (request) =>
    `${request.service} · ${formatDate(request.date)} ${formatTime(request.time)} · ${request.status}`;

  const messageTime = (iso) => {
    const date = new Date(iso);
    return Number.isNaN(date.getTime())
      ? ""
      : date.toLocaleTimeString("es-CO", { hour: "numeric", minute: "2-digit", timeZone: "America/Bogota" });
  };

  const setComposer = (enabled, placeholder) => {
    input.disabled = !enabled;
    submit.disabled = !enabled;
    input.placeholder = placeholder;
  };

  const renderList = () => {
    const header = isClient ? "<h2>Conversaciones</h2>" : "";
    if (!requests.length) {
      list.innerHTML = `${header}<p class="empty-state">${
        isClient
          ? "Cuando envíes una solicitud podrás escribirle aquí al profesional."
          : "Cuando un cliente te envíe una solicitud podrás escribirle aquí."
      }</p>`;
      return;
    }
    list.innerHTML =
      header +
      requests
        .map(
          (request) => `
        <button class="conversation${request.id === active?.id ? " active" : ""}" type="button"
          data-request-id="${escapeHTML(request.id)}" data-chat-person="${escapeHTML(otherName(request))}">
          <img src="assets/provider-avatar.svg" alt="" /><span
            ><strong>${escapeHTML(otherName(request))}</strong
            ><small>${escapeHTML(describe(request))}</small></span>
        </button>`,
        )
        .join("");
  };

  const renderMessages = (chat) => {
    const signature = JSON.stringify(chat.messages.map((message) => message.id)) + chat.open;
    if (signature === lastSignature) return;
    lastSignature = signature;
    const items = chat.messages.length
      ? chat.messages
          .map(
            (message) =>
              `<p class="chat-bubble${message.mine ? " chat-own" : ""}">${escapeHTML(message.text)}<small class="chat-time"> ${escapeHTML(messageTime(message.createdAt))}</small></p>`,
          )
          .join("")
      : `<p class="chat-day">Aún no hay mensajes. Escribe el primero.</p>`;
    messagesBox.removeAttribute("aria-busy");
    messagesBox.innerHTML = `<p class="chat-day">Conversación sobre ${escapeHTML(active.service)}</p>${items}`;
    messagesBox.scrollTop = messagesBox.scrollHeight;
    setComposer(chat.open, chat.open ? "Escribe un mensaje…" : "El chat se cerró: la solicitud fue rechazada o cancelada.");
  };

  const loadMessages = async ({ quiet = false } = {}) => {
    if (!active) return;
    const requestId = active.id;
    try {
      const chat = await getMensajes(requestId);
      if (active?.id === requestId) renderMessages(chat);
    } catch (error) {
      if (!quiet) showError(messagesBox, error.message, () => loadMessages());
    }
  };

  const select = (request) => {
    active = request;
    lastSignature = "";
    renderList();
    if (title) title.textContent = otherName(request);
    if (subtitle) subtitle.textContent = describe(request);
    const initials = document.querySelector(".conversation-head .initial-circle");
    if (initials) {
      initials.textContent = otherName(request)
        .split(/\s+/)
        .map((part) => part[0] || "")
        .join("")
        .slice(0, 2)
        .toUpperCase();
    }
    showLoading(messagesBox, "Cargando mensajes…");
    setComposer(false, "Cargando…");
    loadMessages();
    const url = new URL(location.href);
    url.searchParams.set("solicitud", request.id);
    history.replaceState(null, "", url);
  };

  list.addEventListener("click", (event) => {
    const button = event.target.closest("[data-request-id]");
    if (!button) return;
    const request = requests.find((item) => item.id === button.dataset.requestId);
    if (request) select(request);
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    event.stopImmediatePropagation();
    const text = input.value.trim();
    if (!text || !active) return;
    submit.disabled = true;
    try {
      await enviarMensaje(active.id, text);
      input.value = "";
      await loadMessages();
    } catch (error) {
      window.alert(error.message || "No se pudo enviar el mensaje.");
    } finally {
      submit.disabled = input.disabled;
      input.focus();
    }
  });

  const start = async () => {
    showLoading(list, "Cargando conversaciones…");
    messagesBox.innerHTML = "";
    if (title) title.textContent = "Mensajes";
    if (subtitle) subtitle.textContent = "Elige una solicitud para conversar.";
    setComposer(false, "Elige una conversación…");
    try {
      requests = await (isClient ? getSolicitudes() : getSolicitudesProveedor());
      list.removeAttribute("aria-busy");
      const wanted = new URLSearchParams(location.search).get("solicitud");
      const first = requests.find((item) => item.id === wanted) || requests[0];
      renderList();
      if (first) select(first);
      timer = setInterval(() => {
        if (document.visibilityState === "visible") loadMessages({ quiet: true });
      }, REFRESH_MS);
    } catch (error) {
      showError(list, error.message, start);
    }
  };

  window.addEventListener("pagehide", () => clearInterval(timer));
  start();
}
