import { getAuthState, getCurrentProfile } from "../services/auth.js";
import { getMyProfile, updateMyProfile } from "../services/api.js";

const form = document.querySelector("#client-personal-form");
const message = document.querySelector("#client-profile-message");

function setMessage(text, isError = false) {
  if (!message) return;
  message.textContent = text;
  message.classList.toggle("error-copy", isError);
}

function fillForm(profile) {
  if (!form || !profile) return;
  ["firstName", "lastName", "phone"].forEach((field) => {
    if (form.elements[field]) form.elements[field].value = profile[field] || "";
  });
  const email = document.querySelector("#client-profile-email");
  if (email) email.value = profile.email || "";
}

function setBusy(busy) {
  const button = form?.querySelector('[type="submit"]');
  if (button) button.disabled = busy;
  form?.setAttribute("aria-busy", String(busy));
}

async function loadProfile() {
  if (!form) return;
  const state = await getAuthState();
  fillForm(state.profile || getCurrentProfile());
  setBusy(true);
  try {
    const result = await getMyProfile();
    fillForm(result.profile);
    setMessage("Perfil cargado desde HogarFix.");
  } catch (error) {
    setMessage(error.message || "No se pudo cargar el perfil. Inténtalo de nuevo.", true);
  } finally {
    setBusy(false);
  }
}

form?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!form.reportValidity()) return;
  setBusy(true);
  setMessage("Guardando datos personales…");
  try {
    const result = await updateMyProfile(Object.fromEntries(new FormData(form)));
    fillForm(result.profile);
    const fullName = [result.profile.firstName, result.profile.lastName].filter(Boolean).join(" ");
    const headerName = document.querySelector("#app-user-name");
    if (headerName) headerName.textContent = fullName;
    setMessage("Tus datos personales se guardaron correctamente.");
  } catch (error) {
    setMessage(error.message || "No se pudieron guardar tus datos personales.", true);
  } finally {
    setBusy(false);
  }
});

loadProfile().catch((error) => {
  console.error("No se pudo inicializar la gestión del perfil de cliente:", error);
});