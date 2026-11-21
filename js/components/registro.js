import { getAuthErrorMessage, getAuthState, registerUser } from "../services/auth.js";

const form = document.querySelector("#register-form");
const message = document.querySelector("#register-message");

form?.addEventListener("submit", async (event) => {
  event.preventDefault();
  message.textContent = "";
  if (!form.reportValidity()) return;

  const values = new FormData(form);
  const firstName = String(values.get("firstName") || "").trim();
  const lastName = String(values.get("lastName") || "").trim();
  if (!firstName || !lastName) {
    message.textContent = "Escribe tu nombre y apellido.";
    return;
  }
  if (values.get("password") !== values.get("confirmPassword")) {
    message.textContent = "Las contraseñas no coinciden.";
    form.elements.confirmPassword.focus();
    return;
  }

  const submitButton = form.querySelector('[type="submit"]');
  submitButton.disabled = true;
  message.textContent = "Creando tu cuenta…";

  try {
    const requestedRole =
      new URLSearchParams(location.search).get("tipo") === "proveedor" ? "Proveedor" : "Cliente";
    const { user } = await registerUser({
      email: String(values.get("email") || ""),
      password: String(values.get("password") || ""),
      firstName,
      lastName,
      role: requestedRole,
    });
    const state = await getAuthState();
    if (state.user?.uid !== user.uid || state.profile?.uid !== user.uid || state.error) {
      const error = new Error("La sesión y el perfil todavía no están disponibles.");
      error.code = "profile/not-ready";
      throw error;
    }
    const role = state.profile.role;
    location.replace(role === "Proveedor" ? "inicio-proveedor.html" : "app.html");
  } catch (error) {
    console.error("Error durante el registro:", error);
    message.textContent = getAuthErrorMessage(error, "register");
    submitButton.disabled = false;
  }
});
