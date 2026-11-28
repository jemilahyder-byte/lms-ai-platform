import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import ThemeToggle from "./ThemeToggle.jsx";
import "./theme.css";
import LanguageSelector from "./LanguageSelector.jsx";
createRoot(document.getElementById("root")).render(
  <StrictMode>
    <ThemeToggle />
    <LanguageSelector />
    <App />
  </StrictMode>,
);