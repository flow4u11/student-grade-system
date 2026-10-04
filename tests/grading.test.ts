import { describe, it, expect } from "vitest";
import {
  gradePreview,
  passPreview,
  gpa,
  validateRules,
} from "../src/lib/grading";
import { schemas, saveRequest } from "../src/lib/validation";
const rules = [
  { minimum: 0, points: 0 },
  { minimum: 50, points: 1 },
  { minimum: 55, points: 1.5 },
  { minimum: 60, points: 2 },
  { minimum: 65, points: 2.5 },
  { minimum: 70, points: 3 },
  { minimum: 75, points: 3.5 },
  { minimum: 80, points: 4 },
];
describe("grade boundaries", () => {
  it.each([
    ["79", 3.5],
    ["79.99", 3.5],
    ["80", 4],
    ["74.99", 3],
    ["75", 3.5],
    ["49.99", 0],
    ["50", 1],
    ["0", 0],
    ["100", 4],
  ])("%s => %s", (score, points) =>
    expect(gradePreview(score, 100, rules)).toBe(points),
  );
  it.each(["-1", "100.01", "", "not a score", "NaN", "Infinity", "79.999"])(
    "rejects %s",
    (score) => expect(gradePreview(score, 100, rules)).toBeNull(),
  );
  it("normalizes other maximum scores deterministically", () => {
    expect(gradePreview("39.99", 50, rules)).toBe(3.5);
    expect(gradePreview("40", 50, rules)).toBe(4);
  });
  it("has exact automatic pass boundary", () => {
    expect(passPreview("59.99", 100, 60)).toBe("FAIL");
    expect(passPreview("60", 100, 60)).toBe("PASS");
    expect(passPreview("29.99", 50, 60)).toBe("FAIL");
    expect(passPreview("30", 50, 60)).toBe("PASS");
  });
  it("rejects zero maximum", () =>
    expect(gradePreview("0", 0, rules)).toBeNull());
});
describe("scheme partition invariants", () => {
  it("accepts the default", () => expect(validateRules(rules)).toBe(true));
  it("rejects missing lower bound", () =>
    expect(validateRules(rules.slice(1))).toBe(false));
  it("rejects duplicate boundaries", () =>
    expect(validateRules([...rules, rules[0]])).toBe(false));
  it("rejects impossible points", () =>
    expect(
      validateRules([
        { minimum: 0, points: 5 },
        { minimum: 50, points: 2 },
      ]),
    ).toBe(false));
  it("rejects impossible percentage", () =>
    expect(
      validateRules([
        { minimum: 0, points: 0 },
        { minimum: 101, points: 4 },
      ]),
    ).toBe(false));
});
describe("weighted GPA", () => {
  const grade = (points: number | null, credits = 1) => ({
    grade_points: points,
    credits,
    include_in_gpa: true,
    grading_type: "NUMERIC_GRADE",
    state: "PUBLISHED",
  });
  it("weights credits", () =>
    expect(gpa([grade(4, 3), grade(2, 1)])).toBe("3.50"));
  it("rounds to two decimals", () =>
    expect(gpa([grade(4, 2), grade(3, 1)])).toBe("3.67"));
  it("excludes drafts, excluded subjects, pass/fail, nulls and zero credits", () =>
    expect(
      gpa([
        grade(3.5),
        { ...grade(0), state: "DRAFT" },
        { ...grade(0), include_in_gpa: false },
        { ...grade(0), grading_type: "PASS_FAIL" },
        grade(null),
        grade(0, 0),
      ]),
    ).toBe("3.50"));
  it("returns no result for no credits", () => {
    expect(gpa([])).toBeNull();
    expect(gpa([grade(4, 0)])).toBeNull();
  });
});
describe("request validation", () => {
  it("preserves student number as text", () => {
    const s = schemas.students.parse({
      student_number: "00123",
      first_name: "Test",
      last_name: "Student",
      active: true,
      term_id: "10000000-0000-4000-8000-000000000001",
      class_id: "10000000-0000-4000-8000-000000000002",
      pin: "12345678",
    });
    expect(s.student_number).toBe("00123");
  });
  it("rejects extra score precision", () =>
    expect(
      saveRequest.safeParse({
        offering_id: "10000000-0000-4000-8000-000000000001",
        rows: [
          {
            student_id: "10000000-0000-4000-8000-000000000002",
            version: 0,
            score: "79.999",
            result: null,
          },
        ],
      }).success,
    ).toBe(false));
});

describe("deployed cookie policy", () => {
  it("permits loopback HTTP but rejects public HTTP", async () => {
    const { secureCookies } = await import("../src/lib/config");
    const previous = process.env.APP_URL;
    try {
      process.env.APP_URL = "http://127.0.0.1:3000";
      expect(secureCookies()).toBe(false);
      process.env.APP_URL = "https://school.example";
      expect(secureCookies()).toBe(true);
      process.env.APP_URL = "http://school.example";
      expect(() => secureCookies()).toThrow("HTTPS");
    } finally {
      process.env.APP_URL = previous;
    }
  });
});
