const TYPE_NAMES = {
  string: "string",
  number: "number",
  boolean: "boolean",
  timestamp: "string",
  array: "array",
  referencia: "string"
};

let schemaPromise;

export function readSchema() {
  if (!schemaPromise) {
    schemaPromise = fetch("data/schema.json").then((response) => {
      if (!response.ok) throw new Error(`No se pudo leer el esquema: ${response.status}`);
      return response.json();
    });
  }
  return schemaPromise;
}

const schema = await readSchema().catch((error) => {
  console.error(error);
  return null;
});

export function readForm(form) {
  const formData = new FormData(form);
  const values = {};

  form.querySelectorAll("[name]").forEach((field) => {
    if (!field.name) return;
    if (field.type === "checkbox") {
      const checked = [...form.querySelectorAll(`[name="${CSS.escape(field.name)}"]`)]
        .filter((item) => item.type === "checkbox" && item.checked)
        .map((item) => item.value || item.parentElement?.textContent.trim() || item.name);
      values[field.name] = form.querySelectorAll(`[name="${CSS.escape(field.name)}"]`).length > 1 ? checked : field.checked;
      return;
    }
    if (field.type === "radio" && !field.checked) return;
    if (!(field.name in values)) values[field.name] = formData.get(field.name) ?? "";
  });

  return values;
}

export function validateAgainstSchema(values, schema, entityName) {
  const errors = [];
  const entity = schema?.[entityName];
  if (!entity) return [`No existe la entidad ${entityName} en schema.json.`];

  Object.entries(entity.fields).forEach(([name, definition]) => {
    const value = values[name];
    if (definition.required && (value === undefined || value === null || value === "")) {
      errors.push(`Campo obligatorio faltante: ${name}`);
      return;
    }
    if (value === undefined || value === null || value === "") return;

    const expected = TYPE_NAMES[definition.type];
    const actual = Array.isArray(value) ? "array" : typeof value;
    if (expected && actual !== expected) errors.push(`Tipo inválido para ${name}: se esperaba ${expected}`);
  });

  return errors;
}

export function bindSchemaForm(formId, entityName, options = {}) {
  const form = document.querySelector(`#${formId}`);
  if (!form) return;

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;

    const values = options.transform ? options.transform(readForm(form), form) : readForm(form);
    const errors = [
      ...validateAgainstSchema(values, schema, entityName),
      ...(options.validate?.(values) ?? [])
    ];
    if (errors.length) {
      console.error(`[${entityName}] Datos inválidos`, errors);
      options.onError?.(errors, values);
      return;
    }

    const visibleValues = Object.fromEntries(Object.entries(values).map(([name, value]) => [
      name,
      /password|contraseña/i.test(name) ? "[oculto]" : value
    ]));
    console.table(visibleValues);
    console.log(`[${entityName}] Datos válidos contra schema.json`, visibleValues);
    options.onValid?.(values);
  });
}
