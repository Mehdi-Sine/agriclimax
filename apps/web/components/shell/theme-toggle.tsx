"use client";
import { useSyncExternalStore } from "react";
import { IconButton } from "../ui/primitives";
function subscribe(callback: () => void) {
  window.addEventListener("agriclimax-theme", callback);
  return () => window.removeEventListener("agriclimax-theme", callback);
}
function snapshot() {
  return document.documentElement.dataset.theme === "dark";
}
export function ThemeToggle() {
  const dark = useSyncExternalStore(subscribe, snapshot, () => false);
  function toggle() {
    document.documentElement.dataset.theme = dark ? "light" : "dark";
    try {
      localStorage.setItem("agriclimax-theme", dark ? "light" : "dark");
    } catch {
      /* Storage can be disabled. */
    }
    window.dispatchEvent(new Event("agriclimax-theme"));
  }
  return (
    <IconButton
      label={dark ? "Activer le thème clair" : "Activer le thème sombre"}
      aria-pressed={dark}
      onClick={toggle}
    >
      {dark ? "☀" : "☾"}
    </IconButton>
  );
}
