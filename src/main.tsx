import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Guard: no registrar service worker en preview de Lovable o dentro de iframes
const isInIframe = (() => {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
})();

const isPreviewHost =
  window.location.hostname.includes("id-preview--") ||
  window.location.hostname.includes("lovableproject.com");

if (isPreviewHost || isInIframe) {
  // Limpiar cualquier SW previamente registrado en contextos de preview
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.getRegistrations().then((regs) => regs.forEach((r) => r.unregister()));
  }
} else if ("serviceWorker" in navigator && import.meta.env.PROD) {
  // Solo en producción, fuera de iframe: registrar PWA
  import("virtual:pwa-register")
    .then(({ registerSW }) => {
      registerSW({ immediate: true });
    })
    .catch(() => {});
}

createRoot(document.getElementById("root")!).render(<App />);
