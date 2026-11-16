import type { AdminProject, MediaItem, Project, SiteSettings } from "./types";

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

let csrf = "";
export const setCsrf = (t: string) => { csrf = t; };

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {};
  let payload: BodyInit | undefined;
  if (body instanceof FormData) payload = body;
  else if (body !== undefined) { headers["content-type"] = "application/json"; payload = JSON.stringify(body); }
  if (method !== "GET") headers["x-csrf-token"] = csrf;
  let res: Response;
  try {
    res = await fetch(path, { method, headers, body: payload, credentials: "same-origin" });
  } catch {
    throw new ApiError(0, "Can't reach the server");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, (data as { error?: string }).error ?? `Request failed (${res.status})`);
  return data as T;
}

export const publicApi = {
  load: () => request<{ settings: SiteSettings; projects: Project[] }>("GET", "/api/public"),
};

const A = "/api/admin";
export const adminApi = {
  session: () => request<{ csrf: string }>("GET", `${A}/session`),
  login: (password: string) => request<{ csrf: string }>("POST", `${A}/login`, { password }),
  logout: () => request<{ ok: true }>("POST", `${A}/logout`),
  projects: () => request<{ projects: AdminProject[] }>("GET", `${A}/projects`),
  create: (p: unknown) => request<{ project: AdminProject }>("POST", `${A}/projects`, p),
  update: (id: string, p: unknown) => request<{ project: AdminProject }>("PUT", `${A}/projects/${id}`, p),
  setStatus: (id: string, status: "draft" | "published") => request<{ project: AdminProject }>("PATCH", `${A}/projects/${id}`, { status }),
  remove: (id: string) => request<{ ok: true }>("DELETE", `${A}/projects/${id}`),
  duplicate: (id: string) => request<{ project: AdminProject }>("POST", `${A}/projects/${id}/duplicate`),
  reorder: (ids: string[]) => request<{ ok: true }>("PUT", `${A}/projects/order`, { ids }),
  settings: () => request<{ settings: SiteSettings }>("GET", `${A}/settings`),
  saveSettings: (s: SiteSettings) => request<{ settings: SiteSettings }>("PUT", `${A}/settings`, s),
  media: () => request<{ media: MediaItem[] }>("GET", `${A}/media`),
  upload: (file: File) => { const f = new FormData(); f.append("file", file); return request<{ key: string }>("POST", `${A}/media`, f); },
  deleteMedia: (key: string, force = false) => request<{ ok: true }>("DELETE", `${A}/media/${key}${force ? "?force=1" : ""}`),
};
