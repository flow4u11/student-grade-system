"use client";
import { useLocale } from "./providers";
export function NavigationScroll({ children }: { children: React.ReactNode }) {
  const { t } = useLocale();
  return (
    <div className="nav-scroll-shell">
      <nav className="nav-scroll" aria-label={t("workspace")} tabIndex={0}>
        {children}
      </nav>
    </div>
  );
}
