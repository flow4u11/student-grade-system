import { it, expect } from "vitest";
import { academicYear, canonicalYear } from "../src/lib/presentation";
import { guessMapping, mappedRows, validateImport } from "../src/lib/import";
it("displays BE in Thai and stores CE once", () => {
  expect(academicYear(2026, "th")).toBe("2569");
  expect(academicYear(2026, "en")).toBe("2026");
  expect(canonicalYear(2569)).toBe(2026);
  expect(canonicalYear(2026)).toBe(2026);
});
it("preserves roll ordering without altering student ID", () => {
  const map = guessMapping([
    "เลขที่",
    "รหัสนักเรียน",
    "ชื่อ",
    "นามสกุล",
    "ห้อง",
  ]);
  const rows = mappedRows([["2", "00123", "A", "B", "M.1/1"]], map);
  expect(rows[0].roll_number).toBe(2);
  expect(rows[0].student_number).toBe("00123");
  expect(validateImport(rows)[0].errors).toEqual([]);
});
it("rejects invalid roll numbers", () =>
  expect(
    validateImport([
      {
        student_number: "00123",
        first_name: "A",
        last_name: "B",
        class_name: "M.1/1",
        roll_number: -1,
      },
    ])[0].errors,
  ).toContain("invalid"));
