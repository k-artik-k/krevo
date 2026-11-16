
import type { AdminProject, MediaItem, Project, SiteSettings } from "./types";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

let csrf = "";
export const setCsrf = (t: string) => {
  csrf = t;
};

const MAX_MEDIA_BYTES = 1_200_000;

async function prepareMediaFile(file: File): Promise<File> {
  if (file.size <= MAX_MEDIA_BYTES) return file;

  const supported = ["image/png", "image/jpeg", "image/webp"];
  if (!supported.includes(file.type.toLowerCase())) {
    throw new ApiError(
      413,
      "This image exceeds the 1.2 MB limit. GIF and ICO files cannot be automatically compressed."
    );
  }

  if (typeof createImageBitmap !== "function") {
    throw new ApiError(0, "This browser cannot compress the selected image.");
  }

  let bitmap: ImageBitmap;

  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new ApiError(400, "The selected image could not be decoded.");
  }

  try {
    const canvas = document.createElement("canvas");
    const maxDimension = 2400;
    let scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));

    const qualities = [0.88, 0.82, 0.76, 0.68, 0.60];

    for (const quality of qualities) {
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));

      const context = canvas.getContext("2d");
      if (!context) {
        throw new ApiError(0, "Could not prepare the image for compression.");
      }

      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (result) => {
            if (result) resolve(result);
            else reject(new Error("Image compression failed."));
          },
          "image/webp",
          quality
        );
      });

      if (blob.size <= MAX_MEDIA_BYTES) {
        const baseName = file.name.replace(/\.[^.]+$/, "") || "image";
        return new File([blob], `${baseName}.webp`, {
          type: "image/webp",
          lastModified: Date.now(),
        });
      }

      scale *= 0.82;
    }

    throw new ApiError(
      413,
      "This image is still too large after compression. Choose a smaller image."
    );
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(400, "Image compression failed.");
  } finally {
    bitmap.close();
  }
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown
): Promise<T> {
  const headers: Record<string, string> = {};
  let payload: BodyInit | undefined;

  if (body instanceof FormData) {
    payload = body;
  } else if (body !== undefined) {
    headers["content-type"] = "application/json";
    payload = JSON.stringify(body);
  }

  if (method !== "GET") {
    headers["x-csrf-token"] = csrf;
  }

  let res: Response;

  try {
    res = await fetch(path, {
      method,
      headers,
      body: payload,
      credentials: "same-origin",
    });
  } catch {
    throw new ApiError(0, "Can't reach the server");
  }

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new ApiError(
      res.status,
      (data as { error?: string }).error ?? `Request failed (${res.status})`
    );
  }

  return data as T;
}

export const publicApi = {
  load: () =>
    request<{ settings: SiteSettings; projects: Project[] }>(
      "GET",
      "/api/public"
    ),
};

const A = "/api/admin";

export const adminApi = {
  session: () => request<{ csrf: string }>("GET", `${A}/session`),

  login: (password: string) =>
    request<{ csrf: string }>("POST", `${A}/login`, { password }),

  logout: () => request<{ ok: true }>("POST", `${A}/logout`),

  projects: () =>
    request<{ projects: AdminProject[] }>("GET", `${A}/projects`),

  create: (p: unknown) =>
    request<{ project: AdminProject }>("POST", `${A}/projects`, p),

  update: (id: string, p: unknown) =>
    request<{ project: AdminProject }>("PUT", `${A}/projects/${id}`, p),

  setStatus: (id: string, status: "draft" | "published") =>
    request<{ project: AdminProject }>("PATCH", `${A}/projects/${id}`, {
      status,
    }),

  remove: (id: string) =>
    request<{ ok: true }>("DELETE", `${A}/projects/${id}`),

  duplicate: (id: string) =>
    request<{ project: AdminProject }>(
      "POST",
      `${A}/projects/${id}/duplicate`
    ),

  reorder: (ids: string[]) =>
    request<{ ok: true }>("PUT", `${A}/projects/order`, { ids }),

  settings: () =>
    request<{ settings: SiteSettings }>("GET", `${A}/settings`),

  saveSettings: (s: SiteSettings) =>
    request<{ settings: SiteSettings }>("PUT", `${A}/settings`, s),

  media: () =>
    request<{ media: MediaItem[] }>("GET", `${A}/media`),

  upload: async (file: File) => {
    const prepared = await prepareMediaFile(file);
    const form = new FormData();
    form.append("file", prepared);

    return request<{ key: string }>("POST", `${A}/media`, form);
  },

  deleteMedia: (key: string, force = false) =>
    request<{ ok: true }>(
      "DELETE",
      `${A}/media/${encodeURIComponent(key)}${force ? "?force=1" : ""}`
    ),
};
