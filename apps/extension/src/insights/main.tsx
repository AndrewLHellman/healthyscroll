import React from "react";
import { createRoot } from "react-dom/client";
import { Insights } from "./Insights";
import "./insights.css";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Insights />
  </React.StrictMode>,
);
