"use client";
import { useState } from "react";
import { useLocale } from "./providers";
import type { Rule } from "@/lib/types";
export function CriteriaEditor({ initial }: { initial: Rule[] }) {
  const { t } = useLocale();
  const [rows, setRows] = useState(
    [...initial].sort((a, b) => b.minimum - a.minimum),
  );
  return (
    <>
      <input
        type="hidden"
        name="rules"
        value={rows.map((r) => `${r.minimum},${r.points}`).join("\n")}
      />
      <p className="hint">{t("criteriaHint")}</p>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>{t("minimumPercent")}</th>
              <th>{t("maximum")}</th>
              <th>{t("grade")}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td>
                  <input
                    aria-label={`${t("minimumPercent")} ${i + 1}`}
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    required
                    value={r.minimum}
                    onChange={(e) =>
                      setRows(
                        rows.map((v, j) =>
                          j === i
                            ? { ...v, minimum: Number(e.target.value) }
                            : v,
                        ),
                      )
                    }
                  />
                </td>
                <td>
                  {i === 0 ? "100" : (rows[i - 1].minimum - 0.01).toFixed(2)}
                </td>
                <td>
                  <input
                    aria-label={`${t("grade")} ${i + 1}`}
                    type="number"
                    min="0"
                    max="4"
                    step="0.5"
                    required
                    value={r.points}
                    onChange={(e) =>
                      setRows(
                        rows.map((v, j) =>
                          j === i
                            ? { ...v, points: Number(e.target.value) }
                            : v,
                        ),
                      )
                    }
                  />
                </td>
                <td>
                  <button
                    type="button"
                    className="button small"
                    disabled={rows.length <= 2}
                    onClick={() => setRows(rows.filter((_, j) => i !== j))}
                  >
                    {t("deleteRecord")}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button
        type="button"
        className="button small"
        disabled={rows.length >= 30}
        onClick={() => setRows([...rows, { minimum: 0, points: 0 }])}
      >
        {t("add")}
      </button>
    </>
  );
}
