// Utilidades compartidas por los módulos de pantalla.
export { getCurrentProfile } from "./services/auth.js";

export function escapeHTML(value) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character],
  );
}

export function formatCOP(value) {
  return `$${Number(value || 0).toLocaleString("es-CO")}`;
}

// "2026-11-12" -> "12 nov 2026" (sin desfase de zona horaria).
export function formatDate(isoDate) {
  const [year, month, day] = String(isoDate || "")
    .split("-")
    .map(Number);
  if (!year || !month || !day) return isoDate || "";
  return new Date(year, month - 1, day).toLocaleDateString("es-CO", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// "13:00" -> "1:00 p. m." (la API guarda la hora en 24 h; la pantalla la muestra en 12 h).
export function formatTime(value) {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(String(value || ""));
  if (!match) return value || "";
  const hour = Number(match[1]);
  return `${hour % 12 || 12}:${match[2]} ${hour < 12 ? "a. m." : "p. m."}`;
}

export function formatDateTime(iso) {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" });
}

export function todayISO(offsetDays = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  const pad = (number) => String(number).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function statusClass(status = "") {
  return `status-${String(status)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replaceAll(" ", "-")}`;
}

export function stars(rating) {
  const full = Math.round(Number(rating) || 0);
  return "★".repeat(full) + "☆".repeat(Math.max(0, 5 - full));
}

// Estados de carga y error reutilizables.
export function showLoading(target, text = "Cargando…") {
  target.setAttribute("aria-busy", "true");
  target.innerHTML = `<p class="load-state" role="status"><span class="spinner" aria-hidden="true"></span>${escapeHTML(text)}</p>`;
}

export function showError(target, message, onRetry) {
  target.removeAttribute("aria-busy");
  target.innerHTML = `<div class="error-state" role="alert"><p>${escapeHTML(message)}</p>${
    onRetry ? '<button class="button button-small" type="button">Reintentar</button>' : ""
  }</div>`;
  target.querySelector(".error-state button")?.addEventListener("click", onRetry);
}

export function doneLoading(target) {
  target.removeAttribute("aria-busy");
}
