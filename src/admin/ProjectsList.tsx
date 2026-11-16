import { DragEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { adminApi } from "../api";
import { navigate, toast } from "../router";
import HandBox from "../components/HandBox";
import StateScreen from "../components/StateScreen";
import { EmptySearchArt, EmptySkyArt } from "../components/Illustrations";
import { mediaUrl, type AdminProject } from "../types";
import { useAdmin } from "./ctx";

const moveItem = <T,>(list: T[], from: number, to: number): T[] => {
  const n = [...list];
  const [x] = n.splice(from, 1);
  n.splice(Math.max(0, Math.min(n.length, to)), 0, x);
  return n;
};

export default function ProjectsList() {
  const { run } = useAdmin();
  const [items, setItems] = useState<AdminProject[] | null>(null);
  const [q, setQ] = useState("");
  const [grabbed, setGrabbed] = useState<string | null>(null);
  const [drop, setDrop] = useState<{ id: string; after: boolean } | null>(null);
  const [live, setLive] = useState("");
  const dragId = useRef<string | null>(null);
  const snapshot = useRef<AdminProject[] | null>(null);
  const handles = useRef<Record<string, HTMLButtonElement | null>>({});

  const load = () => run(() => adminApi.projects()).then((r) => r && setItems(r.projects));
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!items || !t) return items;
    return items.filter((p) => [p.title, p.category, p.shortDescription, p.technologies.join(" "), String(p.year)].join(" ").toLowerCase().includes(t));
  }, [items, q]);

  const persist = async (next: AdminProject[]) => {
    setItems(next);
    const ok = await run(() => adminApi.reorder(next.map((p) => p.id)));
    if (!ok) load();
  };
  const moveTo = (id: string, pos: number) => {
    if (!items) return;
    const from = items.findIndex((p) => p.id === id);
    const to = Math.max(0, Math.min(items.length - 1, pos));
    if (from < 0 || from === to) return;
    persist(moveItem(items, from, to));
    setLive(`Moved to position ${to + 1} of ${items.length}`);
  };

  const handleKey = (e: KeyboardEvent<HTMLButtonElement>, p: AdminProject, i: number) => {
    if (!items) return;
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      if (grabbed === p.id) { setGrabbed(null); persist(items); setLive(`Dropped ${p.title} at position ${i + 1} of ${items.length}`); }
      else { snapshot.current = items; setGrabbed(p.id); setLive(`Grabbed ${p.title}, position ${i + 1} of ${items.length}. Use arrow keys to move, Space to drop, Escape to cancel.`); }
    } else if (grabbed === p.id && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
      e.preventDefault();
      const to = i + (e.key === "ArrowUp" ? -1 : 1);
      if (to < 0 || to >= items.length) return;
      setItems(moveItem(items, i, to));
      setLive(`${p.title}, position ${to + 1} of ${items.length}`);
      requestAnimationFrame(() => handles.current[p.id]?.focus());
    } else if (grabbed === p.id && e.key === "Escape") {
      e.preventDefault(); e.stopPropagation();
      setGrabbed(null); if (snapshot.current) setItems(snapshot.current);
      setLive("Move cancelled");
    }
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    if (!items || !dragId.current || !drop) return;
    const from = items.findIndex((p) => p.id === dragId.current);
    let to = items.findIndex((p) => p.id === drop.id) + (drop.after ? 1 : 0);
    if (from < to) to--;
    dragId.current = null; setDrop(null);
    if (from !== to && from >= 0) persist(moveItem(items, from, to));
  };

  const toggle = async (p: AdminProject) => {
    const next = p.status === "published" ? "draft" : "published";
    const r = await run(() => adminApi.setStatus(p.id, next));
    if (r) { setItems((l) => l && l.map((x) => (x.id === p.id ? r.project : x))); toast(next === "published" ? "Published." : "Moved to drafts."); }
  };
  const dup = async (p: AdminProject) => {
    const r = await run(() => adminApi.duplicate(p.id));
    if (r) { toast("Duplicated as a draft."); load(); }
  };
  const del = async (p: AdminProject) => {
    if (!confirm(`Delete “${p.title}”? This can't be undone.`)) return;
    if (await run(() => adminApi.remove(p.id))) { toast("Deleted."); setItems((l) => l && l.filter((x) => x.id !== p.id)); }
  };

  if (!items || !filtered) return <p className="loading" role="status">Loading…</p>;
  const searching = q.trim() !== "";
  return (
    <>
      <div className="page-head">
        <h1 className="page-title">Projects</h1>
        <button className="btn primary" onClick={() => navigate("/admin/projects/new")}>Add project<HandBox seed="add" /></button>
      </div>
      {items.length === 0 ? (
        <StateScreen art={<EmptySkyArt />} title="No projects yet" text="Add your first project to fill the sky."><button className="btn primary" onClick={() => navigate("/admin/projects/new")}>Add project<HandBox seed="add2" /></button></StateScreen>
      ) : (
        <>
          <div className="field search">
            <label htmlFor="q">Search projects</label>
            <input id="q" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Title, category, technology…" />
          </div>
          <p className="hint" id="reorder-help">{searching ? "Clear the search to change the order." : "Drag the handle, or focus it and press Space, then use the arrow keys. You can also type a position."}</p>
          <p className="sr-only" aria-live="assertive">{live}</p>
          {filtered.length === 0 ? (
            <StateScreen art={<EmptySearchArt />} title={`Nothing matches “${q.trim()}”`} text="Check the spelling or try a different word."><button className="btn" onClick={() => setQ("")}>Clear search<HandBox seed="cs" /></button></StateScreen>
          ) : (
            <ol className="rows" onDragOver={(e) => e.preventDefault()} onDrop={onDrop}>
              {filtered.map((p) => {
                const i = items.indexOf(p);
                return (
                  <li key={p.id} className={`row-item box${grabbed === p.id ? " grabbed" : ""}${drop?.id === p.id ? (drop.after ? " drop-after" : " drop-before") : ""}`}
                    draggable={!searching} onDragStart={(e) => { dragId.current = p.id; e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", p.id); }}
                    onDragEnd={() => { dragId.current = null; setDrop(null); }}
                    onDragOver={(e) => { if (!dragId.current) return; e.preventDefault(); const r = e.currentTarget.getBoundingClientRect(); setDrop({ id: p.id, after: e.clientY > r.top + r.height / 2 }); }}>
                    <HandBox seed={p.id} fill />
                    {!searching && (
                      <button ref={(el) => { handles.current[p.id] = el; }} className="handle" aria-describedby="reorder-help" aria-pressed={grabbed === p.id}
                        aria-label={`Reorder ${p.title}, position ${i + 1} of ${items.length}`} onKeyDown={(e) => handleKey(e, p, i)} onBlur={() => { if (grabbed === p.id) { setGrabbed(null); persist(items); } }}>
                        <svg viewBox="0 0 16 24" width="16" height="24" fill="currentColor" aria-hidden="true">{[4, 12, 20].map((y) => <g key={y}><circle cx="4" cy={y} r="2" /><circle cx="12" cy={y} r="2" /></g>)}</svg>
                      </button>
                    )}
                    <div className="row-thumb">{p.coverKey ? <img src={mediaUrl(p.coverKey)} alt="" loading="lazy" /> : <span aria-hidden="true">{p.title.slice(0, 1)}</span>}</div>
                    <div className="row-main">
                      <a href={`/admin/projects/${p.id}`} onClick={(e) => { e.preventDefault(); navigate(`/admin/projects/${p.id}`); }}><strong>{p.title}</strong></a>
                      <span className="hint">{p.year}{p.category ? `, ${p.category}` : ""}</span>
                    </div>
                    <span className={`badge ${p.status}`}>{p.status === "published" ? "Published" : "Draft"}</span>
                    {!searching && (
                      <label className="pos">
                        <span className="sr-only">Position of {p.title}</span>
                        <input type="number" min={1} max={items.length} defaultValue={i + 1} key={`${p.id}-${i}`}
                          onKeyDown={(e) => { if (e.key === "Enter") moveTo(p.id, Number((e.target as HTMLInputElement).value) - 1); }}
                          onBlur={(e) => moveTo(p.id, Number(e.target.value) - 1)} />
                      </label>
                    )}
                    <div className="row actions">
                      <button className="btn sm" onClick={() => navigate(`/admin/projects/${p.id}`)} aria-label={`Edit ${p.title}`}>Edit<HandBox seed={p.id + "e"} /></button>
                      <button className="btn sm" onClick={() => toggle(p)} aria-label={`${p.status === "published" ? "Unpublish" : "Publish"} ${p.title}`}>{p.status === "published" ? "Unpublish" : "Publish"}<HandBox seed={p.id + "p"} /></button>
                      <button className="btn sm" onClick={() => dup(p)} aria-label={`Duplicate ${p.title}`}>Duplicate<HandBox seed={p.id + "d"} /></button>
                      <button className="btn sm danger" onClick={() => del(p)} aria-label={`Delete ${p.title}`}>Delete<HandBox seed={p.id + "x"} /></button>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </>
      )}
    </>
  );
}
