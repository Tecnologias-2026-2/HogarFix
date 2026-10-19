const menuButton = document.querySelector(".menu-toggle");
const navigation = document.querySelector("#primary-nav");

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
