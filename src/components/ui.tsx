"use client";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type InputHTMLAttributes,
} from "react";
import { FieldLabelContext } from "./field-label";
import { BookOpen, Eye, EyeOff, X } from "lucide-react";
import { useLocale } from "./providers";
import { en, type MessageKey } from "@/lib/i18n";
export async function api<T>(resource: string, body?: unknown): Promise<T> {
  const response = await fetch(resource, {
    method: body === undefined ? "GET" : "POST",
    headers:
      body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "serverError");
  return data;
}
export function useError() {
  const { t } = useLocale();
  return (e: unknown) => {
    const k = e instanceof Error ? e.message : "serverError";
    return t(k in en ? (k as MessageKey) : "serverError");
  };
}
export function Notice({
  error,
  message,
}: {
  error?: string;
  message?: string;
}) {
  return error ? (
    <div role="alert" className="notice error">
      {error}
    </div>
  ) : message ? (
    <div role="status" className="notice success">
      {message}
    </div>
  ) : null;
}
export function Loading() {
  const { t } = useLocale();
  return (
    <div className="skeleton-page" role="status" aria-busy="true">
      <span className="sr-only">{t("loading")}</span>
      <div aria-hidden="true">
        <div className="skeleton skeleton-title" />
        <div className="skeleton skeleton-subtitle" />
        <div className="skeleton-panel">
          <div className="skeleton-profile">
            <div className="skeleton skeleton-avatar" />
            <div className="skeleton skeleton-name" />
          </div>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="skeleton-row">
              <div className="skeleton" />
              <div className="skeleton" />
              <div className="skeleton" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
export function PasswordInput(props: InputHTMLAttributes<HTMLInputElement>) {
  const [visible, setVisible] = useState(false);
  const { locale, t } = useLocale();
  const label =
    locale === "th"
      ? visible
        ? "ซ่อนรหัสผ่าน"
        : "แสดงรหัสผ่าน"
      : visible
        ? "Hide password"
        : "Show password";
  return (
    <span className="password-field">
      <input
        {...props}
        aria-label={props["aria-label"] || t("password")}
        type={visible ? "text" : "password"}
      />
      <button
        className="icon-button"
        type="button"
        disabled={props.disabled}
        aria-label={label}
        aria-pressed={visible}
        onClick={() => setVisible(!visible)}
      >
        {visible ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </span>
  );
}
export function Empty({ description }: { description?: string }) {
  const { t } = useLocale();
  return (
    <div className="empty">
      <BookOpen size={30} />
      <h3>{t("empty")}</h3>
      <p>{description || t("emptyDescription")}</p>
    </div>
  );
}
export function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const { t } = useLocale();
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      aria-labelledby="modal-title"
    >
      <div className="dialog-head">
        <h2 id="modal-title">{title}</h2>
        <button
          className="icon-button"
          type="button"
          aria-label={t("close")}
          onClick={onClose}
        >
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function Pager({
  page,
  total,
  onChange,
}: {
  page: number;
  total: number;
  onChange: (p: number) => void;
}) {
  const { t } = useLocale();
  return (
    <div className="pager">
      <span>
        {total.toLocaleString()} {t("records")} · {t("page")} {page + 1}{" "}
        {t("of")} {Math.max(1, Math.ceil(total / 50))}
      </span>
      <div>
        <button
          className="button secondary"
          disabled={!page}
          onClick={() => onChange(page - 1)}
        >
          {t("previous")}
        </button>
        <button
          className="button secondary"
          disabled={(page + 1) * 50 >= total}
          onClick={() => onChange(page + 1)}
        >
          {t("next")}
        </button>
      </div>
    </div>
  );
}
export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  const id = useId();
  return (
    <label className="field">
      <span id={id}>{label}</span>
      <FieldLabelContext.Provider value={id}>
        {children}
      </FieldLabelContext.Provider>
      {hint && <small>{hint}</small>}
    </label>
  );
}
