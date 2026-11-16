import { useEffect, useState } from "react";

export function navigate(to: string, replace = false, state: object = {}) {
  history[replace ? "replaceState" : "pushState"](state, "", to);
  window.dispatchEvent(new Event("app:navigate"));
}

export function usePath(): string {
  const [path, setPath] = useState(location.pathname);
  useEffect(() => {
    const f = () => setPath(location.pathname);
    window.addEventListener("popstate", f);
    window.addEventListener("app:navigate", f);
    return () => { window.removeEventListener("popstate", f); window.removeEventListener("app:navigate", f); };
  }, []);
  return path;
}

export function toast(message: string) {
  window.dispatchEvent(new CustomEvent("archive:toast", { detail: message }));
}
