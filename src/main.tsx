import { StrictMode, Suspense, lazy } from "react";
import { createRoot } from "react-dom/client";
import Viewer from "./Viewer";
import "./styles.css";

const Admin = lazy(() => import("./admin/AdminApp"));
const isAdmin = location.pathname === "/admin" || location.pathname.startsWith("/admin/");

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {isAdmin ? <Suspense fallback={<p className="loading" role="status">Loading admin…</p>}><Admin /></Suspense> : <Viewer />}
  </StrictMode>,
);
