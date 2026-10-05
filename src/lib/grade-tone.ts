/** Visual feedback only; GPA and grades remain calculated by grading.ts. */
export function gradeTone(
  value: string | number | null | undefined,
  perfectGpa = false,
): string {
  if (value === null || value === undefined || value === "") return "";
  if (value === "PASS") return "grade-good";
  if (value === "FAIL") return "grade-low";
  const points = Number(value);
  if (!Number.isFinite(points) || points < 0 || points > 4) return "";
  if (perfectGpa && points === 4) return "grade-perfect";
  if (points < 1) return "grade-low";
  if (points < 2) return "grade-fair";
  if (points < 3) return "grade-medium";
  return "grade-good";
}
