"use client";
import { useState } from "react";
import { Archive } from "lucide-react";
import { useLocale } from "./providers";
import { api, Notice, useError } from "./ui";
import type { Kind } from "./record-editor";
export function ArchiveRecord({
  kind,
  id,
  onSaved,
}: {
  kind: Kind;
  id: string;
  onSaved: () => void;
}) {
  const { locale } = useLocale();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const errorText = useError();
  return (
    <>
      <button
        className="button small"
        disabled={busy}
        onClick={async () => {
          if (
            !window.confirm(
              locale === "th"
                ? "จัดเก็บรายการและรักษาประวัติไว้?"
                : "Archive this record and retain history?",
            )
          )
            return;
          setBusy(true);
          setError("");
          try {
            await api("/api/staff/archive-record", { kind, id });
            onSaved();
          } catch (err) {
            setError(errorText(err));
          } finally {
            setBusy(false);
          }
        }}
      >
        <Archive size={15} />
        {locale === "th" ? "จัดเก็บ" : "Archive"}
      </button>
      <Notice error={error} />
    </>
  );
}
