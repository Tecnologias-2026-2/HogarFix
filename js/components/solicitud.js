// ISSUE 11 y #32 (métodos de pago demo). Formulario de solicitud (perfil-proveedor.html).
import {
  getCategorias,
  getMetodosPago,
  createSolicitud,
  USE_REQUESTS_BACKEND,
} from "../services/api.js";
import { readSchema, validateAgainstSchema } from "./form-data.js";
import { escapeHTML, formatCOP, todayISO } from "../utils.js";
import { getAuthState } from "../services/auth.js";

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
  let pendingPayloadSignature = "";
  let pendingIdempotencyKey = "";

  const getIdempotencyKey = (payload) => {
    const signature = JSON.stringify(payload);
    if (signature !== pendingPayloadSignature) {
      if (!globalThis.crypto?.randomUUID) {
        throw new Error("Este navegador no permite generar una clave segura para la solicitud.");
      }
      pendingPayloadSignature = signature;
      pendingIdempotencyKey = globalThis.crypto.randomUUID();
    }
    return pendingIdempotencyKey;
  };

  // Solo se pueden pedir fechas desde hoy y hasta 60 días después.
  fields.date.min = todayISO();
  fields.date.max = todayISO(60);

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
      if (!USE_REQUESTS_BACKEND) {
        data.payment = form.querySelector('[name="payment"]:checked')?.value || "";
      }
      sessionStorage.setItem(draftKey(), JSON.stringify(data));
    } catch {
      // Draft persistence is optional and contains no authentication data.
    }
  };
  const clearDraft = () => {
    try {
      sessionStorage.removeItem(draftKey());
    } catch {
      // Ignore unavailable session storage after a successful submission.
    }
  };

  const updateSummary = () => {
    const categoria = categorias.find((item) => item.id === fields.service.value);
    const metodo = metodos.find(
      (item) => item.id === form.querySelector('[name="payment"]:checked')?.value,
    );
    rateLabel.textContent = categoria
      ? formatCOP(categoria.fixedPriceCOP ?? categoria.tarifa)
      : "—";
    const serviceSummary = document.querySelector("#summary-service");
    const paymentSummary = document.querySelector("#summary-payment");
    if (serviceSummary) serviceSummary.textContent = categoria?.nombre || categoria?.name || "—";
    if (paymentSummary) {
      paymentSummary.textContent = USE_REQUESTS_BACKEND
        ? "No disponible en el backend"
        : metodo?.nombre || "Sin seleccionar";
    }
    if (paymentNote) {
      paymentNote.textContent = USE_REQUESTS_BACKEND
        ? "El backend todavía no procesa pagos; no se enviarán datos de pago."
        : !metodo
          ? "El precio no se puede modificar."
          : metodo.tipo === "contra-entrega"
            ? "Pago informativo al finalizar; no se procesa ningún cobro."
            : "No se hará ningún cobro. La pasarela de pagos aún no está integrada.";
    }
  };

  const ready = async () => {
    if (!categorias.length || (!USE_REQUESTS_BACKEND && !metodos.length) || !proveedor) return;
    const { user, profile, error } = await getAuthState();
    if (error || !user || !profile) {
      message.textContent = "Inicia sesión con una cuenta de cliente para solicitar un servicio.";
      submit.disabled = true;
      return;
    }
    if (profile.role !== "Cliente") {
      form.innerHTML =
        '<p class="empty-state">Esta es la vista que ven los clientes. Solo una cuenta de cliente puede solicitar servicios.</p>';
      return;
    }
    const offeredCategoryIds =
      proveedor.categoryIds || proveedor.categoryIdsByCatalog || proveedor.categorias || proveedor.services;
    if (!Array.isArray(offeredCategoryIds)) {
      message.textContent = "No se pudo verificar el catálogo de servicios de este profesional.";
      return;
    }
    const offered = categorias.filter((item) => offeredCategoryIds.includes(item.id));
    fields.service.innerHTML = offered
      .map(
        (item) =>
          `<option value="${escapeHTML(item.id)}">${escapeHTML(item.nombre || item.name)}</option>`,
      )
      .join("");
    paymentBox.hidden = USE_REQUESTS_BACKEND;
    paymentBox.innerHTML = USE_REQUESTS_BACKEND
      ? ""
      : metodos
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

    const draft = readDraft();
    if (draft) {
      ["service", "date", "time", "address", "detail"].forEach((name) => {
        if (draft[name] && (name !== "service" || offered.some((item) => item.id === draft[name])))
          fields[name].value = draft[name];
      });
    }
    const paymentToSelect = draft?.payment || "";
    const radio = paymentBox.querySelector(`[value="${CSS.escape(paymentToSelect || "")}"]`);
    if (radio) radio.checked = true;
    updateSummary();
    submit.disabled = false;
  };

  document.addEventListener("hogarfix:proveedor", (event) => {
    proveedor = event.detail;
    ready().catch((error) => {
      message.textContent = error.message || "No se pudo validar la sesión.";
    });
  });

  Promise.all([getCategorias(), USE_REQUESTS_BACKEND ? Promise.resolve([]) : getMetodosPago()])
    .then(([items, pagos]) => {
      categorias = items;
      metodos = pagos;
      return ready();
    })
    .catch((error) => {
      fields.service.innerHTML = '<option value="">No disponible</option>';
      paymentBox.innerHTML = "";
      message.textContent = `${error.message} Recarga la página para intentarlo de nuevo.`;
    });

  fields.service.addEventListener("change", () => {
    updateSummary();
    saveDraft();
  });
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
    if (USE_REQUESTS_BACKEND) return true;
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
    };
    if (!USE_REQUESTS_BACKEND) {
      values.metodoPago = form.querySelector('[name="payment"]:checked').value;
    }
    const schema = await readSchema().catch(() => null);
    const schemaErrors = schema ? validateAgainstSchema(values, schema, "solicitudes") : [];
    if (schemaErrors.length) {
      message.textContent = schemaErrors.join(" ");
      return;
    }

    submit.disabled = true;
    submit.textContent = "Enviando solicitud…";
    try {
      const requestValues = {
        providerCatalogId: proveedor?.providerCatalogId,
        categoryId: values.service,
        date: values.date,
        time: values.time,
        address: values.address,
        detail: values.detail,
      };
      const solicitud = await createSolicitud({
        proveedorId: proveedor.id,
        categoriaId: values.service,
        metodoPagoId: values.metodoPago,
        providerCatalogId: requestValues.providerCatalogId,
        categoryId: requestValues.categoryId,
        date: values.date,
        time: values.time,
        address: values.address,
        detail: values.detail,
        idempotencyKey:
          USE_REQUESTS_BACKEND && requestValues.providerCatalogId
            ? getIdempotencyKey(requestValues)
            : undefined,
      });
      clearDraft();
      pendingPayloadSignature = "";
      pendingIdempotencyKey = "";
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
