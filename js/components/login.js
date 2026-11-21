import {
  getAuthErrorMessage,
  getAuthState,
  requestPasswordReset,
  signInUser,
} from "../services/auth.js";

const form = document.querySelector("#login-form");
const message = document.querySelector("#login-message");
const loginPanel = document.querySelector("#login-panel");
const recoveryPanel = document.querySelector("#password-recovery-panel");
const recoveryForm = document.querySelector("#password-recovery-form");
const recoveryMessage = document.querySelector("#password-recovery-message");
const showRecoveryLink = document.querySelector("#show-recovery-link");
const backToLoginLink = document.querySelector("#back-to-login-link");

const profileError = new URLSearchParams(location.search).get("error") === "profile";
if (profileError) {
  message.textContent =
    "No se pudo validar tu perfil. Vuelve a iniciar sesión cuando la conexión esté disponible.";
}

showRecoveryLink?.addEventListener("click", (event) => {
  event.preventDefault();
  const loginEmail = form?.elements.email;
  const recoveryEmail = recoveryForm?.elements.email;
  if (loginEmail?.value && recoveryEmail) recoveryEmail.value = loginEmail.value.trim();
  if (recoveryMessage) recoveryMessage.textContent = "";
  if (loginPanel) loginPanel.hidden = true;
  if (recoveryPanel) recoveryPanel.hidden = false;
  recoveryEmail?.focus();
});

backToLoginLink?.addEventListener("click", (event) => {
  event.preventDefault();
  if (recoveryMessage) recoveryMessage.textContent = "";
  if (recoveryPanel) recoveryPanel.hidden = true;
  if (loginPanel) loginPanel.hidden = false;
  showRecoveryLink?.focus();
});

form?.addEventListener("submit", async (event) => {
  event.preventDefault();
  message.textContent = "";
  if (!form.reportValidity()) return;

  const submitButton = form.querySelector('[type="submit"]');
  submitButton.disabled = true;
  message.textContent = "Verificando…";

  try {
    const values = new FormData(form);
    const { user } = await signInUser(
      String(values.get("email") || ""),
      String(values.get("password") || ""),
    );
    const state = await getAuthState();
    if (state.user?.uid !== user.uid || state.profile?.uid !== user.uid || state.error) {
      const error = new Error("La sesión y el perfil todavía no están disponibles.");
      error.code = "profile/not-ready";
      throw error;
    }
    const role = state.profile.role;
    location.replace(role === "Proveedor" ? "inicio-proveedor.html" : "app.html");
  } catch (error) {
    console.error("Error durante el inicio de sesión:", error);
    message.textContent = getAuthErrorMessage(error, "login");
    submitButton.disabled = false;
  }
});

recoveryForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!recoveryMessage) return;
  recoveryMessage.textContent = "";
  if (!recoveryForm.reportValidity()) return;

  const values = new FormData(recoveryForm);
  const email = String(values.get("email") || "");
  const submitButton = recoveryForm.querySelector('[type="submit"]');
  submitButton.disabled = true;
  recoveryMessage.textContent = "Enviando instrucciones…";

  try {
    await requestPasswordReset(email);
    recoveryMessage.textContent =
      "Si existe una cuenta con ese correo, recibirás instrucciones para restablecer la contraseña";
  } catch (error) {
    if (error?.code === "auth/user-not-found" || error?.code === "auth/user-disabled") {
      recoveryMessage.textContent =
        "Si existe una cuenta con ese correo, recibirás instrucciones para restablecer la contraseña";
    } else {
      console.error("Error al solicitar la recuperación de contraseña:", error);
      recoveryMessage.textContent = getAuthErrorMessage(error, "password-reset");
    }
  } finally {
    submitButton.disabled = false;
  }
});
