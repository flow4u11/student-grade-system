import { contrastText } from "@/lib/theme";
import type { CSSProperties } from "react";
import { schoolBranding } from "@/lib/school-settings";
import localFont from "next/font/local";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Providers } from "@/components/providers";
import "./globals.css";
const thaiFont = localFont({
  src: "./fonts/NotoSansThai.ttf",
  variable: "--font-thai",
  display: "swap",
  weight: "100 900",
});
export const metadata: Metadata = {
  title: "School Ledger | Student Grade Management",
  description: "Private student records and thoughtful grade management.",
  robots: { index: false, follow: false },
};
export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const school = await schoolBranding();
  const preference = (await cookies()).get("school_locale")?.value;
  const locale =
    preference === "en" || preference === "th"
      ? preference
      : school.default_language;
  return (
    <html
      lang={locale}
      suppressHydrationWarning
      style={
        {
          "--school-primary": school.primary_color,
          "--school-secondary": school.secondary_color,
          "--on-primary": contrastText(school.primary_color),
          "--school-bg": school.background_color,
          "--school-bg-dark": school.background_color_dark,
          "--school-ink": contrastText(school.background_color),
          "--school-ink-dark": contrastText(school.background_color_dark),
          "--school-surface":
            contrastText(school.background_color) === "#ffffff"
              ? `color-mix(in srgb, ${school.background_color} 90%, white)`
              : `color-mix(in srgb, ${school.background_color} 15%, white)`,
          "--school-surface-dark":
            contrastText(school.background_color_dark) === "#ffffff"
              ? `color-mix(in srgb, ${school.background_color_dark} 90%, white)`
              : `color-mix(in srgb, ${school.background_color_dark} 15%, white)`,
        } as CSSProperties
      }
    >
      <body className={thaiFont.variable}>
        <Providers
          initialLocale={locale}
          school={school}
          initialCollapsed={
            (await cookies()).get("school_sidebar")?.value === "collapsed"
          }
        >
          {children}
        </Providers>
      </body>
    </html>
  );
}
