import { Env, HttpError, fromB64u, hmac, randomToken, safeEqual, toB64u } from "./util";

const COOKIE = "archive_sid";
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;
const enc = new TextEncoder();

export interface Session { tokenHash: string; csrf: string }

async function verifyPassword(stored: string | undefined, password: string): Promise<boolean> {
  // Format: pbkdf2-sha256:<iterations>:<salt b64url>:<hash b64url>  (see scripts/hash-password.mjs)
  const [scheme, iterStr, saltB64, hashB64] = (stored ?? "").split(":");
  const iterations = Number(iterStr);
  // Always do the same amount of work, even with a malformed secret, so timing reveals nothing.
  const salt = scheme === "pbkdf2-sha256" && saltB64 ? fromB64u(saltB64) : new Uint8Array(16);
  const expected = hashB64 ? fromB64u(hashB64) : new Uint8Array(32);
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations: Number.isInteger(iterations) && iterations > 0 && iterations <= 100000 ? iterations : 100000 },
    key,
    256,
  );
  return scheme === "pbkdf2-sha256" && safeEqual(new Uint8Array(bits), expected);
}

function cookieValue(req: Request, name: string): string | null {
  for (const part of (req.headers.get("cookie") ?? "").split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k === name) return rest.join("=");
  }
  return null;
}

function cookieHeader(req: Request, value: string, maxAgeSec: number): string {
  const secure = new URL(req.url).protocol === "https:" ? "; Secure" : "";
  return `${COOKIE}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAgeSec}${secure}`;
}

export function assertSameOrigin(req: Request): void {
  const origin = req.headers.get("origin");
  if (!origin || origin !== new URL(req.url).origin) throw new HttpError(403, "Cross-origin request blocked");
}

export async function login(req: Request, env: Env, password: string): Promise<{ csrf: string; setCookie: string }> {
  if (!env.ADMIN_PASSWORD_HASH || !env.SESSION_SECRET) throw new HttpError(500, "Admin sign-in is not set up: the server has no ADMIN_PASSWORD_HASH or SESSION_SECRET. Locally, put them in .dev.vars and restart. On Cloudflare, add them with wrangler secret put. See the README.");
  const ip = req.headers.get("cf-connecting-ip") ?? "local";
  const now = Date.now();

  // Count the attempt first (atomic upsert) so parallel guesses cannot slip past the limit.
  const row = await env.DB.prepare(
    `INSERT INTO login_attempts (ip, count, window_start) VALUES (?1, 1, ?2)
     ON CONFLICT(ip) DO UPDATE SET
       count = CASE WHEN ?2 - window_start > ?3 THEN 1 ELSE count + 1 END,
       window_start = CASE WHEN ?2 - window_start > ?3 THEN ?2 ELSE window_start END
     RETURNING count, window_start`,
  ).bind(ip, now, WINDOW_MS).first<{ count: number; window_start: number }>();
  if (row && row.count > MAX_ATTEMPTS) {
    const retry = Math.max(1, Math.ceil((row.window_start + WINDOW_MS - now) / 1000));
    throw new HttpError(429, "Too many login attempts. Try again later.", { "retry-after": String(retry) });
  }

  if (!(await verifyPassword(env.ADMIN_PASSWORD_HASH, password))) throw new HttpError(401, "Incorrect password");

await env.DB.batch([
  env.DB.prepare("DELETE FROM login_attempts WHERE ip = ?").bind(ip),
  env.DB.prepare("DELETE FROM sessions WHERE expires_at < ?").bind(now),
  env.DB.prepare("DELETE FROM login_attempts WHERE window_start < ?").bind(now - WINDOW_MS),
]);
  const token = randomToken(32);
  const csrf = randomToken(24);
  await env.DB.prepare("INSERT INTO sessions (token_hash, csrf, expires_at, created_at) VALUES (?, ?, ?, ?)")
    .bind(await hmac(env.SESSION_SECRET, token), csrf, now + SESSION_TTL_MS, now).run();
  return { csrf, setCookie: cookieHeader(req, token, SESSION_TTL_MS / 1000) };
}

export async function getSession(req: Request, env: Env): Promise<Session | null> {
  const token = cookieValue(req, COOKIE);
  if (!token || token.length > 100 || !env.SESSION_SECRET) return null;
  const tokenHash = await hmac(env.SESSION_SECRET, token);
  const row = await env.DB.prepare("SELECT csrf FROM sessions WHERE token_hash = ? AND expires_at > ?")
    .bind(tokenHash, Date.now()).first<{ csrf: string }>();
  return row ? { tokenHash, csrf: row.csrf } : null;
}

export async function logout(req: Request, env: Env, session: Session | null): Promise<string> {
  if (session) await env.DB.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(session.tokenHash).run();
  return cookieHeader(req, "", 0);
}

export function assertCsrf(req: Request, session: Session): void {
  const sent = new TextEncoder().encode(req.headers.get("x-csrf-token") ?? "");
  if (!safeEqual(sent, new TextEncoder().encode(session.csrf))) throw new HttpError(403, "Invalid CSRF token");
}

export { toB64u };
