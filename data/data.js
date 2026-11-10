export const usuarios = [
  { firstName: "Laura", lastName: "Bojacá", email: "laura@example.com", password: "********", confirmPassword: "********", terms: true },
  { firstName: "Juan", lastName: "Gutiérrez", email: "juan@example.com", password: "********", confirmPassword: "********", terms: true },
  { firstName: "María", lastName: "López", email: "maria@example.com", password: "********", confirmPassword: "********", terms: true }
];

export const sesiones = [
  { email: "laura@example.com", password: "********" },
  { email: "juan@example.com", password: "********" },
  { email: "maria@example.com", password: "********" }
];

export const busquedas = [
  { q: "Electricidad", availableOnly: true },
  { q: "Plomería", availableOnly: false },
  { q: "Jardinería", availableOnly: true },
  { q: "", availableOnly: false }
];

export const solicitudes = [
  { service: "Electricidad", date: "2026-11-12", time: "10:00 a. m.", address: "Calle 45 #28-10", detail: "Revisión de una luminaria" },
  { service: "Plomería", date: "2026-11-13", time: "8:00 a. m.", address: "Carrera 15 #20-20", detail: "Reparación de fuga en lavaplatos" },
  { service: "Jardinería", date: "2026-11-14", time: "1:00 p. m.", address: "Transversal 93 #55-12", detail: "Poda y limpieza del jardín" },
  { service: "Aseo general", date: "2026-11-15", time: "3:30 p. m.", address: "Av. 68 #23-45", detail: "Aseo profundo del apartamento" }
];

export const proveedores = [
  { name: "Sebastián Torres", bio: "Más de 5 años de experiencia", phone: "+57 300 123 45 67", zone: "Bogotá, Colombia", rate: 95000, availability: "Lun - Sáb, 8:00 am - 6:00 pm", services: ["Plomería", "Electricidad"] },
  { name: "Ana Torres", bio: "Especialista en instalaciones sanitarias", phone: "+57 301 234 56 78", zone: "Bogotá norte", rate: 85000, availability: "Lun - Vie, 7:00 am - 5:00 pm", services: ["Plomería"] },
  { name: "Carlos Ramírez", bio: "Electricista certificado residencial", phone: "+57 302 345 67 89", zone: "Bogotá centro", rate: 90000, availability: "Lun - Sáb, 8:00 am - 6:00 pm", services: ["Electricidad"] },
  { name: "Juan Suárez", bio: "Mantenimiento y diseño de jardines", phone: "+57 303 456 78 90", zone: "Bogotá occidente", rate: 80000, availability: "Mar - Dom, 8:00 am - 5:00 pm", services: ["Jardinería"] }
];

export const mensajes = [
  { message: "Hola, ¿confirmamos la visita?" },
  { message: "Sí, estaré disponible a las 10:00 a. m." },
  { message: "Perfecto, revisaré el problema y llevaré las herramientas necesarias." },
  { message: "Gracias, te espero en la dirección indicada." }
];
