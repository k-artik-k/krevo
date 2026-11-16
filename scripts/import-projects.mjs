// Bulk-add projects from a JSON file to a running site (local or live).
// Usage: node scripts/import-projects.mjs projects.json [site-url]
// Default site is http://localhost:5173. Projects whose title already exists are skipped, so re-running is safe.
import { readFileSync, existsSync } from "node:fs";
import { dirname, resolve, extname, basename } from "node:path";
import readline from "node:readline";

const [file, siteArg] = process.argv.slice(2);
if (!file) { console.error("Usage: node scripts/import-projects.mjs projects.json [site-url]"); process.exit(1); }
const site = (siteArg ?? "http://localhost:5173").replace(/\/+$/, "");
const origin = new URL(site).origin;

function ask(q) {
  return new Promise((done) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl._writeToOutput = (s) => { if (s.includes(q)) process.stdout.write(s); };
    rl.question(q, (a) => { rl.close(); process.stdout.write("\n"); done(a); });
  });
}

const raw = JSON.parse(readFileSync(file, "utf8").replace(/^\uFEFF/, ""));
const list = Array.isArray(raw) ? raw : raw.projects;
if (!Array.isArray(list)) { console.error('The JSON must be a list of projects, or {"projects": [...]}'); process.exit(1); }

const password = process.env.ADMIN_PASSWORD ?? (await ask(`Admin password for ${site}: `));
let cookie = "", csrf = "";
async function call(method, path, body) {
  const headers = { origin, cookie, "x-csrf-token": csrf };
  if (body && !(body instanceof FormData)) headers["content-type"] = "application/json";
  const res = await fetch(site + path, { method, headers, body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
  return { data, res };
}

const login = await call("POST", "/api/admin/login", { password }).catch((e) => { console.error("Sign-in failed:", e.message); process.exit(1); });
cookie = login.res.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
csrf = login.data.csrf;

const MIME = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif" };
async function upload(rel) {
  const path = resolve(dirname(file), rel);
  if (!existsSync(path)) throw new Error(`image not found: ${rel}`);
  const form = new FormData();
  form.append("file", new Blob([readFileSync(path)], { type: MIME[extname(path).toLowerCase()] ?? "application/octet-stream" }), basename(path));
  return (await call("POST", "/api/admin/media", form)).data.key;
}

const existing = new Set((await call("GET", "/api/admin/projects")).data.projects.map((p) => p.title.toLowerCase()));
let added = 0, skipped = 0, failed = 0;
for (const p of list) {
  const name = p.title ?? "(no title)";
  if (existing.has(String(p.title).toLowerCase())) { console.log(`skip   ${name} (already exists)`); skipped++; continue; }
  try {
    const coverKey = p.cover ? await upload(p.cover) : null;
    const gallery = [];
    for (const g of p.gallery ?? []) gallery.push(await upload(g));
    await call("POST", "/api/admin/projects", {
      title: p.title, year: p.year, category: p.category, shortDescription: p.shortDescription, fullDescription: p.fullDescription,
      technologies: p.technologies ?? [], githubUrl: p.githubUrl, liveUrl: p.liveUrl, videoUrl: p.videoUrl, coverKey, gallery,
      status: p.status ?? "draft",
    });
    console.log(`added  ${name}`); added++;
  } catch (e) { console.log(`FAILED ${name}: ${e.message}`); failed++; }
}
console.log(`\nDone: ${added} added, ${skipped} skipped, ${failed} failed. New projects go to the end of the list; reorder them in /admin.`);