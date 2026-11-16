import type { SiteSettings } from "../types";

export default function Footer({ settings: s }: { settings: SiteSettings }) {
  const owner = s.profileName || s.displayName;
  return (
    <footer className="foot">
      <div className="foot-main">
        <p className="foot-name">{owner}</p>
        <ul className="foot-links">
          {s.contactEmail && <li><a href={`mailto:${s.contactEmail}`}>{s.contactEmail}</a></li>}
          {s.githubUrl && <li><a href={s.githubUrl} target="_blank" rel="noopener noreferrer">GitHub</a></li>}
          {s.footerLinks.map((l) => <li key={l.label + l.url}><a href={l.url} target="_blank" rel="noopener noreferrer">{l.label}</a></li>)}
        </ul>
      </div>
      {s.footerText && <p className="foot-text">{s.footerText}</p>}
      <p className="foot-copy">{s.copyright || `© ${new Date().getFullYear()} ${owner}`}</p>
    </footer>
  );
}
