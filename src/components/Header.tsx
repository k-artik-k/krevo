import { useEffect, useRef, useState } from "react";
import HandBox from "./HandBox";
import { LogoMark } from "./Illustrations";
import { mediaUrl, type SiteSettings } from "../types";

interface Props { settings: SiteSettings; onHome: () => void; onRandom?: () => void; onAbout: () => void }

export default function Header({ settings: s, onHome, onRandom, onAbout }: Props) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const clicks = useRef<number[]>([]);

  useEffect(() => {
    if (!open) return;
    const down = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(false); btn.current?.focus(); } };
    document.addEventListener("mousedown", down);
    document.addEventListener("keydown", key);
    return () => { document.removeEventListener("mousedown", down); document.removeEventListener("keydown", key); };
  }, [open]);

  const logoClick = () => {
    onHome();
    if (!s.easterEggs) return;
    const now = Date.now();
    clicks.current = [...clicks.current.filter((t) => now - t < 2500), now];
    if (clicks.current.length >= 5) {
      clicks.current = [];
      window.dispatchEvent(new Event("archive:burst"));
      window.dispatchEvent(new CustomEvent("archive:toast", { detail: "You woke the flock." }));
    }
  };

  const links = [
    s.githubUrl && { label: "GitHub", url: s.githubUrl },
    s.portfolioUrl && { label: "Portfolio", url: s.portfolioUrl },
    ...s.profileLinks,
  ].filter(Boolean) as { label: string; url: string }[];
  const hasProfile = !!(s.profileName || s.profileBio || s.aboutText || links.length);

  return (
    <header className="top">
      <button className="brand" onClick={logoClick} aria-label={`${s.displayName}, back to top`}>
        {s.logoKey ? <img src={mediaUrl(s.logoKey)} alt="" width="40" height="40" /> : <LogoMark />}
        <span>{s.displayName}</span>
      </button>
      <nav aria-label="Main" className="nav">
        <button className="nav-link" onClick={onHome}>Projects</button>
        {s.easterEggs && onRandom && <button className="nav-link" onClick={onRandom}>Surprise me</button>}
        {hasProfile && (
          <div className="profile" ref={box}>
            <button ref={btn} className="avatar" aria-expanded={open} aria-controls="profile-panel" onClick={() => setOpen((o) => !o)}
              onKeyDown={(e) => { if (e.key === "ArrowDown") setOpen(true); }}>
              <HandBox seed="avatar" fill />
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="9" r="3.6" /><path d="M5 20c1-4 4-5.6 7-5.6s6 1.6 7 5.6" /></svg>
              <span className="sr-only">Profile</span>
            </button>
            {open && (
              <div className="panel" id="profile-panel">
                <HandBox seed="panel" fill amp={1.8} />
                {(s.profileName || s.profileBio) && <div className="panel-head">{s.profileName && <strong>{s.profileName}</strong>}{s.profileBio && <p>{s.profileBio}</p>}</div>}
                <ul>
                  {s.aboutText && <li><button onClick={() => { setOpen(false); onAbout(); }}>About</button></li>}
                  {links.map((l) => <li key={l.label + l.url}><a href={l.url} target="_blank" rel="noopener noreferrer">{l.label}</a></li>)}
                </ul>
              </div>
            )}
          </div>
        )}
      </nav>
    </header>
  );
}
