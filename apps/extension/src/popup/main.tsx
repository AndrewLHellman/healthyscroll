import React from "react";
import { createRoot } from "react-dom/client";
import { Popup } from "./Popup";
import "./popup.css";

// popup.css sizes Chrome's popup window; iOS Safari shows the popup as a full-width sheet.
document.documentElement.dataset.target = import.meta.env.VITE_HS_TARGET;

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Popup />
  </React.StrictMode>,
);
