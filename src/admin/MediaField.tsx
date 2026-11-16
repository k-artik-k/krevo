
import { useEffect, useRef, useState } from "react";
import { adminApi, ApiError } from "../api";
import { mediaUrl } from "../types";

const ACCEPTED_IMAGES =
  "image/png,image/jpeg,image/webp,image/gif,image/x-icon,.ico";

function imageSource(value: string) {
  if (/^(https?:\/\/|\/)/i.test(value)) return value;
  return mediaUrl(value) ?? "";
}

function errorMessage(error: unknown) {
  return error instanceof ApiError
    ? error.message
    : error instanceof Error
      ? error.message
      : "Image upload failed.";
}

export default function MediaField({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: string | null;
  onChange: (key: string | null, removedKey?: string) => void;
  hint?: string;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [manual, setManual] = useState(value ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setManual(value ?? "");
  }, [value]);

  const upload = async (file: File | undefined) => {
    if (!file) return;

    setBusy(true);
    setError("");

    try {
      const result = await adminApi.upload(file);
      onChange(result.key, value && value !== result.key ? value : undefined);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  const applyManualValue = () => {
    const next = manual.trim() || null;
    if (next === value) return;
    onChange(next, value ?? undefined);
  };

  const remove = () => {
    setManual("");
    onChange(null, value ?? undefined);
  };

  return (
    <div className="field">
      <span className="label" id={`l-${label}`}>{label}</span>

      <div className="media-field" role="group" aria-labelledby={`l-${label}`}>
        <div className="media-preview">
          {value ? (
            <img src={imageSource(value)} alt={`${label} preview`} />
          ) : (
            <span>No image</span>
          )}
        </div>

        <div className="media-controls">
          <input
            ref={fileInput}
            type="file"
            accept={ACCEPTED_IMAGES}
            disabled={busy}
            aria-label={`Upload ${label.toLowerCase()}`}
            onChange={(e) => upload(e.target.files?.[0])}
          />

          <input
            type="text"
            value={manual}
            disabled={busy}
            onChange={(e) => setManual(e.target.value)}
            placeholder="Media key or image URL"
            aria-label={`${label} media key or URL`}
          />

          <div className="row">
            <button
              type="button"
              className="btn sm"
              disabled={busy || manual.trim() === (value ?? "")}
              onClick={applyManualValue}
            >
              Apply reference
            </button>

            {value && (
              <button
                type="button"
                className="btn sm danger"
                disabled={busy}
                onClick={remove}
              >
                Remove
              </button>
            )}
          </div>
        </div>
      </div>

      {busy && <span className="hint">Uploading image...</span>}
      {hint && <span className="hint">{hint}</span>}
      <span className="hint">
        PNG, JPEG and WebP images are automatically compressed when needed.
        Maximum stored upload size: 1.2 MB.
      </span>
      {error && <p className="error" role="alert">{error}</p>}
    </div>
  );
}

export function GalleryField({
  value,
  onChange,
}: {
  value: string[];
  onChange: (keys: string[], removedKey?: string) => void;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [manual, setManual] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const move = (index: number, direction: number) => {
    const next = [...value];
    [next[index], next[index + direction]] = [
      next[index + direction],
      next[index],
    ];
    onChange(next);
  };

  const addManual = () => {
    const key = manual.trim();
    if (!key || value.length >= 20 || value.includes(key)) return;

    onChange([...value, key]);
    setManual("");
  };

  const uploadFiles = async (files: FileList | null) => {
    if (!files?.length) return;

    setBusy(true);
    setError("");

    const next = [...value];

    try {
      for (const file of Array.from(files)) {
        if (next.length >= 20) break;

        const result = await adminApi.upload(file);
        next.push(result.key);
      }

      onChange(next);
    } catch (err) {
      if (next.length > value.length) onChange(next);
      setError(errorMessage(err));
    } finally {
      setBusy(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  return (
    <div className="field">
      <span className="label" id="l-gallery">Screenshot gallery</span>

      <ul className="gallery-list" aria-labelledby="l-gallery">
        {value.map((key, index) => (
          <li key={`${key}-${index}`}>
            <img src={imageSource(key)} alt={`Screenshot ${index + 1}`} />

            <div className="row">
              <button
                type="button"
                className="btn sm"
                disabled={busy || index === 0}
                onClick={() => move(index, -1)}
                aria-label={`Move screenshot ${index + 1} earlier`}
              >
                ↑
              </button>

              <button
                type="button"
                className="btn sm"
                disabled={busy || index === value.length - 1}
                onClick={() => move(index, 1)}
                aria-label={`Move screenshot ${index + 1} later`}
              >
                ↓
              </button>

              <button
                type="button"
                className="btn sm danger"
                disabled={busy}
                onClick={() =>
                  onChange(
                    value.filter((_, i) => i !== index),
                    key
                  )
                }
                aria-label={`Remove screenshot ${index + 1}`}
              >
                Remove
              </button>
            </div>
          </li>
        ))}
      </ul>

      <div className="row">
        <input
          ref={fileInput}
          type="file"
          multiple
          accept={ACCEPTED_IMAGES}
          disabled={busy || value.length >= 20}
          aria-label="Upload gallery images"
          onChange={(e) => uploadFiles(e.target.files)}
        />
      </div>

      <div className="row">
        <input
          type="text"
          value={manual}
          disabled={busy || value.length >= 20}
          onChange={(e) => setManual(e.target.value)}
          placeholder="Media key or image URL"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addManual();
            }
          }}
        />

        <button
          type="button"
          className="btn sm"
          disabled={!manual.trim() || value.length >= 20 || busy}
          onClick={addManual}
        >
          Add reference
        </button>
      </div>

      <span className="hint">
        Upload images or add an existing media key or image URL. Maximum 20 images.
      </span>
      <span className="hint">
        PNG, JPEG and WebP images are compressed when needed. Maximum stored
        upload size: 1.2 MB per image.
      </span>
      {busy && <span className="hint">Uploading images...</span>}
      {error && <p className="error" role="alert">{error}</p>}
    </div>
  );
}
