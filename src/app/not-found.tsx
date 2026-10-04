"use client";
import Link from "next/link";
import { useLocale } from "@/components/providers";
export default function NotFound() {
  const { t } = useLocale();
  return (
    <main className="error-page">
      <h1>{t("notFound")}</h1>
      <Link className="button" href="/login">
        {t("back")}
      </Link>
    </main>
  );
}
