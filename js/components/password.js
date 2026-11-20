// ISSUE #32. Visualización y validación de contraseñas (registro e inicio de sesión).

export const PASSWORD_RULES = [
  { id: "length", text: "Mínimo 8 caracteres", test: (value) => value.length >= 8 },
  { id: "upper", text: "Una letra mayúscula", test: (value) => /\p{Lu}/u.test(value) },
  { id: "lower", text: "Una letra minúscula", test: (value) => /\p{Ll}/u.test(value) },
  { id: "number", text: "Un número", test: (value) => /\d/.test(value) },
  {
    id: "special",
    text: "Un carácter especial (!@#$%…)",
    test: (value) => /[^\p{L}\d\s]/u.test(value),
  },
];

// Devuelve en minúsculas los requisitos que faltan; vacío si la contraseña es válida.
export function passwordIssues(value = "") {
  return PASSWORD_RULES.filter((rule) => !rule.test(value)).map((rule) => rule.text.toLowerCase());
}

const EYE = `<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2" d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="2"/></svg>`;
const EYE_OFF = `<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2" d="M3 3l18 18M10.6 5.1A10.8 10.8 0 0 1 12 5c6.4 0 10 7 10 7a17.6 17.6 0 0 1-3.2 4.2M6.6 6.6C3.7 8.4 2 12 2 12s3.6 7 10 7a9.7 9.7 0 0 0 5.4-1.6M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>`;

// Botón de ojo: cambia solo el tipo del campo, así el texto escrito se conserva.
function addToggle(input) {
  if (input.parentElement.classList.contains("password-field")) return;
  const wrapper = document.createElement("span");
  wrapper.className = "password-field";
  input.replaceWith(wrapper);
  wrapper.append(input);
  const button = document.createElement("button");
  button.type = "button";
  button.className = "password-toggle";
  button.setAttribute("aria-label", "Mostrar contraseña");
  button.setAttribute("aria-pressed", "false");
  button.innerHTML = EYE;
  button.addEventListener("click", () => {
    const show = input.type === "password";
    input.type = show ? "text" : "password";
    button.innerHTML = show ? EYE_OFF : EYE;
    button.setAttribute("aria-label", show ? "Ocultar contraseña" : "Mostrar contraseña");
    button.setAttribute("aria-pressed", String(show));
    input.focus();
  });
  wrapper.append(button);
}

document.querySelectorAll('input[type="password"]').forEach(addToggle);

const registerForm = document.querySelector("#register-form");
if (registerForm) {
  const password = registerForm.elements.password;
  const confirm = registerForm.elements.confirmPassword;
  const submit = registerForm.querySelector("[type=submit]");

  const checklist = document.createElement("ul");
  checklist.className = "password-rules";
  checklist.id = "password-rules";
  checklist.setAttribute("aria-label", "Requisitos de la contraseña");
  checklist.innerHTML = PASSWORD_RULES.map(
    (rule) => `<li data-rule="${rule.id}">${rule.text}</li>`,
  ).join("");
  const match = document.createElement("p");
  match.className = "password-match";
  match.setAttribute("aria-live", "polite");
  password.closest(".form-row").after(checklist, match);
  password.setAttribute("aria-describedby", "password-rules");

  const update = () => {
    const value = password.value;
    PASSWORD_RULES.forEach((rule) => {
      const ok = rule.test(value);
      const item = checklist.querySelector(`[data-rule="${rule.id}"]`);
      item.classList.toggle("is-ok", ok);
      item.setAttribute("aria-label", `${rule.text}: ${ok ? "cumplido" : "pendiente"}`);
    });
    const valid = passwordIssues(value).length === 0;
    password.setAttribute("aria-invalid", String(Boolean(value) && !valid));
    if (!confirm.value) {
      match.textContent = "";
      match.className = "password-match";
    } else if (confirm.value === value) {
      match.textContent = "✓ Las contraseñas coinciden";
      match.className = "password-match is-ok";
    } else {
      match.textContent = "Las contraseñas no coinciden";
      match.className = "password-match is-error";
    }
    confirm.setAttribute("aria-invalid", String(Boolean(confirm.value) && confirm.value !== value));
    // No se puede continuar hasta que la contraseña sea válida y coincida.
    submit.disabled = !(valid && confirm.value === value);
  };

  password.addEventListener("input", update);
  confirm.addEventListener("input", update);
  update();
}
