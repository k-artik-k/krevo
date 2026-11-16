import { FormEvent, useEffect, useState } from "react";
import { adminApi } from "../api";
import { navigate, toast } from "../router";
import HandBox from "../components/HandBox";
import MediaField, { GalleryField } from "./MediaField";
import { useAdmin } from "./ctx";

interface Form {
  title: string; year: string; category: string; shortDescription: string; fullDescription: string; technologies: string;
  githubUrl: string; liveUrl: string; videoUrl: string; coverKey: string | null; gallery: string[]; status: "draft" | "published";
}
const blank = (): Form => ({ title: "", year: String(new Date().getFullYear()), category: "", shortDescription: "", fullDescription: "", technologies: "", githubUrl: "", liveUrl: "", videoUrl: "", coverKey: null, gallery: [], status: "draft" });

export default function ProjectEditor({ id }: { id: string | null }) {
  const { run } = useAdmin();
  const [form, setForm] = useState<Form | null>(id ? null : blank());
  const [cats, setCats] = useState<string[]>([]);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const dirty = useRef(false);
  const trash = useRef<string[]>([]); // replaced/removed images, deleted from storage after a successful save

  useEffect(() => {
    run(() => adminApi.projects()).then((r) => {
      if (!r) return;
      setCats([...new Set(r.projects.map((p) => p.category).filter(Boolean))]);
      if (!id) return;
      const p = r.projects.find((x) => x.id === id);
      if (!p) { toast("That project no longer exists."); navigate("/admin/projects", true); return; }
      setForm({ title: p.title, year: String(p.year), category: p.category, shortDescription: p.shortDescription, fullDescription: p.fullDescription, technologies: p.technologies.join(", "),
        githubUrl: p.githubUrl ?? "", liveUrl: p.liveUrl ?? "", videoUrl: p.videoUrl ?? "", coverKey: p.coverKey, gallery: p.gallery, status: p.status });
    });
  }, [id, run]);
  useEffect(() => {
    const f = (e: BeforeUnloadEvent) => { if (dirty.current) e.preventDefault(); };
    window.addEventListener("beforeunload", f);
    return () => window.removeEventListener("beforeunload", f);
  }, []);

  if (!form) return <p className="loading" role="status">Loading…</p>;
  const set = <K extends keyof Form>(k: K, v: Form[K]) => { dirty.current = true; setForm((f) => f && { ...f, [k]: v }); };
  const bind = (k: keyof Form) => ({ id: `f-${k}`, value: form[k] as string, onChange: (e: { target: { value: string } }) => set(k, e.target.value as never) });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr("");
    const body = { ...form, year: Number(form.year), technologies: form.technologies.split(",").map((t) => t.trim()).filter(Boolean) };
    try {
      const r = await (async () => {
        const res = id ? await run(() => adminApi.update(id, body)) : await run(() => adminApi.create(body));
        return res;
      })();
      if (r) {
        dirty.current = false;
        for (const k of trash.current) await adminApi.deleteMedia(k).catch(() => {}); // refused if another project still uses it
        toast(form.status === "published" ? "Saved and published." : "Saved as draft.");
        navigate("/admin/projects");
      }
    } finally { setBusy(false); }
  };

  return (
    <form className="box editor" onSubmit={submit} noValidate>
      <HandBox seed="editor" fill amp={2} />
      <h1 className="page-title">{id ? "Edit project" : "Add project"}</h1>
      <div className="grid2">
        <div className="field"><label htmlFor="f-title">Title</label><input {...bind("title")} required maxLength={100} /></div>
        <div className="field"><label htmlFor="f-year">Year</label><input {...bind("year")} type="number" min={1980} max={2100} required /></div>
      </div>
      <div className="field">
        <label htmlFor="f-category">Category</label>
        <input {...bind("category")} maxLength={40} list="cats" />
        <datalist id="cats">{cats.map((c) => <option key={c} value={c} />)}</datalist>
      </div>
      <div className="field">
        <label htmlFor="f-shortDescription">Short description</label>
        <input {...bind("shortDescription")} maxLength={180} aria-describedby="sd-hint" />
        <span className="hint" id="sd-hint">Shown on the card. {form.shortDescription.length}/180</span>
      </div>
      <div className="field">
        <label htmlFor="f-fullDescription">Full description</label>
        <textarea {...bind("fullDescription")} rows={8} maxLength={8000} aria-describedby="fd-hint" />
        <span className="hint" id="fd-hint">Shown in the project window. Leave a blank line between paragraphs.</span>
      </div>
      <div className="field">
        <label htmlFor="f-technologies">Technologies</label>
        <input {...bind("technologies")} aria-describedby="t-hint" />
        <span className="hint" id="t-hint">Separate with commas, e.g. React, Python, Arduino.</span>
      </div>
      <div className="grid2">
        <div className="field"><label htmlFor="f-githubUrl">GitHub URL</label><input {...bind("githubUrl")} type="url" inputMode="url" placeholder="https://github.com/…" /></div>
        <div className="field"><label htmlFor="f-liveUrl">Live URL</label><input {...bind("liveUrl")} type="url" inputMode="url" placeholder="https://…" /></div>
      </div>
      <div className="field"><label htmlFor="f-videoUrl">Demo video URL</label><input {...bind("videoUrl")} type="url" inputMode="url" aria-describedby="v-hint" /><span className="hint" id="v-hint">YouTube, Vimeo, or a direct .mp4 or .webm link.</span></div>
      <MediaField label="Cover image" value={form.coverKey} onChange={(k, old) => { if (old) trash.current.push(old); set("coverKey", k); }} hint="Shown on the project card. 16:10 works best." />
      <GalleryField value={form.gallery} onChange={(keys, removed) => { if (removed) trash.current.push(removed); set("gallery", keys); }} />
      <div className="field">
        <label htmlFor="f-status">Status</label>
        <select {...bind("status")}><option value="draft">Draft (hidden from visitors)</option><option value="published">Published</option></select>
      </div>
      {err && <p className="error" role="alert">{err}</p>}
      <div className="row">
        <button className="btn primary" disabled={busy}>{busy ? "Saving…" : "Save project"}<HandBox seed="save" /></button>
        <button type="button" className="btn" onClick={() => { if (!dirty.current || confirm("Discard your changes?")) { dirty.current = false; navigate("/admin/projects"); } }}>Cancel<HandBox seed="cancel" /></button>
      </div>
    </form>
  );
}
