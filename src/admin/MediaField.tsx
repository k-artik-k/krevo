import { useState } from "react";
import { mediaUrl } from "../types";

/** Text input for an image filename (from public/media/) or full URL, with live preview. */
export default function MediaField({ label, value, onChange, hint }: { label: string; value: string | null; onChange: (key: string | null) => void; hint?: string }) {
  return (
    <div className="field">
      <span className="label" id={`l-${label}`}>{label}</span>
      <div className="media-field" role="group" aria-labelledby={`l-${label}`}>
        <div className="media-preview">{value ? <img src={mediaUrl(value)} alt={`${label} preview`} /> : <span>No image</span>}</div>
        <input
          type="text"
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value || null)}
          placeholder="e.g. cover.png or https://…"
        />
        {value && <button type="button" className="btn sm danger" onClick={() => onChange(null)}>Remove</button>}
      </div>
      {hint && <span className="hint">{hint}</span>}
    </div>
  );
}

export function GalleryField({ value, onChange }: { value: string[]; onChange: (keys: string[]) => void }) {
  const [input, setInput] = useState("");
  const move = (i: number, d: number) => { const n = [...value]; [n[i], n[i + d]] = [n[i + d], n[i]]; onChange(n); };
  const add = () => {
    const v = input.trim();
    if (v && value.length < 20) { onChange([...value, v]); setInput(""); }
  };
  return (
    <div className="field">
      <span className="label" id="l-gallery">Screenshot gallery</span>
      <ul className="gallery-list" aria-labelledby="l-gallery">
        {value.map((k, i) => (
          <li key={k + i}>
            <img src={mediaUrl(k)} alt={`Screenshot ${i + 1}`} />
            <div className="row">
              <button type="button" className="btn sm" disabled={i === 0} onClick={() => move(i, -1)} aria-label={`Move screenshot ${i + 1} earlier`}>↑</button>
              <button type="button" className="btn sm" disabled={i === value.length - 1} onClick={() => move(i, 1)} aria-label={`Move screenshot ${i + 1} later`}>↓</button>
              <button type="button" className="btn sm danger" onClick={() => onChange(value.filter((_, j) => j !== i))} aria-label={`Remove screenshot ${i + 1}`}>Remove</button>
            </div>
          </li>
        ))}
      </ul>
      <div className="row">
        <input type="text" value={input} onChange={(e) => setInput(e.target.value)} placeholder="e.g. screenshot1.png" onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} />
        <button type="button" className="btn sm" disabled={!input.trim() || value.length >= 20} onClick={add}>Add screenshot</button>
      </div>
      <span className="hint">Filename from public/media/ folder, or a full URL. Images must be committed and deployed.</span>
    </div>
  );
}
