import { createRoot } from "react-dom/client";
import { ThemeProvider } from "next-themes";
import App from "./App.tsx";
import "./index.css";

const ensurePortalRoot = () => {
  const existing = document.getElementById("portal-root");
  if (existing) return;
  const el = document.createElement("div");
  el.id = "portal-root";
  document.body.appendChild(el);
};

ensurePortalRoot();

createRoot(document.getElementById("root")!).render(
  <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
    <App />
  </ThemeProvider>,
);
