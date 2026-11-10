import { bindSchemaForm } from "./form-data.js";

bindSchemaForm("register-form", "usuarios", {
  transform: (values) => ({ ...values, terms: Boolean(values.terms) }),
  validate: (values) => values.password === values.confirmPassword ? [] : ["password y confirmPassword deben coincidir."]
});
