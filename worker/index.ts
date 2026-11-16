
import {
  assertCsrf,
  assertSameOrigin,
  getSession,
  login,
  logout,
  Session,
} from "./auth";

import {
  DEFAULT_SETTINGS,
  projectInput,
  Settings,
  settingsInput,
} from "./validate";

import {
  Env,
  HttpError,
  json,
  readJson,
  slugify,
} from "./util";

interface ProjectRow {
  id: string;
  slug: string;
  title: string;
  year: number;
  category: string;
  short_description: string;
  full_description: string;
  technologies: string;
  github_url: string | null;
  live_url: string | null;
  video_url: string | null;
  cover_key: string | null;
  gallery: string;
  status: "draft" | "published";
  position: number;
  created_at: number;
  updated_at: number;
}

interface MediaRow {
  key: string;
  mime: string;
  size: number;
  created_at: number;
}

interface MediaBlobRow {
  data: string;
}

const MAX_UPLOAD = 1_200_000;
const MAX_MULTIPART = 1_400_000;

const parseList = (value: string): string[] => {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const publicProject = (row: ProjectRow) => ({
  id: row.id,
  slug: row.slug,
  title: row.title,
  year: row.year,
  category: row.category,
  shortDescription: row.short_description,
  fullDescription: row.full_description,
  technologies: parseList(row.technologies),
  githubUrl: row.github_url,
  liveUrl: row.live_url,
  videoUrl: row.video_url,
  coverKey: row.cover_key,
  gallery: parseList(row.gallery),
});

const adminProject = (row: ProjectRow) => ({
  ...publicProject(row),
  status: row.status,
  position: row.position,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

async function loadSettings(env: Env): Promise<Settings> {
  const row = await env.DB.prepare(
    "SELECT value FROM settings WHERE key = 'site'"
  ).first<{ value: string }>();

  let saved: Record<string, unknown> = {};

  try {
    saved = row ? JSON.parse(row.value) : {};
  } catch {
    // Ignore corrupt settings.
  }

  return { ...DEFAULT_SETTINGS, ...saved } as Settings;
}

async function uniqueSlug(env: Env, title: string): Promise<string> {
  const base = slugify(title) || "project";

  for (let i = 1; i < 50; i++) {
    const slug = i === 1 ? base : `${base}-${i}`;

    const existing = await env.DB.prepare(
      "SELECT 1 FROM projects WHERE slug = ?"
    )
      .bind(slug)
      .first();

    if (!existing) return slug;
  }

  return `${base}-${crypto.randomUUID().slice(0, 6)}`;
}

const get = (env: Env, id: string) =>
  env.DB.prepare("SELECT * FROM projects WHERE id = ?")
    .bind(id)
    .first<ProjectRow>();

const insertSql = `
  INSERT INTO projects (
    id, slug, title, year, category,
    short_description, full_description, technologies,
    github_url, live_url, video_url, cover_key,
    gallery, status, position, created_at, updated_at
  )
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`;

// ---------- D1 media helpers ----------

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";

  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(
      ...bytes.subarray(i, Math.min(i + 0x8000, bytes.length))
    );
  }

  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes;
}

function sniff(bytes: Uint8Array): string | null {
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "image/png";
  }

  if (
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  ) {
    return "image/jpeg";
  }

  if (
    bytes.length >= 6 &&
    String.fromCharCode(...bytes.subarray(0, 3)) === "GIF"
  ) {
    return "image/gif";
  }

  if (
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.subarray(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.subarray(8, 12)) === "WEBP"
  ) {
    return "image/webp";
  }

  if (
    bytes.length >= 4 &&
    bytes[0] === 0x00 &&
    bytes[1] === 0x00 &&
    bytes[2] === 0x01 &&
    bytes[3] === 0x00
  ) {
    return "image/x-icon";
  }

  return null;
}

const mediaExtension: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/x-icon": "ico",
};

const mediaKeyPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpg|gif|webp|ico)$/i;

async function mediaInUse(env: Env, key: string): Promise<boolean> {
  const projects = await env.DB.prepare(
    "SELECT cover_key, gallery FROM projects"
  ).all<Pick<ProjectRow, "cover_key" | "gallery">>();

  for (const project of projects.results) {
    if (project.cover_key === key) return true;
    if (parseList(project.gallery).includes(key)) return true;
  }

  const settingsRow = await env.DB.prepare(
    "SELECT value FROM settings WHERE key = 'site'"
  ).first<{ value: string }>();

  if (settingsRow) {
    try {
      const settings = JSON.parse(settingsRow.value) as {
        logoKey?: string | null;
        faviconKey?: string | null;
      };

      if (settings.logoKey === key || settings.faviconKey === key) {
        return true;
      }
    } catch {
      // Ignore corrupt settings.
    }
  }

  return false;
}

async function deleteMedia(
  env: Env,
  key: string,
  force = false
): Promise<void> {
  if (!mediaKeyPattern.test(key)) {
    throw new HttpError(400, "Invalid media key");
  }

  const exists = await env.DB.prepare(
    "SELECT key FROM media WHERE key = ?"
  )
    .bind(key)
    .first();

  if (!exists) {
    throw new HttpError(404, "Image not found");
  }

  if (await mediaInUse(env, key)) {
    if (!force) {
      throw new HttpError(
        409,
        "This image is being used by a project or site setting"
      );
    }

    const projects = await env.DB.prepare(
      "SELECT id, cover_key, gallery FROM projects"
    ).all<{
      id: string;
      cover_key: string | null;
      gallery: string;
    }>();

    const statements = [];

    for (const project of projects.results) {
      const gallery = parseList(project.gallery);
      const nextGallery = gallery.filter((item) => item !== key);
      const nextCover =
        project.cover_key === key ? null : project.cover_key;

      if (
        nextCover !== project.cover_key ||
        nextGallery.length !== gallery.length
      ) {
        statements.push(
          env.DB.prepare(
            "UPDATE projects SET cover_key = ?, gallery = ?, updated_at = ? WHERE id = ?"
          ).bind(
            nextCover,
            JSON.stringify(nextGallery),
            Date.now(),
            project.id
          )
        );
      }
    }

    const settingsRow = await env.DB.prepare(
      "SELECT value FROM settings WHERE key = 'site'"
    ).first<{ value: string }>();

    if (settingsRow) {
      try {
        const settings = JSON.parse(settingsRow.value) as Record<
          string,
          unknown
        >;

        if (settings.logoKey === key) settings.logoKey = null;
        if (settings.faviconKey === key) settings.faviconKey = null;

        statements.push(
          env.DB.prepare(
            "UPDATE settings SET value = ? WHERE key = 'site'"
          ).bind(JSON.stringify(settings))
        );
      } catch {
        // Do not overwrite corrupt settings.
      }
    }

    statements.push(
      env.DB.prepare("DELETE FROM media_blobs WHERE key = ?").bind(key),
      env.DB.prepare("DELETE FROM media WHERE key = ?").bind(key)
    );

    await env.DB.batch(statements);
    return;
  }

  await env.DB.batch([
    env.DB.prepare("DELETE FROM media_blobs WHERE key = ?").bind(key),
    env.DB.prepare("DELETE FROM media WHERE key = ?").bind(key),
  ]);
}

async function serveMedia(
  req: Request,
  env: Env,
  key: string
): Promise<Response> {
  if (!mediaKeyPattern.test(key)) {
    return new Response("Not found", { status: 404 });
  }

  const metadata = await env.DB.prepare(
    "SELECT key, mime, size, created_at FROM media WHERE key = ?"
  )
    .bind(key)
    .first<MediaRow>();

  if (!metadata) {
    return new Response("Not found", { status: 404 });
  }

  const etag = `"${key}"`;
  const headers = {
    "content-type": metadata.mime,
    "content-length": String(metadata.size),
    "cache-control": "public, max-age=31536000, immutable",
    "etag": etag,
    "x-content-type-options": "nosniff",
  };

  if (req.headers.get("if-none-match") === etag) {
    return new Response(null, { status: 304, headers });
  }

  if (req.method === "HEAD") {
    return new Response(null, { status: 200, headers });
  }

  const blob = await env.DB.prepare(
    "SELECT data FROM media_blobs WHERE key = ?"
  )
    .bind(key)
    .first<MediaBlobRow>();

  if (!blob) {
    return new Response("Image data not found", { status: 404 });
  }

  const bytes = base64ToBytes(blob.data);

  if (bytes.length !== metadata.size) {
    console.error("Media size mismatch:", key);
    return new Response("Image data is corrupted", { status: 500 });
  }

  return new Response(bytes, { status: 200, headers });
}

// ---------- routing ----------

async function admin(
  req: Request,
  env: Env,
  path: string
): Promise<Response> {
  const method = req.method;
  const mutating = method !== "GET" && method !== "HEAD";

  if (mutating) assertSameOrigin(req);

  if (path === "/login" && method === "POST") {
    const body = await readJson(req, 2000);

    if (
      typeof body.password !== "string" ||
      !body.password ||
      body.password.length > 200
    ) {
      throw new HttpError(400, "Password required");
    }

    const { csrf, setCookie } = await login(req, env, body.password);

    return json(
      { authenticated: true, csrf },
      200,
      { "set-cookie": setCookie }
    );
  }

  const session: Session | null = await getSession(req, env);

  if (path === "/logout" && method === "POST") {
    return json(
      { ok: true },
      200,
      { "set-cookie": await logout(req, env, session) }
    );
  }

  if (!session) throw new HttpError(401, "Not signed in");
  if (mutating) assertCsrf(req, session);

  if (path === "/session" && method === "GET") {
    return json({ authenticated: true, csrf: session.csrf });
  }

  // ---------- media API ----------

  if (path === "/media" && method === "GET") {
    const result = await env.DB.prepare(
      "SELECT key, mime, size, created_at FROM media ORDER BY created_at DESC"
    ).all<MediaRow>();

    return json({ media: result.results });
  }

  if (path === "/media" && method === "POST") {
    const contentLength = Number(req.headers.get("content-length") ?? 0);

    if (contentLength > MAX_MULTIPART) {
      throw new HttpError(413, "Upload request is too large");
    }

    let form: FormData;

    try {
      form = await req.formData();
    } catch {
      throw new HttpError(400, "Invalid multipart upload");
    }

    const file = form.get("file");

    if (!(file instanceof File)) {
      throw new HttpError(400, "An image file is required");
    }

    if (file.size === 0) {
      throw new HttpError(400, "The selected image is empty");
    }

    if (file.size > MAX_UPLOAD) {
      throw new HttpError(
        413,
        "Image exceeds the 1.2 MB upload limit"
      );
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const mime = sniff(bytes);

    if (!mime) {
      throw new HttpError(
        415,
        "Unsupported image. Use PNG, JPEG, WebP, GIF or ICO"
      );
    }

    const extension = mediaExtension[mime];

    if (!extension) {
      throw new HttpError(415, "Unsupported image format");
    }

    const key = `${crypto.randomUUID()}.${extension}`;
    const createdAt = Date.now();
    const data = bytesToBase64(bytes);

    await env.DB.batch([
      env.DB.prepare(
        "INSERT INTO media (key, mime, size, created_at) VALUES (?, ?, ?, ?)"
      ).bind(key, mime, bytes.length, createdAt),

      env.DB.prepare(
        "INSERT INTO media_blobs (key, data) VALUES (?, ?)"
      ).bind(key, data),
    ]);

    return json({ key }, 201);
  }

  const mediaDeleteMatch = path.match(/^\/media\/([^/]+)$/);

  if (mediaDeleteMatch && method === "DELETE") {
    let key: string;

    try {
      key = decodeURIComponent(mediaDeleteMatch[1]);
    } catch {
      throw new HttpError(400, "Invalid media key");
    }

    const force = new URL(req.url).searchParams.get("force") === "1";

    await deleteMedia(env, key, force);

    return json({ ok: true });
  }

  // ---------- project API ----------

  if (path === "/projects" && method === "GET") {
    const rows = await env.DB.prepare(
      "SELECT * FROM projects ORDER BY position ASC, created_at ASC"
    ).all<ProjectRow>();

    return json({ projects: rows.results.map(adminProject) });
  }

  if (path === "/projects" && method === "POST") {
    const project = projectInput(await readJson(req));
    const id = crypto.randomUUID();
    const now = Date.now();
    const slug = await uniqueSlug(env, project.title);

    const position =
      (
        await env.DB.prepare(
          "SELECT COALESCE(MAX(position), -1) + 1 AS n FROM projects"
        ).first<{ n: number }>()
      )?.n ?? 0;

    await env.DB.prepare(insertSql)
      .bind(
        id,
        slug,
        project.title,
        project.year,
        project.category,
        project.short_description,
        project.full_description,
        JSON.stringify(project.technologies),
        project.github_url,
        project.live_url,
        project.video_url,
        project.cover_key,
        JSON.stringify(project.gallery),
        project.status,
        position,
        now,
        now
      )
      .run();

    return json(
      { project: adminProject((await get(env, id))!) },
      201
    );
  }

  if (path === "/projects/order" && method === "PUT") {
    const body = await readJson(req);
    const ids = body.ids;

    const rows = await env.DB.prepare(
      "SELECT id FROM projects"
    ).all<{ id: string }>();

    const existing = new Set(rows.results.map((row) => row.id));

    if (
      !Array.isArray(ids) ||
      ids.length !== existing.size ||
      new Set(ids).size !== ids.length ||
      !ids.every(
        (id) => typeof id === "string" && existing.has(id)
      )
    ) {
      throw new HttpError(
        400,
        "Order must list every project exactly once"
      );
    }

    await env.DB.batch(
      (ids as string[]).map((id, index) =>
        env.DB.prepare(
          "UPDATE projects SET position = ? WHERE id = ?"
        ).bind(index, id)
      )
    );

    return json({ ok: true });
  }

  const projectMatch = path.match(
    /^\/projects\/([0-9a-f-]{36})(\/duplicate)?$/i
  );

  if (projectMatch) {
    const id = projectMatch[1];
    const duplicate = Boolean(projectMatch[2]);

    const row = await get(env, id);

    if (!row) {
      throw new HttpError(404, "Project not found");
    }

    if (duplicate && method === "POST") {
      const newId = crypto.randomUUID();
      const now = Date.now();
      const title = `${row.title.slice(0, 90)} (copy)`;
      const slug = await uniqueSlug(env, title);

      await env.DB.batch([
        env.DB.prepare(
          "UPDATE projects SET position = position + 1 WHERE position > ?"
        ).bind(row.position),

        env.DB.prepare(insertSql).bind(
          newId,
          slug,
          title,
          row.year,
          row.category,
          row.short_description,
          row.full_description,
          row.technologies,
          row.github_url,
          row.live_url,
          row.video_url,
          row.cover_key,
          row.gallery,
          "draft",
          row.position + 1,
          now,
          now
        ),
      ]);

      return json(
        { project: adminProject((await get(env, newId))!) },
        201
      );
    }

    if (!duplicate && method === "PUT") {
      const project = projectInput(await readJson(req));

      await env.DB.prepare(`
        UPDATE projects SET
          title = ?, year = ?, category = ?,
          short_description = ?, full_description = ?,
          technologies = ?, github_url = ?, live_url = ?,
          video_url = ?, cover_key = ?, gallery = ?,
          status = ?, updated_at = ?
        WHERE id = ?
      `)
        .bind(
          project.title,
          project.year,
          project.category,
          project.short_description,
          project.full_description,
          JSON.stringify(project.technologies),
          project.github_url,
          project.live_url,
          project.video_url,
          project.cover_key,
          JSON.stringify(project.gallery),
          project.status,
          Date.now(),
          id
        )
        .run();

      return json({
        project: adminProject((await get(env, id))!),
      });
    }

    if (!duplicate && method === "PATCH") {
      const body = await readJson(req, 1000);

      if (
        body.status !== "draft" &&
        body.status !== "published"
      ) {
        throw new HttpError(400, "Invalid status");
      }

      await env.DB.prepare(
        "UPDATE projects SET status = ?, updated_at = ? WHERE id = ?"
      )
        .bind(body.status, Date.now(), id)
        .run();

      return json({
        project: adminProject((await get(env, id))!),
      });
    }

    if (!duplicate && method === "DELETE") {
      await env.DB.prepare(
        "DELETE FROM projects WHERE id = ?"
      )
        .bind(id)
        .run();

      return json({ ok: true });
    }
  }

  // ---------- settings API ----------

  if (path === "/settings" && method === "GET") {
    return json({ settings: await loadSettings(env) });
  }

  if (path === "/settings" && method === "PUT") {
    const settings = settingsInput(await readJson(req));

    await env.DB.prepare(`
      INSERT INTO settings (key, value)
      VALUES ('site', ?1)
      ON CONFLICT(key) DO UPDATE SET value = ?1
    `)
      .bind(JSON.stringify(settings))
      .run();

    return json({ settings });
  }

  throw new HttpError(404, "Not found");
}

// ---------- main router ----------

async function route(
  req: Request,
  env: Env
): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname;

  // Public image delivery from D1.
  if (
    (req.method === "GET" || req.method === "HEAD") &&
    path.startsWith("/media/")
  ) {
    const key = path.slice("/media/".length);
    return serveMedia(req, env, key);
  }

  if (path === "/api/public" && req.method === "GET") {
    const rows = await env.DB.prepare(`
      SELECT * FROM projects
      WHERE status = 'published'
      ORDER BY position ASC, created_at ASC
    `).all<ProjectRow>();

    return json(
      {
        settings: await loadSettings(env),
        projects: rows.results.map(publicProject),
      },
      200,
      { "cache-control": "no-cache" }
    );
  }

  if (path.startsWith("/api/admin/")) {
    return admin(req, env, path.slice("/api/admin".length));
  }

  if (path.startsWith("/api/")) {
    throw new HttpError(404, "Not found");
  }

  return env.ASSETS.fetch(req);
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    try {
      return await route(req, env);
    } catch (error) {
      if (error instanceof HttpError) {
        return json(
          { error: error.message },
          error.status,
          error.headers
        );
      }

      console.error("Unhandled error", error);

      return json(
        { error: "Something went wrong on the server" },
        500
      );
    }
  },
} satisfies ExportedHandler<Env>;
