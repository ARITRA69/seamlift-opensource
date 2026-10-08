"use client";

import { useSyncExternalStore } from "react";
import { themeStorageKey } from "./theme-script";

export type PageTheme = "light" | "dark";

function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });
  return () => observer.disconnect();
}

function getSnapshot(): PageTheme {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

function getServerSnapshot(): PageTheme {
  return "light";
}

export function usePageTheme() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function setPageTheme(theme: PageTheme) {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem(themeStorageKey, theme);
  } catch {
    // The choice still applies until the page reloads.
  }
}
