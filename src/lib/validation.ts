import { z } from "zod";
import { validateRules } from "./grading";
const id = z.uuid();
const name = z.string().trim().min(1).max(120);
const shortName = z.string().trim().min(1).max(100);
const decimal = z.coerce
  .number()
  .finite()
  .nonnegative()
  .refine(
    (v) => Math.abs(v * 100 - Math.round(v * 100)) < 0.000001,
    "Use at most 2 decimal places",
  );
export const studentNumber = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9_-]{1,40}$/);
export const schemas = {
  terms: z.object({
    id: id.optional(),
    academic_year: z.coerce.number().int().min(2000).max(3000),
    name: shortName,
    active: z.boolean(),
  }),
  classes: z.object({
    id: id.optional(),
    name: z.string().trim().min(1).max(60),
    active: z.boolean(),
  }),
  students: z.object({
    id: id.optional(),
    student_number: studentNumber,
    roll_number: z
      .union([z.coerce.number().int().min(1).max(1000), z.null()])
      .optional(),
    first_name: name,
    last_name: name,
    active: z.boolean(),
    term_id: id,
    class_id: id,
    reset_on_move: z.boolean().optional(),
    pin: z
      .string()
      .regex(/^\d{6,12}$/)
      .optional(),
  }),
  subjects: z.object({
    id: id.optional(),
    code: z.string().trim().min(1).max(40),
    name_th: z.string().trim().min(1).max(150),
    name_en: z.string().trim().min(1).max(150),
    default_credits: z
      .union([z.null(), decimal.refine((v) => v <= 100)])
      .optional(),
    active: z.boolean(),
  }),
  offerings: z
    .object({
      id: id.optional(),
      subject_id: id,
      term_id: id,
      class_id: id,
      grading_type: z.enum(["NUMERIC_GRADE", "PASS_FAIL"]),
      max_score: decimal.refine((v) => v > 0 && v <= 100000),
      credits: decimal.refine((v) => v <= 100),
      scheme_id: z.union([id, z.literal("")]),
      include_in_gpa: z.boolean(),
      pass_mode: z.enum(["AUTOMATIC", "MANUAL"]),
      pass_threshold: decimal.refine((v) => v <= 100),
    })
    .refine((v) =>
      v.grading_type === "NUMERIC_GRADE" ? !!v.scheme_id : !v.include_in_gpa,
    ),
  schemes: z.object({
    id: id.optional(),
    name: shortName,
    rules: z
      .array(z.object({ minimum: z.number(), points: z.number() }))
      .refine(validateRules),
  }),
};
export const importRow = z.object({
  student_number: studentNumber,
  first_name: name,
  last_name: name,
  class_name: z.string().trim().min(1).max(60),
  roll_number: z.number().int().min(1).max(1000).optional(),
});
export const importRequest = z.object({
  term_id: id,
  rows: z.array(importRow).min(1).max(1000),
});
export const saveRequest = z.object({
  offering_id: id,
  rows: z
    .array(
      z.object({
        student_id: id,
        version: z.number().int().nonnegative(),
        score: z.union([z.string().regex(/^\d+(\.\d{1,2})?$/), z.null()]),
        result: z.enum(["PASS", "FAIL"]).nullable(),
      }),
    )
    .min(1)
    .max(1000),
});
export const publishRequest = z.object({
  offering_id: id,
  rows: z
    .array(z.object({ student_id: id, version: z.number().int().positive() }))
    .min(1)
    .max(1000),
  publish: z.boolean(),
});

export const portalSchema = z.object({
  student: z.object({
    student_number: z.string(),
    first_name: z.string(),
    last_name: z.string(),
  }),
  enrollments: z.array(
    z.object({
      term_id: z.uuid(),
      academic_year: z.number(),
      name: z.string(),
      active: z.boolean(),
      class_name: z.string(),
    }),
  ),
  grades: z.array(
    z.object({
      term_id: z.uuid(),
      code: z.string(),
      name_th: z.string(),
      name_en: z.string(),
      score: z.number().nullable(),
      max_score: z.number(),
      grade_points: z.number().nullable(),
      result: z.enum(["PASS", "FAIL"]).nullable(),
      credits: z.number(),
      include_in_gpa: z.boolean(),
      grading_type: z.string(),
      state: z.string(),
    }),
  ),
});

export const bulkOfferingsRequest = z.object({
  payload: z
    .object({
      ...schemas.offerings.shape,
      id: z.never().optional(),
      class_id: z.never().optional(),
    })
    .refine((v) =>
      v.grading_type === "NUMERIC_GRADE" ? !!v.scheme_id : !v.include_in_gpa,
    ),
  class_ids: z
    .array(z.uuid())
    .min(1)
    .max(1000)
    .refine((v) => new Set(v).size === v.length),
});
export const studentGradesRequest = z.object({
  student_id: z.uuid(),
  term_id: z.uuid(),
  rows: z
    .array(
      saveRequest.shape.rows.element
        .omit({ student_id: true })
        .extend({ offering_id: z.uuid() }),
    )
    .min(1)
    .max(1000),
});
export const studentPublishRequest = z.object({
  student_id: z.uuid(),
  term_id: z.uuid(),
  publish: z.boolean(),
  rows: z
    .array(
      z.object({ offering_id: z.uuid(), version: z.number().int().positive() }),
    )
    .min(1)
    .max(1000),
});
