import { FormEvent, useState } from "react";
import { toast } from "../router";
import HandBox from "../components/HandBox";
import type { Link, SiteSettings } from "../types";
import MediaField from "./MediaField";
import { useAdmin } from "./ctx";

function LinkList({ label, value, onChange }: { label: string; value: Link[]; onChange: (l: Link[]) => void }) {
  const upd = (i: number, k: keyof Link, v: string) => onChange(value.map((l, j) => (j === i ? { ...l, [k]: v } : l)));
  return (
    <fieldset className="field links-field">
      <legend>{label}</legend>
      {value.map((l, i) => (
        <div className="link-row" key={i}>
          <input aria-label={`${label} ${i + 1} label`} placeholder="Label" value={l.label} maxLength={40} onChange={(e) => upd(i, "label", e.target.value)} />
          <input aria-label={`${label} ${i + 1} URL`} placeholder="https://…" type="url" inputMode="url" value={l.url} onChange={(e) => upd(i, "url", e.target.value)} />
          <button type="button" className="btn sm danger" onClick={() => onChange(value.filter((_, j) => j !== i))} aria-label={`Remove ${label} ${i + 1}`}>Remove</button>
        </div>
      ))}
      {value.length < 8 && <button type="button" className="btn sm" onClick={() => onChange([...value, { label: "", url: "" }])}>Add link<HandBox seed={"al" + label} /></button>}
    </fieldset>
  );
}

export default function SiteForm() {
  const { run, settings, setSettings } = useAdmin();
  const [f, setF] = useState<SiteSettings>(settings);
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof SiteSettings>(k: K, v: SiteSettings[K]) => setF((s) => ({ ...s, [k]: v }));
  const text = (k: "displayName" | "profileName" | "profileBio" | "browserTitle" | "copyright" | "footerText" | "aboutText") => ({ id: `s-${k}`, value: f[k], onChange: (e: { target: { value: string } }) => set(k, e.target.value) });
  const nullable = (k: "githubUrl" | "portfolioUrl" | "contactEmail") => ({ id: `s-${k}`, value: f[k] ?? "", onChange: (e: { target: { value: string } }) => set(k, e.target.value || null) });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const r = await run(() => adminApi.saveSettings(f));
    setBusy(false);
    if (r) { setSettings(r.settings); setF(r.settings); toast("Site settings saved."); }
  };
  return (
    <form className="box editor" onSubmit={submit} noValidate>
      <HandBox seed="site" fill amp={2} />
      <h1 className="page-title">Site settings</h1>
      <MediaField label="Logo" value={f.logoKey} onChange={(k) => set("logoKey", k)} hint="Square images look best. Without one, a small sun-and-cloud mark is used." />
      <div className="grid2">
        <div className="field"><label htmlFor="s-displayName">Display name</label><input {...text("displayName")} required maxLength={60} /></div>
        <div className="field"><label htmlFor="s-browserTitle">Browser title</label><input {...text("browserTitle")} required maxLength={80} /></div>
      </div>
      <MediaField label="Favicon" value={f.faviconKey} onChange={(k) => set("faviconKey", k)} hint="A small square PNG or ICO." />
      <h2>Profile</h2>
      <div className="field"><label htmlFor="s-profileName">Profile name</label><input {...text("profileName")} maxLength={60} /><span className="hint">Also used as the owner's name in the footer.</span></div>
      <div className="field"><label htmlFor="s-profileBio">Short bio</label><input {...text("profileBio")} maxLength={300} /></div>
      <div className="field"><label htmlFor="s-aboutText">About</label><textarea {...text("aboutText")} rows={6} maxLength={3000} /><span className="hint">Opens from the profile menu. Leave empty to hide the About item.</span></div>
      <div className="grid2">
        <div className="field"><label htmlFor="s-githubUrl">GitHub URL</label><input {...nullable("githubUrl")} type="url" inputMode="url" /></div>
        <div className="field"><label htmlFor="s-portfolioUrl">Portfolio URL</label><input {...nullable("portfolioUrl")} type="url" inputMode="url" /></div>
      </div>
      <LinkList label="Extra profile links" value={f.profileLinks} onChange={(l) => set("profileLinks", l)} />
      <h2>Footer</h2>
      <div className="field"><label htmlFor="s-contactEmail">Contact email</label><input {...nullable("contactEmail")} type="email" /></div>
      <div className="field"><label htmlFor="s-copyright">Copyright line</label><input {...text("copyright")} maxLength={120} /><span className="hint">Leave empty to use “© year, name”.</span></div>
      <div className="field"><label htmlFor="s-footerText">Footer note</label><input {...text("footerText")} maxLength={300} /></div>
      <LinkList label="Footer links" value={f.footerLinks} onChange={(l) => set("footerLinks", l)} />
      <button className="btn primary" disabled={busy}>{busy ? "Saving…" : "Save settings"}<HandBox seed="ss" /></button>
    </form>
  );
}
