"use client";
import { useEffect, useState, useSyncExternalStore } from "react";
import { BookOpen, Heart, Sparkles, Clock3 } from "lucide-react";
import { useLocale } from "./providers";
import { Modal } from "./ui";
import { SUPPORT_URL } from "@/lib/site-config";

export function ThaiClock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    const update = () => setNow(new Date());
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, []);
  const date =
    now &&
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Bangkok",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(now);
  const time =
    now &&
    new Intl.DateTimeFormat("th-TH", {
      timeZone: "Asia/Bangkok",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).format(now);
  return (
    <div className="thai-clock" title="เวลาไทย (Asia/Bangkok) · วันที่ ค.ศ.">
      <Clock3 size={15} />
      <time dateTime={now?.toISOString()}>
        {time || "--:--:--"}
        <small>{date || "DD/MM/YYYY"}</small>
      </time>
    </div>
  );
}
const welcomeSubscribe = (listener: () => void) => {
  window.addEventListener("school-welcome", listener);
  return () => window.removeEventListener("school-welcome", listener);
};
function welcomeSnapshot(kind: "teacher" | "student") {
  try {
    return sessionStorage.getItem("school_welcome") === kind;
  } catch {
    return false;
  }
}
function closeWelcome() {
  try {
    sessionStorage.removeItem("school_welcome");
  } catch {}
  window.dispatchEvent(new Event("school-welcome"));
}
export function WelcomeScreen({
  name,
  kind = "teacher",
}: {
  name: string;
  kind?: "teacher" | "student";
}) {
  const { locale } = useLocale();
  const show = useSyncExternalStore(
    welcomeSubscribe,
    () => welcomeSnapshot(kind),
    () => false,
  );
  useEffect(() => {
    if (!show) return;
    const timer = setTimeout(closeWelcome, 2400);
    return () => clearTimeout(timer);
  }, [show]);
  return show ? (
    <div
      className="welcome-screen"
      role="dialog"
      aria-modal="true"
      aria-label={locale === "th" ? "ยินดีต้อนรับ" : "Welcome"}
      onClick={closeWelcome}
    >
      <div className="welcome-card">
        <span className="welcome-mark">
          <BookOpen size={34} />
        </span>
        <span className="eyebrow">School Ledger</span>
        <h1>{locale === "th" ? "ยินดีต้อนรับ" : "Welcome"}</h1>
        <p>{name}</p>
        <button type="button" className="button primary" onClick={closeWelcome}>
          <Sparkles size={16} />
          {locale === "th" ? "เริ่มใช้งาน" : "Get started"}
        </button>
      </div>
    </div>
  ) : null;
}
export function SupportButton() {
  const [open, setOpen] = useState(false);
  const { locale } = useLocale();
  return (
    <>
      <button
        type="button"
        className="support-button"
        onClick={() => setOpen(true)}
      >
        <Heart size={16} />
        <span>Support me</span>
      </button>
      {open && (
        <Modal
          title={
            locale === "th" ? "สนับสนุน School Ledger" : "Support School Ledger"
          }
          onClose={() => setOpen(false)}
        >
          <div className="dialog-body">
            <p>
              {locale === "th"
                ? "ขอบคุณที่สนับสนุนการพัฒนา School Ledger"
                : "Thank you for supporting School Ledger."}
            </p>
            {SUPPORT_URL ? (
              <a
                className="button primary"
                href={SUPPORT_URL}
                target="_blank"
                rel="noopener noreferrer"
              >
                {locale === "th" ? "เปิดหน้าสนับสนุน" : "Open support page"}
              </a>
            ) : (
              <p className="hint">
                {locale === "th"
                  ? "กำลังเตรียมช่องทางสนับสนุนผ่าน Stripe ขณะนี้ยังไม่มีการรับชำระเงิน"
                  : "A Stripe support option is planned. Payments are not enabled yet."}
              </p>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}
