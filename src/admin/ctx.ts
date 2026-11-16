import { createContext, useContext } from "react";
import type { SiteSettings } from "../types";

export interface AdminCtx {
  /** Runs an API call, handling expired sessions and showing errors. Resolves undefined on failure. */
  run: <T>(fn: () => Promise<T>) => Promise<T | undefined>;
  settings: SiteSettings;
  setSettings: (s: SiteSettings) => void;
  setPreview: (s: SiteSettings | null) => void;
}
export const Ctx = createContext<AdminCtx>(null as unknown as AdminCtx);
export const useAdmin = () => useContext(Ctx);
