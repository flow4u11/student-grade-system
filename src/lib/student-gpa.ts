import "server-only";
import type {
  PostgrestSingleResponse,
  SupabaseClient,
} from "@supabase/supabase-js";
import type { Database } from "./database.types";
import { gpa } from "./grading";
import type { StudentListRow } from "./types";

type ListStudent = Omit<StudentListRow, "gpa">;
type GpaGrade = Parameters<typeof gpa>[0][number];
type JoinedGrade = Pick<
  Database["public"]["Tables"]["student_grades"]["Row"],
  "student_id" | "grade_points" | "state"
> & {
  subject_offerings: Pick<
    Database["public"]["Tables"]["subject_offerings"]["Row"],
    "term_id" | "class_id" | "credits" | "include_in_gpa" | "grading_type"
  >;
};

export async function withStudentGpas(
  db: SupabaseClient<Database>,
  students: ListStudent[],
  term: string | null,
): Promise<StudentListRow[]> {
  const grades = new Map<string, GpaGrade[]>();
  const classes = new Map(
    students.map((student) => [
      student.id,
      student.enrollments.find((enrollment) => enrollment.term_id === term)
        ?.class_id,
    ]),
  );
  const enrolled = students.filter((student) => classes.get(student.id));
  if (term) {
    // Use the signed-in staff client: offering and grade RLS match the profile.
    // Bound both the ID filters and grade pages, including large Excel exports.
    for (let start = 0; start < enrolled.length; start += 50) {
      const batch = enrolled.slice(start, start + 50);
      const classIds = [
        ...new Set(batch.map((student) => classes.get(student.id)!)),
      ];
      for (let offset = 0; ; offset += 1000) {
        const result: PostgrestSingleResponse<JoinedGrade[]> = await db
          .from("student_grades")
          .select(
            "student_id,grade_points,state,subject_offerings!inner(term_id,class_id,credits,include_in_gpa,grading_type)",
          )
          .eq("state", "PUBLISHED")
          .eq("subject_offerings.term_id", term)
          .in(
            "student_id",
            batch.map((student) => student.id),
          )
          .in("subject_offerings.class_id", classIds)
          .order("id")
          .range(offset, offset + 999);
        if (result.error) throw result.error;
        result.data.forEach((grade: JoinedGrade) => {
          const offering = grade.subject_offerings;
          // Students can have historical grades after changing classrooms.
          if (
            offering.term_id !== term ||
            offering.class_id !== classes.get(grade.student_id)
          )
            return;
          const rows = grades.get(grade.student_id) ?? [];
          rows.push({ ...offering, ...grade });
          grades.set(grade.student_id, rows);
        });
        if (result.data.length < 1000) break;
      }
    }
  }
  return students.map((student) => ({
    ...student,
    gpa: gpa(grades.get(student.id) ?? []),
  }));
}

export function studentExportRows(students: StudentListRow[], th: boolean) {
  return [
    th
      ? [
          "รหัสนักเรียน",
          "เลขที่",
          "ชื่อ",
          "นามสกุล",
          "ห้องเรียน",
          "สถานะ",
          "เกรดเฉลี่ย (GPA)",
        ]
      : [
          "Student ID",
          "No.",
          "First Name",
          "Last Name",
          "Class",
          "Status",
          "GPA",
        ],
    ...students.map((student) => [
      student.student_number,
      student.roll_number ?? "",
      student.first_name,
      student.last_name,
      student.class_name ?? "",
      th
        ? student.active
          ? "ใช้งาน"
          : "ปิดการใช้งาน"
        : student.active
          ? "Active"
          : "Inactive",
      student.gpa === null ? "" : Number(student.gpa),
    ]),
  ];
}
