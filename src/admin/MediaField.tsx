import { useRef, useState } from "react";
import { adminApi } from "../api";
import { mediaUrl } from "../types";
import { useAdmin } from "./ctx";

/** Upload / replace / remove one image. `onChange(newKey, oldKey)` lets the parent delete the old file after saving. */
export default function MediaField({ label, value, onChange, hint }: { label: string; value: string | null; onChange: (key: string | null, old: string | null) => void; hint?: string }) {
  const { run } = useAdmin();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const pick = async (file?: File) => {
    if (!file) return;
    setBusy(true);
    const r = await run(() => adminApi.upload(file));
    setBusy(false);
    if (r) onChange(r.key, value);
    if (input.current) input.current.value = "";
  };
  return (
    <div className="field">
      <span className="label" id={`l-${label}`}>{label}</span>
      <div className="media-field" role="group" aria-labelledby={`l-${label}`}>
        <div className="media-preview">{value ? <img src={mediaUrl(value)} alt={`${label} preview`} /> : <span>No image</span>}</div>
        <div className="row">
          <button type="button" className="btn sm" disabled={busy} onClick={() => input.current?.click()}>{busy ? "Uploading…" : value ? "Replace" : "Upload"}</button>
          {value && <button type="button" className="btn sm danger" disabled={busy} onClick={() => onChange(null, value)}>Remove</button>}
        </div>
        <input ref={input} type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/x-icon" hidden tabIndex={-1} onChange={(e) => pick(e.target.files?.[0])} />
      </div>
      {hint && <span className="hint">{hint}</span>}
    </div>
  );
}

export function GalleryField({ value, onChange }: { value: string[]; onChange: (keys: string[], removed?: string) => void }) {
  const { run } = useAdmin();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const add = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    const keys: string[] = [];
    for (const f of [...files].slice(0, 20 - value.length)) {
      const r = await run(() => adminApi.upload(f));
      if (r) keys.push(r.key);
    }
    setBusy(false);
    if (keys.length) onChange([...value, ...keys]);
    if (input.current) input.current.value = "";
  };
  const move = (i: number, d: number) => { const n = [...value]; [n[i], n[i + d]] = [n[i + d], n[i]]; onChange(n); };
  return (
    <div className="field">
      <span className="label" id="l-gallery">Screenshot gallery</span>
      <ul className="gallery-list" aria-labelledby="l-gallery">
        {value.map((k, i) => (
          <li key={k}>
            <img src={mediaUrl(k)} alt={`Screenshot ${i + 1}`} />
            <div className="row">
              <button type="button" className="btn sm" disabled={i === 0} onClick={() => move(i, -1)} aria-label={`Move screenshot ${i + 1} earlier`}>↑</button>
              <button type="button" className="btn sm" disabled={i === value.length - 1} onClick={() => move(i, 1)} aria-label={`Move screenshot ${i + 1} later`}>↓</button>
              <button type="button" className="btn sm danger" onClick={() => onChange(value.filter((x) => x !== k), k)} aria-label={`Remove screenshot ${i + 1}`}>Remove</button>
            </div>
          </li>
        ))}
      </ul>
      <div className="row">
        <button type="button" className="btn sm" disabled={busy || value.length >= 20} onClick={() => input.current?.click()}>{busy ? "Uploading…" : "Add screenshots"}</button>
        <span className="hint">PNG, JPEG, WebP or GIF, up to 5 MB each.</span>
      </div>
      <input ref={input} type="file" multiple accept="image/png,image/jpeg,image/webp,image/gif" hidden tabIndex={-1} onChange={(e) => add(e.target.files)} />
    </div>
  );
}
