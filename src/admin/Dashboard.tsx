import { useEffect, useState } from "react";
import { adminApi } from "../api";
import { navigate } from "../router";
import HandBox from "../components/HandBox";
import type { AdminProject } from "../types";
import { useAdmin } from "./ctx";

export default function Dashboard() {
  const { run } = useAdmin();
  const [projects, setProjects] = useState<AdminProject[] | null>(null);
  useEffect(() => { run(() => adminApi.projects()).then((r) => r && setProjects(r.projects)); }, [run]);
  if (!projects) return <p className="loading" role="status">Loading…</p>;
  const published = projects.filter((p) => p.status === "published").length;
  const recent = [...projects].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 5);
  const stats: [string, number][] = [["Total projects", projects.length], ["Published", published], ["Drafts", projects.length - published]];
  return (
    <>
      <h1 className="page-title">Dashboard</h1>
      <ul className="stats">
        {stats.map(([label, n]) => <li key={label} className="box"><HandBox seed={label} fill /><strong>{n}</strong><span>{label}</span></li>)}
      </ul>
      <section className="box">
        <HandBox seed="recent" fill />
        <h2>Recently updated</h2>
        {recent.length === 0 ? <p>No projects yet.</p> : (
          <ul className="plain">
            {recent.map((p) => (
              <li key={p.id}>
                <a href={`/admin/projects/${p.id}`} onClick={(e) => { e.preventDefault(); navigate(`/admin/projects/${p.id}`); }}>{p.title}</a>
                <span className={`badge ${p.status}`}>{p.status === "published" ? "Published" : "Draft"}</span>
                <time dateTime={new Date(p.updatedAt).toISOString()}>{new Date(p.updatedAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}</time>
              </li>
            ))}
          </ul>
        )}
        <button className="btn primary" onClick={() => navigate("/admin/projects/new")}>Add a project<HandBox seed="np" /></button>
      </section>
    </>
  );
}
