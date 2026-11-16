
import { useRef, useState } from "react";
import type { FormEvent } from "react";
import { adminApi } from "../api";
import { toast } from "../router";
import HandBox from "../components/HandBox";
import type { Link, SiteSettings } from "../types";
import MediaField from "./MediaField";
import { useAdmin } from "./ctx";

function LinkList({
  label,
  value,
  onChange,
}: {
  label: string;
  value: Link[];
  onChange: (links: Link[]) => void;
}) {
  const update = (index: number, key: keyof Link, nextValue: string) => {
    onChange(
      value.map((link, currentIndex) =>
        currentIndex === index
          ? { ...link, [key]: nextValue }
          : link
      )
    );
  };

  return (
    <fieldset className="field links-field">
      <legend>{label}</legend>

      {value.map((link, index) => (
        <div className="link-row" key={index}>
          <input
            aria-label={`${label} ${index + 1} label`}
            placeholder="Label"
            value={link.label}
            maxLength={40}
            onChange={(event) =>
              update(index, "label", event.target.value)
            }
          />

          <input
            aria-label={`${label} ${index + 1} URL`}
            placeholder="https://..."
            type="url"
            inputMode="url"
            value={link.url}
            onChange={(event) =>
              update(index, "url", event.target.value)
            }
          />

          <button
            type="button"
            className="btn sm danger"
            onClick={() =>
              onChange(value.filter((_, currentIndex) => currentIndex !== index))
            }
            aria-label={`Remove ${label} ${index + 1}`}
          >
            Remove
          </button>
        </div>
      ))}

      {value.length < 8 && (
        <button
          type="button"
          className="btn sm"
          onClick={() => onChange([...value, { label: "", url: "" }])}
        >
          Add link
          <HandBox seed={"al" + label} />
        </button>
      )}
    </fieldset>
  );
}

function normalizeIntensity(value: number): number {
  const n = Number(value);

  if (!Number.isFinite(n)) return 2;

  return Math.min(3, Math.max(1, Math.round(n)));
}

const intensityOptions = [
  { value: 1, number: "01", label: "Low", description: "Subtle" },
  { value: 2, number: "02", label: "Medium", description: "Balanced" },
  { value: 3, number: "03", label: "High", description: "Intense" },
] as const;

export default function SiteForm() {
  const { run, settings, setSettings } = useAdmin();

  const [form, setForm] = useState<SiteSettings>(() => ({
    ...settings,
    intensity: normalizeIntensity(settings.intensity),
  }));

  const [busy, setBusy] = useState(false);
  const removedMedia = useRef<string[]>([]);

  const set = <K extends keyof SiteSettings>(
    key: K,
    value: SiteSettings[K]
  ) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const text = (
    key:
      | "displayName"
      | "profileName"
      | "profileBio"
      | "browserTitle"
      | "copyright"
      | "footerText"
      | "aboutText"
  ) => ({
    id: `s-${key}`,
    value: form[key],
    onChange: (event: { target: { value: string } }) =>
      set(key, event.target.value),
  });

  const nullable = (
    key: "githubUrl" | "portfolioUrl" | "contactEmail"
  ) => ({
    id: `s-${key}`,
    value: form[key] ?? "",
    onChange: (event: { target: { value: string } }) =>
      set(key, event.target.value || null),
  });

  const changeMedia = (
    key: "logoKey" | "faviconKey",
    nextValue: string | null,
    oldValue?: string
  ) => {
    if (
      oldValue &&
      oldValue !== nextValue &&
      !removedMedia.current.includes(oldValue)
    ) {
      removedMedia.current.push(oldValue);
    }

    set(key, nextValue);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);

    try {
      const result = await run(() => adminApi.saveSettings(form));

      if (!result) return;

      setSettings(result.settings);
      setForm(result.settings);

      const removedKeys = [...new Set(removedMedia.current)];
      removedMedia.current = [];

      await Promise.all(
        removedKeys.map((key) =>
          adminApi.deleteMedia(key).catch(() => null)
        )
      );

      toast("Site settings saved.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="box editor" onSubmit={submit} noValidate>
      <HandBox seed="site" fill amp={2} />

      <h1 className="page-title">Site settings</h1>

      <MediaField
        label="Logo"
        value={form.logoKey}
        onChange={(key, oldKey) => changeMedia("logoKey", key, oldKey)}
        hint="Square images look best. Without one, a small sun-and-cloud mark is used."
      />

      <div className="grid2">
        <div className="field">
          <label htmlFor="s-displayName">Display name</label>
          <input {...text("displayName")} required maxLength={60} />
        </div>

        <div className="field">
          <label htmlFor="s-browserTitle">Browser title</label>
          <input {...text("browserTitle")} required maxLength={80} />
        </div>
      </div>

      <MediaField
        label="Favicon"
        value={form.faviconKey}
        onChange={(key, oldKey) => changeMedia("faviconKey", key, oldKey)}
        hint="A small square PNG or ICO."
      />

      <h2>Profile</h2>

      <div className="field">
        <label htmlFor="s-profileName">Profile name</label>
        <input {...text("profileName")} maxLength={60} />
        <span className="hint">
          Also used as the owner's name in the footer.
        </span>
      </div>

      <div className="field">
        <label htmlFor="s-profileBio">Short bio</label>
        <input {...text("profileBio")} maxLength={300} />
      </div>

      <div className="field">
        <label htmlFor="s-aboutText">About</label>
        <textarea {...text("aboutText")} rows={6} maxLength={3000} />
        <span className="hint">
          Opens from the profile menu. Leave empty to hide the About item.
        </span>
      </div>

      <div className="grid2">
        <div className="field">
          <label htmlFor="s-githubUrl">GitHub URL</label>
          <input {...nullable("githubUrl")} type="url" inputMode="url" />
        </div>

        <div className="field">
          <label htmlFor="s-portfolioUrl">Portfolio URL</label>
          <input {...nullable("portfolioUrl")} type="url" inputMode="url" />
        </div>
      </div>

      <LinkList
        label="Extra profile links"
        value={form.profileLinks}
        onChange={(links) => set("profileLinks", links)}
      />

      <h2>Footer</h2>

      <div className="field">
        <label htmlFor="s-contactEmail">Contact email</label>
        <input
          {...nullable("contactEmail")}
          type="email"
          inputMode="email"
        />
      </div>

      <div className="field">
        <label htmlFor="s-copyright">Copyright line</label>
        <input {...text("copyright")} maxLength={120} />
        <span className="hint">
          Leave empty to use the default copyright line.
        </span>
      </div>

      <div className="field">
        <label htmlFor="s-footerText">Footer text</label>
        <input {...text("footerText")} maxLength={300} />
      </div>

      <LinkList
        label="Footer links"
        value={form.footerLinks}
        onChange={(links) => set("footerLinks", links)}
      />

      <h2>Appearance</h2>

      <div className="field">
        <label className="check-row">
          <input
            type="checkbox"
            checked={form.clouds}
            onChange={(event) => set("clouds", event.target.checked)}
          />
          Show clouds
        </label>

        <label className="check-row">
          <input
            type="checkbox"
            checked={form.birds}
            onChange={(event) => set("birds", event.target.checked)}
          />
          Show birds
        </label>

        <label className="check-row">
          <input
            type="checkbox"
            checked={form.timeSky}
            onChange={(event) => set("timeSky", event.target.checked)}
          />
          Use time-based sky
        </label>

        <label className="check-row">
          <input
            type="checkbox"
            checked={form.easterEggs}
            onChange={(event) => set("easterEggs", event.target.checked)}
          />
          Enable easter eggs
        </label>
      </div>

      <div className="field">
        <span className="field-label" id="s-intensity-label">
          Sky intensity
        </span>

        <div
          className="intensity-control"
          role="group"
          aria-labelledby="s-intensity-label"
        >
          {intensityOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`intensity-option ${
                form.intensity === option.value ? "active" : ""
              }`}
              aria-pressed={form.intensity === option.value}
              onClick={() => set("intensity", option.value)}
            >
              <span className="intensity-number">{option.number}</span>
              <span className="intensity-label">{option.label}</span>
              <span className="intensity-description">
                {option.description}
              </span>
            </button>
          ))}
        </div>

        <span className="hint">
          Controls the intensity of the background effects.
        </span>
      </div>

      <div className="row">
        <button className="btn primary" disabled={busy}>
          {busy ? "Saving..." : "Save settings"}
          <HandBox seed="save-settings" />
        </button>
      </div>
    </form>
  );
}
