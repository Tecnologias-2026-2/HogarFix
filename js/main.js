import "./components/login.js";
import "./components/registro.js";
import "./components/buscar.js";
import "./components/chat.js";
import "./components/catalogo.js";
import "./components/proveedores.js";
import "./components/solicitud.js";
import "./components/resumen.js";
import "./components/historial.js";
import "./components/panel-proveedor.js";
import "./components/perfil.js";
import { passwordIssues } from "./components/password.js";

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
  if (registerLoginLink)
    registerLoginLink.href = `login.html?tipo=${role === "proveedor" ? "proveedor" : "cliente"}`;
}

const ACCOUNTS_KEY = "hogarfix.accounts.v1";
const SESSION_KEY = "hogarfix.session.v1";
const CLIENT_REQUESTS_KEY = "hogarfix.requests.v1";
const CHAT_THREADS_KEY = "hogarfix.chat-threads.v1";

function getCurrentSession() {
  try {
    return JSON.parse(sessionStorage.getItem(SESSION_KEY) || "null");
  } catch {
    return null;
  }
}
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
  ownerEmail = getCurrentSession()?.email || "cliente-demo",
) {
  const owner = ownerEmail;
  return `${normalizeKey(owner)}::${normalizeKey(providerName)}`;
}
function getProviderName() {
  const session = getCurrentSession();
  return [session?.firstName, session?.lastName].filter(Boolean).join(" ");
}
function getProviderThreadKey(clientName) {
  const providerName = getProviderName();
  const session = getCurrentSession();
  const request = readStoredArray(CLIENT_REQUESTS_KEY).find(
    (item) =>
      normalizeKey(item.clientName) === normalizeKey(clientName) &&
      item.providerEmail === session?.email,
  );
  return getClientThreadKey(
    providerName || "proveedor-demo",
    request?.ownerEmail || normalizeKey(clientName),
  );
}

function getAccounts() {
  try {
    return JSON.parse(localStorage.getItem(ACCOUNTS_KEY) || "[]");
  } catch {
    return [];
  }
}

async function hashPassword(password, salt) {
  if (!globalThis.crypto?.subtle)
    throw new Error("Abre el sitio publicado con HTTPS para usar el acceso de demostración.");
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, [
    "deriveBits",
  ]);
  const saltBytes = Uint8Array.from(atob(salt), (character) => character.charCodeAt(0));
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: saltBytes, iterations: 120000, hash: "SHA-256" },
    key,
    256,
  );
  return btoa(String.fromCharCode(...new Uint8Array(bits)));
}

function createSalt() {
  if (!globalThis.crypto?.getRandomValues)
    throw new Error("Abre el sitio publicado con HTTPS para usar el acceso de demostración.");
  return btoa(String.fromCharCode(...globalThis.crypto.getRandomValues(new Uint8Array(16))));
}

function startDemoSession(account) {
  sessionStorage.setItem(
    SESSION_KEY,
    JSON.stringify({
      firstName: account.firstName,
      lastName: account.lastName,
      email: account.email,
      role: account.role,
    }),
  );
  window.location.replace(account.role === "Proveedor" ? "inicio-proveedor.html" : "app.html");
}

registerForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  registerMessage.textContent = "";

  if (!registerForm.reportValidity()) return;

  const values = new FormData(registerForm);
  const issues = passwordIssues(String(values.get("password")));
  if (issues.length) {
    registerMessage.textContent = `La contraseña necesita: ${issues.join(", ")}.`;
    registerForm.elements.password.focus();
    return;
  }
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
      registerMessage.textContent =
        "Ya existe una cuenta con ese correo en este navegador. Inicia sesión.";
      return;
    }
    const salt = createSalt();
    const account = {
      firstName: String(values.get("firstName")).trim(),
      lastName: String(values.get("lastName")).trim(),
      email,
      role:
        new URLSearchParams(window.location.search).get("tipo") === "proveedor"
          ? "Proveedor"
          : "Cliente",
      salt,
      passwordHash: await hashPassword(String(values.get("password")), salt),
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
  const role =
    new URLSearchParams(location.search).get("tipo") === "proveedor" ? "Proveedor" : "Cliente";
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
    if (
      !account ||
      (await hashPassword(String(values.get("password")), account.salt)) !== account.passwordHash
    ) {
      loginMessage.textContent =
        "Correo o contraseña incorrectos. Si no tienes una cuenta en este navegador, regístrate primero.";
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
  try {
    session = JSON.parse(sessionStorage.getItem(SESSION_KEY) || "null");
  } catch {
    session = null;
  }
  if (!session) window.location.replace("login.html");
  else {
    // Cada rol solo usa sus propias pantallas.
    // (Excepción: el proveedor puede ver su perfil público en perfil-proveedor.html.)
    if (
      session.role === "Proveedor" &&
      document.querySelector("#client-nav") &&
      !location.pathname.endsWith("perfil-proveedor.html")
    )
      window.location.replace("inicio-proveedor.html");
    if (session.role === "Cliente" && document.querySelector("#provider-nav"))
      window.location.replace("app.html");
    if (appName) appName.textContent = `${session.firstName} ${session.lastName}`;
    if (appRole) appRole.textContent = session.role;
    const clientFirstName = document.querySelector("#client-first-name");
    if (clientFirstName) clientFirstName.textContent = session.firstName;
    const providerGreeting = document.querySelector("#provider-greeting");
    if (providerGreeting) providerGreeting.textContent = session.firstName;
  }
}

document.querySelector("#logout-button")?.addEventListener("click", () => {
  sessionStorage.removeItem(SESSION_KEY);
  window.location.replace("index.html");
});

const chatForm = document.querySelector("#chat-form");
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
if (initialClientChat) selectClientChat(initialClientChat);
else {
  const firstClientChat = document.querySelector("[data-client-chat]");
  if (firstClientChat) selectClientChat(firstClientChat);
}

// Las solicitudes del proveedor se gestionan en js/components/panel-proveedor.js
// y su perfil en js/components/perfil.js.
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
if (initialProviderChat) selectProviderChat(initialProviderChat);
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
