import type { ReactNode } from "react";

export default function StateScreen({ art, title, text, children, alert = false }: { art: ReactNode; title: string; text: string; children?: ReactNode; alert?: boolean }) {
  return (
    <div className="state" role={alert ? "alert" : "status"}>
      {art}
      <h2>{title}</h2>
      <p>{text}</p>
      {children && <div className="state-actions">{children}</div>}
    </div>
  );
}
