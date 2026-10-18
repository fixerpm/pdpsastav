// Lightweight secure password hashing using SHA-256 with salt
export async function hashPassword(password, salt) {
  const enc = new TextEncoder();
  const actualSalt = salt || Math.random().toString(36).slice(2, 12);
  const data = enc.encode(`${actualSalt}::${password}`);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${actualSalt}$${hashHex}`;
}

export async function verifyPassword(password, storedHash) {
  if (!storedHash || !storedHash.includes("$")) return false;
  const [salt, expectedHash] = storedHash.split("$");
  const computed = await hashPassword(password, salt);
  return computed === storedHash;
}
