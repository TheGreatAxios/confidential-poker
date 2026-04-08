import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./globals.css";
import { Providers } from "./providers";
import App from "./App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {/* Ambient Background */}
    <div className="ambient-bg" aria-hidden="true">
      <div className="ambient-blob ambient-blob-1" />
      <div className="ambient-blob ambient-blob-2" />
      <div className="ambient-blob ambient-blob-3" />
    </div>
    <div className="noise-overlay" aria-hidden="true" />

    {/* Content */}
    <div className="relative z-10">
      <Providers>
        <App />
      </Providers>
    </div>
  </StrictMode>,
);
