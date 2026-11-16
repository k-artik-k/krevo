export interface Link { label: string; url: string }

export interface SiteSettings {
  displayName: string;
  logoKey: string | null;
  profileName: string;
  profileBio: string;
  aboutText: string;
  githubUrl: string | null;
  portfolioUrl: string | null;
  contactEmail: string | null;
  copyright: string;
  footerText: string;
  profileLinks: Link[];
  footerLinks: Link[];
  browserTitle: string;
  faviconKey: string | null;
  clouds: boolean;
  birds: boolean;
  intensity: number;
  timeSky: boolean;
  easterEggs: boolean;
}

export interface Project {
  id: string;
  slug: string;
  title: string;
  year: number;
  category: string;
  shortDescription: string;
  fullDescription: string;
  technologies: string[];
  githubUrl: string | null;
  liveUrl: string | null;
  videoUrl: string | null;
  coverKey: string | null;
  gallery: string[];
}

export interface AdminProject extends Project {
  status: "draft" | "published";
  position: number;
  createdAt: number;
  updatedAt: number;
}

export interface MediaItem { key: string; mime: string; size: number; created_at: number }

export const mediaUrl = (key?: string | null) => {
  if (!key) return undefined;
  if (key.startsWith("http://") || key.startsWith("https://")) return key;
  return `/media/${key}`;
};
