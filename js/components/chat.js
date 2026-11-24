import { bindSchemaForm } from "./form-data.js";

import { USE_REQUESTS_BACKEND } from "../services/api.js";

// En modo demostración valida el formulario contra schema.json; con backend el envío lo hace mensajes.js.
if (!USE_REQUESTS_BACKEND) {
  bindSchemaForm("chat-form", "mensajes");
  bindSchemaForm("provider-chat-form", "mensajes");
}
