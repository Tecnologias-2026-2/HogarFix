// ISSUE 11 y #32 (métodos de pago). Formulario de solicitud de servicios (perfil-proveedor.html).
import { getCategorias, getMetodosPago, getPerfil, createSolicitud } from "../services/api.js";
import { readSchema, validateAgainstSchema } from "./form-data.js";
import { escapeHTML, formatCOP, getSession, todayISO } from "../utils.js";

const form = document.querySelector("#booking-form");
const DRAFT_KEY = "hogarfix.booking-draft.v1";

if (form) {
  const fields = form.elements;
  const submit = form.querySelector("[type=submit]");
  const message = document.querySelector("#booking-message");
  const rateLabel = document.querySelector("#booking-rate");
  const paymentBox = document.querySelector("#payment-options");
  const paymentNote = document.querySelector("#payment-note");
  let categorias = [];
  let metodos = [];
  let proveedor = null;
  let preferredPayment = "";

  // Solo se pueden pedir fechas desde hoy y hasta 60 días después.
  fields.date.min = todayISO();
  fields.date.max = todayISO(60);

  /* ---------- Borrador: la selección se conserva si recargas o vuelves a la página ---------- */

  const draftKey = () => `${DRAFT_KEY}:${proveedor?.id || ""}`;
  const readDraft = () => {
    try {
      return JSON.parse(sessionStorage.getItem(draftKey()) || "null");
    } catch {
      return null;
    }
  };
  const saveDraft = () => {
    if (!proveedor) return;
    try {
      const data = Object.fromEntries(
        ["service", "date", "time", "address", "detail"].map((name) => [name, fields[name].value]),
      );
      data.payment = form.querySelector('[name="payment"]:checked')?.value || "";
      sessionStorage.setItem(draftKey(), JSON.stringify(data));
    } catch {
      /* El borrador es solo una comodidad. */
    }
  };
  const clearDraft = () => {
    try {
      sessionStorage.removeItem(draftKey());
    } catch {
      /* Nada que limpiar. */
    }
  };

  /* ---------- Resumen antes de enviar ---------- */

  const updateSummary = () => {
    const categoria = categorias.find((item) => item.id === fields.service.value);
    const metodo = metodos.find(
      (item) => item.id === form.querySelector('[name="payment"]:checked')?.value,
    );
    rateLabel.textContent = categoria ? formatCOP(categoria.tarifa) : "—";
    document.querySelector("#summary-service").textContent = categoria?.nombre || "—";
    document.querySelector("#summary-payment").textContent = metodo?.nombre || "Sin seleccionar";
    paymentNote.textContent = !metodo
      ? "El precio no se puede modificar."
      : metodo.tipo === "contra-entrega"
        ? "Pagarás en efectivo al profesional cuando termine el servicio. El precio no se puede modificar."
        : "No se hará ningún cobro ahora. El pago en línea se habilitará cuando HogarFix integre la pasarela de pagos.";
  };

  const ready = () => {
    if (!categorias.length || !metodos.length || !proveedor) return;
    const session = getSession();
    if (session?.role === "Proveedor") {
      form.innerHTML =
        '<p class="empty-state">Esta es la vista que ven los clientes. Solo una cuenta de cliente puede solicitar servicios.</p>';
      return;
    }
    // Las opciones salen del catálogo y se limitan a lo que ofrece el profesional.
    const offered = categorias.filter((item) => proveedor.categorias.includes(item.id));
    fields.service.innerHTML = offered
      .map((item) => `<option value="${escapeHTML(item.id)}">${escapeHTML(item.nombre)}</option>`)
      .join("");
    paymentBox.innerHTML = metodos
      .map(
        (item) => `
        <label class="payment-option">
          <input type="radio" name="payment" value="${escapeHTML(item.id)}" />
          <span class="payment-icon" aria-hidden="true">${escapeHTML(item.icono)}</span>
          <span><strong>${escapeHTML(item.nombre)}</strong><small>${escapeHTML(item.descripcion)}</small></span>
          <span class="payment-badge">${item.tipo === "contra-entrega" ? "Al terminar" : "En línea"}</span>
        </label>`,
      )
      .join("");
    paymentBox.querySelectorAll('[name="payment"]').forEach((radio) =>
      radio.addEventListener("change", () => {
        document.querySelector("#payment-error").textContent = "";
        updateSummary();
        saveDraft();
      }),
    );

    // Restaurar borrador o, si no hay, el método preferido del perfil.
    const draft = readDraft();
    if (draft) {
      ["service", "date", "time", "address", "detail"].forEach((name) => {
        if (draft[name] && (name !== "service" || offered.some((item) => item.id === draft[name])))
          fields[name].value = draft[name];
      });
    }
    const paymentToSelect = draft?.payment || preferredPayment;
    const radio = paymentBox.querySelector(`[value="${CSS.escape(paymentToSelect || "")}"]`);
    if (radio) radio.checked = true;
    updateSummary();
    submit.disabled = false;
  };

  document.addEventListener("hogarfix:proveedor", (event) => {
    proveedor = event.detail;
    ready();
  });

  Promise.all([
    getCategorias(),
    getMetodosPago(),
    getPerfil()
      .then((perfil) => perfil)
      .catch(() => ({})),
  ])
    .then(([items, pagos, perfil]) => {
      categorias = items;
      metodos = pagos;
      preferredPayment = perfil.preferredPayment || "";
      if (!fields.address.value && perfil.address) fields.address.value = perfil.address;
      ready();
    })
    .catch((error) => {
      fields.service.innerHTML = '<option value="">No disponible</option>';
      paymentBox.innerHTML = "";
      message.textContent = `${error.message} Recarga la página para intentarlo de nuevo.`;
    });

  fields.service.addEventListener("change", updateSummary);
  form.addEventListener("input", saveDraft);

  // Los horarios de la tarjeta "Horarios disponibles" controlan el campo Hora.
  document.querySelectorAll('[name="time-choice"]').forEach((radio) =>
    radio.addEventListener("change", () => {
      fields.time.value = radio.value;
      saveDraft();
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

  const validatePayment = () => {
    const ok = Boolean(form.querySelector('[name="payment"]:checked'));
    document.querySelector("#payment-error").textContent = ok
      ? ""
      : "Selecciona cómo vas a pagar el servicio.";
    return ok;
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
    const paymentOk = validatePayment();
    if (invalid.length || !paymentOk) {
      (invalid.length ? fields[invalid[0]] : paymentBox.querySelector('[name="payment"]'))?.focus();
      message.textContent = "Revisa los campos marcados.";
      return;
    }

    const values = {
      service: fields.service.value,
      date: fields.date.value,
      time: fields.time.value,
      address: fields.address.value.trim(),
      detail: fields.detail.value.trim(),
      metodoPago: form.querySelector('[name="payment"]:checked').value,
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
        metodoPagoId: values.metodoPago,
        date: values.date,
        time: values.time,
        address: values.address,
        detail: values.detail,
      });
      clearDraft();
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
