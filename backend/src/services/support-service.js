import { getAdminFirestore } from "../config/firebase-admin.js";

const FAQS = Object.freeze([
  { id: "request-status", question: "¿Cómo consulto mi solicitud?", answer: "Abre Mis solicitudes para ver el estado y los detalles del servicio." },
  { id: "cancel-request", question: "¿Cómo cancelo una solicitud?", answer: "Puedes cancelarla mientras esté pendiente o aceptada desde el detalle de la solicitud." },
  { id: "provider-rating", question: "¿Cómo califico a un proveedor?", answer: "Al completarse el servicio podrás dejar una calificación de 1 a 5 estrellas." },
]);

function inputError(message, statusCode = 400) {
  return Object.assign(new Error(message), { statusCode });
}

function validUid(uid) {
  if (typeof uid !== "string" || !uid || uid.length > 128 || uid.includes("/")) {
    throw inputError("El usuario autenticado no es válido.");
  }
}

export function createSupportService({ db, now = () => new Date() } = {}) {
  const firestore = () => db || getAdminFirestore();

  async function listNotifications({ uid, limit = 50 } = {}) {
    validUid(uid);
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw inputError("El límite debe estar entre 1 y 100.");
    const snapshot = await firestore().collection("notifications")
      .where("recipientUid", "==", uid).limit(limit).get();
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
      .sort((a, b) => new Date(b.createdAt?.toDate?.() || b.createdAt || 0)
        - new Date(a.createdAt?.toDate?.() || a.createdAt || 0));
  }

  async function markNotificationRead({ uid, notificationId } = {}) {
    validUid(uid);
    if (typeof notificationId !== "string" || !notificationId || notificationId.includes("/")) throw inputError("La notificación indicada no es válida.");
    const reference = firestore().collection("notifications").doc(notificationId);
    const snapshot = await reference.get();
    if (!snapshot.exists || snapshot.get("recipientUid") !== uid) throw inputError("No encontramos esa notificación.", 404);
    if (!snapshot.get("readAt")) await reference.update({ readAt: now() });
    const updated = await reference.get();
    return { id: updated.id, ...updated.data() };
  }

  async function createSupportMessage({ uid, role, input } = {}) {
    validUid(uid);
    if (!["Cliente", "Proveedor"].includes(role)) throw inputError("El rol no es válido.", 403);
    if (!input || typeof input !== "object" || Array.isArray(input)) throw inputError("El mensaje de soporte no es válido.");
    const subject = typeof input.subject === "string" ? input.subject.trim() : "";
    const message = typeof input.message === "string" ? input.message.trim() : "";
    if (subject.length < 3 || subject.length > 120) throw inputError("El asunto debe tener entre 3 y 120 caracteres.");
    if (message.length < 10 || message.length > 3000) throw inputError("El mensaje debe tener entre 10 y 3000 caracteres.");
    const reference = firestore().collection("supportMessages").doc();
    const data = { uid, role, subject, message, status: "open", createdAt: now() };
    await reference.create(data);
    return { id: reference.id, ...data };
  }

  return Object.freeze({ listNotifications, markNotificationRead, listFaqs: () => FAQS, createSupportMessage });
}
