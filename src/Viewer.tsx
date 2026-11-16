import { useCallback, useEffect, useRef, useState } from "react";
import { publicApi, ApiError } from "./api";
import { navigate, usePath } from "./router";
import Sky from "./sky/Sky";
import Header from "./components/Header";
import Footer from "./components/Footer";
import ProjectCard from "./components/ProjectCard";
import ProjectDialog from "./components/ProjectDialog";
import StateScreen from "./components/StateScreen";
import Modal from "./components/Modal";
import Toast from "./components/Toast";
import HandBox from "./components/HandBox";
import { EmptySkyArt, NotFoundArt, OfflineArt, ServerErrorArt } from "./components/Illustrations";
import { mediaUrl, type Project, type SiteSettings } from "./types";

export const DEFAULT_SETTINGS: SiteSettings = {
  displayName: "Project Archive", logoKey: null, profileName: "", profileBio: "", aboutText: "", githubUrl: null, portfolioUrl: null,
  contactEmail: null, copyright: "", footerText: "", profileLinks: [], footerLinks: [], browserTitle: "Project Archive", faviconKey: null,
  clouds: true, birds: true, intensity: 2, timeSky: true, easterEggs: true,
};

type Data = { status: "loading" } | { status: "error"; offline: boolean } | { status: "ready"; settings: SiteSettings; projects: Project[] };
const KONAMI = ["ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown", "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight", "b", "a"];


function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}


export function applyHead(settings: SiteSettings, extra?: string) {
  document.title = extra ? `${extra} · ${settings.browserTitle}` : settings.browserTitle;
  if (settings.faviconKey) {
    let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (!link) { link = document.createElement("link"); link.rel = "icon"; document.head.append(link); }
    link.removeAttribute("type");
    link.href = mediaUrl(settings.faviconKey)!;
  }
}

export default function Viewer() {
  const [data, setData] = useState<Data>({ status: "loading" });
  const [about, setAbout] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);
  const path = usePath();
  const gridRef = useRef<HTMLElement>(null);

  const load = useCallback(() => {
    setData({ status: "loading" });
    publicApi.load().then((d) => setData({ status: "ready", ...d })).catch((e: unknown) => setData({ status: "error", offline: !navigator.onLine || (e instanceof ApiError && e.status === 0) }));
  }, []);
  useEffect(load, [load]);
  useEffect(() => {
    const on = () => setOnline(true), off = () => setOnline(false);
    window.addEventListener("online", on); window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);

  const settings = data.status === "ready" ? data.settings : DEFAULT_SETTINGS;
  const projects = data.status === "ready" ? data.projects : [];
const slug = path.startsWith("/p/") ? safeDecode(path.slice(3).replace(/\/+$/, "")) : null;
  const known = path === "/" || slug !== null;
  const current = slug ? projects.find((p) => p.slug === slug) ?? null : null;
  const dialogOpen = known && slug !== null && data.status === "ready";

  useEffect(() => { if (data.status === "ready") applyHead(settings, current?.title); }, [data, settings, current]);

  const open = (p: Project) => navigate(`/p/${p.slug}`, false, { overlay: true });
  const close = useCallback(() => { if (history.state?.overlay) history.back(); else navigate("/", true); }, []);
  const home = () => { if (path !== "/") close(); window.scrollTo({ top: 0, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" }); };
  const random = () => {
    const pool = projects.filter((p) => p.slug !== slug);
    if (pool.length) open(pool[Math.floor(Math.random() * pool.length)]);
  };

  // Hidden keyboard sequence (Konami code).
  // Hidden keyboard sequences: Konami code, and the typed words "time", "origin", "latest". Double-click empty sky to make a wish.
  useEffect(() => {
    if (!settings.easterEggs) return;
    let buf: string[] = [];
    const say = (m: string) => window.dispatchEvent(new CustomEvent("archive:toast", { detail: m }));
    const f = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest?.("input, textarea, select, [contenteditable]") || e.ctrlKey || e.metaKey || e.altKey) return;
      buf = [...buf, e.key.length === 1 ? e.key.toLowerCase() : e.key].slice(-12);
      const tail = buf.join("");
      if (buf.slice(-KONAMI.length).join() === KONAMI.join()) {
        buf = []; window.dispatchEvent(new Event("archive:meteors")); say("Meteor shower unlocked.");
      } else if (tail.endsWith("time")) {
        buf = []; window.dispatchEvent(new Event("archive:timelapse")); say("Time machine: one whole day in 20 seconds.");
      } else if (tail.endsWith("origin") || tail.endsWith("latest")) {
        const oldest = tail.endsWith("origin");
        buf = [];
        const pick = [...projects].sort((a, b) => (oldest ? a.year - b.year : b.year - a.year))[0];
        if (pick) { open(pick); say(oldest ? `Where it all started: ${pick.year}.` : `The newest thing: ${pick.year}.`); }
      }
    };
    const dbl = (e: MouseEvent) => {
      if ((e.target as HTMLElement)?.closest?.("a, button, input, textarea, select, [role=dialog], .panel, .scrim, .state, .card")) return;
      window.dispatchEvent(new Event("archive:wish")); say("Make a wish.");
    };
    window.addEventListener("keydown", f);
    window.addEventListener("dblclick", dbl);
    return () => { window.removeEventListener("keydown", f); window.removeEventListener("dblclick", dbl); };
  }, [settings.easterEggs, projects]);

  let body;
  if (!known) {
    body = (
      <StateScreen art={<NotFoundArt />} title="This page flew away" text="There's nothing at this address. The link may be old or mistyped.">
        <a className="btn primary" href="/" onClick={(e) => { e.preventDefault(); navigate("/"); }}>Back to the archive<HandBox seed="home" /></a>
      </StateScreen>
    );
  } else if (data.status === "loading") {
    body = <p className="loading" role="status">Loading projects…</p>;
  } else if (data.status === "error") {
    body = data.offline
      ? <StateScreen alert art={<OfflineArt />} title="You're offline" text="Reconnect to the internet and the archive will load."><button className="btn primary" onClick={load}>Try again<HandBox seed="r" /></button></StateScreen>
      : <StateScreen alert art={<ServerErrorArt />} title="The cloud broke" text="Something went wrong on the server. Wait a moment, then try again."><button className="btn primary" onClick={load}>Try again<HandBox seed="r" /></button></StateScreen>;
  } else if (projects.length === 0) {
    body = <StateScreen art={<EmptySkyArt />} title="The sky is empty" text="No projects have been published yet. Check back soon." />;
  } else {
    body = (
      <ul className="grid" aria-label="Projects">
        {projects.map((p, i) => <ProjectCard key={p.id} project={p} index={i} onOpen={open} />)}
      </ul>
    );
  }

  return (
    <>
      <Sky clouds={settings.clouds} birds={settings.birds} intensity={settings.intensity} timeSky={settings.timeSky} easterEggs={settings.easterEggs} />
      <div className="page" inert={dialogOpen || about}>
        <Header settings={settings} onHome={home} onRandom={projects.length ? random : undefined} onAbout={() => setAbout(true)} />
        <main id="main" ref={gridRef}>{body}</main>
        {data.status === "ready" && <Footer settings={settings} />}
      </div>
      {dialogOpen && <ProjectDialog key={slug} project={current} onClose={close} />}
      {about && (
        <Modal seed="about" onClose={() => setAbout(false)} title={(id) => <header className="dlg-head"><h2 id={id}>About</h2></header>}>
          <button className="close" onClick={() => setAbout(false)} aria-label="Close" data-autofocus>
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true"><path d="M5 6 L19 19 M19 5 L6 18" /></svg>
          </button>
          <div className="prose">{settings.aboutText.split(/\n{2,}/).map((p, i) => <p key={i}>{p}</p>)}</div>
        </Modal>
      )}
      {!online && <p className="offline-pill" role="status">You're offline</p>}
      <Toast />
    </>
  );
}
