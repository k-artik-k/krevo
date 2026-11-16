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

  throw new HttpError(404, "Not found");
}

async function route(req: Request, env: Env): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname;
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
