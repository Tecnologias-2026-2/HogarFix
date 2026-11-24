import "./components/login.js";
import "./components/registro.js";
import "./components/password.js";
import "./components/buscar.js";
import "./components/perfil-cliente.js";
import "./components/perfil-proveedor.js";
import "./components/chat.js";
import "./components/mensajes.js";
import "./components/catalogo.js";
import "./components/proveedores.js";
import "./components/solicitud.js";
import "./components/resumen.js";
import "./components/historial.js";
import "./components/panel-proveedor.js";
import "./components/service-center.js";
import { USE_REQUESTS_BACKEND } from "./services/api.js";
import {
  getAuthErrorMessage,
  getCurrentProfile,
  signOutUser,
  subscribeToAuthState,
} from "./services/auth.js";

const menuButton = document.querySelector(".menu-toggle");
const navigation = document.querySelector("#primary-nav, #client-nav, #provider-nav");

menuButton?.addEventListener("click", () => {
  const isOpen = menuButton.getAttribute("aria-expanded") === "true";
  menuButton.setAttribute("aria-expanded", String(!isOpen));
  menuButton.setAttribute("aria-label", isOpen ? "Abrir menú" : "Cerrar menú");
  navigation?.classList.toggle("open", !isOpen);
});

navigation?.querySelectorAll("a").forEach((link) => {
  link.addEventListener("click", () => {
    navigation.classList.remove("open");
    menuButton?.setAttribute("aria-expanded", "false");
    menuButton?.setAttribute("aria-label", "Abrir menú");
  });
});

const year = document.querySelector("#year");
if (year) year.textContent = new Date().getFullYear();

const textToggle = document.querySelector("#text-toggle");
textToggle?.addEventListener("click", () => {
  const enabled = document.body.classList.toggle("large-text");
  textToggle.setAttribute("aria-pressed", String(enabled));
  textToggle.title = enabled ? "Restablecer tamaño del texto" : "Aumentar tamaño del texto";
});

const contrastToggle = document.querySelector("#contrast-toggle");
contrastToggle?.addEventListener("click", () => {
  const enabled = document.body.classList.toggle("high-contrast");
  contrastToggle.setAttribute("aria-pressed", String(enabled));
  contrastToggle.title = enabled ? "Desactivar alto contraste" : "Activar alto contraste";
});

const registerRole = document.querySelector("#register-role");
const registerLoginLink = document.querySelector("#register-login-link");

if (registerRole) {
  const role = new URLSearchParams(window.location.search).get("tipo");
  registerRole.textContent = role === "proveedor" ? "Proveedor" : "Cliente";
  if (registerLoginLink)
    registerLoginLink.href = `login.html?tipo=${role === "proveedor" ? "proveedor" : "cliente"}`;
}

const CLIENT_REQUESTS_KEY = "hogarfix.requests.v1";
const CHAT_THREADS_KEY = "hogarfix.chat-threads.v1";

function readStoredArray(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}
function writeStoredArray(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}
function normalizeKey(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
function readChatThreads() {
  try {
    return JSON.parse(localStorage.getItem(CHAT_THREADS_KEY) || "{}");
  } catch {
    return {};
  }
}
function writeChatThread(key, messages) {
  const threads = readChatThreads();
  threads[key] = messages;
  localStorage.setItem(CHAT_THREADS_KEY, JSON.stringify(threads));
}
function getClientThreadKey(
  providerName,
  ownerEmail = getCurrentProfile()?.email || "cliente-demo",
) {
  const owner = ownerEmail;
  return `${normalizeKey(owner)}::${normalizeKey(providerName)}`;
}
function getProviderName() {
  const profile = getCurrentProfile();
  const authenticatedName = [profile?.firstName, profile?.lastName].filter(Boolean).join(" ");
  return authenticatedName;
}
function getProviderThreadKey(clientName) {
  const providerName = getProviderName();
  const request = readStoredArray(CLIENT_REQUESTS_KEY).find(
    (item) =>
      normalizeKey(item.clientName) === normalizeKey(clientName) &&
      normalizeKey(item.provider) === normalizeKey(providerName),
  );
  return getClientThreadKey(
    providerName || "proveedor-demo",
    request?.ownerEmail || normalizeKey(clientName),
  );
}

const loginRole = document.querySelector("#login-role");
const loginRegisterLink = document.querySelector("#login-register-link");
if (loginRole) {
  const role =
    new URLSearchParams(location.search).get("tipo") === "proveedor" ? "Proveedor" : "Cliente";
  loginRole.textContent = role;
  if (loginRegisterLink) loginRegisterLink.href = `registro.html?tipo=${role.toLowerCase()}`;
}

const appName = document.querySelector("#app-user-name");
const appRole = document.querySelector("#app-user-role");
const providerAvatarInitial = document.querySelector("#provider-avatar-initial");
let isSigningOut = false;
if (appName || appRole) {
  const isProviderPage = Boolean(document.querySelector("#provider-nav"));
  const expectedRole = isProviderPage ? "Proveedor" : "Cliente";
  subscribeToAuthState(({ user, profile, error }) => {
    if (!user) {
      if (isSigningOut) return;
      window.location.replace(`login.html?tipo=${isProviderPage ? "proveedor" : "cliente"}`);
      return;
    }
    if (error || !profile) {
      console.error("No se pudo cargar el perfil autenticado:", error);
      window.location.replace(
        `login.html?tipo=${isProviderPage ? "proveedor" : "cliente"}&error=profile`,
      );
      return;
    }
    if (profile.role !== expectedRole) {
      window.location.replace(profile.role === "Proveedor" ? "inicio-proveedor.html" : "app.html");
      return;
    }

    const firstName = String(profile.firstName || "").trim();
    const lastName = String(profile.lastName || "").trim();
    const fullName = [firstName, lastName].filter(Boolean).join(" ");
    if (appName) appName.textContent = fullName;
    if (appRole) appRole.textContent = profile.role;
    const clientFirstName = document.querySelector("#client-first-name");
    if (clientFirstName) clientFirstName.textContent = firstName;
    const providerGreeting = document.querySelector("#provider-greeting");
    if (providerGreeting) providerGreeting.textContent = firstName;
    if (providerAvatarInitial) {
      const avatarName = firstName || lastName;
      const initial = Array.from(avatarName)[0] || "";
      providerAvatarInitial.textContent = initial.toLocaleUpperCase("es");
    }
    const providerProfileName = document.querySelector("#provider-profile-name");
    if (providerProfileName) {
      providerProfileName.textContent = fullName;
      providerProfileName.hidden = false;
    }
  });
}

document.querySelector("#logout-button")?.addEventListener("click", async (event) => {
  const button = event.currentTarget;
  button.disabled = true;
  isSigningOut = true;
  try {
    await signOutUser();
    window.location.replace("index.html");
  } catch (error) {
    console.error("Error al cerrar sesión:", error);
    isSigningOut = false;
    window.alert(getAuthErrorMessage(error, "logout"));
    button.disabled = false;
  }
});

// Chat local (solo modo demostración); con backend lo maneja components/mensajes.js.
const chatForm = USE_REQUESTS_BACKEND ? null : document.querySelector("#chat-form");
let activeClientChat = null;
function renderChatMessages(target, providerName, key, emptyGreeting) {
  if (!target) return;
  const messages = readChatThreads()[key] || [];
  target.replaceChildren();
  const day = document.createElement("p");
  day.className = "chat-day";
  day.textContent = "Conversación";
  target.append(day);
  if (!messages.length) {
    const greeting = document.createElement("p");
    greeting.className = "chat-bubble";
    greeting.textContent = emptyGreeting;
    target.append(greeting);
    return;
  }
  messages.forEach((message) => {
    const bubble = document.createElement("p");
    bubble.className = `chat-bubble${message.sender === "me" ? " chat-own" : ""}`;
    bubble.textContent = message.text;
    target.append(bubble);
  });
  target.scrollTop = target.scrollHeight;
}
chatForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  const input = chatForm.elements.message;
  const text = input.value.trim();
  if (!text || !activeClientChat) return;
  const key = getClientThreadKey(activeClientChat.dataset.clientChat);
  const messages = readChatThreads()[key] || [];
  messages.push({ sender: "me", text, createdAt: new Date().toISOString() });
  try {
    writeChatThread(key, messages);
    renderChatMessages(
      document.querySelector("#chat-messages"),
      activeClientChat.dataset.clientChat,
      key,
      "",
    );
    input.value = "";
  } catch {
    const notice = document.querySelector("#chat-storage-message");
    if (notice) notice.textContent = "No se pudo guardar el mensaje en este navegador.";
  }
  input.focus();
});
function selectClientChat(button) {
  activeClientChat = button;
  document
    .querySelectorAll("[data-client-chat]")
    .forEach((item) => item.classList.toggle("active", item === button));
  const name = document.querySelector("#client-chat-name");
  const profession = document.querySelector("#client-chat-profession");
  if (name) name.textContent = button.dataset.clientChat;
  if (profession) profession.textContent = `${button.dataset.profession} · Disponible`;
  const key = getClientThreadKey(button.dataset.clientChat);
  renderChatMessages(
    document.querySelector("#chat-messages"),
    button.dataset.clientChat,
    key,
    `Hola, soy ${button.dataset.clientChat}. ¿En qué puedo ayudarte con el servicio?`,
  );
}
document
  .querySelectorAll("[data-client-chat]")
  .forEach((button) => button.addEventListener("click", () => selectClientChat(button)));
const desiredClientChat = new URLSearchParams(location.search).get("persona");
const initialClientChat = [...document.querySelectorAll("[data-client-chat]")].find(
  (button) => button.dataset.clientChat === desiredClientChat,
);
if (USE_REQUESTS_BACKEND) {
  // components/mensajes.js arma las conversaciones reales.
} else if (initialClientChat) selectClientChat(initialClientChat);
else {
  const firstClientChat = document.querySelector("[data-client-chat]");
  if (firstClientChat) selectClientChat(firstClientChat);
}

// Provider screens in WEB FINAL share one persistent demo request state.
const PROVIDER_REQUESTS_KEY = "hogarfix.provider.requests.v1";
const sampleProviderRequests = [
  {
    id: "P-1001",
    client: "Juan Pérez",
    service: "Plomería",
    date: "26 ago, 2026 · 9:00 am",
    address: "Carrera 15 #20-20, Apto 501",
    detail:
      "Tengo una fuga en el lavaplatos que lleva varios días, el agua escurre por debajo del mueble.",
    amount: 35000,
    status: "Pendiente",
  },
  {
    id: "P-1002",
    client: "Luis Fernández",
    service: "Plomería",
    date: "20 ago, 2026 · 8:00 am",
    address: "Transversal 93 #55-12",
    detail: "Revisión y mantenimiento general de fontanería.",
    amount: 35000,
    status: "Pendiente",
  },
  {
    id: "P-1003",
    client: "María López",
    service: "Plomería",
    date: "27 ago, 2026 · 11:00 am",
    address: "Av. 68 #23-45, Casa 12",
    detail: "Cambio de grifo en el baño principal y revisión de tubería.",
    amount: 35000,
    status: "Confirmada",
  },
  {
    id: "P-1004",
    client: "Carlos García",
    service: "Plomería",
    date: "24 ago, 2026 · 2:00 pm",
    address: "Calle 80 #40-30",
    detail: "Instalación de calentador de agua nuevo.",
    amount: 35000,
    status: "En proceso",
  },
  {
    id: "P-1005",
    client: "Ana Ruiz",
    service: "Plomería",
    date: "15 ago, 2026 · 10:00 am",
    address: "Calle 45 #28-10",
    detail: "Reparación de tuberías de agua caliente.",
    amount: 35000,
    status: "Completada",
  },
];
function getProviderRequests() {
  let stored = readStoredArray(PROVIDER_REQUESTS_KEY);
  const providerName = getProviderName();
  const customerRequests = readStoredArray(CLIENT_REQUESTS_KEY)
    .filter((item) => normalizeKey(item.provider) === normalizeKey(providerName))
    .map((item) => ({
      ...item,
      client: item.clientName,
      date: `${item.date} · ${item.time}`,
      source: "client",
    }));
  if (!stored.length && !customerRequests.length)
    return sampleProviderRequests.map((item) => ({ ...item }));
  return [...customerRequests, ...stored];
}
function saveProviderRequests(items) {
  const localItems = items.filter((item) => item.source !== "client");
  writeStoredArray(PROVIDER_REQUESTS_KEY, localItems);
  const customerRequests = readStoredArray(CLIENT_REQUESTS_KEY);
  items
    .filter((item) => item.source === "client")
    .forEach((item) => {
      const target = customerRequests.find((request) => request.id === item.id);
      if (target) target.status = item.status;
    });
  writeStoredArray(CLIENT_REQUESTS_KEY, customerRequests);
}
function safeText(value) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character],
  );
}
function providerRequestCard(item, detail = false) {
  const statusClass = item.status.toLowerCase().replaceAll(" ", "-");
  const actions =
    item.status === "Pendiente"
      ? `<button class="button button-small" data-provider-action="accept" data-id="${safeText(item.id)}">✓ Aceptar</button><button class="button button-small danger-button" data-provider-action="reject" data-id="${safeText(item.id)}">× Rechazar</button>`
      : item.status === "Aceptada"
        ? `<span class="waiting-note">Esperando confirmación del cliente</span>`
        : item.status === "Confirmada"
          ? `<button class="button button-small" data-provider-action="start" data-id="${safeText(item.id)}">Marcar en proceso</button>`
          : item.status === "En proceso"
            ? `<button class="button button-small" data-provider-action="complete" data-id="${safeText(item.id)}">Marcar completo</button>`
            : "";
  const payment = item.paymentMethod
    ? `<p class="provider-request-payment">Pago informativo: ${safeText(item.paymentMethod.nombre)} · ${safeText(item.paymentStatus || "Sin procesar")}</p>`
    : "";
  const body = `<div class="provider-request-top"><div><h3>${safeText(item.client)}</h3><p>${safeText(item.service)} · ${safeText(item.date)}</p><p>${safeText(item.address)}</p></div><div class="provider-request-price"><strong>$${Number(item.amount).toLocaleString("es-CO")}</strong><small>Hace 3 horas</small></div></div><p class="provider-request-description">${safeText(item.detail)}</p>${payment}<div class="provider-request-bottom"><span class="request-status status-${statusClass}">● ${safeText(item.status)}</span><div class="provider-request-actions">${actions}<a href="detalle-proveedor.html?id=${encodeURIComponent(item.id)}">Ver detalles</a><a href="mensajes-proveedor.html?chat=${encodeURIComponent(item.client)}">Chat</a></div></div>`;
  return `<article class="provider-request-card ${detail ? "provider-request-detail-card" : ""}">${body}</article>`;
}
function renderProviderDashboard() {
  const requests = getProviderRequests();
  const pending = document.querySelector("#provider-dashboard-requests");
  const inProgress = document.querySelector("#provider-inprogress");
  if (pending)
    pending.innerHTML =
      requests
        .filter((item) => item.status === "Pendiente")
        .slice(0, 2)
        .map((item) => providerRequestCard(item))
        .join("") || '<p class="empty-state">No tienes solicitudes nuevas.</p>';
  if (inProgress)
    inProgress.innerHTML =
      requests
        .filter((item) => item.status === "En proceso")
        .map((item) => providerRequestCard(item))
        .join("") || '<p class="empty-state">No tienes servicios en proceso.</p>';
  const counts = {
    "provider-pending-count": ["Pendiente"],
    "provider-accepted-count": ["Aceptada"],
    "provider-inprogress-count": ["En proceso"],
    "provider-completed-count": ["Completada"],
  };
  Object.entries(counts).forEach(([id, statuses]) => {
    const node = document.getElementById(id);
    if (node) node.textContent = requests.filter((item) => statuses.includes(item.status)).length;
  });
}
function renderProviderRequestList(filter = "Todas") {
  const target = document.querySelector("#provider-request-list");
  if (!target) return;
  const requests = getProviderRequests();
  document.querySelectorAll("[data-count]").forEach((node) => {
    const status = node.dataset.count;
    node.textContent = `(${status === "Todas" ? requests.length : requests.filter((item) => item.status === status).length})`;
  });
  const items = requests.filter(
    (item) => filter === "Todas" || item.status === filter,
  );
  target.innerHTML =
    items.map((item) => providerRequestCard(item)).join("") ||
    '<p class="empty-state">No hay solicitudes en este estado.</p>';
}
if (!USE_REQUESTS_BACKEND) {
  const dataNote = document.querySelector("#provider-request-data-note");
  if (dataNote) {
    dataNote.textContent =
      "Modo demostración: las solicitudes y tarifas mostradas son datos locales de ejemplo; no representan pagos procesados.";
    dataNote.hidden = false;
  }
  renderProviderDashboard();
  renderProviderRequestList(new URLSearchParams(location.search).get("estado") || "Todas");
  document.querySelectorAll("[data-provider-filter]").forEach((button) => {
    if (button.dataset.providerFilter === new URLSearchParams(location.search).get("estado")) {
      document
        .querySelectorAll("[data-provider-filter]")
        .forEach((other) => other.setAttribute("aria-pressed", String(other === button)));
    }
    button.addEventListener("click", () => {
      document
        .querySelectorAll("[data-provider-filter]")
        .forEach((other) => other.setAttribute("aria-pressed", String(other === button)));
      renderProviderRequestList(button.dataset.providerFilter);
    });
  });
  document.addEventListener("click", (event) => {
    const button = event.target.closest("[data-provider-action]");
    if (!button) return;
    const requests = getProviderRequests();
    const request = requests.find((item) => item.id === button.dataset.id);
    if (!request) return;
    const next = {
      accept: "Aceptada",
      reject: "Rechazada",
      start: "En proceso",
      complete: "Completada",
    }[button.dataset.providerAction];
    if (next) request.status = next;
    saveProviderRequests(requests);
    renderProviderDashboard();
    const active =
      document.querySelector("[data-provider-filter][aria-pressed=true]")?.dataset.providerFilter ||
      new URLSearchParams(location.search).get("estado") ||
      "Todas";
    renderProviderRequestList(active);
    renderProviderRequestDetail();
  });
}
function renderProviderRequestDetail() {
  const target = document.querySelector("#provider-request-detail");
  if (!target) return;
  const id = new URLSearchParams(location.search).get("id");
  const request = getProviderRequests().find((item) => item.id === id) || getProviderRequests()[0];
  target.innerHTML = request
    ? providerRequestCard(request, true)
    : '<p class="empty-state">No encontramos esa solicitud.</p>';
}
if (!USE_REQUESTS_BACKEND) renderProviderRequestDetail();
const providerMessageForm = USE_REQUESTS_BACKEND ? null : document.querySelector("#provider-chat-form");
let activeProviderChat = null;
providerMessageForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  const input = providerMessageForm.elements.message;
  if (!input.value.trim()) return;
  if (!activeProviderChat) return;
  const key = getProviderThreadKey(activeProviderChat.dataset.chatPerson);
  const messages = readChatThreads()[key] || [];
  messages.push({ sender: "me", text: input.value.trim(), createdAt: new Date().toISOString() });
  try {
    writeChatThread(key, messages);
    renderChatMessages(
      document.querySelector("#provider-chat-messages"),
      activeProviderChat.dataset.chatPerson,
      key,
      "La conversación aún no tiene mensajes.",
    );
    input.value = "";
  } catch {
    return;
  }
  input.focus();
});
function selectProviderChat(button) {
  activeProviderChat = button;
  document
    .querySelectorAll("[data-chat-person]")
    .forEach((item) => item.classList.toggle("active", item === button));
  const name = document.querySelector("#active-chat-person");
  if (name) name.textContent = button.dataset.chatPerson;
  const key = getProviderThreadKey(button.dataset.chatPerson);
  renderChatMessages(
    document.querySelector("#provider-chat-messages"),
    button.dataset.chatPerson,
    key,
    `Hola ${button.dataset.chatPerson}, ¿en qué puedo ayudarte?`,
  );
}
document
  .querySelectorAll("[data-chat-person]")
  .forEach((button) => button.addEventListener("click", () => selectProviderChat(button)));
const desiredProviderChat = new URLSearchParams(location.search).get("chat");
const initialProviderChat = [...document.querySelectorAll("[data-chat-person]")].find(
  (button) => button.dataset.chatPerson === desiredProviderChat,
);
if (USE_REQUESTS_BACKEND) {
  // components/mensajes.js arma las conversaciones reales.
} else if (initialProviderChat) selectProviderChat(initialProviderChat);
else {
  const firstProviderChat = document.querySelector("[data-chat-person]");
  if (firstProviderChat) selectProviderChat(firstProviderChat);
}
const conversationSearch = document.querySelector("#conversation-search");
conversationSearch?.addEventListener("input", () =>
  document.querySelectorAll("[data-chat-person]").forEach((item) => {
    item.hidden = !item.textContent
      .toLocaleLowerCase("es")
      .includes(conversationSearch.value.toLocaleLowerCase("es"));
  }),
);
