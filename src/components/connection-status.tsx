"use client";
import { useSyncExternalStore } from "react";
import { useLocale } from "./providers";
function subscribe(listener: () => void) {
  window.addEventListener("online", listener);
  window.addEventListener("offline", listener);
  return () => {
    window.removeEventListener("online", listener);
    window.removeEventListener("offline", listener);
  };
}
export function ConnectionStatus({ dot = false }: { dot?: boolean }) {
  const online = useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );
  const { locale } = useLocale();
  return (
    <span
      className={`connection-status ${dot ? "connection-dot" : ""} ${online ? "is-online" : "is-offline"}`}
      role="status"
      aria-label={
        locale === "th"
          ? online
            ? "ออนไลน์"
            : "ออฟไลน์"
          : online
            ? "Online"
            : "Offline"
      }
      title={
        locale === "th"
          ? "สถานะการเชื่อมต่อเครือข่ายของเครื่องนี้"
          : "This device’s network connection"
      }
    >
      <i aria-hidden="true" />
      {!dot &&
        (locale === "th"
          ? online
            ? "ออนไลน์"
            : "ออฟไลน์"
          : online
            ? "Online"
            : "Offline")}
    </span>
  );
}
