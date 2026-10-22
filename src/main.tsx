import React from "react";
import { createRoot } from "react-dom/client";
import { RootApp } from "./RootApp";
import { ScienceProvider } from "./science/api";
import "./app.css";
import "./archive.css";

createRoot(document.getElementById("root")!).render(<ScienceProvider><RootApp /></ScienceProvider>);
