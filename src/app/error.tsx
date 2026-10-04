"use client";
import { useLocale } from "@/components/providers";
export default function ErrorPage({ reset }: { reset: () => void }) {
  const { t } = useLocale();
  return (
    <main className="error-page">
      <h1>{t("serverError")}</h1>
      <button className="button primary" onClick={reset}>
        {t("retry")}
      </button>
    </main>
  );
}
