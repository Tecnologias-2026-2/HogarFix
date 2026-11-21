import { getAuthState, getCurrentProfile } from "../services/auth.js";
import {
  getMyProfile,
  getProviderEligibility,
  getProviderProfile,
  updateMyProfile,
  updateProviderProfile,
} from "../services/api.js";

const personalForm = document.querySelector("#provider-personal-form");
const professionalForm = document.querySelector("#provider-profile-form");

function setMessage(target, message, isError = false) {
  if (!target) return;
  target.textContent = message;
  target.classList.toggle("error-copy", isError);
}

function setBusy(form, busy) {
  const button = form?.querySelector('[type="submit"]');
  if (button) button.disabled = busy;
  form?.setAttribute("aria-busy", String(busy));
}

function fillPersonalForm(form, profile) {
  if (!form || !profile) return;
  ["firstName", "lastName", "phone"].forEach((field) => {
    if (form.elements[field]) form.elements[field].value = profile[field] || "";
  });
  const email = document.querySelector("#provider-profile-email");
  if (email) email.value = profile.email || "";
}

function renderProviderStatus(profile) {
  const validation = document.querySelector("#provider-validation-status");
  const approval = document.querySelector("#provider-approval-status");
  if (validation) {
    validation.textContent =
      profile.automaticValidation?.status === "passed"
        ? "Validación automática: completada."
        : "Validación automática: pendiente.";
  }
  if (approval) {
    const labels = {
      pending: "Pendiente de revisión administrativa.",
      approved: "Aprobado por HogarFix.",
      rejected: "Requiere ajustes antes de una nueva revisión.",
    };
    approval.textContent =
      labels[profile.adminApproval?.status] || "Pendiente de revisión administrativa.";
  }
}

function renderEligibility(eligibility) {
  const target = document.querySelector("#provider-eligibility-status");
  if (!target) return;
  target.classList.remove("error-copy");
  target.textContent = eligibility.eligible
    ? "Tu cuenta está habilitada para ofrecer servicios."
    : `Aún no puedes ofrecer ni recibir solicitudes. ${eligibility.reasons.join(" ")}`;
}

function renderEligibilityError(error) {
  const target = document.querySelector("#provider-eligibility-status");
  if (!target) return;
  target.classList.add("error-copy");
  target.textContent =
    error.message || "No se pudo verificar si la cuenta está habilitada para ofrecer servicios.";
}

function getProfessionalSaveMessage(profile) {
  if (profile.automaticValidation?.status !== "passed") {
    return "Perfil guardado. Completa los campos pendientes para la validación automática.";
  }
  if (profile.adminApproval?.status === "approved") {
    return "Perfil guardado. La aprobación administrativa está vigente.";
  }
  if (profile.adminApproval?.status === "rejected") {
    return "Perfil guardado. El perfil requiere ajustes antes de una nueva revisión.";
  }
  return "Perfil guardado. La aprobación administrativa todavía está pendiente.";
}

function fillProfessionalForm(form, profile) {
  if (!form || !profile) return;
  ["bio", "experienceYears", "coverageZone", "availability"].forEach((field) => {
    if (form.elements[field]) form.elements[field].value = profile[field] ?? "";
  });
  const selectedServices = new Set(profile.services || []);
  form.querySelectorAll('[name="services"]').forEach((checkbox) => {
    checkbox.checked = selectedServices.has(checkbox.value);
  });
  renderProviderStatus(profile);
}

async function loadProfileForms() {
  if (!personalForm && !professionalForm) return;
  const state = await getAuthState();
  fillPersonalForm(personalForm, state.profile || getCurrentProfile());
  if (!professionalForm) return;

  setBusy(personalForm, true);
  setBusy(professionalForm, true);
  try {
    const [personalResult, providerResult] = await Promise.all([
      getMyProfile(),
      getProviderProfile(),
    ]);
    fillPersonalForm(personalForm, personalResult.profile);
    fillProfessionalForm(professionalForm, providerResult.profile);
    setMessage(
      document.querySelector("#provider-profile-message"),
      "Perfil cargado desde HogarFix.",
    );
    try {
      const eligibilityResult = await getProviderEligibility();
      renderEligibility(eligibilityResult.eligibility);
    } catch (error) {
      renderEligibilityError(error);
    }
  } catch (error) {
    setMessage(
      document.querySelector("#provider-profile-message"),
      error.message || "No se pudo cargar el perfil. Inténtalo de nuevo.",
      true,
    );
  } finally {
    setBusy(personalForm, false);
    setBusy(professionalForm, false);
  }
}

personalForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!personalForm.reportValidity()) return;
  setBusy(personalForm, true);
  setMessage(document.querySelector("#provider-personal-message"), "Guardando datos personales…");
  try {
    const values = Object.fromEntries(new FormData(personalForm));
    const result = await updateMyProfile(values);
    fillPersonalForm(personalForm, result.profile);
    const fullName = [result.profile.firstName, result.profile.lastName].filter(Boolean).join(" ");
    const name = document.querySelector("#provider-profile-name");
    const headerName = document.querySelector("#app-user-name");
    const greeting = document.querySelector("#provider-greeting");
    const avatar = document.querySelector("#provider-avatar-initial");
    if (name) name.textContent = fullName;
    if (headerName) headerName.textContent = fullName;
    if (greeting) greeting.textContent = result.profile.firstName;
    if (avatar) {
      const avatarName = String(result.profile.firstName || result.profile.lastName || "");
      avatar.textContent = Array.from(avatarName)[0]?.toLocaleUpperCase("es") || "";
    }
    setMessage(
      document.querySelector("#provider-personal-message"),
      "Tus datos personales se guardaron correctamente.",
    );
  } catch (error) {
    setMessage(
      document.querySelector("#provider-personal-message"),
      error.message || "No se pudieron guardar tus datos personales.",
      true,
    );
  } finally {
    setBusy(personalForm, false);
  }
});

professionalForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!professionalForm.reportValidity()) return;
  setBusy(professionalForm, true);
  setMessage(document.querySelector("#provider-profile-message"), "Guardando perfil profesional…");
  try {
    const formData = new FormData(professionalForm);
    const values = {
      bio: formData.get("bio"),
      experienceYears: formData.get("experienceYears")
        ? Number(formData.get("experienceYears"))
        : null,
      coverageZone: formData.get("coverageZone"),
      availability: formData.get("availability"),
      services: formData.getAll("services"),
    };
    const result = await updateProviderProfile(values);
    fillProfessionalForm(professionalForm, result.profile);
    setMessage(
      document.querySelector("#provider-profile-message"),
      getProfessionalSaveMessage(result.profile),
    );
    try {
      const eligibility = await getProviderEligibility();
      renderEligibility(eligibility.eligibility);
    } catch (error) {
      renderEligibilityError(error);
      setMessage(
        document.querySelector("#provider-profile-message"),
        "El perfil se guardó, pero no se pudo actualizar su estado de elegibilidad.",
        true,
      );
    }
  } catch (error) {
    setMessage(
      document.querySelector("#provider-profile-message"),
      error.message || "No se pudo guardar el perfil profesional.",
      true,
    );
  } finally {
    setBusy(professionalForm, false);
  }
});

loadProfileForms().catch((error) => {
  console.error("No se pudo inicializar la gestión del perfil profesional:", error);
});
