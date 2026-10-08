"use client";

import { useSyncExternalStore } from "react";

const darkModeQuery = "(prefers-color-scheme: dark)";

function subscribe(onChange: () => void) {
  const media = window.matchMedia(darkModeQuery);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

function getSnapshot() {
  return window.matchMedia(darkModeQuery).matches;
}

function getServerSnapshot() {
  return false;
}

export function usePageTheme() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
    ? "dark"
    : "light";
}
