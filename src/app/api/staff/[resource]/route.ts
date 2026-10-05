import { signedAvatar } from "@/lib/avatars";
import { isAdmin } from "@/lib/permissions";
import { z } from "zod";
import { requireStaff } from "@/lib/supabase/server";
import { body, failure, json, sameOrigin } from "@/lib/http";
import {
  bulkOfferingsRequest,
  studentGradesRequest,
  studentPublishRequest,
  importRequest,
  schemas,
  saveRequest,
  publishRequest,
} from "@/lib/validation";
import { validateImport } from "@/lib/import";
import { workbookResponse } from "@/lib/workbook";
import { studentExportRows, withStudentGpas } from "@/lib/student-gpa";
import type { StudentListRow } from "@/lib/types";
async function nameAuditActors<T extends { actor: string | null }>(
  db: Awaited<ReturnType<typeof requireStaff>>["db"],
  rows: T[],
) {
  const ids = [
    ...new Set(rows.flatMap((row) => (row.actor ? [row.actor] : []))),
  ];
  if (!ids.length) return rows.map((row) => ({ ...row, actor_name: null }));
  const profiles = await db
    .from("profiles")
    .select("id,display_name")
    .in("id", ids);
  if (profiles.error) throw profiles.error;
  const names = new Map(
    profiles.data.map((teacher) => [teacher.id, teacher.display_name]),
  );
  return rows.map((row) => ({
    ...row,
    actor_name: row.actor ? names.get(row.actor) || null : null,
  }));
}
export async function GET(
  request: Request,
  { params }: { params: Promise<{ resource: string }> },
) {
  try {
    const { db, profile } = await requireStaff();
    const { resource } = await params;
    const q = new URL(request.url).searchParams;
    const th = q.get("locale") !== "en";
    if (resource === "assignments") {
      if (!isAdmin(profile.role)) throw new Error("FORBIDDEN");
      const [teachers, assignments, homerooms] = await Promise.all([
        db
          .from("profiles")
          .select(
            "id,display_name,role,active,teaching_request,school_username",
          )
          .eq("active", true)
          .in("role", ["ADMIN", "DEVELOPER", "TEACHER"])
          .order("display_name"),
        db.from("teacher_assignments").select("*"),
        db.from("homeroom_assignments").select("*"),
      ]);
      if (teachers.error) throw teachers.error;
      if (assignments.error) throw assignments.error;
      if (homerooms.error) throw homerooms.error;
      if (teachers.data.length >= 1000 || assignments.data.length >= 1000)
        throw new Error("Reference data limit reached");
      return json({
        teachers: teachers.data,
        assignments: assignments.data,
        homerooms: homerooms.data,
      });
    }
    if (resource === "meta") {
      const results = await Promise.all([
        db
          .from("academic_terms")
          .select("*")
          .order("academic_year", { ascending: false })
          .order("name"),
        db.from("classes").select("*").order("name"),
        db.from("subjects").select("*").order("code"),
        db
          .from("grade_schemes")
          .select("*,grade_scheme_rules(minimum,points)")
          .order("name"),
        db
          .from("subject_offerings")
          .select("*")
          .order("created_at", { ascending: false }),
      ]);
      for (const r of results) if (r.error) throw r.error;
      if (results.some((r) => r.data!.length >= 1000))
        throw new Error("Reference data limit reached");
      const homerooms = await db.from("homeroom_assignments").select("*");
      if (homerooms.error) throw homerooms.error;
      const assignments = await db
        .from("teacher_assignments")
        .select("offering_id")
        .eq("teacher_id", profile.id);
      if (assignments.error) throw assignments.error;
      const teachingIds = new Set(assignments.data.map((a) => a.offering_id));
      const teachers = isAdmin(profile.role)
        ? await db.from("profiles").select("id,display_name").eq("active", true)
        : {
            data: [{ id: profile.id, display_name: profile.display_name }],
            error: null,
          };
      if (teachers.error) throw teachers.error;
      return json({
        profile: {
          ...profile,
          avatar_url: await signedAvatar(profile.avatar_path),
        },
        homerooms: homerooms.data,
        teachers: teachers.data,
        teaching_offering_ids: [...teachingIds],
        terms: results[0].data,
        classes: results[1].data,
        subjects: results[2].data,
        schemes: results[3].data,
        offerings: results[4].data!.map((offering) => ({
          ...offering,
          can_edit: isAdmin(profile.role) || teachingIds.has(offering.id),
        })),
      });
    }
    if (resource === "work") {
      const term = z.uuid().parse(q.get("term"));
      const result = await db.rpc("teacher_work", { term });
      if (result.error) throw result.error;
      return json({ rows: result.data });
    }

    if (resource === "dashboard") {
      const results = await Promise.all([
        db
          .from("students")
          .select("*", { count: "exact", head: true })
          .eq("active", true),
        db
          .from("classes")
          .select("*", { count: "exact", head: true })
          .eq("active", true),
        db
          .from("subjects")
          .select("*", { count: "exact", head: true })
          .eq("active", true),
        db
          .from("student_grades")
          .select("*", { count: "exact", head: true })
          .eq("state", "PUBLISHED"),
        db
          .from("student_grades")
          .select("*", { count: "exact", head: true })
          .eq("state", "DRAFT"),
      ]);
      for (const r of results) if (r.error) throw r.error;
      return json({ counts: results.map((r) => r.count ?? 0) });
    }
    if (resource === "students" || resource === "students-export") {
      const page = Math.max(0, Math.min(10000, Number(q.get("page")) || 0));
      const filters = Object.fromEntries(q);
      let term: string | null = q.get("term") || q.get("group_term");
      if (term) term = z.uuid().parse(term);
      else {
        const latest = await db
          .from("academic_terms")
          .select("id")
          .order("active", { ascending: false })
          .order("academic_year", { ascending: false })
          .order("name", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (latest.error) throw latest.error;
        term = latest.data?.id ?? null;
      }
      const read = async (skip: number, take: number) => {
        const result = await db.rpc("list_students", {
          filters: { ...filters, skip, take },
        });
        if (result.error) throw result.error;
        const students = result.data as {
          rows: Omit<StudentListRow, "gpa">[];
          total: number;
        };
        return {
          ...students,
          rows: await withStudentGpas(db, students.rows, term),
        };
      };
      if (resource === "students-export") {
        const all = [];
        for (let offset = 0; offset < 50000; offset += 1000) {
          const result = await read(offset, 1000);
          all.push(...result.rows);
          if (result.rows.length < 1000) break;
        }
        return workbookResponse("students", studentExportRows(all, th), {
          7: "0.00",
        });
      }
      return json(await read(page * 50, 50));
    }
    if (resource === "student-profile") {
      const id = z.uuid().parse(q.get("student"));
      const term = z.uuid().parse(q.get("term"));
      const student = await db
        .from("students")
        .select("*,enrollments(id,class_id,term_id,roll_number)")
        .eq("id", id)
        .maybeSingle();
      if (student.error) throw student.error;
      if (!student.data) return json({ error: "notFound" }, 404);
      const enrollment = student.data.enrollments.find(
        (e) => e.term_id === term,
      );
      const offerings = enrollment
        ? await db
            .from("subject_offerings")
            .select("*")
            .eq("term_id", term)
            .eq("class_id", enrollment.class_id)
        : { data: [], error: null };
      if (offerings.error) throw offerings.error;
      const ids = offerings.data.map((o) => o.id);
      const grades = ids.length
        ? await db
            .from("student_grades")
            .select("*")
            .eq("student_id", id)
            .in("offering_id", ids)
        : { data: [], error: null };
      if (grades.error) throw grades.error;
      const neighbors = await db.rpc("student_neighbors", {
        learner: id,
        term,
      });
      if (neighbors.error) throw neighbors.error;
      const assignments = await db
        .from("teacher_assignments")
        .select("offering_id")
        .eq("teacher_id", profile.id);
      if (assignments.error) throw assignments.error;
      const teachingIds = new Set(assignments.data.map((a) => a.offering_id));
      const homeroomTeachers = enrollment
        ? await db.rpc("class_homeroom_teachers", {
            term,
            classroom: enrollment.class_id,
          })
        : { data: [], error: null };
      if (homeroomTeachers.error) throw homeroomTeachers.error;
      let activity: Record<string, unknown>[] = [];
      if (isAdmin(profile.role)) {
        const recent = await db
          .from("audit_logs")
          .select("id,actor,action,entity,created_at,before_data,after_data")
          .or(
            `entity_id.eq.${id},after_data->>student_id.eq.${id},before_data->>student_id.eq.${id},after_data->>student.eq.${id}`,
          )
          .order("id", { ascending: false })
          .limit(20);
        if (recent.error) throw recent.error;
        const named = await nameAuditActors(db, recent.data);
        activity = named.map(({ before_data, after_data, ...log }) => {
          const before = before_data as Record<string, unknown> | null;
          const after = after_data as Record<string, unknown> | null;
          const action =
            log.entity !== "student_grades"
              ? log.action
              : before?.state !== "PUBLISHED" && after?.state === "PUBLISHED"
                ? "PUBLISH"
                : before?.state === "PUBLISHED" && after?.state === "DRAFT"
                  ? "UNPUBLISH"
                  : log.action;
          return { ...log, action };
        });
      }
      return json({
        neighbors: neighbors.data,
        student: student.data,
        offerings: offerings.data.map((offering) => ({
          ...offering,
          can_edit: isAdmin(profile.role) || teachingIds.has(offering.id),
        })),
        grades: grades.data,
        homeroom_teachers: homeroomTeachers.data,
        activity,
      });
    }
    if (resource === "gradebook" || resource === "gradebook-export") {
      const offering = z.uuid().parse(q.get("offering"));
      const { data: o, error: oe } = await db
        .from("subject_offerings")
        .select("*")
        .eq("id", offering)
        .single();
      if (oe?.code === "PGRST116") return json({ error: "notFound" }, 404);
      if (oe) throw oe;
      const results = await Promise.all([
        db
          .from("enrollments")
          .select("*,students(*)", { count: "exact" })
          .eq("class_id", o.class_id)
          .eq("term_id", o.term_id),
        db.from("student_grades").select("*").eq("offering_id", offering),
      ]);
      for (const r of results) if (r.error) throw r.error;
      if ((results[0].count ?? 0) > 1000)
        throw new Error("Class exceeds supported size");
      const enrollments = results[0].data!.sort(
        (a, b) =>
          (a.roll_number ?? 1001) - (b.roll_number ?? 1001) ||
          a.students.student_number.localeCompare(b.students.student_number),
      );
      if (resource === "gradebook-export") {
        const { data: sub } = await db
          .from("subjects")
          .select("code")
          .eq("id", o.subject_id)
          .single();
        const { data: term } = await db
          .from("academic_terms")
          .select("academic_year,name")
          .eq("id", o.term_id)
          .single();
        const cls = await db
          .from("classes")
          .select("name")
          .eq("id", o.class_id)
          .single();
        if (cls.error) throw cls.error;
        return workbookResponse(
          `gradebook-${sub?.code}-${term?.academic_year}-${term?.name}`,
          [
            th
              ? [
                  "รหัสนักเรียน",
                  "เลขที่",
                  "ชื่อ",
                  "นามสกุล",
                  "ห้องเรียน",
                  "คะแนน",
                  "เกรด",
                  "ผ่าน/ไม่ผ่าน",
                  "สถานะ",
                ]
              : [
                  "Student ID",
                  "No.",
                  "First Name",
                  "Last Name",
                  "Class",
                  "Score",
                  "Grade",
                  "Pass/Fail",
                  "State",
                ],
            ...enrollments.map((e) => {
              const g = results[1].data!.find(
                (g) => g.student_id === e.student_id,
              );
              return [
                e.students.student_number,
                e.roll_number ?? "",
                e.students.first_name,
                e.students.last_name,
                cls.data.name,
                g?.score ?? "",
                g?.grade_points ?? "",
                th && g?.result
                  ? g.result === "PASS"
                    ? "ผ่าน"
                    : "ไม่ผ่าน"
                  : (g?.result ?? ""),
                th && g?.state
                  ? g.state === "PUBLISHED"
                    ? "ประกาศแล้ว"
                    : "ฉบับร่าง"
                  : (g?.state ?? ""),
              ];
            }),
          ],
        );
      }
      const writable = await db.rpc("can_edit_offering", { target: offering });
      if (writable.error) throw writable.error;
      return json({
        enrollments,
        grades: results[1].data,
        can_edit: writable.data,
      });
    }
    if (resource === "template")
      return workbookResponse("student-import-template", [
        th
          ? ["รหัสนักเรียน", "ชื่อ", "นามสกุล", "ห้อง", "เลขที่"]
          : ["Student ID", "First Name", "Last Name", "Class", "No."],
        ["00123", "Example", "Student", "M.1/1", 1],
      ]);
    if (resource === "audit") {
      if (!isAdmin(profile.role)) throw new Error("FORBIDDEN");
      const page = Math.max(0, Math.min(10000, Number(q.get("page")) || 0));
      const { data, error, count } = await db
        .from("audit_logs")
        .select("*", { count: "exact" })
        .order("id", { ascending: false })
        .range(page * 50, page * 50 + 49);
      if (error) throw error;
      return json({
        rows: await nameAuditActors(db, data || []),
        total: count,
      });
    }
    return json({ error: "notFound" }, 404);
  } catch (e) {
    return failure(e);
  }
}
export async function POST(
  request: Request,
  { params }: { params: Promise<{ resource: string }> },
) {
  try {
    sameOrigin(request);
    const { db, profile } = await requireStaff();
    const { resource } = await params;
    const input = await body(request);
    if (resource === "homerooms") {
      const value = z
        .object({
          teacher: z.uuid(),
          term: z.uuid(),
          classroom: z.uuid(),
          assigned: z.boolean(),
        })
        .parse(input);
      const result = await db.rpc("assign_homeroom", value);
      if (result.error) throw result.error;
      return json({ ok: true });
    }
    if (resource === "reset-course-grades") {
      const value = z
        .object({
          offering: z.uuid(),
          learner: z.uuid().nullable().default(null),
          expected_version: z.number().int().min(1).nullable().default(null),
          expected_rows: z
            .array(
              z.object({
                student_id: z.uuid(),
                version: z.number().int().min(1),
              }),
            )
            .max(1000)
            .optional(),
          confirmation: z.literal("RESET"),
        })
        .parse(input);
      const result = await db.rpc("clear_course_grades", {
        offering: value.offering,
        confirmation: value.confirmation,
        ...(value.learner ? { learner: value.learner } : {}),
        ...(value.expected_version
          ? { expected_version: value.expected_version }
          : {}),
        ...(value.expected_rows ? { expected_rows: value.expected_rows } : {}),
      });
      if (result.error) throw result.error;
      return json({ count: result.data });
    }
    if (resource === "offerings-compose") {
      if (!isAdmin(profile.role)) throw new Error("FORBIDDEN");
      const v = z
        .object({
          payload: z
            .object({
              ...schemas.offerings.shape,
              id: z.never().optional(),
              class_id: z.never().optional(),
              subject_id: z.uuid().optional(),
            })
            .refine((v) =>
              v.grading_type === "NUMERIC_GRADE"
                ? !!v.scheme_id
                : !v.include_in_gpa,
            ),
          class_ids: z.array(z.uuid()).min(1).max(100),
          subject: schemas.subjects.omit({ id: true }).nullable(),
        })
        .parse(input);
      if (!v.subject && !v.payload.subject_id) throw new Error("INVALID");
      const result = await db.rpc("create_course", {
        payload: v.payload,
        class_ids: v.class_ids,
        subject: v.subject,
      });
      if (result.error) throw result.error;
      return json({ count: result.data });
    }
    if (resource === "assignments") {
      if (!isAdmin(profile.role)) throw new Error("FORBIDDEN");
      const value = z
        .object({
          teacher: z.uuid(),
          offering: z.uuid(),
          assigned: z.boolean(),
        })
        .parse(input);
      const result = await db.rpc("assign_teacher", value);
      if (result.error) throw result.error;
      return json({ ok: true });
    }
    if (
      [
        "import",
        "import-validate",
        "delete-record",
        "archive-record",
        "restore-record",
        "offerings-bulk",
        ...Object.keys(schemas).filter((key) => key !== "students"),
      ].includes(resource) &&
      !isAdmin(profile.role)
    )
      throw new Error("FORBIDDEN");
    if (resource === "students-query" || resource === "students-download") {
      const filters = z
        .object({
          locale: z.enum(["th", "en"]).optional(),
          group_term: z.union([z.uuid(), z.literal("")]).optional(),
          term: z.union([z.uuid(), z.literal("")]).optional(),
          class: z.union([z.uuid(), z.literal("")]).optional(),
          search: z.string().max(100).optional(),
          status: z.string().optional(),
          sort: z.string().optional(),
          direction: z.string().optional(),
          page: z.number().int().min(0).max(10000).optional(),
        })
        .parse(input);
      const url = new URL(request.url);
      url.search = "";
      for (const [k, v] of Object.entries(filters))
        if (v !== undefined && v !== "") url.searchParams.set(k, String(v));
      return GET(new Request(url), {
        params: Promise.resolve({
          resource:
            resource === "students-query" ? "students" : "students-export",
        }),
      });
    }
    if (resource === "archive-record") {
      const v = z
        .object({
          kind: z.enum([
            "students",
            "terms",
            "classes",
            "subjects",
            "offerings",
            "schemes",
          ]),
          id: z.uuid(),
        })
        .parse(input);
      const result = await db.rpc("archive_record", {
        kind: v.kind,
        record_id: v.id,
      });
      if (result.error) throw result.error;
      return json({ ok: true });
    }
    if (resource === "restore-record") {
      const value = z
        .object({
          kind: z.enum([
            "offerings",
            "schemes",
            "subjects",
            "classes",
            "terms",
          ]),
          id: z.uuid(),
        })
        .parse(input);
      const result = await db.rpc("restore_record", {
        kind: value.kind,
        record_id: value.id,
      });
      if (result.error) throw result.error;
      return json({ ok: true });
    }
    if (resource === "delete-record") {
      const value = z
        .object({
          kind: z.enum([
            "students",
            "terms",
            "classes",
            "subjects",
            "offerings",
            "schemes",
          ]),
          id: z.uuid(),
          confirmation: z.literal("DELETE"),
        })
        .parse(input);
      const result = await db.rpc("purge_record", {
        kind: value.kind,
        record_id: value.id,
        confirmation: value.confirmation,
      });
      if (result.error) throw result.error;
      return json({ ok: true, result: "deleted" });
    }
    if (resource === "offerings-bulk") {
      const value = bulkOfferingsRequest.parse(input);
      const result = await db.rpc("create_offerings", value);
      if (result.error) throw result.error;
      return json({ count: result.data });
    }
    if (
      resource === "save-student-grades" ||
      resource === "publish-student-grades"
    ) {
      const value =
        resource === "save-student-grades"
          ? studentGradesRequest.parse(input)
          : studentPublishRequest.parse(input);
      const result = await db.rpc("write_student_grades", {
        learner: value.student_id,
        term: value.term_id,
        rows: value.rows,
        ...("publish" in value ? { publish: value.publish } : {}),
      });
      if (result.error) throw result.error;
      return json({ count: result.data });
    }
    if (Object.hasOwn(schemas, resource)) {
      const value = schemas[resource as keyof typeof schemas].parse(input);
      const { data, error } = await db.rpc("manage_record", {
        kind: resource,
        payload: value,
      });
      if (error) throw error;
      return json({ id: data });
    }
    if (resource === "import-validate" || resource === "import") {
      const value = importRequest.parse(input);
      const existing: string[] = [];
      for (let i = 0; i < value.rows.length; i += 100) {
        const r = await db
          .from("students")
          .select("student_number")
          .in(
            "student_number",
            value.rows.slice(i, i + 100).map((r) => r.student_number),
          );
        if (r.error) throw r.error;
        existing.push(...r.data.map((s) => s.student_number));
      }
      const classes = await db
        .from("classes")
        .select("name")
        .eq("active", true);
      if (classes.error) throw classes.error;
      const checks = validateImport(
        value.rows,
        new Set(existing),
        new Set(classes.data.map((c) => c.name)),
      );
      if (resource === "import-validate") return json({ checks });
      if (checks.some((r) => r.errors.length))
        return json({ error: "invalid", checks }, 400);
      const { data, error } = await db.rpc("import_students", {
        rows: value.rows,
        term: value.term_id,
      });
      if (error) throw error;
      return json({ count: data });
    }
    if (resource === "save-grades") {
      const value = saveRequest.parse(input);
      const { data, error } = await db.rpc("save_grades", {
        offering: value.offering_id,
        rows: value.rows,
      });
      if (error) throw error;
      return json({ count: data });
    }
    if (resource === "publish-grades") {
      const value = publishRequest.parse(input);
      const { data, error } = await db.rpc("publish_grades", {
        offering: value.offering_id,
        rows: value.rows,
        publish: value.publish,
      });
      if (error) throw error;
      return json({ count: data });
    }
    return json({ error: "notFound" }, 404);
  } catch (e) {
    return failure(e);
  }
}
