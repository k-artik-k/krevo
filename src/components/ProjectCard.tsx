
import type { KeyboardEvent, MouseEvent } from "react";
import HandBox from "./HandBox";
import { Doodle } from "./Illustrations";
import { mediaUrl, type Project } from "../types";

const hash = (s: string) => {
  let h = 0;
  for (const c of s) {
    h = (h * 31 + c.charCodeAt(0)) | 0;
  }
  return h >>> 0;
};

// Stable, deterministic tilt for each project.
const getTilt = (slug: string) => {
  const value = hash(slug) % 2201;
  return ((value / 1000) - 1.1).toFixed(2);
};

export default function ProjectCard({
  project,
  index,
  onOpen,
}: {
  project: Project;
  index: number;
  onOpen: (p: Project) => void;
}) {
  const click = (e: MouseEvent<HTMLAnchorElement>) => {
    // Preserve browser shortcuts and open-in-new-tab behaviour.
    if (
      e.metaKey ||
      e.ctrlKey ||
      e.shiftKey ||
      e.button !== 0
    ) {
      return;
    }

    e.preventDefault();
    onOpen(project);
  };

  const key = (e: KeyboardEvent<HTMLAnchorElement>) => {
    if (e.key === " ") {
      e.preventDefault();
      e.currentTarget.click();
    }
  };

  return (
    <li
      className="float"
      style={{
        ["--i" as string]: index,
        ["--tilt" as string]: `${getTilt(project.slug)}deg`,
      }}
    >
      <a
        className="card"
        href={`/p/${project.slug}`}
        onClick={click}
        onKeyDown={key}
      >
        <HandBox
          seed={project.slug}
          fill
          echo
          sketch
        />

        <div className="thumb">
          <div className="thumb-in">
            {project.coverKey ? (
              <img
                src={mediaUrl(project.coverKey)}
                alt=""
                loading="lazy"
                decoding="async"
              />
            ) : (
              <Doodle seed={hash(project.slug)} />
            )}
          </div>

          <HandBox
            seed={project.slug + "t"}
            amp={1.1}
          />
        </div>

        <div className="card-body">
          <h2>{project.title}</h2>

          <p>{project.shortDescription}</p>

          <div className="card-meta">
            <span className="tag">
              {project.category || "Project"}
            </span>

            <span className="year">
              {project.year}
            </span>
          </div>
        </div>
      </a>
    </li>
  );
}
