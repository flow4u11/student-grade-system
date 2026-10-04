import { describe, it, expect } from "vitest";
import {
  bulkOfferingsRequest,
  studentGradesRequest,
} from "../src/lib/validation";
const a = "10000000-0000-4000-8000-000000000001",
  b = "10000000-0000-4000-8000-000000000002";
const payload = {
  subject_id: a,
  term_id: a,
  grading_type: "NUMERIC_GRADE",
  max_score: "100",
  credits: "1",
  scheme_id: a,
  include_in_gpa: true,
  pass_mode: "AUTOMATIC",
  pass_threshold: "60",
};
describe("teacher QoL input boundaries", () => {
  it("accepts shared offering settings and multiple distinct classes", () =>
    expect(
      bulkOfferingsRequest.parse({ payload, class_ids: [a, b] }).payload
        .max_score,
    ).toBe(100));
  it("rejects empty, duplicate or update-based bulk creation", () => {
    for (const value of [
      { payload, class_ids: [] },
      { payload, class_ids: [a, a] },
      { payload: { ...payload, id: a }, class_ids: [a] },
    ])
      expect(bulkOfferingsRequest.safeParse(value).success).toBe(false);
  });
  it("requires a numeric scheme and excludes pass/fail from GPA", () => {
    for (const p of [
      { ...payload, scheme_id: "" },
      { ...payload, grading_type: "PASS_FAIL", include_in_gpa: true },
    ])
      expect(
        bulkOfferingsRequest.safeParse({ payload: p, class_ids: [a] }).success,
      ).toBe(false);
  });
  it("requires versions and precise scores in student saves", () => {
    const row = { offering_id: a, version: 0, score: "79.99", result: null };
    expect(
      studentGradesRequest.safeParse({ student_id: a, term_id: b, rows: [row] })
        .success,
    ).toBe(true);
    expect(
      studentGradesRequest.safeParse({
        student_id: a,
        term_id: b,
        rows: [{ ...row, score: "79.999" }],
      }).success,
    ).toBe(false);
  });
});
