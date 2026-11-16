
import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { adminApi } from "../api";
import { navigate, toast } from "../router";
import HandBox from "../components/HandBox";
import MediaField, { GalleryField } from "./MediaField";
import { useAdmin } from "./ctx";

interface Form {
  title: string;
  year: string;
  category: string;
  shortDescription: string;
  fullDescription: string;
  technologies: string;
  githubUrl: string;
  liveUrl: string;
  videoUrl: string;
  coverKey: string | null;
  gallery: string[];
  status: "draft" | "published";
}

const blank = (): Form => ({
  title: "",
  year: String(new Date().getFullYear()),
  category: "",
  shortDescription: "",
  fullDescription: "",
  technologies: "",
  githubUrl: "",
  liveUrl: "",
  videoUrl: "",
  coverKey: null,
  gallery: [],
  status: "draft",
});

export default function ProjectEditor({ id }: { id: string | null }) {
  const { run } = useAdmin();

  const [form, setForm] = useState<Form | null>(id ? null : blank());
  const [cats, setCats] = useState<string[]>([]);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const dirty = useRef(false);
  const trash = useRef<string[]>([]);

  useEffect(() => {
    run(() => adminApi.projects()).then((result) => {
      if (!result) return;

      setCats([
        ...new Set(
          result.projects.map((project) => project.category).filter(Boolean)
        ),
      ]);

      if (!id) return;

      const project = result.projects.find((item) => item.id === id);

      if (!project) {
        toast("That project no longer exists.");
        navigate("/admin/projects", true);
        return;
      }

      setForm({
        title: project.title,
        year: String(project.year),
        category: project.category,
        shortDescription: project.shortDescription,
        fullDescription: project.fullDescription,
        technologies: project.technologies.join(", "),
        githubUrl: project.githubUrl ?? "",
        liveUrl: project.liveUrl ?? "",
        videoUrl: project.videoUrl ?? "",
        coverKey: project.coverKey,
        gallery: project.gallery,
        status: project.status,
      });
    });
  }, [id, run]);

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (dirty.current) event.preventDefault();
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, []);

  if (!form) {
    return <p className="loading" role="status">Loading...</p>;
  }

  const set = <K extends keyof Form>(key: K, value: Form[K]) => {
    dirty.current = true;
    setForm((current) =>
      current ? { ...current, [key]: value } : current
    );
  };

  const rememberRemoved = (key?: string) => {
    if (key && !trash.current.includes(key)) {
      trash.current.push(key);
    }
  };

  const bind = (key: keyof Form) => ({
    id: `f-${key}`,
    value: form[key] as string,
    onChange: (event: { target: { value: string } }) =>
      set(key, event.target.value as never),
  });

  const submit = async (event: FormEvent) => {
    event.preventDefault();

    setBusy(true);
    setErr("");

    const body = {
      ...form,
      year: Number(form.year),
      technologies: form.technologies
        .split(",")
        .map((technology) => technology.trim())
        .filter(Boolean),
    };

    try {
      const result = id
        ? await run(() => adminApi.update(id, body))
        : await run(() => adminApi.create(body));

      if (!result) return;

      dirty.current = false;

      const removedKeys = [...new Set(trash.current)];
      trash.current = [];

      await Promise.all(
        removedKeys.map((key) =>
          adminApi.deleteMedia(key).catch(() => null)
        )
      );

      toast(
        form.status === "published"
          ? "Saved and published."
          : "Saved as draft."
      );

      navigate("/admin/projects");
    } catch (error) {
      setErr(
        error instanceof Error
          ? error.message
          : "Could not save the project."
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="box editor" onSubmit={submit} noValidate>
      <HandBox seed="editor" fill amp={2} />

      <h1 className="page-title">
        {id ? "Edit project" : "Add project"}
      </h1>

      <div className="grid2">
        <div className="field">
          <label htmlFor="f-title">Title</label>
          <input {...bind("title")} required maxLength={100} />
        </div>

        <div className="field">
          <label htmlFor="f-year">Year</label>
          <input
            {...bind("year")}
            type="number"
            min={1980}
            max={2100}
            required
          />
        </div>
      </div>

      <div className="field">
        <label htmlFor="f-category">Category</label>
        <input {...bind("category")} maxLength={40} list="cats" />
        <datalist id="cats">
          {cats.map((category) => (
            <option key={category} value={category} />
          ))}
        </datalist>
      </div>

      <div className="field">
        <label htmlFor="f-shortDescription">Short description</label>
        <input
          {...bind("shortDescription")}
          maxLength={180}
          aria-describedby="sd-hint"
        />
        <span className="hint" id="sd-hint">
          Shown on the card. {form.shortDescription.length}/180
        </span>
      </div>

      <div className="field">
        <label htmlFor="f-fullDescription">Full description</label>
        <textarea
          {...bind("fullDescription")}
          rows={8}
          maxLength={8000}
        />
        <span className="hint">
          Shown in the project window. Leave a blank line between paragraphs.
        </span>
      </div>

      <div className="field">
        <label htmlFor="f-technologies">Technologies</label>
        <input {...bind("technologies")} />
        <span className="hint">
          Separate with commas, e.g. React, Python, Arduino.
        </span>
      </div>

      <div className="grid2">
        <div className="field">
          <label htmlFor="f-githubUrl">GitHub URL</label>
          <input
            {...bind("githubUrl")}
            type="url"
            inputMode="url"
            placeholder="https://github.com/..."
          />
        </div>

        <div className="field">
          <label htmlFor="f-liveUrl">Live URL</label>
          <input
            {...bind("liveUrl")}
            type="url"
            inputMode="url"
            placeholder="https://..."
          />
        </div>
      </div>

      <div className="field">
        <label htmlFor="f-videoUrl">Demo video URL</label>
        <input
          {...bind("videoUrl")}
          type="url"
          inputMode="url"
        />
        <span className="hint">
          YouTube, Vimeo, or a direct .mp4 or .webm link.
        </span>
      </div>

      <MediaField
        label="Cover image"
        value={form.coverKey}
        onChange={(key, oldKey) => {
          rememberRemoved(oldKey);
          set("coverKey", key);
        }}
        hint="Shown on the project card. 16:10 works best."
      />

      <GalleryField
        value={form.gallery}
        onChange={(keys, removedKey) => {
          rememberRemoved(removedKey);
          set("gallery", keys);
        }}
      />

      <div className="field">
        <label htmlFor="f-status">Status</label>
        <select {...bind("status")}>
          <option value="draft">Draft (hidden from visitors)</option>
          <option value="published">Published</option>
        </select>
      </div>

      {err && <p className="error" role="alert">{err}</p>}

      <div className="row">
        <button className="btn primary" disabled={busy}>
          {busy ? "Saving..." : "Save project"}
          <HandBox seed="save" />
        </button>

        <button
          type="button"
          className="btn"
          disabled={busy}
          onClick={() => {
            if (!dirty.current || confirm("Discard your changes?")) {
              dirty.current = false;
              navigate("/admin/projects");
            }
          }}
        >
          Cancel
          <HandBox seed="cancel" />
        </button>
      </div>
    </form>
  );
}
