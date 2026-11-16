import { useEffect, useRef, useState } from "react";
import { adminApi, ApiError } from "../api";
import { toast } from "../router";
import HandBox from "../components/HandBox";
import StateScreen from "../components/StateScreen";
import { EmptySkyArt } from "../components/Illustrations";
import { mediaUrl, type MediaItem } from "../types";
import { useAdmin } from "./ctx";

export default function MediaLibrary() {
  const { run, setSettings } = useAdmin();
  const [items, setItems] = useState<MediaItem[] | null>(null);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const load = () => run(() => adminApi.media()).then((r) => r && setItems(r.media));
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    for (const f of files) await run(() => adminApi.upload(f));
    setBusy(false);
    if (input.current) input.current.value = "";
    load();
  };
  const del = async (m: MediaItem) => {
    try { await adminApi.deleteMedia(m.key); }
    catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        if (!confirm("This image is used by a project or a site setting. Delete it anyway and remove it from there?")) return;
        if (!(await run(() => adminApi.deleteMedia(m.key, true)))) return;
        run(() => adminApi.settings()).then((r) => r && setSettings(r.settings));
      } else { await run(() => Promise.reject(e)); return; }
    }
    toast("Image deleted.");
    load();
  };
  if (!items) return <p className="loading" role="status">Loading…</p>;
  return (
    <>
      <div className="page-head">
        <h1 className="page-title">Media</h1>
        <button className="btn primary" disabled={busy} onClick={() => input.current?.click()}>{busy ? "Uploading…" : "Upload images"}<HandBox seed="up" /></button>
        <input ref={input} type="file" multiple accept="image/png,image/jpeg,image/webp,image/gif,image/x-icon" hidden tabIndex={-1} onChange={(e) => upload(e.target.files)} />
      </div>
      {items.length === 0 ? <StateScreen art={<EmptySkyArt />} title="No images yet" text="Uploaded covers, screenshots and logos appear here." /> : (
        <ul className="media-grid">
          {items.map((m) => (
            <li key={m.key} className="box">
              <HandBox seed={m.key} fill />
              <img src={mediaUrl(m.key)} alt="" loading="lazy" />
              <span className="hint">{(m.size / 1024).toFixed(0)} KB</span>
              <button className="btn sm danger" onClick={() => del(m)} aria-label={`Delete image ${m.key.slice(0, 8)}`}>Delete<HandBox seed={m.key + "d"} /></button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
