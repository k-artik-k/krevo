import { assertCsrf, assertSameOrigin, getSession, login, logout, Session } from "./auth";
import { DEFAULT_SETTINGS, projectInput, Settings, settingsInput } from "./validate";
import { Env, HttpError, json, readJson, slugify } from "./util";

interface ProjectRow {
  id: string; slug: string; title: string; year: number; category: string;
  short_description: string; full_description: string; technologies: string;
  github_url: string | null; live_url: string | null; video_url: string | null;
  cover_key: string | null; gallery: string; status: "draft" | "published";
  position: number; created_at: number; updated_at: number;
}

const parseList = (s: string): string[] => { try { const v = JSON.parse(s); return Array.isArray(v) ? v : []; } catch { return []; } };

const publicProject = (r: ProjectRow) => ({
  id: r.id, slug: r.slug, title: r.title, year: r.year, category: r.category,
  shortDescription: r.short_description, fullDescription: r.full_description,
  technologies: parseList(r.technologies), githubUrl: r.github_url, liveUrl: r.live_url,
  videoUrl: r.video_url, coverKey: r.cover_key, gallery: parseList(r.gallery),
});
const adminProject = (r: ProjectRow) => ({ ...publicProject(r), status: r.status, position: r.position, createdAt: r.created_at, updatedAt: r.updated_at });

async function loadSettings(env: Env): Promise<Settings> {
  const row = await env.DB.prepare("SELECT value FROM settings WHERE key = 'site'").first<{ value: string }>();
  let saved: Record<string, unknown> = {};
  try { saved = row ? JSON.parse(row.value) : {}; } catch { /* ignore corrupt row */ }
  return { ...DEFAULT_SETTINGS, ...saved } as Settings;
}

async function uniqueSlug(env: Env, title: string): Promise<string> {
  const base = slugify(title) || "project";
  for (let i = 1; i < 50; i++) {
    const slug = i === 1 ? base : `${base}-${i}`;
    if (!(await env.DB.prepare("SELECT 1 FROM projects WHERE slug = ?").bind(slug).first())) return slug;
  }
  return `${base}-${crypto.randomUUID().slice(0, 6)}`;
}

const get = (env: Env, id: string) => env.DB.prepare("SELECT * FROM projects WHERE id = ?").bind(id).first<ProjectRow>();

const insertSql = `INSERT INTO projects (id, slug, title, year, category, short_description, full_description, technologies,
  github_url, live_url, video_url, cover_key, gallery, status, position, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

// ---------- media ----------
const MAX_UPLOAD = 5 * 1024 * 1024;
function sniff(b: Uint8Array): { mime: string; ext: string } | null {
  const is = (...bytes: number[]) => bytes.every((v, i) => b[i] === v);
  if (is(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return { mime: "image/png", ext: "png" };
  if (is(0xff, 0xd8, 0xff)) return { mime: "image/jpeg", ext: "jpg" };
  if (is(0x47, 0x49, 0x46, 0x38) && (b[4] === 0x37 || b[4] === 0x39) && b[5] === 0x61) return { mime: "image/gif", ext: "gif" };
  if (is(0x52, 0x49, 0x46, 0x46) && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return { mime: "image/webp", ext: "webp" };
  if (is(0x00, 0x00, 0x01, 0x00)) return { mime: "image/x-icon", ext: "ico" };
  return null;
}

async function serveMedia(req: Request, env: Env, key: string): Promise<Response> {
  if (!/^[0-9a-f-]{36}\.(png|jpg|webp|gif|ico)$/.test(key)) throw new HttpError(404, "Not found");
  const headers = {
    etag: `"${key}"`, "cache-control": "public, max-age=31536000, immutable",
    "x-content-type-options": "nosniff", "content-security-policy": "default-src 'none'; sandbox",
  };
  if (req.headers.get("if-none-match") === headers.etag) return new Response(null, { status: 304, headers });
  const obj = await env.MEDIA.get(key);
  if (!obj) throw new HttpError(404, "Not found");
  return new Response(obj.body, { headers: { ...headers, "content-type": obj.httpMetadata?.contentType ?? "application/octet-stream" } });
}

async function mediaInUse(env: Env, key: string, exceptProject?: string): Promise<boolean> {
  const p = await env.DB.prepare("SELECT 1 FROM projects WHERE (cover_key = ?1 OR gallery LIKE '%' || ?1 || '%') AND id IS NOT ?2 LIMIT 1").bind(key, exceptProject ?? null).first();
  if (p) return true;
  const s = await env.DB.prepare("SELECT 1 FROM settings WHERE value LIKE '%' || ? || '%' LIMIT 1").bind(key).first();
  return !!s;
}

async function deleteMedia(env: Env, key: string, force: boolean): Promise<void> {
  if (await mediaInUse(env, key)) {
    if (!force) throw new HttpError(409, "Image is still used by a project or setting");
    await env.DB.prepare("UPDATE projects SET cover_key = NULL WHERE cover_key = ?").bind(key).run();
    const rows = await env.DB.prepare("SELECT id, gallery FROM projects WHERE gallery LIKE '%' || ? || '%'").bind(key).all<{ id: string; gallery: string }>();
    await env.DB.batch(rows.results.map((r) => env.DB.prepare("UPDATE projects SET gallery = ? WHERE id = ?").bind(JSON.stringify(parseList(r.gallery).filter((k) => k !== key)), r.id)));
    const s = await loadSettings(env);
    if (s.logoKey === key) s.logoKey = null;
    if (s.faviconKey === key) s.faviconKey = null;
    await env.DB.prepare("INSERT INTO settings (key, value) VALUES ('site', ?1) ON CONFLICT(key) DO UPDATE SET value = ?1").bind(JSON.stringify(s)).run();
  }
  await env.MEDIA.delete(key);
  await env.DB.prepare("DELETE FROM media WHERE key = ?").bind(key).run();
}

// ---------- routing ----------
async function admin(req: Request, env: Env, path: string): Promise<Response> {
  const method = req.method;
  const mutating = method !== "GET" && method !== "HEAD";
  if (mutating) assertSameOrigin(req);

  if (path === "/login" && method === "POST") {
    const body = await readJson(req, 2000);
    if (typeof body.password !== "string" || !body.password || body.password.length > 200) throw new HttpError(400, "Password required");
    const { csrf, setCookie } = await login(req, env, body.password);
    return json({ authenticated: true, csrf }, 200, { "set-cookie": setCookie });
  }

  const session: Session | null = await getSession(req, env);
  if (path === "/logout" && method === "POST") {
    return json({ ok: true }, 200, { "set-cookie": await logout(req, env, session) });
  }
  if (!session) throw new HttpError(401, "Not signed in");
  if (mutating) assertCsrf(req, session);

  if (path === "/session" && method === "GET") return json({ authenticated: true, csrf: session.csrf });

  if (path === "/projects" && method === "GET") {
    const rows = await env.DB.prepare("SELECT * FROM projects ORDER BY position ASC, created_at ASC").all<ProjectRow>();
    return json({ projects: rows.results.map(adminProject) });
  }
  if (path === "/projects" && method === "POST") {
    const p = projectInput(await readJson(req));
    const id = crypto.randomUUID(), now = Date.now();
    const slug = await uniqueSlug(env, p.title);
    const pos = (await env.DB.prepare("SELECT COALESCE(MAX(position), -1) + 1 AS n FROM projects").first<{ n: number }>())?.n ?? 0;
    await env.DB.prepare(insertSql).bind(id, slug, p.title, p.year, p.category, p.short_description, p.full_description,
      JSON.stringify(p.technologies), p.github_url, p.live_url, p.video_url, p.cover_key, JSON.stringify(p.gallery), p.status, pos, now, now).run();
    return json({ project: adminProject((await get(env, id))!) }, 201);
  }
  if (path === "/projects/order" && method === "PUT") {
    const body = await readJson(req);
    const ids = body.ids;
    const rows = await env.DB.prepare("SELECT id FROM projects").all<{ id: string }>();
    const existing = new Set(rows.results.map((r) => r.id));
    if (!Array.isArray(ids) || ids.length !== existing.size || new Set(ids).size !== ids.length || !ids.every((i) => typeof i === "string" && existing.has(i)))
      throw new HttpError(400, "Order must list every project exactly once");
    await env.DB.batch((ids as string[]).map((id, i) => env.DB.prepare("UPDATE projects SET position = ? WHERE id = ?").bind(i, id)));
    return json({ ok: true });
  }

  const m = path.match(/^\/projects\/([0-9a-f-]{36})(\/duplicate)?$/);
  if (m) {
    const id = m[1];
    const row = await get(env, id);
    if (!row) throw new HttpError(404, "Project not found");
    if (m[2] && method === "POST") {
      const newId = crypto.randomUUID(), now = Date.now();
      const title = `${row.title.slice(0, 90)} (copy)`;
      const slug = await uniqueSlug(env, title);
      await env.DB.batch([
        env.DB.prepare("UPDATE projects SET position = position + 1 WHERE position > ?").bind(row.position),
        env.DB.prepare(insertSql).bind(newId, slug, title, row.year, row.category, row.short_description, row.full_description,
          row.technologies, row.github_url, row.live_url, row.video_url, row.cover_key, row.gallery, "draft", row.position + 1, now, now),
      ]);
      return json({ project: adminProject((await get(env, newId))!) }, 201);
    }
    if (!m[2] && method === "PUT") {
      const p = projectInput(await readJson(req));
      await env.DB.prepare(`UPDATE projects SET title=?, year=?, category=?, short_description=?, full_description=?, technologies=?,
        github_url=?, live_url=?, video_url=?, cover_key=?, gallery=?, status=?, updated_at=? WHERE id=?`)
        .bind(p.title, p.year, p.category, p.short_description, p.full_description, JSON.stringify(p.technologies),
          p.github_url, p.live_url, p.video_url, p.cover_key, JSON.stringify(p.gallery), p.status, Date.now(), id).run();
      return json({ project: adminProject((await get(env, id))!) });
    }
    if (!m[2] && method === "PATCH") {
      const body = await readJson(req, 1000);
      if (body.status !== "draft" && body.status !== "published") throw new HttpError(400, "Invalid status");
      await env.DB.prepare("UPDATE projects SET status = ?, updated_at = ? WHERE id = ?").bind(body.status, Date.now(), id).run();
      return json({ project: adminProject((await get(env, id))!) });
    }
    if (!m[2] && method === "DELETE") {
      await env.DB.prepare("DELETE FROM projects WHERE id = ?").bind(id).run();
      return json({ ok: true });
    }
  }

  if (path === "/settings" && method === "GET") return json({ settings: await loadSettings(env) });
  if (path === "/settings" && method === "PUT") {
    const s = settingsInput(await readJson(req));
    await env.DB.prepare("INSERT INTO settings (key, value) VALUES ('site', ?1) ON CONFLICT(key) DO UPDATE SET value = ?1").bind(JSON.stringify(s)).run();
    return json({ settings: s });
  }

  if (path === "/media" && method === "GET") {
    const rows = await env.DB.prepare("SELECT key, mime, size, created_at FROM media ORDER BY created_at DESC LIMIT 500").all();
    return json({ media: rows.results });
  }
  if (path === "/media" && method === "POST") {
    if (Number(req.headers.get("content-length") ?? 0) > MAX_UPLOAD + 10_000) throw new HttpError(413, "Image must be 5 MB or smaller");
    const form = await req.formData().catch(() => { throw new HttpError(400, "Expected a multipart upload"); });
    const file = form.get("file");
    if (!(file instanceof File)) throw new HttpError(400, "No file provided");
    if (file.size === 0 || file.size > MAX_UPLOAD) throw new HttpError(413, "Image must be between 1 byte and 5 MB");
    const data = new Uint8Array(await file.arrayBuffer());
    const kind = sniff(data.subarray(0, 12));
    if (!kind) throw new HttpError(415, "Only PNG, JPEG, WebP, GIF and ICO images are allowed");
    const key = `${crypto.randomUUID()}.${kind.ext}`;
    await env.MEDIA.put(key, data, { httpMetadata: { contentType: kind.mime } });
    await env.DB.prepare("INSERT INTO media (key, mime, size, created_at) VALUES (?, ?, ?, ?)").bind(key, kind.mime, data.byteLength, Date.now()).run();
    return json({ key, mime: kind.mime, size: data.byteLength }, 201);
  }
  const md = path.match(/^\/media\/([0-9a-f-]{36}\.(?:png|jpg|webp|gif|ico))$/);
  if (md && method === "DELETE") {
    await deleteMedia(env, md[1], new URL(req.url).searchParams.get("force") === "1");
    return json({ ok: true });
  }
  throw new HttpError(404, "Not found");
}

async function route(req: Request, env: Env): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname;
  if (path.startsWith("/media/") && (req.method === "GET" || req.method === "HEAD")) return serveMedia(req, env, path.slice(7));
  if (path === "/api/public" && req.method === "GET") {
    const rows = await env.DB.prepare("SELECT * FROM projects WHERE status = 'published' ORDER BY position ASC, created_at ASC").all<ProjectRow>();
    return json({ settings: await loadSettings(env), projects: rows.results.map(publicProject) }, 200, { "cache-control": "no-cache" });
  }
  if (path.startsWith("/api/admin/")) return admin(req, env, path.slice("/api/admin".length));
  if (path.startsWith("/api/")) throw new HttpError(404, "Not found");
  return env.ASSETS.fetch(req);
}

export default {
  async fetch(req, env) {
    try {
      return await route(req, env);
    } catch (e) {
      if (e instanceof HttpError) return json({ error: e.message }, e.status, e.headers);
      console.error("Unhandled error", e);
      return json({ error: "Something went wrong on the server" }, 500);
    }
  },
} satisfies ExportedHandler<Env>;
