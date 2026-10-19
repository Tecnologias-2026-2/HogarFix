const menuButton = document.querySelector(".menu-toggle");
const navigation = document.querySelector("#primary-nav, #client-nav");

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

if (registerRole) {
  const role = new URLSearchParams(window.location.search).get("tipo");
  registerRole.textContent = role === "proveedor" ? "Proveedor" : "Cliente";
}

const ACCOUNTS_KEY = "hogarfix.accounts.v1";
const SESSION_KEY = "hogarfix.session.v1";

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
  window.location.replace("app.html");
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
    if (appName) appName.textContent = `${session.firstName} ${session.lastName}`;
    if (appRole) appRole.textContent = session.role;
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
  const formData = Object.fromEntries(new FormData(bookingForm));
  const requests = JSON.parse(localStorage.getItem("hogarfix.requests.v1") || "[]");
  const request = { id: `HF-${Date.now().toString().slice(-6)}`, provider: profile.name, service: formData.service || profile.service, date: formData.date, time: formData.time, address: formData.address, detail: formData.detail, status: "Pendiente" };
  localStorage.setItem("hogarfix.requests.v1", JSON.stringify([request, ...requests]));
  location.href = `reserva.html?id=${encodeURIComponent(request.id)}`;
});
const requestList = document.querySelector("#request-list");
if (requestList) {
  let requests = [];
  try { requests = JSON.parse(localStorage.getItem("hogarfix.requests.v1") || "[]"); } catch { requests = []; }
  const samples = [
    { id: "HF-24081", provider: "Carlos Ramírez", service: "Electricidad", date: "18 oct 2026", time: "10:00 a. m.", status: "En proceso" },
    { id: "HF-24075", provider: "Ana Torres", service: "Plomería", date: "21 oct 2026", time: "1:00 p. m.", status: "Pendiente" },
    { id: "HF-23992", provider: "Juan Suárez", service: "Jardinería", date: "10 oct 2026", time: "8:00 a. m.", status: "Completada" },
    { id: "HF-23910", provider: "Maribel Cruz", service: "Aseo general", date: "4 oct 2026", time: "3:30 p. m.", status: "Cancelada" }
  ];
  const allRequests = [...requests, ...samples];
  const escapeHTML = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
  const renderRequests = (filter = "Todas") => {
    const filtered = allRequests.filter((item) => filter === "Todas" || item.status === filter);
    requestList.innerHTML = filtered.length ? filtered.map((item) => `<article class="request-card"><div class="request-icon" aria-hidden="true">⌂</div><div class="request-main"><p class="eyebrow">${escapeHTML(item.id)}</p><h2>${escapeHTML(item.service)}</h2><p>Profesional: <strong>${escapeHTML(item.provider)}</strong></p><p>${escapeHTML(item.date)} · ${escapeHTML(item.time)}</p></div><span class="request-status status-${escapeHTML(item.status.toLowerCase().replaceAll(" ", "-"))}">${escapeHTML(item.status)}</span><a class="button button-small" href="chat.html">Ver detalle</a></article>`).join("") : '<p class="empty-state">No tienes solicitudes en este estado.</p>';
  };
  renderRequests();
  document.querySelectorAll("[data-request-filter]").forEach((button) => button.addEventListener("click", () => {
    document.querySelectorAll("[data-request-filter]").forEach((item) => item.setAttribute("aria-pressed", String(item === button)));
    renderRequests(button.dataset.requestFilter);
  }));
}
const confirmation = document.querySelector("#confirmation-details");
if (confirmation) {
  const wantedId = new URLSearchParams(location.search).get("id");
  let requests = [];
  try { requests = JSON.parse(localStorage.getItem("hogarfix.requests.v1") || "[]"); } catch { requests = []; }
  const request = requests.find((item) => item.id === wantedId) || requests[0];
  if (request) confirmation.innerHTML = `<p><strong>Profesional:</strong> ${request.provider}</p><p><strong>Servicio:</strong> ${request.service}</p><p><strong>Fecha y hora:</strong> ${request.date} · ${request.time}</p><p><strong>Estado:</strong> <span class="request-status status-pendiente">${request.status}</span></p>`;
}
const chatForm = document.querySelector("#chat-form");
chatForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  const input = chatForm.elements.message;
  if (!input.value.trim()) return;
  const bubble = document.createElement("p");
  bubble.className = "chat-bubble chat-own";
  bubble.textContent = input.value.trim();
  document.querySelector("#chat-messages")?.append(bubble);
  input.value = "";
  input.focus();
});
