// ISSUE 11. Formulario de solicitud de servicios (perfil-proveedor.html).
import { getCategorias, createSolicitud } from "../services/api.js";
import { readSchema, validateAgainstSchema } from "./form-data.js";
import { formatCOP, todayISO } from "../utils.js";

const form = document.querySelector("#booking-form");

if (form) {
  const fields = form.elements;
  const submit = form.querySelector("[type=submit]");
  const message = document.querySelector("#booking-message");
  const rateLabel = document.querySelector("#booking-rate");
  let categorias = [];
  let proveedor = null;

  // Solo se pueden pedir fechas desde hoy y hasta 60 días después.
  fields.date.min = todayISO();
  fields.date.max = todayISO(60);

  const showRate = () => {
    const categoria = categorias.find((item) => item.id === fields.service.value);
    rateLabel.textContent = categoria ? formatCOP(categoria.tarifa) : "—";
  };

  // Las opciones salen del catálogo y se limitan a lo que ofrece el profesional.
  const fillServices = () => {
    if (!categorias.length || !proveedor) return;
    const offered = categorias.filter((item) => proveedor.categorias.includes(item.id));
    fields.service.innerHTML = offered
      .map((item) => `<option value="${item.id}">${item.nombre}</option>`)
      .join("");
    showRate();
    submit.disabled = false;
  };

  document.addEventListener("hogarfix:proveedor", (event) => {
    proveedor = event.detail;
    fillServices();
  });

  getCategorias()
    .then((items) => {
      categorias = items;
      fillServices();
    })
    .catch((error) => {
      fields.service.innerHTML = '<option value="">No disponible</option>';
      message.textContent = `${error.message} Recarga la página para intentarlo de nuevo.`;
    });

  fields.service.addEventListener("change", showRate);

  // Los horarios de la tarjeta "Horarios disponibles" controlan el campo Hora.
  document.querySelectorAll('[name="time-choice"]').forEach((radio) =>
    radio.addEventListener("change", () => {
      fields.time.value = radio.value;
    }),
  );
  fields.time.addEventListener("change", () => {
    const radio = document.querySelector(`[name="time-choice"][value="${fields.time.value}"]`);
    if (radio) radio.checked = true;
  });

  const rules = {
    service: (value) => (value ? "" : "Selecciona la categoría del servicio."),
    date: (value) => {
      if (!value) return "Elige la fecha del servicio.";
      if (value < fields.date.min) return "La fecha no puede ser anterior a hoy.";
      if (value > fields.date.max) return "Solo puedes agendar con hasta 60 días de anticipación.";
      return "";
    },
    time: (value) => (value ? "" : "Elige una hora."),
    address: (value) =>
      value.trim().length >= 8 ? "" : "Escribe la dirección completa (mínimo 8 caracteres).",
    detail: (value) =>
      value.trim().length >= 15 ? "" : "Describe el trabajo con al menos 15 caracteres.",
  };

  const validateField = (name) => {
    const error = rules[name](fields[name].value);
    fields[name].setAttribute("aria-invalid", String(Boolean(error)));
    document.querySelector(`#${name}-error`).textContent = error;
    return !error;
  };

  Object.keys(rules).forEach((name) => {
    fields[name].addEventListener("blur", () => validateField(name));
    fields[name].addEventListener("input", () => {
      if (fields[name].getAttribute("aria-invalid") === "true") validateField(name);
    });
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    message.textContent = "";
    message.classList.remove("is-success");
    const invalid = Object.keys(rules).filter((name) => !validateField(name));
    if (invalid.length) {
      fields[invalid[0]].focus();
      message.textContent = "Revisa los campos marcados.";
      return;
    }

    const values = {
      service: fields.service.value,
      date: fields.date.value,
      time: fields.time.value,
      address: fields.address.value.trim(),
      detail: fields.detail.value.trim(),
    };
    const schema = await readSchema().catch(() => null);
    const schemaErrors = schema ? validateAgainstSchema(values, schema, "solicitudes") : [];
    if (schemaErrors.length) {
      message.textContent = schemaErrors.join(" ");
      return;
    }

    submit.disabled = true;
    submit.textContent = "Enviando solicitud…";
    try {
      const solicitud = await createSolicitud({
        proveedorId: proveedor.id,
        categoriaId: values.service,
        date: values.date,
        time: values.time,
        address: values.address,
        detail: values.detail,
      });
      message.classList.add("is-success");
      message.textContent = "¡Solicitud enviada! Abriendo el resumen…";
      location.href = `reserva.html?id=${encodeURIComponent(solicitud.id)}`;
    } catch (error) {
      message.textContent = error.message || "No se pudo enviar la solicitud.";
      submit.disabled = false;
      submit.textContent = "Solicitar servicio";
    }
  });
}
