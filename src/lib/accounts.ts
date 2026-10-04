import { z } from "zod";
export function loginBase(first: string, last: string) {
  const clean = (s: string) => {
    const v = s
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim()
      .toLowerCase();
    if (!/^[a-z][a-z '\-]*$/.test(v)) throw new Error("loginNameUnsupported");
    return v.replace(/[^a-z]/g, "");
  };
  const a = clean(first),
    b = clean(last);
  if (a.length > 48) throw new Error("loginNameUnsupported");
  return `${a}.${b.slice(0, 4)}`;
}
export const settingsSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    short_name: z.string().trim().min(1).max(40),
    login_domain: z
      .string()
      .trim()
      .toLowerCase()
      .max(180)
      .regex(/^[a-z0-9]([a-z0-9.-]*[a-z0-9])?\.[a-z]{2,}$/)
      .refine((s) => !s.includes("..")),
    logo_url: z.union([z.literal(""), z.url().startsWith("https://").max(500)]),
    primary_color: z.string().regex(/^#[a-fA-F0-9]{6}$/),
    secondary_color: z.string().regex(/^#[a-fA-F0-9]{6}$/),
    background_color: z
      .string()
      .regex(/^#[a-fA-F0-9]{6}$/)
      .optional(),
    background_color_dark: z
      .string()
      .regex(/^#[a-fA-F0-9]{6}$/)
      .optional(),
    default_language: z.enum(["th", "en"]),
    default_scheme_id: z.union([z.uuid(), z.literal("")]),
    support_info: z.string().trim().max(1000),
  })
  .strict();
export const profileSchema = z
  .object({
    nickname: z.string().trim().max(60),
    contact_email: z.union([z.literal(""), z.email().max(254)]),
    contact_phone: z.string().trim().max(40),
    bio: z.string().trim().max(500),
    teaching_request: z.string().trim().max(500),
    avatar: z.enum(["teacher", "book", "leaf", "star"]),
  })
  .strict();
export const teacherEditSchema = z
  .object({
    teacher: z.uuid(),
    expected_updated_at: z.iso.datetime({ offset: true }),
    payload: z
      .object({
        display_name: z.string().trim().min(1).max(120),
        official_first_name_th: z.string().trim().max(120),
        official_last_name_th: z.string().trim().max(120),
        official_first_name: z.string().trim().max(120),
        official_last_name: z.string().trim().max(120),
        nickname: z.string().trim().max(60),
        contact_email: z.union([z.literal(""), z.email().max(254)]),
        contact_phone: z.string().trim().max(40),
      })
      .strict()
      .refine(
        (v) =>
          Boolean(v.official_first_name_th) ===
          Boolean(v.official_last_name_th),
      ),
  })
  .strict();
export const registrationSchema = z
  .object({
    first_name_th: z.string().trim().min(1).max(120),
    last_name_th: z.string().trim().min(1).max(120),
    first_name: z.string().trim().min(1).max(120),
    last_name: z.string().trim().min(1).max(120),
    login_first_name: z.string().trim().max(80).optional(),
    login_last_name: z.string().trim().max(80).optional(),
    password: z.string().min(12).max(128),
    code: z.string().trim().min(20).max(100),
    confirmed: z.literal(true),
  })
  .strict();
export const feedbackSchema = z
  .object({
    type: z.enum(["PROBLEM", "SUGGESTION", "FEATURE", "OTHER"]),
    message: z.string().trim().min(1).max(3000),
    page: z
      .string()
      .max(120)
      .refine((s) => s === "" || /^\/teacher(?:\/[a-z-]+)?$/.test(s)),
    contact: z.string().trim().max(254),
  })
  .strict();
