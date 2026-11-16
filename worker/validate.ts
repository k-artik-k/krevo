import { HttpError } from "./util";

type Obj = Record<string, unknown>;
const bad = (m: string) => new HttpError(400, m);

export function str(v: unknown, field: string, max: number, required = false): string {
  if (v == null || v === "") { if (required) throw bad(`${field} is required`); return ""; }
  if (typeof v !== "string") throw bad(`${field} must be text`);
  const t = v.trim();
  if (required && !t) throw bad(`${field} is required`);
  if (t.length > max) throw bad(`${field} must be at most ${max} characters`);
  return t;
}

export function url(v: unknown, field: string): string | null {
  const s = str(v, field, 500);
  if (!s) return null;
  try {
    const u = new URL(s);
    if (u.protocol !== "https:" && u.protocol !== "http:") throw 0;
    return u.toString();
  } catch { throw bad(`${field} must be a valid http(s) URL`); }
}

export function email(v: unknown, field: string): string | null {
  const s = str(v, field, 200);
  if (!s) return null;
  if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(s)) throw bad(`${field} must be a valid email address`);
  return s;
}

const MEDIA_KEY = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpg|webp|gif|ico)$/;
export function mediaKey(v: unknown, field: string): string | null {
  if (v == null || v === "") return null;
  if (typeof v !== "string" || !MEDIA_KEY.test(v)) throw bad(`${field} is not a valid media key`);
  return v;
}

function bool(v: unknown, d: boolean): boolean { return typeof v === "boolean" ? v : d; }

function links(v: unknown, field: string): { label: string; url: string }[] {
  if (v == null) return [];
  if (!Array.isArray(v) || v.length > 8) throw bad(`${field} must be a list of at most 8 links`);
  return v.map((l, i) => {
    const o = (l ?? {}) as Obj;
    return { label: str(o.label, `${field} ${i + 1} label`, 40, true), url: url(o.url, `${field} ${i + 1} URL`) ?? (() => { throw bad(`${field} ${i + 1} URL is required`); })() };
  });
}

export function projectInput(b: Obj) {
  const year = Number(b.year);
  if (!Number.isInteger(year) || year < 1980 || year > 2100) throw bad("Year must be between 1980 and 2100");
  const techRaw = b.technologies ?? [];
  if (!Array.isArray(techRaw) || techRaw.length > 30) throw bad("Technologies must be a list of at most 30 items");
  const technologies = [...new Set(techRaw.map((t) => str(t, "Technology", 40)).filter(Boolean))];
  const galleryRaw = b.gallery ?? [];
  if (!Array.isArray(galleryRaw) || galleryRaw.length > 20) throw bad("Gallery can hold at most 20 images");
  const status = b.status === "published" ? "published" : b.status === "draft" || b.status == null ? "draft" : (() => { throw bad("Invalid status"); })();
  return {
    title: str(b.title, "Title", 100, true),
    year,
    category: str(b.category, "Category", 40),
    short_description: str(b.shortDescription, "Short description", 180),
    full_description: str(b.fullDescription, "Full description", 8000),
    technologies,
    github_url: url(b.githubUrl, "GitHub URL"),
    live_url: url(b.liveUrl, "Live URL"),
    video_url: url(b.videoUrl, "Demo video URL"),
    cover_key: mediaKey(b.coverKey, "Cover image"),
    gallery: galleryRaw.map((g) => mediaKey(g, "Gallery image")).filter((g): g is string => !!g),
    status,
  };
}

export const DEFAULT_SETTINGS = {
  displayName: "Project Archive",
  logoKey: null as string | null,
  profileName: "",
  profileBio: "",
  aboutText: "",
  githubUrl: null as string | null,
  portfolioUrl: null as string | null,
  contactEmail: null as string | null,
  copyright: "",
  footerText: "",
  profileLinks: [] as { label: string; url: string }[],
  footerLinks: [] as { label: string; url: string }[],
  browserTitle: "Project Archive",
  faviconKey: null as string | null,
  clouds: true,
  birds: true,
  intensity: 2,
  timeSky: true,
  easterEggs: true,
};
export type Settings = typeof DEFAULT_SETTINGS;

export function settingsInput(b: Obj): Settings {
  const d = DEFAULT_SETTINGS;
  const intensity = Number(b.intensity ?? d.intensity);
  if (![1, 2, 3].includes(intensity)) throw bad("Intensity must be 1, 2 or 3");
  return {
    displayName: str(b.displayName, "Display name", 60, true),
    logoKey: mediaKey(b.logoKey, "Logo"),
    profileName: str(b.profileName, "Profile name", 60),
    profileBio: str(b.profileBio, "Profile bio", 300),
    aboutText: str(b.aboutText, "About", 3000),
    githubUrl: url(b.githubUrl, "GitHub URL"),
    portfolioUrl: url(b.portfolioUrl, "Portfolio URL"),
    contactEmail: email(b.contactEmail, "Contact email"),
    copyright: str(b.copyright, "Copyright", 120),
    footerText: str(b.footerText, "Footer text", 300),
    profileLinks: links(b.profileLinks, "Profile links"),
    footerLinks: links(b.footerLinks, "Footer links"),
    browserTitle: str(b.browserTitle, "Browser title", 80, true),
    faviconKey: mediaKey(b.faviconKey, "Favicon"),
    clouds: bool(b.clouds, d.clouds),
    birds: bool(b.birds, d.birds),
    intensity,
    timeSky: bool(b.timeSky, d.timeSky),
    easterEggs: bool(b.easterEggs, d.easterEggs),
  };
}
