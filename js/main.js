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

const registerForm = document.querySelector("#register-form");
const registerRole = document.querySelector("#register-role");
const registerMessage = document.querySelector("#register-message");
const registerLoginLink = document.querySelector("#register-login-link");

if (registerRole) {
  const role = new URLSearchParams(window.location.search).get("tipo");
  registerRole.textContent = role === "proveedor" ? "Proveedor" : "Cliente";
  if (registerLoginLink) registerLoginLink.href = `login.html?tipo=${role === "proveedor" ? "proveedor" : "cliente"}`;
}

const ACCOUNTS_KEY = "hogarfix.accounts.v1";
const SESSION_KEY = "hogarfix.session.v1";
const CLIENT_REQUESTS_KEY = "hogarfix.requests.v1";
const CHAT_THREADS_KEY = "hogarfix.chat-threads.v1";

function getCurrentSession() {
  try { return JSON.parse(sessionStorage.getItem(SESSION_KEY) || "null"); }
  catch { return null; }
}
function readStoredArray(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(value) ? value : [];
  } catch { return []; }
}
function writeStoredArray(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}
function normalizeKey(value = "") {
  return String(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
function readChatThreads() {
  try { return JSON.parse(localStorage.getItem(CHAT_THREADS_KEY) || "{}"); }
  catch { return {}; }
}
function writeChatThread(key, messages) {
  const threads = readChatThreads();
  threads[key] = messages;
  localStorage.setItem(CHAT_THREADS_KEY, JSON.stringify(threads));
}
function getClientThreadKey(providerName, ownerEmail = getCurrentSession()?.email || "cliente-demo") {
  const owner = ownerEmail;
  return `${normalizeKey(owner)}::${normalizeKey(providerName)}`;
}
function getProviderName() {
  const savedProfile = (() => { try { return JSON.parse(localStorage.getItem("hogarfix.provider.profile.v1") || "null"); } catch { return null; } })();
  const session = getCurrentSession();
  return savedProfile?.name || [session?.firstName, session?.lastName].filter(Boolean).join(" ");
}
function getProviderThreadKey(clientName) {
  const providerName = getProviderName();
  const request = readStoredArray(CLIENT_REQUESTS_KEY).find((item) => normalizeKey(item.clientName) === normalizeKey(clientName) && normalizeKey(item.provider) === normalizeKey(providerName));
  return getClientThreadKey(providerName || "proveedor-demo", request?.ownerEmail || normalizeKey(clientName));
}

function getAccounts() {
  try { return JSON.parse(localStorage.getItem(ACCOUNTS_KEY) || "[]"); }
  catch { return []; }
}

async function hashPassword(password, salt) {
  if (!globalThis.crypto?.subtle) throw new Error("Abre el sitio publicado con HTTPS para usar el acceso de demostración.");
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const saltBytes = Uint8Array.from(atob(salt), (character) => character.charCodeAt(0));
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt: saltBytes, iterations: 120000, hash: "SHA-256" }, key, 256);
  return btoa(String.fromCharCode(...new Uint8Array(bits)));
}

function createSalt() {
  if (!globalThis.crypto?.getRandomValues) throw new Error("Abre el sitio publicado con HTTPS para usar el acceso de demostración.");
  return btoa(String.fromCharCode(...globalThis.crypto.getRandomValues(new Uint8Array(16))));
}

function startDemoSession(account) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify({ firstName: account.firstName, lastName: account.lastName, email: account.email, role: account.role }));
  window.location.replace(account.role === "Proveedor" ? "inicio-proveedor.html" : "app.html");
}

registerForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  registerMessage.textContent = "";

  if (!registerForm.reportValidity()) return;

  const values = new FormData(registerForm);
  if (values.get("password") !== values.get("confirmPassword")) {
    registerMessage.textContent = "Las contraseñas no coinciden.";
    registerForm.elements.confirmPassword.focus();
    return;
  }

  registerMessage.textContent = "Creando tu cuenta…";
  const submitButton = registerForm.querySelector("[type=submit]");
  submitButton.disabled = true;
  try {
    const email = String(values.get("email")).trim().toLowerCase();
    const accounts = getAccounts();
    if (accounts.some((account) => account.email === email)) {
      registerMessage.textContent = "Ya existe una cuenta con ese correo en este navegador. Inicia sesión.";
      return;
    }
    const salt = createSalt();
    const account = {
      firstName: String(values.get("firstName")).trim(),
      lastName: String(values.get("lastName")).trim(),
      email,
      role: new URLSearchParams(window.location.search).get("tipo") === "proveedor" ? "Proveedor" : "Cliente",
      salt,
      passwordHash: await hashPassword(String(values.get("password")), salt)
    };
    localStorage.setItem(ACCOUNTS_KEY, JSON.stringify([...accounts, account]));
    startDemoSession(account);
  } catch (error) {
    registerMessage.textContent = error.message || "No se pudo crear la cuenta en este navegador.";
  } finally {
    submitButton.disabled = false;
  }
});

const loginForm = document.querySelector("#login-form");
const loginMessage = document.querySelector("#login-message");
const loginRole = document.querySelector("#login-role");
const loginRegisterLink = document.querySelector("#login-register-link");
if (loginRole) {
  const role = new URLSearchParams(location.search).get("tipo") === "proveedor" ? "Proveedor" : "Cliente";
  loginRole.textContent = role;
  if (loginRegisterLink) loginRegisterLink.href = `registro.html?tipo=${role.toLowerCase()}`;
}
loginForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  loginMessage.textContent = "Verificando…";
  const submitButton = loginForm.querySelector("[type=submit]");
  submitButton.disabled = true;
  try {
    const values = new FormData(loginForm);
    const email = String(values.get("email")).trim().toLowerCase();
    const account = getAccounts().find((savedAccount) => savedAccount.email === email);
    if (!account || await hashPassword(String(values.get("password")), account.salt) !== account.passwordHash) {
      loginMessage.textContent = "Correo o contraseña incorrectos. Si no tienes una cuenta en este navegador, regístrate primero.";
      return;
    }
    startDemoSession(account);
  } catch (error) {
    loginMessage.textContent = error.message || "No se pudo iniciar sesión en este navegador.";
  } finally {
    submitButton.disabled = false;
  }
});

const appName = document.querySelector("#app-user-name");
const appRole = document.querySelector("#app-user-role");
if (appName || appRole) {
  let session;
  try { session = JSON.parse(sessionStorage.getItem(SESSION_KEY) || "null"); } catch { session = null; }
  if (!session) window.location.replace("login.html");
  else {
    if (session.role === "Proveedor" && location.pathname.endsWith("app.html")) window.location.replace("inicio-proveedor.html");
    if (appName) appName.textContent = `${session.firstName} ${session.lastName}`;
    if (appRole) appRole.textContent = session.role;
    const clientFirstName = document.querySelector("#client-first-name");
    if (clientFirstName) clientFirstName.textContent = session.firstName;
    const providerGreeting = document.querySelector("#provider-greeting");
    if (providerGreeting) providerGreeting.textContent = session.firstName;
    const providerProfileName = document.querySelector("#provider-profile-name");
    if (providerProfileName && !localStorage.getItem("hogarfix.provider.profile.v1")) providerProfileName.textContent = `${session.firstName} ${session.lastName}`;
  }
}

document.querySelector("#logout-button")?.addEventListener("click", () => {
  sessionStorage.removeItem(SESSION_KEY);
  window.location.replace("index.html");
});

const providerSearchForm = document.querySelector("#provider-search-form");
const providerGrid = document.querySelector("#provider-grid");
if (providerSearchForm && providerGrid) {
  const cards = [...providerGrid.querySelectorAll(".search-provider-card")];
  const queryInput = document.querySelector("#service-query");
  const availableOnly = document.querySelector("#available-only");
  const resultCount = document.querySelector("#result-count");
  const noResults = document.querySelector("#no-results");
  let activeCategory = "";
  const initialQuery = new URLSearchParams(location.search).get("q") || "";
  queryInput.value = initialQuery;
  const updateResults = () => {
    const query = queryInput.value.trim().toLocaleLowerCase("es");
    let count = 0;
    cards.forEach((card) => {
      const searchText = `${card.dataset.name} ${card.dataset.service} ${card.dataset.category}`.toLocaleLowerCase("es");
      const matches = (!query || searchText.includes(query)) && (!activeCategory || card.dataset.category === activeCategory) && (!availableOnly.checked || card.dataset.available === "true");
      card.hidden = !matches;
      if (matches) count += 1;
    });
    resultCount.textContent = `(${count} ${count === 1 ? "resultado" : "resultados"})`;
    noResults.hidden = count !== 0;
  };
  providerSearchForm.addEventListener("submit", (event) => { event.preventDefault(); updateResults(); });
  queryInput.addEventListener("input", updateResults);
  availableOnly.addEventListener("change", updateResults);
  document.querySelectorAll(".filter-chip").forEach((chip) => chip.addEventListener("click", () => {
    activeCategory = activeCategory === chip.dataset.filter ? "" : chip.dataset.filter;
    document.querySelectorAll(".filter-chip").forEach((item) => item.setAttribute("aria-pressed", String(item.dataset.filter === activeCategory)));
    updateResults();
  }));
  if (initialQuery) updateResults();
}

// Client demo flow: provider profile -> service request -> requests list.
const providerProfiles = {
  "carlos-ramirez": { name: "Carlos Ramírez", profession: "Electricista", rating: "4.9", jobs: "356", reviews: "48", service: "Electricidad" },
  "ana-torres": { name: "Ana Torres", profession: "Plomera", rating: "4.8", jobs: "284", reviews: "42", service: "Plomería" },
  "juan-suarez": { name: "Juan Suárez", profession: "Jardinero", rating: "4.5", jobs: "198", reviews: "31", service: "Jardinería" },
  "maribel-cruz": { name: "Maribel Cruz", profession: "Limpieza General", rating: "4.8", jobs: "312", reviews: "55", service: "Aseo general" },
  "pedro-herrera": { name: "Pedro Herrera", profession: "Plomero", rating: "4.7", jobs: "241", reviews: "38", service: "Plomería" },
  "lucia-mendez": { name: "Lucía Méndez", profession: "Electricista", rating: "4.6", jobs: "173", reviews: "29", service: "Electricidad" },
  "roberto-vargas": { name: "Roberto Vargas", profession: "Jardinero", rating: "4.4", jobs: "162", reviews: "24", service: "Jardinería" },
  "maria-lopez": { name: "María López", profession: "Limpieza General", rating: "4.9", jobs: "205", reviews: "46", service: "Aseo general" }
};
const profileId = new URLSearchParams(location.search).get("id") || "carlos-ramirez";
const profile = providerProfiles[profileId] || providerProfiles["carlos-ramirez"];
document.querySelectorAll("[data-provider-name]").forEach((node) => { node.textContent = profile.name; });
document.querySelectorAll("[data-provider-profession]").forEach((node) => { node.textContent = profile.profession; });
document.querySelectorAll("[data-provider-rating]").forEach((node) => { node.textContent = profile.rating; });
document.querySelectorAll("[data-provider-jobs]").forEach((node) => { node.textContent = profile.jobs; });
document.querySelectorAll("[data-provider-reviews]").forEach((node) => { node.textContent = profile.reviews; });
document.querySelectorAll("[data-provider-service]").forEach((node) => { node.textContent = profile.service; });
const bookingService = document.querySelector('#booking-form [name="service"]');
if (bookingService) bookingService.value = profile.service;
document.querySelectorAll('[name="time-choice"]').forEach((radio) => radio.addEventListener("change", () => {
  const timeSelect = document.querySelector('#booking-form [name="time"]');
  if (timeSelect) timeSelect.value = radio.value;
}));
const bookingForm = document.querySelector("#booking-form");
bookingForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!bookingForm.reportValidity()) return;
  const message = document.querySelector("#booking-message");
  try {
    const formData = Object.fromEntries(new FormData(bookingForm));
    const session = getCurrentSession();
    const requests = readStoredArray(CLIENT_REQUESTS_KEY);
    const request = {
      id: `HF-${globalThis.crypto?.randomUUID?.() || Date.now().toString(36)}`,
      ownerEmail: session?.email || "cliente-demo",
      clientName: session ? `${session.firstName} ${session.lastName}` : "Cliente",
      provider: profile.name,
      service: formData.service || profile.service,
      date: formData.date,
      time: formData.time,
      address: String(formData.address).trim(),
      detail: String(formData.detail).trim(),
      amount: 40000,
      status: "Pendiente",
      createdAt: new Date().toISOString()
    };
    writeStoredArray(CLIENT_REQUESTS_KEY, [request, ...requests]);
    if (!readStoredArray(CLIENT_REQUESTS_KEY).some((saved) => saved.id === request.id)) throw new Error("No se pudo confirmar el guardado en este navegador.");
    location.href = `reserva.html?id=${encodeURIComponent(request.id)}`;
  } catch (error) {
    if (message) message.textContent = error.message || "No se pudo guardar la solicitud en este navegador.";
  }
});
const requestList = document.querySelector("#request-list");
if (requestList) {
  const session = getCurrentSession();
  const allRequests = readStoredArray(CLIENT_REQUESTS_KEY).filter((item) => !session?.email || !item.ownerEmail || item.ownerEmail === session.email);
  const escapeHTML = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
  const renderRequests = (filter = "Todas") => {
    const filtered = allRequests.filter((item) => filter === "Todas" || item.status === filter);
    requestList.innerHTML = filtered.length ? filtered.map((item) => `<article class="client-request-card"><div class="client-request-head"><div><h2>${escapeHTML(item.service)}</h2><p>${escapeHTML(item.provider)} · ${escapeHTML(item.date)}</p></div><span class="request-status status-${escapeHTML(item.status.toLowerCase().replaceAll(" ", "-"))}">● ${escapeHTML(item.status)}</span></div><div class="client-request-meta"><span>📅 ${escapeHTML(item.date)}</span><span>🕐 ${escapeHTML(item.time)}</span><strong>$${Number(item.amount || 0).toLocaleString("es-CO")}</strong></div><p class="client-request-description">${escapeHTML(item.detail || "Solicitud de servicio para el hogar.")}</p><div class="client-request-actions"><a href="perfil-proveedor.html?id=${encodeURIComponent(profileIdFromName(item.provider))}">Ver detalles</a><a href="chat.html?persona=${encodeURIComponent(item.provider)}">▢ Chat</a></div></article>`).join("") : '<p class="empty-state">No tienes solicitudes en este estado.</p>';
  };
  const initialStatus = new URLSearchParams(location.search).get("estado") || "Todas";
  renderRequests(initialStatus);
  document.querySelectorAll("[data-request-filter]").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.requestFilter === initialStatus)));
  document.querySelectorAll("[data-request-filter]").forEach((button) => button.addEventListener("click", () => {
    document.querySelectorAll("[data-request-filter]").forEach((item) => item.setAttribute("aria-pressed", String(item === button)));
    renderRequests(button.dataset.requestFilter);
  }));
}
function profileIdFromName(name = "") {
  return String(name).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
const clientDashboardList = document.querySelector("#active-request-list");
if (clientDashboardList) {
  const session = getCurrentSession();
  const clientRequests = readStoredArray(CLIENT_REQUESTS_KEY).filter((item) => !session?.email || !item.ownerEmail || item.ownerEmail === session.email);
  {
    const active = clientRequests.filter((item) => !["Completada", "Cancelada"].includes(item.status)).slice(0, 2);
    clientDashboardList.innerHTML = active.length ? active.map((item) => `<a class="active-request" href="solicitudes.html"><span class="category-icon">⌂</span><span><strong>${safeText(item.service)}</strong><small>${safeText(item.provider)} · ${safeText(item.date)}</small></span><span class="request-status status-${safeText(item.status.toLowerCase().replaceAll(" ", "-"))}">● ${safeText(item.status)}</span></a>`).join("") : '<p class="empty-state">No tienes solicitudes activas. <a href="buscar.html">Busca un servicio</a></p>';
    const counts = { Pendiente: "client-pending-count", "En proceso": "client-inprogress-count", Completada: "client-completed-count", Cancelada: "client-cancelled-count" };
    Object.entries(counts).forEach(([status, id]) => { const target = document.getElementById(id); if (target) target.textContent = clientRequests.filter((item) => item.status === status).length; });
  }
}
const confirmation = document.querySelector("#confirmation-details");
if (confirmation) {
  const wantedId = new URLSearchParams(location.search).get("id");
  const session = getCurrentSession();
  const requests = readStoredArray(CLIENT_REQUESTS_KEY).filter((item) => !session?.email || !item.ownerEmail || item.ownerEmail === session.email);
  const request = requests.find((item) => item.id === wantedId);
  if (request) confirmation.innerHTML = `<p><strong>Profesional:</strong> ${safeText(request.provider)}</p><p><strong>Servicio:</strong> ${safeText(request.service)}</p><p><strong>Fecha y hora:</strong> ${safeText(request.date)} · ${safeText(request.time)}</p><p><strong>Dirección:</strong> ${safeText(request.address)}</p><p><strong>Estado:</strong> <span class="request-status status-pendiente">${safeText(request.status)}</span></p>`;
  else confirmation.innerHTML = '<p>No encontramos esa solicitud en este navegador. Abre “Mis solicitudes” para ver tus datos guardados.</p>';
}
const chatForm = document.querySelector("#chat-form");
let activeClientChat = null;
function renderChatMessages(target, providerName, key, emptyGreeting) {
  if (!target) return;
  const messages = readChatThreads()[key] || [];
  target.replaceChildren();
  const day = document.createElement("p"); day.className = "chat-day"; day.textContent = "Conversación"; target.append(day);
  if (!messages.length) {
    const greeting = document.createElement("p"); greeting.className = "chat-bubble"; greeting.textContent = emptyGreeting; target.append(greeting); return;
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
  try { writeChatThread(key, messages); renderChatMessages(document.querySelector("#chat-messages"), activeClientChat.dataset.clientChat, key, ""); input.value = ""; }
  catch { const notice = document.querySelector("#chat-storage-message"); if (notice) notice.textContent = "No se pudo guardar el mensaje en este navegador."; }
  input.focus();
});
function selectClientChat(button) {
  activeClientChat = button;
  document.querySelectorAll("[data-client-chat]").forEach((item) => item.classList.toggle("active", item === button));
  const name = document.querySelector("#client-chat-name");
  const profession = document.querySelector("#client-chat-profession");
  if (name) name.textContent = button.dataset.clientChat;
  if (profession) profession.textContent = `${button.dataset.profession} · Disponible`;
  const key = getClientThreadKey(button.dataset.clientChat);
  renderChatMessages(document.querySelector("#chat-messages"), button.dataset.clientChat, key, `Hola, soy ${button.dataset.clientChat}. ¿En qué puedo ayudarte con el servicio?`);
}
document.querySelectorAll("[data-client-chat]").forEach((button) => button.addEventListener("click", () => selectClientChat(button)));
const desiredClientChat = new URLSearchParams(location.search).get("persona");
const initialClientChat = [...document.querySelectorAll("[data-client-chat]")].find((button) => button.dataset.clientChat === desiredClientChat);
if (initialClientChat) selectClientChat(initialClientChat);
else { const firstClientChat = document.querySelector("[data-client-chat]"); if (firstClientChat) selectClientChat(firstClientChat); }

// Provider screens in WEB FINAL share one persistent demo request state.
const PROVIDER_REQUESTS_KEY = "hogarfix.provider.requests.v1";
const sampleProviderRequests = [
  { id: "P-1001", client: "Juan Pérez", service: "Plomería", date: "26 ago, 2026 · 9:00 am", address: "Carrera 15 #20-20, Apto 501", detail: "Tengo una fuga en el lavaplatos que lleva varios días, el agua escurre por debajo del mueble.", amount: 75000, status: "Pendiente" },
  { id: "P-1002", client: "Luis Fernández", service: "Plomería", date: "20 ago, 2026 · 8:00 am", address: "Transversal 93 #55-12", detail: "Revisión y mantenimiento general de fontanería.", amount: 55000, status: "Pendiente" },
  { id: "P-1003", client: "María López", service: "Plomería", date: "27 ago, 2026 · 11:00 am", address: "Av. 68 #23-45, Casa 12", detail: "Cambio de grifo en el baño principal y revisión de tubería.", amount: 90000, status: "Aceptada" },
  { id: "P-1004", client: "Carlos García", service: "Plomería", date: "24 ago, 2026 · 2:00 pm", address: "Calle 80 #40-30", detail: "Instalación de calentador de agua nuevo.", amount: 120000, status: "En proceso" },
  { id: "P-1005", client: "Ana Ruiz", service: "Plomería", date: "15 ago, 2026 · 10:00 am", address: "Calle 45 #28-10", detail: "Reparación de tuberías de agua caliente.", amount: 65000, status: "Completada" }
];
function getProviderRequests() {
  let stored = readStoredArray(PROVIDER_REQUESTS_KEY);
  const providerName = getProviderName();
  const customerRequests = readStoredArray(CLIENT_REQUESTS_KEY)
    .filter((item) => normalizeKey(item.provider) === normalizeKey(providerName))
    .map((item) => ({ ...item, client: item.clientName, date: `${item.date} · ${item.time}`, source: "client" }));
  if (!stored.length && !customerRequests.length) return sampleProviderRequests.map((item) => ({ ...item }));
  return [...customerRequests, ...stored];
}
function saveProviderRequests(items) {
  const localItems = items.filter((item) => item.source !== "client");
  writeStoredArray(PROVIDER_REQUESTS_KEY, localItems);
  const customerRequests = readStoredArray(CLIENT_REQUESTS_KEY);
  items.filter((item) => item.source === "client").forEach((item) => {
    const target = customerRequests.find((request) => request.id === item.id);
    if (target) target.status = item.status;
  });
  writeStoredArray(CLIENT_REQUESTS_KEY, customerRequests);
}
function safeText(value) { return String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]); }
function providerRequestCard(item, detail = false) {
  const statusClass = item.status.toLowerCase().replaceAll(" ", "-");
  const actions = item.status === "Pendiente"
    ? `<button class="button button-small" data-provider-action="accept" data-id="${safeText(item.id)}">✓ Aceptar</button><button class="button button-small danger-button" data-provider-action="reject" data-id="${safeText(item.id)}">× Rechazar</button>`
    : item.status === "Aceptada"
      ? `<button class="button button-small" data-provider-action="start" data-id="${safeText(item.id)}">Marcar en proceso</button>`
      : item.status === "En proceso"
        ? `<button class="button button-small" data-provider-action="complete" data-id="${safeText(item.id)}">Marcar completo</button>`
        : "";
  const body = `<div class="provider-request-top"><div><h3>${safeText(item.client)}</h3><p>${safeText(item.service)} · ${safeText(item.date)}</p><p>${safeText(item.address)}</p></div><div class="provider-request-price"><strong>$${Number(item.amount).toLocaleString("es-CO")}</strong><small>Hace 3 horas</small></div></div><p class="provider-request-description">${safeText(item.detail)}</p><div class="provider-request-bottom"><span class="request-status status-${statusClass}">● ${safeText(item.status)}</span><div class="provider-request-actions">${actions}<a href="detalle-proveedor.html?id=${encodeURIComponent(item.id)}">Ver detalles</a><a href="mensajes-proveedor.html?chat=${encodeURIComponent(item.client)}">Chat</a></div></div>`;
  return `<article class="provider-request-card ${detail ? "provider-request-detail-card" : ""}">${body}</article>`;
}
function renderProviderDashboard() {
  const requests = getProviderRequests();
  const pending = document.querySelector("#provider-dashboard-requests");
  const inProgress = document.querySelector("#provider-inprogress");
  if (pending) pending.innerHTML = requests.filter((item) => item.status === "Pendiente").slice(0, 2).map((item) => providerRequestCard(item)).join("") || '<p class="empty-state">No tienes solicitudes nuevas.</p>';
  if (inProgress) inProgress.innerHTML = requests.filter((item) => item.status === "En proceso").map((item) => providerRequestCard(item)).join("") || '<p class="empty-state">No tienes servicios en proceso.</p>';
  const count = document.querySelector("#provider-pending-count");
  if (count) count.textContent = requests.filter((item) => item.status === "Pendiente").length;
}
function renderProviderRequestList(filter = "Todas") {
  const target = document.querySelector("#provider-request-list");
  if (!target) return;
  const items = getProviderRequests().filter((item) => filter === "Todas" || item.status === filter);
  target.innerHTML = items.map((item) => providerRequestCard(item)).join("") || '<p class="empty-state">No hay solicitudes en este estado.</p>';
}
renderProviderDashboard();
renderProviderRequestList(new URLSearchParams(location.search).get("estado") || "Todas");
document.querySelectorAll("[data-provider-filter]").forEach((button) => {
  if (button.dataset.providerFilter === new URLSearchParams(location.search).get("estado")) {
    document.querySelectorAll("[data-provider-filter]").forEach((other) => other.setAttribute("aria-pressed", String(other === button)));
  }
  button.addEventListener("click", () => {
    document.querySelectorAll("[data-provider-filter]").forEach((other) => other.setAttribute("aria-pressed", String(other === button)));
    renderProviderRequestList(button.dataset.providerFilter);
  });
});
document.addEventListener("click", (event) => {
  const button = event.target.closest("[data-provider-action]");
  if (!button) return;
  const requests = getProviderRequests();
  const request = requests.find((item) => item.id === button.dataset.id);
  if (!request) return;
  const next = { accept: "Aceptada", reject: "Rechazada", start: "En proceso", complete: "Completada" }[button.dataset.providerAction];
  if (next) request.status = next;
  saveProviderRequests(requests);
  renderProviderDashboard();
  const active = document.querySelector("[data-provider-filter][aria-pressed=true]")?.dataset.providerFilter || new URLSearchParams(location.search).get("estado") || "Todas";
  renderProviderRequestList(active);
  renderProviderRequestDetail();
});
function renderProviderRequestDetail() {
  const target = document.querySelector("#provider-request-detail");
  if (!target) return;
  const id = new URLSearchParams(location.search).get("id");
  const request = getProviderRequests().find((item) => item.id === id) || getProviderRequests()[0];
  target.innerHTML = request ? providerRequestCard(request, true) : '<p class="empty-state">No encontramos esa solicitud.</p>';
}
renderProviderRequestDetail();
const providerProfileForm = document.querySelector("#provider-profile-form");
if (providerProfileForm) {
  try {
    const saved = JSON.parse(localStorage.getItem("hogarfix.provider.profile.v1") || "null");
    if (saved) Object.entries(saved).forEach(([key, value]) => { if (providerProfileForm.elements[key]) providerProfileForm.elements[key].value = value; });
  } catch { /* Keep the Figma demo defaults. */ }
  providerProfileForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(providerProfileForm));
    localStorage.setItem("hogarfix.provider.profile.v1", JSON.stringify(values));
    const name = document.querySelector("#provider-profile-name");
    if (name) name.textContent = values.name;
    document.querySelector("#provider-profile-message").textContent = "Cambios guardados en este navegador.";
  });
}
const providerMessageForm = document.querySelector("#provider-chat-form");
let activeProviderChat = null;
providerMessageForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  const input = providerMessageForm.elements.message;
  if (!input.value.trim()) return;
  if (!activeProviderChat) return;
  const key = getProviderThreadKey(activeProviderChat.dataset.chatPerson);
  const messages = readChatThreads()[key] || [];
  messages.push({ sender: "me", text: input.value.trim(), createdAt: new Date().toISOString() });
  try { writeChatThread(key, messages); renderChatMessages(document.querySelector("#provider-chat-messages"), activeProviderChat.dataset.chatPerson, key, "La conversación aún no tiene mensajes."); input.value = ""; }
  catch { return; }
  input.focus();
});
function selectProviderChat(button) {
  activeProviderChat = button;
  document.querySelectorAll("[data-chat-person]").forEach((item) => item.classList.toggle("active", item === button));
  const name = document.querySelector("#active-chat-person");
  if (name) name.textContent = button.dataset.chatPerson;
  const key = getProviderThreadKey(button.dataset.chatPerson);
  renderChatMessages(document.querySelector("#provider-chat-messages"), button.dataset.chatPerson, key, `Hola ${button.dataset.chatPerson}, ¿en qué puedo ayudarte?`);
}
document.querySelectorAll("[data-chat-person]").forEach((button) => button.addEventListener("click", () => selectProviderChat(button)));
const desiredProviderChat = new URLSearchParams(location.search).get("chat");
const initialProviderChat = [...document.querySelectorAll("[data-chat-person]")].find((button) => button.dataset.chatPerson === desiredProviderChat);
if (initialProviderChat) selectProviderChat(initialProviderChat);
else { const firstProviderChat = document.querySelector("[data-chat-person]"); if (firstProviderChat) selectProviderChat(firstProviderChat); }
const conversationSearch = document.querySelector("#conversation-search");
conversationSearch?.addEventListener("input", () => document.querySelectorAll("[data-chat-person]").forEach((item) => { item.hidden = !item.textContent.toLocaleLowerCase("es").includes(conversationSearch.value.toLocaleLowerCase("es")); }));
