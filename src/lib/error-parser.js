/**
 * PDP SASTAV — Error Parser & Validation Utilities
 * Sanitizes technical stack traces, Convex runtime errors, and network issues
 * into clean, user-friendly Uzbek messages.
 */

/**
 * Strips technical Convex internals, request IDs, and stack traces.
 * Keeps clean business messages for users.
 */
export function parseErrorMessage(error, fallback = "Kutilmagan xatolik yuz berdi") {
  if (!error) return fallback;

  // Extract raw string message
  let raw = "";
  if (typeof error === "string") {
    raw = error;
  } else if (error?.data?.message) {
    raw = String(error.data.message);
  } else if (error?.data && typeof error.data === "string") {
    raw = String(error.data);
  } else if (error?.message) {
    raw = String(error.message);
  } else {
    raw = String(error);
  }

  // Preserve developer diagnostics in console
  if (typeof window !== "undefined") {
    console.debug("[PDP_DIAGNOSTICS]", { raw, original: error });
  }

  // Network / fetch errors
  if (
    raw.includes("Failed to fetch") ||
    raw.includes("NetworkError") ||
    raw.includes("Network request failed") ||
    raw.includes("ERR_CONNECTION") ||
    raw.includes("ECONNREFUSED")
  ) {
    return "Internet aloqasi mavjud emas yoki server bilan aloqa uzildi. Iltimos, ulanishingizni tekshiring.";
  }

  // Convex Server Error parsing
  // Matches "Uncaught Error: <message>" or "Uncaught ConvexError: <message>"
  const uncaughtMatch = raw.match(/Uncaught\s+(?:Error|ConvexError):\s*([^\n\r]+)/);
  if (uncaughtMatch && uncaughtMatch[1]) {
    let clean = uncaughtMatch[1].trim();
    // Strip trailing "at handler (...)"
    clean = clean.replace(/\s+at\s+handler.*$/i, "").trim();
    clean = clean.replace(/\s+at\s+.*$/i, "").trim();
    clean = clean.replace(/\s+Called by client.*$/i, "").trim();
    if (clean) return clean;
  }

  // If raw contains [CONVEX M(...)] ... Server Error: ...
  let cleaned = raw
    .replace(/\[CONVEX\s+[^\]]+\]/g, "")
    .replace(/\[Request ID:\s*[^\]]+\]/g, "")
    .replace(/Server Error/gi, "")
    .replace(/Uncaught Error:\s*/gi, "")
    .replace(/Uncaught ConvexError:\s*/gi, "")
    .replace(/Called by client/gi, "")
    .replace(/at\s+handler\s*\([^)]+\)/gi, "")
    .replace(/\bat\s+[^\n]+/g, "")
    .trim();

  // Remove leading colons or hyphens left by stripping
  cleaned = cleaned.replace(/^[:\-\s]+/, "").trim();

  // Translate known system errors to polite Uzbek
  if (!cleaned || cleaned.toLowerCase() === "error" || cleaned.toLowerCase() === "unknown") {
    return fallback;
  }

  if (cleaned.includes("User not found")) {
    return "Foydalanuvchi topilmadi";
  }

  if (cleaned.includes("Unauthorized") || cleaned.includes("Unauthenticated")) {
    return "Iltimos, avval akkauntingizga kiring";
  }

  if (cleaned.includes("Internal server error")) {
    return "Serverda vaqtinchalik nosozlik yuz berdi. Iltimos, qayta urinib ko‘ring.";
  }

  return cleaned;
}

/**
 * Normalizes username input:
 * - Trims whitespace
 * - Strips leading '@'
 * - Lowercases
 * - Validates allowed chars (letters, numbers, underscore)
 */
export function normalizeUsername(input) {
  if (!input || typeof input !== "string") return "";
  return input
    .trim()
    .toLowerCase()
    .replace(/^@+/, "");
}

/**
 * Validates a normalized username format.
 * Must be 3-30 chars, only [a-z0-9_].
 */
export function validateUsername(username) {
  const clean = normalizeUsername(username);
  if (!clean) {
    return { isValid: false, error: "Username kiritilishi shart" };
  }
  if (clean.length < 3) {
    return { isValid: false, error: "Username kamida 3 ta belgidan iborat bo‘lishi kerak" };
  }
  if (clean.length > 30) {
    return { isValid: false, error: "Username 30 ta belgidan oshmasligi kerak" };
  }
  if (!/^[a-z0-9_]+$/.test(clean)) {
    return {
      isValid: false,
      error: "Username faqat lotin harflari, raqamlar va pastki chiziqdan (_) iborat bo‘lishi mumkin",
    };
  }
  return { isValid: true, clean };
}

/**
 * Computes contact relationship status between currentUser and targetUser:
 * Returns: 'self' | 'accepted' | 'pending_sent' | 'pending_received' | 'blocked' | 'none'
 */
export function determineContactStatus({
  currentUserId,
  targetUserId,
  contacts = [],
  contactRequests = { incoming: [], outgoing: [] },
  blockedUserIds = [],
}) {
  if (!currentUserId || !targetUserId) return "none";
  if (currentUserId === targetUserId) return "self";

  if (blockedUserIds && blockedUserIds.includes(targetUserId)) {
    return "blocked";
  }

  const isContact = contacts.some(
    (c) => (c.userId === targetUserId || c.id === targetUserId) && !c.isBlocked
  );
  if (isContact) return "accepted";

  const isPendingSent = contactRequests?.outgoing?.some(
    (req) => req.user?.id === targetUserId || req.user?.userId === targetUserId
  );
  if (isPendingSent) return "pending_sent";

  const isPendingReceived = contactRequests?.incoming?.some(
    (req) => req.user?.id === targetUserId || req.user?.userId === targetUserId
  );
  if (isPendingReceived) return "pending_received";

  return "none";
}
