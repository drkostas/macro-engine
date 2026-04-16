const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60;
const CLOCK_SKEW_SECONDS = 300;

function b64url(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

let cachedKey: { secret: string; key: CryptoKey } | null = null;

async function getKey(): Promise<CryptoKey> {
  const secret = process.env.MACROENGINE_SECRET;
  if (!secret) throw new Error("MACROENGINE_SECRET not set");
  if (secret.length < 32) throw new Error("MACROENGINE_SECRET must be at least 32 chars");
  if (cachedKey && cachedKey.secret === secret) return cachedKey.key;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
  cachedKey = { secret, key };
  return key;
}

async function hmac(data: string): Promise<string> {
  const key = await getKey();
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return b64url(sig);
}

export async function signSession(issuedAt?: number): Promise<string> {
  const ts = issuedAt ?? Math.floor(Date.now() / 1000);
  const payload = `v1.${ts}`;
  const sig = await hmac(payload);
  return `${payload}.${sig}`;
}

export async function verifySession(cookie: string | null): Promise<boolean> {
  if (!cookie) return false;
  const m = cookie.match(/^v1\.(\d+)\.([A-Za-z0-9_-]+)$/);
  if (!m) return false;
  const ts = Number(m[1]);
  const sig = m[2];
  const now = Math.floor(Date.now() / 1000);
  if (now - ts > SESSION_TTL_SECONDS) return false;
  if (ts > now + CLOCK_SKEW_SECONDS) return false;
  try {
    const expected = await hmac(`v1.${ts}`);
    // Constant-time compare
    if (sig.length !== expected.length) return false;
    let diff = 0;
    for (let i = 0; i < sig.length; i++) diff |= sig.charCodeAt(i) ^ expected.charCodeAt(i);
    return diff === 0;
  } catch {
    return false;
  }
}

export const SESSION_COOKIE = "me_session";
