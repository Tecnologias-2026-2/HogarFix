// URL base del backend de HogarFix (Node.js + Express).
// - Vacía: modo demostración. Los datos salen de data/data.js y las solicitudes
//   se guardan en el localStorage del navegador.
// - Con valor (por ejemplo "http://localhost:3000/api"): el frontend consume la API real.
export const API_BASE_URL = "";

// Milisegundos de espera simulada en modo demostración, para ver los estados de carga.
export const DEMO_LATENCY_MS = 300;
