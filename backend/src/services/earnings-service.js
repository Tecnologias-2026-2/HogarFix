import { getAdminFirestore } from "../config/firebase-admin.js";

function earningsError(message, statusCode, code) {
  return Object.assign(new Error(message), { statusCode, code });
}

function validateUid(uid) {
  if (
    typeof uid !== "string" ||
    !uid ||
    uid.length > 128 ||
    uid.includes("/")
  ) {
    throw earningsError(
      "El proveedor autenticado no es válido.",
      400,
      "INVALID_UID"
    );
  }
}

function parseDate(value, field) {
  if (value === undefined) return null;

  if (typeof value !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw earningsError(
      `El parámetro ${field} debe tener formato YYYY-MM-DD.`,
      400,
      "INVALID_DATE"
    );
  }

  const date = new Date(`${value}T00:00:00.000Z`);

  if (
    !Number.isFinite(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
  ) {
    throw earningsError(
      `La fecha ${field} no es válida.`,
      400,
      "INVALID_DATE"
    );
  }

  return date;
}

function paymentDate(value) {
  if (value instanceof Date) return value;

  if (value && typeof value.toDate === "function") {
    return value.toDate();
  }

  return null;
}

function validatePeriod(period) {
  if (period === undefined) return "month";

  if (!["day", "month", "year"].includes(period)) {
    throw earningsError(
      "El periodo debe ser day, month o year.",
      400,
      "INVALID_PERIOD"
    );
  }

  return period;
}

function periodKey(date, period) {
  const iso = date.toISOString();

  if (period === "day") return iso.slice(0, 10);
  if (period === "year") return iso.slice(0, 4);

  return iso.slice(0, 7);
}

export function createEarningsService({
  db = null
} = {}) {
  function firestore() {
    return db || getAdminFirestore();
  }

  async function getEarnings({
    providerUid,
    from,
    to,
    period = "month"
  } = {}) {
    validateUid(providerUid);

    const startDate = parseDate(from, "from");
    const endDate = parseDate(to, "to");
    const selectedPeriod = validatePeriod(period);

    if (
      startDate &&
      endDate &&
      startDate.getTime() > endDate.getTime()
    ) {
      throw earningsError(
        "La fecha inicial no puede superar la fecha final.",
        400,
        "INVALID_DATE_RANGE"
      );
    }

    // El límite superior es exclusivo: incluye todo el día 'to'.
    const endExclusive = endDate
      ? new Date(endDate.getTime() + 24 * 60 * 60 * 1000)
      : null;

    let snapshot;

    try {
      snapshot = await firestore()
        .collection("solicitudes")
        .where("providerUid", "==", providerUid)
        .get();
    } catch (error) {
      console.error(
        "Firestore earnings query failed:",
        error?.code || "unknown"
      );

      throw earningsError(
        "No se pudieron consultar los ingresos.",
        503,
        "FIRESTORE_UNAVAILABLE"
      );
    }

    let totalEarningsCOP = 0;
    let paidServicesCount = 0;

    const breakdownMap = new Map();

    for (const document of snapshot.docs) {
      const data = document.data();
      const payment = data.payment;

      // Solo contabilizamos pagos confirmados.
      if (!payment || payment.status !== "paid") continue;

      const amount = payment.amountCOP;
      const paidAt = paymentDate(payment.paidAt);

      if (
        !Number.isSafeInteger(amount) ||
        amount <= 0 ||
        !paidAt ||
        !Number.isFinite(paidAt.getTime())
      ) {
        continue;
      }

      if (startDate && paidAt < startDate) continue;
      if (endExclusive && paidAt >= endExclusive) continue;

      totalEarningsCOP += amount;
      paidServicesCount += 1;

      const key = periodKey(paidAt, selectedPeriod);

      const current = breakdownMap.get(key) || {
        period: key,
        totalCOP: 0,
        servicesCount: 0
      };

      current.totalCOP += amount;
      current.servicesCount += 1;

      breakdownMap.set(key, current);
    }

    const breakdown = [...breakdownMap.values()]
      .sort((a, b) => a.period.localeCompare(b.period));

    return {
      currency: "COP",
      totalEarningsCOP,
      paidServicesCount,
      filters: {
        from: from || null,
        to: to || null,
        period: selectedPeriod
      },
      breakdown
    };
  }

  return { getEarnings };
}
