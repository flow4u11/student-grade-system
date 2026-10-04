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
export function ConnectionStatus() {
  const online = useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );
  const { locale } = useLocale();
  return (
    <span
      className={`connection-status ${online ? "is-online" : "is-offline"}`}
      role="status"
      title={
        locale === "th"
          ? "สถานะการเชื่อมต่อเครือข่ายของเครื่องนี้"
          : "This device’s network connection"
      }
    >
      <i aria-hidden="true" />
      {locale === "th"
        ? online
          ? "ออนไลน์"
          : "ออฟไลน์"
        : online
          ? "Online"
          : "Offline"}
    </span>
  );
}
