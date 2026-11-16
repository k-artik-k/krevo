import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { adminApi, ApiError, setCsrf } from "../api";
import { navigate, toast, usePath } from "../router";
import Sky from "../sky/Sky";
import Toast from "../components/Toast";
import HandBox from "../components/HandBox";
import StateScreen from "../components/StateScreen";
import { ForbiddenArt, LogoMark, NotFoundArt, ServerErrorArt } from "../components/Illustrations";
import { DEFAULT_SETTINGS } from "../Viewer";
import type { SiteSettings } from "../types";
import { Ctx } from "./ctx";
import Dashboard from "./Dashboard";
import ProjectsList from "./ProjectsList";
import ProjectEditor from "./ProjectEditor";
import SiteForm from "./SiteForm";
import AppearanceForm from "./AppearanceForm";
import MediaLibrary from "./MediaLibrary";
import "./admin.css";

type Auth = "checking" | "out" | "in" | "forbidden" | "down";
const TABS = [["/admin", "Dashboard"], ["/admin/projects", "Projects"], ["/admin/site", "Site"], ["/admin/appearance", "Appearance"], ["/admin/media", "Media"]] as const;

function Login({ onDone, locked }: { onDone: () => void; locked: string | null }) {
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [lock, setLock] = useState(locked);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr("");
    try { const r = await adminApi.login(pw); setCsrf(r.csrf); onDone(); }
    catch (ex) {
      if (ex instanceof ApiError && ex.status === 429) setLock(ex.message);
      else setErr(ex instanceof ApiError && ex.status === 401 ? "That password isn't right." : ex instanceof Error ? ex.message : "Sign-in failed.");
      setPw("");
    } finally { setBusy(false); }
  };
  if (lock) return (
    <div className="admin narrow"><StateScreen alert art={<ForbiddenArt />} title="Locked for now" text={`${lock} Wait about 15 minutes before trying again.`} /></div>
  );
  return (
    <div className="admin narrow">
      <form className="box login" onSubmit={submit}>
        <HandBox seed="login" fill amp={2} />
        <LogoMark />
        <h1>Admin sign-in</h1>
        <div className="field">
          <label htmlFor="pw">Password</label>
          <input id="pw" type="password" autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} required autoFocus aria-describedby={err ? "pw-err" : undefined} />
        </div>
        {err && <p id="pw-err" className="error" role="alert">{err}</p>}
        <button className="btn primary" disabled={busy || !pw}>{busy ? "Signing in…" : "Sign in"}<HandBox seed="signin" /></button>
        <a href="/" className="back" onClick={(e) => { e.preventDefault(); navigate("/"); location.assign("/"); }}>Back to the archive</a>
      </form>
    </div>
  );
}

export default function AdminApp() {
  const [auth, setAuth] = useState<Auth>("checking");
  const [settings, setSettings] = useState<SiteSettings>(DEFAULT_SETTINGS);
  const [preview, setPreview] = useState<SiteSettings | null>(null);
  const [lockMsg] = useState<string | null>(null);
  const path = usePath();
  const authRef = useRef(auth);
  authRef.current = auth;

  useEffect(() => {
    const meta = document.createElement("meta");
    meta.name = "robots"; meta.content = "noindex";
    document.head.append(meta);
    return () => meta.remove();
  }, []);
  useEffect(() => { document.title = `Admin · ${settings.browserTitle}`; }, [settings.browserTitle]);

  const loadSettings = useCallback(() => adminApi.settings().then((r) => setSettings(r.settings)).catch(() => {}), []);
  useEffect(() => {
    adminApi.session().then((r) => { setCsrf(r.csrf); setAuth("in"); }).catch((e) => setAuth(e instanceof ApiError && e.status === 0 ? "down" : "out"));
  }, []);
  useEffect(() => { if (auth === "in") loadSettings(); }, [auth, loadSettings]);

  const run = useCallback(async <T,>(fn: () => Promise<T>): Promise<T | undefined> => {
    try { return await fn(); }
    catch (e) {
      if (e instanceof ApiError) {
        if (e.status === 401) { setAuth("out"); toast("Your session ended. Sign in again."); return undefined; }
        if (e.status === 403) { setAuth("forbidden"); return undefined; }
        toast(e.message);
      } else toast("Something went wrong.");
      return undefined;
    }
  }, []);

  const ctx = useMemo(() => ({ run, settings, setSettings, setPreview }), [run, settings]);
  const sky = preview ?? settings;
  const logout = async () => { await run(() => adminApi.logout()); setCsrf(""); setAuth("out"); navigate("/admin", true); };

  let body;
  if (auth === "checking") body = <p className="loading" role="status">Checking your session…</p>;
  else if (auth === "down") body = <div className="admin narrow"><StateScreen alert art={<ServerErrorArt />} title="Can't reach the server" text="Check your connection and reload the page." /></div>;
  else if (auth === "forbidden") body = <div className="admin narrow"><StateScreen alert art={<ForbiddenArt />} title="Locked out" text="The server refused that request. Reload the page and sign in again."><button className="btn primary" onClick={() => location.reload()}>Reload<HandBox seed="rl" /></button></StateScreen></div>;
  else if (auth === "out") body = <Login locked={lockMsg} onDone={() => setAuth("in")} />;
  else {
    const p = path.replace(/\/+$/, "") || "/admin";
    let page;
    const edit = p.match(/^\/admin\/projects\/([\w-]+)$/);
    if (p === "/admin") page = <Dashboard />;
    else if (p === "/admin/projects") page = <ProjectsList />;
    else if (edit) page = <ProjectEditor key={edit[1]} id={edit[1] === "new" ? null : edit[1]} />;
    else if (p === "/admin/site") page = <SiteForm />;
    else if (p === "/admin/appearance") page = <AppearanceForm />;
    else if (p === "/admin/media") page = <MediaLibrary />;
    else page = <StateScreen art={<NotFoundArt />} title="No such admin page" text="Use the menu above to find what you need." />;
    body = (
      <Ctx.Provider value={ctx}>
        <div className="admin">
          <header className="admin-top">
            <a className="brand" href="/admin" onClick={(e) => { e.preventDefault(); navigate("/admin"); }}><LogoMark /><span>Admin</span></a>
            <nav aria-label="Admin">
              {TABS.map(([to, label]) => (
                <a key={to} href={to} aria-current={(to === "/admin" ? p === to : p.startsWith(to)) ? "page" : undefined} onClick={(e) => { e.preventDefault(); navigate(to); }}>{label}</a>
              ))}
            </nav>
            <div className="row">
              <a className="btn sm" href="/" target="_blank" rel="noopener">View site<HandBox seed="vs" /></a>
              <button className="btn sm" onClick={logout}>Sign out<HandBox seed="so" /></button>
            </div>
          </header>
          <main id="main">{page}</main>
        </div>
      </Ctx.Provider>
    );
  }
  return (
    <>
      <Sky clouds={sky.clouds} birds={sky.birds} intensity={sky.intensity} timeSky={sky.timeSky} easterEggs={sky.easterEggs} />
      {body}
      <Toast />
    </>
  );
}
