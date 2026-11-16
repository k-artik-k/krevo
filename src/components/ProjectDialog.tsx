import { useEffect, useState } from "react";
import HandBox from "./HandBox";
import Modal from "./Modal";
import StateScreen from "./StateScreen";
import { NotFoundArt } from "./Illustrations";
import { mediaUrl, type Project } from "../types";

function videoEmbed(url: string): { kind: "iframe" | "video" | "link"; src: string } {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    let id: string | null = null;
    if (host === "youtu.be") id = u.pathname.slice(1);
    else if (host.endsWith("youtube.com")) id = u.searchParams.get("v") ?? u.pathname.match(/^\/(?:embed|shorts)\/([\w-]+)/)?.[1] ?? null;
    if (id && /^[\w-]{6,15}$/.test(id)) return { kind: "iframe", src: `https://www.youtube-nocookie.com/embed/${id}` };
    const vm = host === "vimeo.com" ? u.pathname.match(/^\/(\d+)/) : null;
    if (vm) return { kind: "iframe", src: `https://player.vimeo.com/video/${vm[1]}` };
    if (/\.(mp4|webm|ogg)$/i.test(u.pathname)) return { kind: "video", src: url };
  } catch { /* fall through */ }
  return { kind: "link", src: url };
}

function Gallery({ images, title }: { images: string[]; title: string }) {
  const [i, setI] = useState(0);
  const n = images.length;
  const go = (d: number) => setI((v) => (v + d + n) % n);
  return (
    <section className="gallery" aria-label={`${title} images`} onKeyDown={(e) => {
      if (n < 2) return;
      if (e.key === "ArrowRight") { e.preventDefault(); go(1); } else if (e.key === "ArrowLeft") { e.preventDefault(); go(-1); }
    }}>
      <figure className="shot">
        <HandBox seed={"shot" + title} />
        <img src={mediaUrl(images[i])} alt={`${title}, image ${i + 1} of ${n}`} decoding="async" />
        {n > 1 && <>
          <button className="shot-nav prev" onClick={() => go(-1)} aria-label="Previous image">‹</button>
          <button className="shot-nav next" onClick={() => go(1)} aria-label="Next image">›</button>
        </>}
      </figure>
      {n > 1 && (
        <ul className="thumbs">
          {images.map((k, idx) => (
            <li key={k}>
              <button onClick={() => setI(idx)} aria-label={`Show image ${idx + 1} of ${n}`} aria-current={idx === i ? "true" : undefined}>
                <img src={mediaUrl(k)} alt="" loading="lazy" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function ProjectDialog({ project, onClose }: { project: Project | null; onClose: () => void }) {
  useEffect(() => { document.documentElement.classList.add("modal-open"); return () => document.documentElement.classList.remove("modal-open"); }, []);
  const closeBtn = (
    <button className="close" onClick={onClose} aria-label="Close" data-autofocus>
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true"><path d="M5 6 L19 19 M19 5 L6 18" /></svg>
    </button>
  );
  if (!project) {
    return (
      <Modal onClose={onClose} title={(id) => <h2 id={id} className="sr-only">Project not found</h2>}>
        {closeBtn}
        <StateScreen art={<NotFoundArt />} title="This project flew away" text="The link may be old, or the project isn't public any more.">
          <button className="btn" onClick={onClose}>Back to the archive<HandBox seed="nf" /></button>
        </StateScreen>
      </Modal>
    );
  }
  const images = [project.coverKey, ...project.gallery].filter((k): k is string => !!k);
  const paras = (project.fullDescription || project.shortDescription).split(/\n{2,}/).filter(Boolean);
  const video = project.videoUrl ? videoEmbed(project.videoUrl) : null;
  return (
    <Modal wide seed={"dlg" + project.slug} onClose={onClose} title={(id) => (
      <header className="dlg-head">
        <h2 id={id}>{project.title}</h2>
        <p className="meta"><span className="year">{project.year}</span>{project.category && <span className="tag">{project.category}</span>}</p>
      </header>
    )}>
      {closeBtn}
      {images.length > 0 && <Gallery images={images} title={project.title} />}
      <div className="prose">{paras.map((p, i) => <p key={i}>{p}</p>)}</div>
      {video && (
        <section className="video" aria-label="Demo video">
          {video.kind === "iframe" && <iframe src={video.src} title={`${project.title} demo video`} allow="fullscreen; picture-in-picture" allowFullScreen loading="lazy" referrerPolicy="strict-origin-when-cross-origin" />}
          {video.kind === "video" && <video src={video.src} controls preload="metadata" />}
          {video.kind === "link" && <a className="btn" href={video.src} target="_blank" rel="noopener noreferrer">Watch the demo video<HandBox seed="vid" /></a>}
        </section>
      )}
      {project.technologies.length > 0 && (
        <section aria-label="Technologies used">
          <ul className="chips">{project.technologies.map((t) => <li key={t}>{t}</li>)}</ul>
        </section>
      )}
      {(project.githubUrl || project.liveUrl) && (
        <div className="links">
          {project.liveUrl && <a className="btn primary" href={project.liveUrl} target="_blank" rel="noopener noreferrer">Open live project<HandBox seed="live" /></a>}
          {project.githubUrl && <a className="btn" href={project.githubUrl} target="_blank" rel="noopener noreferrer">View on GitHub<HandBox seed="gh" /></a>}
        </div>
      )}
    </Modal>
  );
}
