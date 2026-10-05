"use client";
import { PersonalThemeProvider } from "./personal-theme";
import { Select } from "./select";
import { createContext, useContext, useState } from "react";
import { defaultBranding, type Branding } from "@/lib/branding";
const NavigationContext = createContext<{
  collapsed: boolean;
  setCollapsed: (value: boolean) => void;
}>({
  collapsed: false,
  setCollapsed: () => {},
});
export const useNavigationPreferences = () => useContext(NavigationContext);
const BrandingContext = createContext<Branding>(defaultBranding);
export const useBranding = () => useContext(BrandingContext);
import { ThemeProvider } from "next-themes";
import { en, th, type MessageKey } from "@/lib/i18n";
const LocaleContext = createContext<{
  locale: "th" | "en";
  setLocale: (value: "th" | "en") => void;
  t: (key: MessageKey) => string;
}>({ locale: "th", setLocale: () => {}, t: (key) => en[key] });
export function Providers({
  children,
  initialLocale,
  school,
  initialCollapsed,
}: {
  children: React.ReactNode;
  initialLocale: "th" | "en";
  school: Branding;
  initialCollapsed: boolean;
}) {
  const [collapsed, setCollapse] = useState(initialCollapsed);
  function setCollapsed(value: boolean) {
    setCollapse(value);
    document.cookie = `school_sidebar=${value ? "collapsed" : "expanded"};path=/;max-age=31536000;SameSite=Lax`;
  }
  const [locale, set] = useState(initialLocale);
  function setLocale(value: "th" | "en") {
    set(value);
    document.cookie = `school_locale=${value};path=/;max-age=31536000;SameSite=Lax`;
    document.documentElement.lang = value;
  }
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <PersonalThemeProvider school={school}>
        <BrandingContext.Provider value={school}>
          <LocaleContext.Provider
            value={{
              locale,
              setLocale,
              t: (key) => (locale === "th" ? th : en)[key],
            }}
          >
            <NavigationContext.Provider value={{ collapsed, setCollapsed }}>
              <div
                className="application-root"
                onDragStartCapture={(e) => e.preventDefault()}
              >
                {children}
              </div>
            </NavigationContext.Provider>
          </LocaleContext.Provider>
        </BrandingContext.Provider>
      </PersonalThemeProvider>
    </ThemeProvider>
  );
}
export const useLocale = () => useContext(LocaleContext);
export function Preferences({ compact = false }: { compact?: boolean }) {
  const { locale, setLocale, t } = useLocale();
  return (
    <div className={`preferences ${compact ? "compact-preferences" : ""}`}>
      <label>
        <span className="sr-only">{t("language")}</span>
        <Select
          aria-label={t("language")}
          value={locale}
          onChange={(e) => setLocale(e.target.value as "th" | "en")}
        >
          <option value="th">ไทย</option>
          <option value="en">English</option>
        </Select>
      </label>
    </div>
  );
}
