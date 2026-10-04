import { describe, expect, it, vi } from "vitest";
import ExcelJS from "exceljs";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../src/lib/database.types";
import type { StudentListRow } from "../src/lib/types";
import { studentExportRows, withStudentGpas } from "../src/lib/student-gpa";
import { workbookResponse } from "../src/lib/workbook";

vi.mock("server-only", () => ({}));

const term = "term-a";
const student = (id: string, classroom = "class-a") => ({
  id,
  student_number: "00123",
  first_name: "Test",
  last_name: "Student",
  active: true,
  roll_number: 1,
  class_name: "M.1/1",
  enrollments: [{ term_id: term, class_id: classroom }],
});
const grade = (
  studentId: string,
  offeringId: string,
  points: number | null,
  credits = 1,
) => ({
  id: offeringId,
  student_id: studentId,
  grade_points: points,
  state: "PUBLISHED",
  subject_offerings: {
    term_id: term,
    class_id: "class-a",
    credits,
    include_in_gpa: true,
    grading_type: "NUMERIC_GRADE",
  },
});
type GradeRow = ReturnType<typeof grade>;

// Emulate PostgREST filtering plus the signed-in client's RLS-visible offerings.
function staffDb(rows: GradeRow[], visible?: Set<string>) {
  const reads: {
    ids: string[];
    term?: unknown;
    classes: string[];
    from: number;
  }[] = [];
  const from = vi.fn((table: string) => {
    expect(table).toBe("student_grades");
    const filters: Record<string, unknown> = {};
    const query = {
      select: vi.fn(() => query),
      eq: vi.fn((key: string, value: unknown) => {
        filters[key] = value;
        return query;
      }),
      in: vi.fn((key: string, values: string[]) => {
        filters[key] = values;
        return query;
      }),
      order: vi.fn(() => query),
      range: vi.fn(async (start: number, end: number) => {
        const ids = filters.student_id as string[];
        const classes = filters["subject_offerings.class_id"] as string[];
        reads.push({
          ids,
          classes,
          term: filters["subject_offerings.term_id"],
          from: start,
        });
        return {
          data: rows
            .filter(
              (row) =>
                (!visible || visible.has(row.id)) &&
                row.state === filters.state &&
                row.subject_offerings.term_id ===
                  filters["subject_offerings.term_id"] &&
                ids.includes(row.student_id) &&
                classes.includes(row.subject_offerings.class_id),
            )
            .slice(start, end + 1),
          error: null,
        };
      }),
    };
    return query;
  });
  return { db: { from } as unknown as SupabaseClient<Database>, reads, from };
}

describe("student list GPA", () => {
  it("uses published weighted grades in the selected enrollment and leaves missing results empty", async () => {
    const math = grade("a", "math", 4, 3);
    const english = grade("a", "english", 2);
    const { db } = staffDb([
      math,
      english,
      { ...grade("a", "draft", 0, 20), state: "DRAFT" },
      {
        ...grade("a", "pass", 0, 20),
        subject_offerings: {
          ...math.subject_offerings,
          grading_type: "PASS_FAIL",
        },
      },
      {
        ...grade("a", "excluded", 0, 20),
        subject_offerings: { ...math.subject_offerings, include_in_gpa: false },
      },
      grade("a", "no-credit", 0, 0),
      grade("a", "ungraded", null, 20),
      {
        ...grade("a", "prior-term", 0, 20),
        subject_offerings: { ...math.subject_offerings, term_id: "term-old" },
      },
      {
        ...grade("a", "prior-room", 0, 20),
        subject_offerings: { ...math.subject_offerings, class_id: "class-b" },
      },
      grade("b", "failing", 0),
      { ...grade("c", "only-draft", 4), state: "DRAFT" },
      grade("outside-page", "outside", 0, 20),
    ]);
    const rows = await withStudentGpas(
      db,
      [
        student("a"),
        student("b", "class-b"),
        student("c"),
        { ...student("d"), enrollments: [] },
      ],
      term,
    );
    expect(rows.map((row) => row.gpa)).toEqual(["3.50", null, null, null]);
    // A published zero grade counts when the student is enrolled in its class.
    const zero = await withStudentGpas(db, [student("b")], term);
    expect(zero[0].gpa).toBe("0.00");
    expect(rows[0].student_number).toBe("00123");
  });

  it.each([
    ["course teacher", ["math"], "4.00"],
    ["homeroom teacher", ["math", "english"], "3.50"],
    ["administrator", ["math", "english", "other-room"], "3.50"],
  ])(
    "preserves the %s staff client's offering visibility",
    async (_role, visible, expected) => {
      const math = grade("a", "math", 4, 3);
      const { db } = staffDb(
        [
          math,
          grade("a", "english", 2),
          {
            ...grade("a", "other-room", 0, 20),
            subject_offerings: {
              ...math.subject_offerings,
              class_id: "class-b",
            },
          },
        ],
        new Set(visible),
      );
      const rows = await withStudentGpas(db, [student("a")], term);
      expect(rows[0].gpa).toBe(expected);
    },
  );

  it("reads every grade page and batches student IDs while preserving list order", async () => {
    const many = Array.from({ length: 1000 }, (_, index) =>
      grade("a", `course-${index}`, 4),
    );
    many.push(grade("a", "last-course", 0, 100));
    const students = [
      student("a"),
      ...Array.from({ length: 50 }, (_, index) => student(`student-${index}`)),
    ];
    const { db, reads } = staffDb(many);
    const rows = await withStudentGpas(db, students, term);
    expect(rows[0].gpa).toBe("3.64");
    expect(rows.map((row) => row.id)).toEqual(students.map((row) => row.id));
    expect(reads.map((read) => read.from)).toEqual([0, 1000, 0]);
    expect(
      reads.every((read) => read.ids.length <= 50 && read.term === term),
    ).toBe(true);
    expect(rows[50].gpa).toBeNull();
  });

  it("returns empty GPA without reading grades when no term or enrollment exists", async () => {
    const { db, from } = staffDb([]);
    expect((await withStudentGpas(db, [student("a")], null))[0].gpa).toBeNull();
    expect(
      (
        await withStudentGpas(db, [{ ...student("a"), enrollments: [] }], term)
      )[0].gpa,
    ).toBeNull();
    expect(from).not.toHaveBeenCalled();
  });
});

it.each([true, false])(
  "exports numeric GPA with two decimals and preserves text IDs (Thai=%s)",
  async (th) => {
    const students: StudentListRow[] = [
      { ...student("a"), gpa: "3.50" },
      { ...student("b"), student_number: "00009", gpa: null },
      { ...student("c"), student_number: "00010", gpa: "0.00" },
    ];
    const response = await workbookResponse(
      "students",
      studentExportRows(students, th),
      { 7: "0.00" },
    );
    const book = new ExcelJS.Workbook();
    await book.xlsx.load(await response.arrayBuffer());
    const sheet = book.getWorksheet("Records")!;
    expect(sheet.getCell("G1").value).toBe(th ? "เกรดเฉลี่ย (GPA)" : "GPA");
    expect(sheet.getCell("A2").value).toBe("00123");
    expect(sheet.getCell("A3").value).toBe("00009");
    expect(sheet.getColumn(1).numFmt).toBe("@");
    expect(sheet.getCell("G2").value).toBe(3.5);
    expect(sheet.getCell("G2").numFmt).toBe("0.00");
    expect(sheet.getCell("G3").value ?? "").toBe("");
    expect(sheet.getCell("G4").value).toBe(0);
  },
);
