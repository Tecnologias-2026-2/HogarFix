// ISSUES #30 y #31. Edición del perfil del cliente (mi-perfil.html) y del proveedor
// (mi-perfil-proveedor.html). Los datos pasan por la capa de servicios: hoy se guardan
// en el navegador por usuario y, con Firebase, irán al documento usuarios/{uid}.
import {
  getPerfil,
  updatePerfil,
  getCategorias,
  getMetodosPago,
  getSolicitudesProveedor,
  providerIdFromEmail,
} from "../services/api.js";
import { escapeHTML } from "../utils.js";

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const PHOTO_SIZE = 320;

// Reduce la foto a 320 px para que pese poco (localStorage hoy, Firebase Storage después).
function resizePhoto(file) {
  return new Promise((resolve, reject) => {
    if (!/^image\/(png|jpeg|webp)$/.test(file.type))
      return reject(new Error("La foto debe ser JPG, PNG o WebP."));
    if (file.size > MAX_UPLOAD_BYTES) return reject(new Error("La foto pesa más de 5 MB."));
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      const scale = Math.min(1, PHOTO_SIZE / Math.max(image.width, image.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(image.width * scale);
      canvas.height = Math.round(image.height * scale);
      canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.85));
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("No se pudo leer la imagen."));
    };
    image.src = url;
  });
}

// Foto e iniciales en el encabezado de todas las páginas con sesión.
function paintHeader(perfil) {
  document.querySelectorAll(".client-avatar").forEach((avatar) => {
    avatar.innerHTML = perfil.photo
      ? `<img src="${escapeHTML(perfil.photo)}" alt="" />`
      : escapeHTML((perfil.firstName || "?").charAt(0).toUpperCase());
  });
  const name = document.querySelector("#app-user-name");
  if (name) name.textContent = `${perfil.firstName} ${perfil.lastName}`;
}

function setupProfileForm(form, role) {
  const fields = form.elements;
  const message = form.querySelector("#profile-message");
  const preview = form.querySelector("[data-photo-preview]");
  const fullName = form.querySelector("[data-profile-fullname]");
  const defaultPhoto = preview.getAttribute("src");
  let saved = null;
  let photo = "";

  const say = (text, ok = false) => {
    message.textContent = text;
    message.classList.toggle("is-success", ok);
  };
  const showPhoto = () => preview.setAttribute("src", photo || defaultPhoto);

  const fill = (perfil) => {
    ["firstName", "lastName", "email", "phone", "city", "address", "bio", "profession", "zone"]
      .filter((name) => fields[name])
      .forEach((name) => (fields[name].value = perfil[name] || ""));
    if (fields.radiusKm) fields.radiusKm.value = perfil.radiusKm || "";
    if (fields.preferredPayment) fields.preferredPayment.value = perfil.preferredPayment || "";
    if (role === "Proveedor") {
      form
        .querySelectorAll('[name="categorias"]')
        .forEach((box) => (box.checked = (perfil.categorias || []).includes(box.value)));
      const days = perfil.days || ["lun", "mar", "mie", "jue", "vie", "sab"];
      form
        .querySelectorAll('[name="days"]')
        .forEach((box) => (box.checked = days.includes(box.value)));
      fields.startTime.value = perfil.startTime || "08:00";
      fields.endTime.value = perfil.endTime || "18:00";
      fields.available.checked = perfil.available !== false;
      const link = document.querySelector("#provider-public-link");
      if (link) {
        link.hidden = !perfil.categorias?.length;
        link.href = `perfil-proveedor.html?id=${encodeURIComponent(providerIdFromEmail(perfil.email))}`;
      }
    }
    photo = perfil.photo || "";
    showPhoto();
    fullName.textContent = `${perfil.firstName} ${perfil.lastName}`;
    form.querySelectorAll("[aria-invalid]").forEach((node) => node.removeAttribute("aria-invalid"));
    form.querySelectorAll(".field-error").forEach((node) => (node.textContent = ""));
  };

  const validate = () => {
    const errors = [];
    const mark = (name, bad) => fields[name]?.setAttribute("aria-invalid", String(bad));
    ["firstName", "lastName"].forEach((name) => {
      const bad = fields[name].value.trim().length < 2;
      mark(name, bad);
      if (bad) errors.push("Escribe tu nombre y apellido.");
    });
    if (fields.phone.value.trim()) {
      const bad = !/^\+?[\d\s-]{7,20}$/.test(fields.phone.value.trim());
      mark("phone", bad);
      if (bad) errors.push("El teléfono solo puede tener números, espacios y guiones.");
    }
    if (role === "Proveedor") {
      if (!fields.phone.value.trim()) {
        mark("phone", true);
        errors.push("El teléfono de contacto es obligatorio para los profesionales.");
      }
      const categorias = form.querySelectorAll('[name="categorias"]:checked').length;
      document.querySelector("#categorias-error").textContent = categorias
        ? ""
        : "Elige al menos una especialidad.";
      if (!categorias) errors.push("Elige al menos una especialidad.");
      const days = form.querySelectorAll('[name="days"]:checked').length;
      const hoursBad = fields.startTime.value >= fields.endTime.value;
      document.querySelector("#horario-error").textContent = !days
        ? "Elige al menos un día de atención."
        : hoursBad
          ? "La hora de inicio debe ser anterior a la hora de fin."
          : "";
      if (!days || hoursBad) errors.push("Revisa tus horarios.");
    }
    return [...new Set(errors)];
  };

  const collect = () => {
    const data = {
      firstName: fields.firstName.value.trim(),
      lastName: fields.lastName.value.trim(),
      phone: fields.phone.value.trim(),
      bio: fields.bio.value.trim(),
      photo,
    };
    if (role === "Cliente") {
      data.city = fields.city.value.trim();
      data.address = fields.address.value.trim();
      data.preferredPayment = fields.preferredPayment.value;
    } else {
      data.profession = fields.profession.value.trim();
      data.zone = fields.zone.value.trim();
      data.radiusKm = fields.radiusKm.value ? Number(fields.radiusKm.value) : "";
      data.categorias = [...form.querySelectorAll('[name="categorias"]:checked')].map(
        (box) => box.value,
      );
      data.days = [...form.querySelectorAll('[name="days"]:checked')].map((box) => box.value);
      data.startTime = fields.startTime.value;
      data.endTime = fields.endTime.value;
      data.available = fields.available.checked;
    }
    return data;
  };

  fields.photoFile.addEventListener("change", async () => {
    const [file] = fields.photoFile.files;
    if (!file) return;
    try {
      photo = await resizePhoto(file);
      showPhoto();
      say("Foto lista. Recuerda guardar los cambios.");
    } catch (error) {
      say(error.message);
    } finally {
      fields.photoFile.value = "";
    }
  });
  form.querySelector("[data-photo-remove]").addEventListener("click", () => {
    photo = "";
    showPhoto();
    say("Foto quitada. Recuerda guardar los cambios.");
  });
  form.querySelector("[data-profile-cancel]").addEventListener("click", () => {
    if (saved) fill(saved);
    say("Se descartaron los cambios.");
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const errors = validate();
    if (errors.length) {
      say(errors.join(" "));
      form.querySelector('[aria-invalid="true"]')?.focus();
      return;
    }
    const button = form.querySelector("[type=submit]");
    button.disabled = true;
    button.textContent = "Guardando…";
    try {
      saved = await updatePerfil(collect());
      fill(saved);
      paintHeader(saved);
      say("Perfil actualizado.", true);
    } catch (error) {
      say(error.message || "No se pudieron guardar los cambios.");
    } finally {
      button.disabled = false;
      button.textContent = "Guardar cambios";
    }
  });

  async function load() {
    try {
      const extras = [];
      if (role === "Proveedor") {
        extras.push(
          getCategorias().then((categorias) => {
            document
              .querySelector("#provider-specialties")
              .insertAdjacentHTML(
                "beforeend",
                categorias
                  .map(
                    (item) =>
                      `<label><input type="checkbox" name="categorias" value="${escapeHTML(item.id)}" /> ${escapeHTML(item.nombre)}</label>`,
                  )
                  .join(""),
              );
            document.querySelector("#provider-specialties > .muted-copy")?.remove();
          }),
          getSolicitudesProveedor()
            .then((items) => {
              const done = items.filter((item) => item.status === "Completada").length;
              document.querySelector("#provider-profile-stats").textContent =
                `${done} ${done === 1 ? "trabajo completado" : "trabajos completados"} · Aún sin reseñas`;
            })
            .catch(() => {}),
        );
      } else {
        extras.push(
          getMetodosPago().then((metodos) =>
            fields.preferredPayment.insertAdjacentHTML(
              "beforeend",
              metodos
                .map(
                  (item) =>
                    `<option value="${escapeHTML(item.id)}">${escapeHTML(item.nombre)}</option>`,
                )
                .join(""),
            ),
          ),
        );
      }
      const [perfil] = await Promise.all([getPerfil(), ...extras]);
      saved = perfil;
      fill(perfil);
      form.removeAttribute("aria-busy");
    } catch (error) {
      say(`${error.message} Recarga la página para intentarlo de nuevo.`);
    }
  }
  load();
}

const clientForm = document.querySelector("#client-profile-form");
const providerForm = document.querySelector("#provider-profile-form");
if (clientForm) setupProfileForm(clientForm, "Cliente");
if (providerForm) setupProfileForm(providerForm, "Proveedor");

// En el resto de páginas con sesión, mostrar la foto guardada en el encabezado.
if (document.querySelector(".client-avatar") && sessionStorage.getItem("hogarfix.session.v1")) {
  getPerfil()
    .then(paintHeader)
    .catch(() => {});
}
