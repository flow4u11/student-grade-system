import type { Rule } from "./types";
export function validDecimal(value: string): boolean {
  return /^\d+(\.\d{1,2})?$/.test(value);
}
export function validateRules(rules: Rule[]) {
  if (rules.length < 2 || rules.length > 30) return false;
  const sorted = [...rules].sort((a, b) => a.minimum - b.minimum);
  return (
    sorted[0].minimum === 0 &&
    sorted.every(
      (r, i) =>
        Number.isFinite(r.minimum) &&
        r.minimum >= 0 &&
        r.minimum <= 100 &&
        Number.isFinite(r.points) &&
        r.points >= 0 &&
        r.points <= 4 &&
        validDecimal(String(r.minimum)) &&
        validDecimal(String(r.points)) &&
        (i === 0 || r.minimum > sorted[i - 1].minimum),
    )
  );
}
// Preview only. PostgreSQL numeric arithmetic is authoritative before every write.
export function gradePreview(
  score: string,
  maximum: number,
  rules: Rule[],
): number | null {
  if (
    !validDecimal(score) ||
    Number(score) > maximum ||
    maximum <= 0 ||
    !validateRules(rules)
  )
    return null;
  const hundredths = Math.round(Number(score) * 100);
  const maxHundredths = Math.round(maximum * 100);
  return (
    [...rules]
      .sort((a, b) => b.minimum - a.minimum)
      .find(
        (r) =>
          hundredths * 10000 >= Math.round(r.minimum * 100) * maxHundredths,
      )?.points ?? null
  );
}
export function passPreview(
  score: string,
  maximum: number,
  threshold: number,
): "PASS" | "FAIL" | null {
  if (!validDecimal(score) || Number(score) > maximum || maximum <= 0)
    return null;
  return Math.round(Number(score) * 100) * 10000 >=
    Math.round(threshold * 100) * Math.round(maximum * 100)
    ? "PASS"
    : "FAIL";
}
export function gpa(
  grades: {
    grade_points: number | null;
    credits: number;
    include_in_gpa: boolean;
    grading_type: string;
    state: string;
  }[],
): string | null {
  const eligible = grades.filter(
    (g) =>
      g.state === "PUBLISHED" &&
      g.include_in_gpa &&
      g.grading_type === "NUMERIC_GRADE" &&
      g.grade_points !== null &&
      g.credits > 0,
  );
  const credits = eligible.reduce((s, g) => s + Math.round(g.credits * 100), 0);
  const weighted = eligible.reduce(
    (s, g) =>
      s + Math.round(g.grade_points! * 100) * Math.round(g.credits * 100),
    0,
  );
  return credits ? (Math.round(weighted / credits) / 100).toFixed(2) : null;
}
