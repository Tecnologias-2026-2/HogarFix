import { auth } from "../firebase-config.js";
import { PROFILE_API_BASE_URL } from "../config.js";
import {
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  deleteUser,
  onAuthStateChanged,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
} from "https://www.gstatic.com/firebasejs/13.2.0/firebase-auth.js";

const VALID_ROLES = new Set(["Cliente", "Proveedor"]);
const subscribers = new Set();
const pendingProfileWrites = new Set();

let authState = { user: null, profile: null, error: null, ready: false };
let resolveInitialState;
let initialStateResolved = false;
let authStateVersion = 0;
let authOperationVersion = 0;

const initialState = new Promise((resolve) => {
  resolveInitialState = resolve;
});

async function readUserProfile(user) {
  const profile = await requestBackendProfile(user, "/profile/me");
  if (!VALID_ROLES.has(profile.role) || profile.email !== user.email) {
    const error = new Error("El perfil de usuario no es válido.");
    error.code = "profile/invalid";
    throw error;
  }

  return { ...profile, uid: user.uid };
}

async function requestBackendProfile(user, path, body) {
  if (!PROFILE_API_BASE_URL) {
    const error = new Error("Configura PROFILE_API_BASE_URL para conectar el registro y el perfil con el backend.");
    error.code = "profile/backend-unconfigured";
    throw error;
  }
  let response;
  try {
    response = await fetch(`${PROFILE_API_BASE_URL}${path}`, {
      method: body ? "POST" : "GET",
      headers: {
        Authorization: `Bearer ${await user.getIdToken()}`,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  } catch {
    const error = new Error("No se pudo conectar con el backend de HogarFix.");
    error.code = "profile/backend-unavailable";
    throw error;
  }
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.profile) {
    const error = new Error(result.message || "No se pudo guardar o consultar el perfil.");
    error.code = result.code || `profile/http-${response.status}`;
    throw error;
  }
  return result.profile;
}

function publishAuthState(state) {
  authState = state;
  if (!initialStateResolved) {
    initialStateResolved = true;
    resolveInitialState(state);
  }

  subscribers.forEach((subscriber) => {
    notifySubscriber(subscriber, state);
  });
}

function notifySubscriber(subscriber, state) {
  try {
    const result = subscriber(state);
    if (result && typeof result.catch === "function") {
      result.catch((error) => console.error("Error al procesar el estado de autenticación:", error));
    }
  } catch (error) {
    console.error("Error al procesar el estado de autenticación:", error);
  }
}

function updateAuthState(state) {
  authStateVersion += 1;
  publishAuthState({ ...state, ready: true });
}

function beginProfileWrite() {
  let release;
  const pending = new Promise((resolve) => {
    release = resolve;
  });
  pendingProfileWrites.add(pending);
  return () => {
    pendingProfileWrites.delete(pending);
    release();
  };
}

onAuthStateChanged(auth, async (user) => {
  const version = ++authStateVersion;
  await Promise.all([...pendingProfileWrites]);
  if (version !== authStateVersion || auth.currentUser?.uid !== user?.uid) return;

  let profile = null;
  let error = null;

  if (user) {
    try {
      profile = await readUserProfile(user);
    } catch (caught) {
      error = caught;
    }
  }

  if (version !== authStateVersion || auth.currentUser?.uid !== user?.uid) return;
  publishAuthState({ user, profile, error, ready: true });
}, (error) => {
  authStateVersion += 1;
  publishAuthState({ user: auth.currentUser, profile: null, error, ready: true });
});

export function getAuthState() {
  return authState.ready ? Promise.resolve(authState) : initialState;
}

export function getCurrentProfile() {
  return authState.profile;
}

export function subscribeToAuthState(subscriber) {
  subscribers.add(subscriber);
  if (authState.ready) notifySubscriber(subscriber, authState);
  return () => subscribers.delete(subscriber);
}

export async function registerUser({ email, password, firstName, lastName, role }) {
  if (!VALID_ROLES.has(role)) {
    throw new Error("Selecciona un tipo de cuenta válido.");
  }

  const operationVersion = ++authOperationVersion;
  await setPersistence(auth, browserLocalPersistence);
  const finishProfileWrite = beginProfileWrite();
  let user;
  try {
    ({ user } = await createUserWithEmailAndPassword(
      auth,
      email.trim().toLowerCase(),
      password,
    ));
    const profileFields = {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      role,
    };

    try {
      await requestBackendProfile(user, "/auth/profile", profileFields);
    } catch (profileError) {
      try {
        await deleteUser(user);
        if (operationVersion === authOperationVersion && !auth.currentUser) {
          updateAuthState({ user: null, profile: null, error: null });
        }
      } catch (cleanupError) {
        console.error("No se pudo guardar el perfil ni revertir la cuenta de Authentication.", {
          profileError,
          cleanupError,
        });
        const error = new Error(
          "La cuenta se creó, pero no se pudo guardar el perfil ni revertir el registro. Contacta al equipo de HogarFix.",
        );
        error.code = "profile/creation-and-cleanup-failed";
        throw error;
      }
      throw profileError;
    }
  } finally {
    finishProfileWrite();
  }

  let profile;
  try {
    profile = await readUserProfile(user);
  } catch (error) {
    if (
      operationVersion === authOperationVersion
      && auth.currentUser?.uid === user.uid
    ) {
      updateAuthState({ user, profile: null, error });
    }
    throw error;
  }

  if (
    operationVersion === authOperationVersion
    && auth.currentUser?.uid === user.uid
  ) {
    updateAuthState({ user, profile, error: null });
  }
  return { user, profile };
}

export async function signInUser(email, password) {
  const operationVersion = ++authOperationVersion;
  await setPersistence(auth, browserLocalPersistence);
  const { user } = await signInWithEmailAndPassword(auth, email.trim().toLowerCase(), password);

  try {
    const profile = await readUserProfile(user);
    if (
      operationVersion === authOperationVersion
      && auth.currentUser?.uid === user.uid
    ) {
      updateAuthState({ user, profile, error: null });
    }
    return { user, profile };
  } catch (error) {
    if (
      operationVersion === authOperationVersion
      && auth.currentUser?.uid === user.uid
    ) {
      try {
        await signOutUser();
      } catch (signOutError) {
        console.error("No se pudo cerrar la sesión de una cuenta sin perfil valido.", signOutError);
      }
    }
    throw error;
  }
}

export async function signOutUser() {
  const operationVersion = ++authOperationVersion;
  await signOut(auth);
  if (operationVersion === authOperationVersion && !auth.currentUser) {
    updateAuthState({ user: null, profile: null, error: null });
  }
}

export async function requestPasswordReset(email) {
  await sendPasswordResetEmail(auth, email.trim().toLowerCase());
}

export function getAuthErrorMessage(error, operation) {
  if (operation === "password-reset") {
    if (error?.code === "auth/missing-email") return "Escribe tu correo electrónico.";
    if (error?.code === "auth/invalid-email") return "Escribe un correo electrónico válido.";
    if (error?.code === "auth/network-request-failed")
      return "No se pudo conectar con Firebase. Inténtalo de nuevo más tarde.";
    if (error?.code === "auth/too-many-requests")
      return "No se pudo procesar la solicitud ahora. Espera un momento e inténtalo de nuevo.";
    return "No se pudo procesar la solicitud. Inténtalo de nuevo más tarde.";
  }

  const messages = {
    "auth/email-already-in-use": "Ya existe una cuenta con ese correo. Inicia sesion.",
    "auth/missing-email": "Escribe tu correo electronico.",
    "auth/invalid-email": "El correo electrónico no es valido.",
    "auth/weak-password": "La contraseña es demasiado débil. Usa al menos 8 caracteres.",
    "auth/missing-password": "Escribe tu contraseña.",
    "auth/invalid-credential": "Correo o contraseña incorrectos.",
    "auth/invalid-login-credentials": "Correo o contraseña incorrectos.",
    "auth/user-not-found": "Correo o contraseña incorrectos.",
    "auth/wrong-password": "Correo o contraseña incorrectos.",
    "auth/user-disabled": "Esta cuenta esta deshabilitada. Contacta al equipo de HogarFix.",
    "auth/too-many-requests": "Se hicieron demasiados intentos. Espera un momento e inténtalo de nuevo.",
    "auth/network-request-failed": "No hay conexión con Firebase. Revisa tu internet e inténtalo de nuevo.",
    "auth/operation-not-allowed": "El acceso con correo y contraseña no está habilitado en Firebase.",
    "auth/invalid-api-key": "La configuracion de Firebase no es válida.",
    "auth/unauthorized-domain": "Este dominio no está autorizado en Firebase Authentication.",
    "permission-denied": "Firestore no permitió leer o guardar el perfil. Verifica las reglas desplegadas.",
    "unavailable": "Firestore no está disponible en este momento. Intentalo de nuevo.",
    "profile/not-found": "La cuenta no tiene un perfil de HogarFix asociado.",
    "profile/invalid": "El perfil de HogarFix no contiene un rol o correo válido.",
    "profile/not-ready": "La sesión y el perfil todavía no están disponibles. Intentalo de nuevo.",
    "profile/creation-and-cleanup-failed":
      "No se pudo completar ni revertir el registro. Contacta al equipo de HogarFix.",
  };

  if (messages[error?.code]) return messages[error.code];
  if (error?.code?.startsWith("auth/")) {
    return `Firebase Authentication no pudo completar la operación (${error.code}). Intentalo de nuevo.`;
  }
  return operation === "register"
    ? "No se pudo crear la cuenta. Intentalo de nuevo."
    : operation === "login"
      ? "No se pudo iniciar sesion. Revisa tus datos e intentalo de nuevo."
      : "No se pudo cerrar sesion. Inténtalo de nuevo.";
}
