import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const PROJECT_ID = "demo-hogarfix";
const FIRESTORE_PORT = "8080";
const COLLECTION = "emulatorSmokeChecks";

function assertProject(env) {
  const projectIds = [
    ["GCLOUD_PROJECT", env.GCLOUD_PROJECT],
    ["GOOGLE_CLOUD_PROJECT", env.GOOGLE_CLOUD_PROJECT],
    ["FIREBASE_PROJECT_ID", env.FIREBASE_PROJECT_ID],
    ["CLOUDSDK_CORE_PROJECT", env.CLOUDSDK_CORE_PROJECT],
  ].filter(([, value]) => value);

  if (!projectIds.length) {
    throw new Error("Falta la variable de proyecto que debe proporcionar Firebase Emulator.");
  }

  for (const [name, value] of projectIds) {
    if (value !== PROJECT_ID) {
      throw new Error(`${name} debe ser exactamente ${PROJECT_ID}.`);
    }
  }

  if (env.FIREBASE_CONFIG) {
    let firebaseConfig;
    try {
      firebaseConfig = JSON.parse(env.FIREBASE_CONFIG);
    } catch {
      throw new Error("FIREBASE_CONFIG debe ser JSON válido.");
    }
    if (firebaseConfig.projectId && firebaseConfig.projectId !== PROJECT_ID) {
      throw new Error(`FIREBASE_CONFIG.projectId debe ser exactamente ${PROJECT_ID}.`);
    }
  }
}

function getEmulatorConnection(env) {
  const value = env.FIRESTORE_EMULATOR_HOST;
  if (!value) {
    throw new Error("Falta FIRESTORE_EMULATOR_HOST; no se conectará a Firestore.");
  }

  const match = /^(localhost|127\.0\.0\.1|\[::1\]):(\d+)$/i.exec(value);
  if (!match || match[2] !== FIRESTORE_PORT) {
    throw new Error(
      `FIRESTORE_EMULATOR_HOST debe usar localhost, 127.0.0.1 o ::1 en el puerto ${FIRESTORE_PORT}.`,
    );
  }

  const host = match[1].toLowerCase();
  return {
    baseUrl: `http://${host}:${FIRESTORE_PORT}`,
    emulatorHost: `${host}:${FIRESTORE_PORT}`,
  };
}

export function validateEnvironment(env = process.env) {
  assertProject(env);
  if (env.GOOGLE_APPLICATION_CREDENTIALS || env.FIREBASE_TOKEN) {
    throw new Error(
      "El entorno no debe incluir GOOGLE_APPLICATION_CREDENTIALS ni FIREBASE_TOKEN.",
    );
  }
  return {
    ...getEmulatorConnection(env),
    projectId: PROJECT_ID,
  };
}

async function requestJson(url, options, onSuccess) {
  const response = await fetch(url, {
    ...options,
    redirect: "error",
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) {
    throw new Error(`Firestore Emulator respondió HTTP ${response.status}.`);
  }
  onSuccess?.();
  return response.json();
}

async function verifyFirestore({ baseUrl, projectId }) {
  const documentId = `probe-${randomUUID()}`;
  const documentPath =
    `/v1/projects/${projectId}/databases/(default)/documents/${COLLECTION}/${documentId}`;
  const documentUrl = `${baseUrl}${documentPath}`;
  const collectionUrl =
    `${baseUrl}/v1/projects/${projectId}/databases/(default)/documents/${COLLECTION}`
    + `?documentId=${encodeURIComponent(documentId)}`;
  let created = false;

  try {
    const written = await requestJson(collectionUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fields: {
          projectId: { stringValue: projectId },
          marker: { stringValue: "local-emulator-check" },
        },
      }),
    }, () => {
      created = true;
    });
    if (!written.name?.endsWith(`/${COLLECTION}/${documentId}`)) {
      throw new Error("La respuesta de Firestore Emulator no identificó el documento de prueba.");
    }

    const read = await requestJson(documentUrl, { method: "GET" });
    if (
      read.fields?.projectId?.stringValue !== projectId
      || read.fields?.marker?.stringValue !== "local-emulator-check"
    ) {
      throw new Error("La lectura de Firestore Emulator no coincidió con los datos escritos.");
    }
  } finally {
    if (created) {
      const response = await fetch(documentUrl, {
        method: "DELETE",
        redirect: "error",
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok && response.status !== 404) {
        throw new Error(`No se pudo limpiar el documento de verificación (HTTP ${response.status}).`);
      }
    }
  }
}

async function main() {
  const mode = process.argv[2];
  if (mode && mode !== "--check") {
    throw new Error("Uso: node scripts/run-emulator-tests.js [--check]");
  }

  const configuration = validateEnvironment();
  if (mode === "--check") {
    console.log("Guard aceptó únicamente el entorno local demo-hogarfix.");
    return;
  }

  await verifyFirestore(configuration);
  console.log("Firestore Emulator verificado; el documento temporal fue eliminado.");

  const scriptDirectory = dirname(fileURLToPath(import.meta.url));
  const backendDirectory = dirname(scriptDirectory);
  const integrationTest = resolve(
    backendDirectory,
    "test",
    "integration",
    "request-service.integration.js",
  );
  const testResult = spawnSync(process.execPath, ["--test", integrationTest], {
    cwd: backendDirectory,
    env: {
      ...process.env,
      FIREBASE_PROJECT_ID: configuration.projectId,
      GCLOUD_PROJECT: configuration.projectId,
      FIRESTORE_EMULATOR_HOST: configuration.emulatorHost,
    },
    stdio: "inherit",
  });
  if (testResult.error) throw testResult.error;
  if (testResult.status !== 0) {
    process.exitCode = testResult.status ?? 1;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`Verificación de Emulator detenida: ${error.message}`);
    process.exitCode = 1;
  });
}
