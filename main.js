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

document.querySelector("#year").textContent = new Date().getFullYear();

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

registerForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  registerMessage.textContent = "";

  if (!registerForm.reportValidity()) return;

  const values = new FormData(registerForm);
  if (values.get("password") !== values.get("confirmPassword")) {
    registerMessage.textContent = "Las contraseñas no coinciden.";
    registerForm.elements.confirmPassword.focus();
    return;
  }

  registerMessage.textContent = "El formulario está completo. Para crear la cuenta y guardar tus datos, HogarFix debe conectarse a un servicio de registro.";
});
