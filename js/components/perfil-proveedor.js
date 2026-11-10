import { bindSchemaForm } from "./form-data.js";

bindSchemaForm("provider-profile-form", "proveedores", {
  transform: (values) => ({ ...values, rate: Number(values.rate || 0) })
});
