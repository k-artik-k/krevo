import { FormEvent, useEffect, useState } from "react";
import { adminApi } from "../api";
import { toast } from "../router";
import HandBox from "../components/HandBox";
import type { SiteSettings } from "../types";
import { useAdmin } from "./ctx";

const TOGGLES: [keyof SiteSettings, string, string][] = [
  ["clouds", "Cloud animations", "Drifting clouds in three depths."],
  ["birds", "Bird animations", "Birds and small flocks crossing the sky."],
  ["timeSky", "Time-based sky", "The sky follows each visitor's local clock. When off, it stays at midday."],
  ["easterEggs", "Easter eggs", "Logo clicks, rainbow cloud, “Surprise me”, Konami code, unusual birds, typing time / origin / latest, double-click to wish, clicking the sun and moon."],
];
const LEVELS = [[1, "Calm"], [2, "Balanced"], [3, "Lively"]] as const;

export default function AppearanceForm() {
  const { run, settings, setSettings, setPreview } = useAdmin();
  const [f, setF] = useState(settings);
  const [busy, setBusy] = useState(false);
  useEffect(() => { setPreview(f); }, [f, setPreview]);
  useEffect(() => () => setPreview(null), [setPreview]);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const r = await run(() => adminApi.saveSettings(f));
    setBusy(false);
    if (r) { setSettings(r.settings); toast("Appearance saved."); }
  };
  return (
    <form className="box editor" onSubmit={submit}>
      <HandBox seed="appearance" fill amp={2} />
      <h1 className="page-title">Appearance</h1>
      <p className="hint">Changes preview live in the sky behind this page. Save to publish them.</p>
      <ul className="plain toggles">
        {TOGGLES.map(([k, label, desc]) => (
          <li key={k}>
            <label className="check">
              <input type="checkbox" checked={f[k] as boolean} onChange={(e) => setF({ ...f, [k]: e.target.checked })} aria-describedby={`d-${k}`} />
              <span><strong>{label}</strong><span className="hint" id={`d-${k}`}>{desc}</span></span>
            </label>
          </li>
        ))}
      </ul>
      <fieldset className="field">
        <legend>Animation intensity</legend>
        <div className="row">
          {LEVELS.map(([n, label]) => (
            <label key={n} className="radio"><input type="radio" name="intensity" checked={f.intensity === n} onChange={() => setF({ ...f, intensity: n })} />{label}</label>
          ))}
        </div>
        <span className="hint">Controls how many clouds and birds appear and how fast they move.</span>
      </fieldset>
      <button className="btn primary" disabled={busy}>{busy ? "Saving…" : "Save appearance"}<HandBox seed="sa" /></button>
    </form>
  );
}
