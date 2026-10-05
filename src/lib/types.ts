export type RecordData = { id: string; [key: string]: unknown };
export type Term = {
  archived: boolean;
  id: string;
  academic_year: number;
  name: string;
  active: boolean;
};
export type SchoolClass = {
  archived: boolean;
  id: string;
  name: string;
  active: boolean;
};
export type Student = {
  id: string;
  student_number: string;
  first_name: string;
  last_name: string;
  active: boolean;
};
export type StudentListRow = Student & {
  roll_number: number | null;
  class_name: string | null;
  enrollments: { class_id: string; term_id: string }[];
  gpa: string | null;
};
export type Subject = {
  archived: boolean;
  default_credits: number | null;
  id: string;
  code: string;
  name_th: string;
  name_en: string;
  active: boolean;
};
export type Rule = { minimum: number; points: number };
export type Scheme = {
  archived: boolean;
  id: string;
  name: string;
  grade_scheme_rules: Rule[];
};
export type Offering = {
  can_edit?: boolean;
  archived: boolean;
  id: string;
  subject_id: string;
  term_id: string;
  class_id: string;
  grading_type: "NUMERIC_GRADE" | "PASS_FAIL";
  max_score: number;
  credits: number;
  scheme_id: string | null;
  include_in_gpa: boolean;
  pass_mode: "AUTOMATIC" | "MANUAL";
  pass_threshold: number;
};
export type Grade = {
  id: string;
  student_id: string;
  offering_id: string;
  score: number | null;
  grade_points: number | null;
  result: "PASS" | "FAIL" | null;
  state: "DRAFT" | "PUBLISHED";
  version: number;
};
export type Enrollment = {
  roll_number: number | null;
  id: string;
  student_id: string;
  class_id: string;
  term_id: string;
  students: Student;
};
export type Meta = {
  teaching_offering_ids?: string[];
  teachers?: { id: string; display_name: string }[];
  homerooms: { teacher_id: string; term_id: string; class_id: string }[];
  terms: Term[];
  classes: SchoolClass[];
  subjects: Subject[];
  schemes: Scheme[];
  offerings: Offering[];
  profile: {
    avatar_url?: string | null;
    id: string;
    display_name: string;
    role: string;
  };
};
export type PortalGrade = {
  term_id: string;
  code: string;
  name_th: string;
  name_en: string;
  score: number | null;
  max_score: number;
  grade_points: number | null;
  result: "PASS" | "FAIL" | null;
  credits: number;
  include_in_gpa: boolean;
  grading_type: string;
  state: string;
};
export type Portal = {
  student: Pick<Student, "student_number" | "first_name" | "last_name">;
  enrollments: (Omit<Term, "id" | "archived"> & {
    term_id: string;
    class_name: string;
  })[];
  grades: PortalGrade[];
};
