import { useEffect, useState } from "react";

export default function ThemeToggle() {
  const [dark, setDark] = useState(() => {
    try {
      const saved = localStorage.getItem("lms-theme");
      if (saved) return saved === "dark";
    } catch {
      // Use the system preference when storage is unavailable.
    }
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    try {
      localStorage.setItem("lms-theme", dark ? "dark" : "light");
    } catch {
      // The toggle still works without storage.
    }
  }, [dark]);

  return (
    <div className="theme-toolbar">
      <button
        type="button"
        aria-pressed={dark}
        onClick={() => setDark((value) => !value)}
      >
        Dark mode: {dark ? "On" : "Off"}
      </button>
    </div>
  );
}