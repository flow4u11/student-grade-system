import { signedAvatar } from "@/lib/avatars";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { serviceClient } from "@/lib/supabase/server";
import { bucket, requestIp } from "@/lib/http";
import { requireStaff } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/permissions";
import { body, failure, hash, json, sameOrigin } from "@/lib/http";
import {
  settingsSchema,
  profileSchema,
  feedbackSchema,
  teacherEditSchema,
} from "@/lib/accounts";
type Context = { params: Promise<{ action: string }> };
export async function GET(request: Request, { params }: Context) {
  try {
    const { db, profile } = await requireStaff();
    const { action } = await params;
    if (action === "profile") {
      const r = await db
        .from("profiles")
        .select("*")
        .eq("id", profile.id)
        .single();
      if (r.error) throw r.error;
      return json({
        ...r.data,
        avatar_url: await signedAvatar(r.data.avatar_path),
      });
    }
    if (action === "teachers") {
      if (!isAdmin(profile.role)) throw new Error("FORBIDDEN");
      const r = await db
        .from("profiles")
        .select(
          "id,display_name,school_username,active,role,official_first_name_th,official_last_name_th,official_first_name,official_last_name,nickname,contact_email,contact_phone,updated_at",
        )
        .order("display_name");
      if (r.error) throw r.error;
      return json({ rows: r.data });
    }
    if (action === "settings") {
      if (!isAdmin(profile.role)) throw new Error("FORBIDDEN");
      const [s, i] = await Promise.all([
        db.from("school_settings").select("*").single(),
        db.rpc("teacher_invite_status"),
      ]);
      if (s.error) throw s.error;
      if (i.error) throw i.error;
      return json({ settings: s.data, invite: i.data });
    }
    if (action === "feedback") {
      const page = z.coerce
        .number()
        .int()
        .min(0)
        .max(10000)
        .parse(new URL(request.url).searchParams.get("page") || 0);
      const r = await db
        .from("feedback")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(page * 25, page * 25 + 24);
      if (r.error) throw r.error;
      return json({ rows: r.data, total: r.count });
    }
    return json({ error: "notFound" }, 404);
  } catch (e) {
    return failure(e);
  }
}
export async function POST(request: Request, { params }: Context) {
  try {
    sameOrigin(request);
    const { db, profile } = await requireStaff();
    const { action } = await params;
    const input = await body(request);
    if (action === "edit-teacher") {
      if (!isAdmin(profile.role)) throw new Error("FORBIDDEN");
      const v = teacherEditSchema.parse(input);
      const result = await db.rpc("admin_update_teacher", v);
      if (result.error) throw result.error;
      return json({ ok: true });
    }
    if (action === "delete-teacher") {
      if (!isAdmin(profile.role)) throw new Error("FORBIDDEN");
      const v = z
        .object({ teacher: z.uuid(), confirmation: z.literal("DELETE") })
        .parse(input);
      const prepared = await db.rpc("prepare_teacher_delete", v);
      if (prepared.error) throw prepared.error;
      const service = serviceClient();
      const removedPhoto = await service.storage
        .from("teacher-avatars")
        .remove([`${v.teacher}/avatar.jpg`]);
      if (removedPhoto.error) throw removedPhoto.error;
      const removed = await service.auth.admin.deleteUser(v.teacher, false);
      if (removed.error) throw removed.error;
      return json({ ok: true });
    }
    if (action === "reset-authorize") {
      if (!isAdmin(profile.role)) throw new Error("FORBIDDEN");
      const value = z
        .object({ term: z.uuid(), password: z.string().min(1).max(128) })
        .parse(input);
      const service = serviceClient();
      const limit = await service.rpc("consume_limit", {
        bucket_key: bucket("reset:" + profile.id + ":" + requestIp(request)),
        max_attempts: 5,
      });
      if (limit.error || !limit.data) return json({ error: "tryLater" }, 429);
      const current = await db.auth.getUser();
      if (!current.data.user?.email) throw new Error("FORBIDDEN");
      const check = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
        { auth: { persistSession: false, autoRefreshToken: false } },
      );
      const login = await check.auth.signInWithPassword({
        email: current.data.user.email,
        password: value.password,
      });
      if (login.error || login.data.user?.id !== profile.id)
        return json({ error: "loginFailed" }, 401);
      await check.auth.signOut({ scope: "local" });
      const proof = randomBytes(32).toString("base64url");
      const result = await service.rpc("authorize_grade_reset", {
        actor: profile.id,
        term: value.term,
        proof_hash: hash(proof),
      });
      if (result.error) throw result.error;
      return json({ proof, preview: result.data });
    }
    if (action === "reset-grades") {
      if (!isAdmin(profile.role)) throw new Error("FORBIDDEN");
      const value = z
        .object({
          term: z.uuid(),
          proof: z.string().min(40).max(100),
          phrase: z.literal("RESET GRADES"),
          confirmed: z.literal(true),
        })
        .parse(input);
      const result = await db.rpc("reset_term_grades", {
        term: value.term,
        proof_hash: hash(value.proof),
        phrase: value.phrase,
      });
      if (result.error) throw result.error;
      return json({ count: result.data });
    }
    if (
      ["settings", "invite", "close-registration", "review-feedback"].includes(
        action,
      ) &&
      !isAdmin(profile.role)
    )
      throw new Error("FORBIDDEN");
    if (
      action === "profile" ||
      action === "settings" ||
      action === "feedback"
    ) {
      const value = (
        action === "profile"
          ? profileSchema
          : action === "settings"
            ? settingsSchema
            : feedbackSchema
      ).parse(input);
      const r = await db.rpc(
        action === "profile"
          ? "update_teacher_profile"
          : action === "settings"
            ? "update_school_settings"
            : "submit_feedback",
        { payload: value },
      );
      if (r.error) throw r.error;
      return json({ ok: true });
    }
    if (action === "invite") {
      const v = z
        .object({
          days: z.number().int().min(1).max(30),
          max_uses: z.number().int().min(1).max(100),
        })
        .parse(input);
      const code = randomBytes(24).toString("base64url");
      const r = await db.rpc("issue_teacher_invite", {
        ...v,
        code_hash: hash(code),
      });
      if (r.error) throw r.error;
      return json({ code });
    }
    if (action === "close-registration") {
      const r = await db.rpc("close_teacher_registration");
      if (r.error) throw r.error;
      return json({ ok: true });
    }
    if (action === "review-feedback") {
      const v = z
        .object({
          feedback_id: z.uuid(),
          new_status: z.enum(["NEW", "READ", "DONE"]),
        })
        .parse(input);
      const r = await db.rpc("review_feedback", v);
      if (r.error) throw r.error;
      return json({ ok: true });
    }
    return json({ error: "notFound" }, 404);
  } catch (e) {
    return failure(e);
  }
}
