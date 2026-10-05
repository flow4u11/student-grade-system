"use client";
import {
  createContext,
  useContext,
  useEffect,
  useSyncExternalStore,
} from "react";
import { contrastText, parsePalette, type Palette } from "@/lib/theme";
import type { Branding } from "@/lib/branding";
const key = "school_personal_theme";
const context = createContext<{
  palette: Palette | null;
  design: "standard" | "glass" | "neo";
  setDesign: (value: "standard" | "glass" | "neo") => void;
  setPalette: (value: Palette | null) => void;
}>({
  palette: null,
  setPalette: () => {},
  design: "standard",
  setDesign: () => {},
});
function subscribe(listener: () => void) {
  window.addEventListener("storage", listener);
  window.addEventListener("school-theme", listener);
  return () => {
    window.removeEventListener("storage", listener);
    window.removeEventListener("school-theme", listener);
  };
}
function snapshot() {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
export function PersonalThemeProvider({
  school,
  children,
}: {
  school: Branding;
  children: React.ReactNode;
}) {
  const raw = useSyncExternalStore(subscribe, snapshot, () => null);
  const storedDesign = useSyncExternalStore(
    subscribe,
    () => {
      try {
        return localStorage.getItem("school_design_theme");
      } catch {
        return null;
      }
    },
    () => null,
  );
  const design =
    storedDesign === "glass" || storedDesign === "neo"
      ? storedDesign
      : "standard";
  useEffect(() => {
    document.documentElement.dataset.schoolDesign = design;
  }, [design]);
  function setDesign(value: "standard" | "glass" | "neo") {
    try {
      localStorage.setItem("school_design_theme", value);
    } catch {
      return;
    }
    window.dispatchEvent(new Event("school-theme"));
  }
  const palette = parsePalette(raw);
  const applied = palette || school;
  const {
    primary_color,
    secondary_color,
    background_color,
    background_color_dark,
  } = applied;
  useEffect(() => {
    const colors = {
      "--school-primary": primary_color,
      "--school-secondary": secondary_color,
      "--on-primary": contrastText(primary_color),
      "--school-bg": background_color,
      "--school-bg-dark": background_color_dark,
      "--school-ink": contrastText(background_color),
      "--school-ink-dark": contrastText(background_color_dark),
      "--school-surface": `color-mix(in srgb, ${background_color} ${contrastText(background_color) === "#ffffff" ? "90%" : "15%"}, white)`,
      "--school-surface-dark": `color-mix(in srgb, ${background_color_dark} ${contrastText(background_color_dark) === "#ffffff" ? "90%" : "15%"}, white)`,
    };
    for (const [name, value] of Object.entries(colors))
      document.documentElement.style.setProperty(name, value);
  }, [primary_color, secondary_color, background_color, background_color_dark]);
  function setPalette(value: Palette | null) {
    try {
      if (value) localStorage.setItem(key, JSON.stringify(value));
      else localStorage.removeItem(key);
    } catch {
      return;
    }
    window.dispatchEvent(new Event("school-theme"));
  }
  return (
    <context.Provider value={{ palette, setPalette, design, setDesign }}>
      {children}
    </context.Provider>
  );
}
export const usePersonalTheme = () => useContext(context);
