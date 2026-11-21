import "dotenv/config";
import app from "./app.js";

const port = Number(process.env.PORT ?? 3000);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("PORT debe ser un número entero entre 1 y 65535.");
}

const server = app.listen(port, () => {
  console.log(`Servidor de HogarFix funcionando en el puerto ${port}.`);
});

server.on("error", (error) => {
  console.error("No se pudo iniciar el servidor de HogarFix:", error);
  process.exitCode = 1;
});
