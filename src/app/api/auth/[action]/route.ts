import { isStaff } from "@/lib/permissions";
import { secureCookies, studentPortalEnabled } from "@/lib/config";
import { cookies } from "next/headers";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { staffClient, serviceClient } from "@/lib/supabase/server";
import {
  body,
  bucket,
  failure,
  hash,
  json,
  requestIp,
  sameOrigin,
} from "@/lib/http";
const input = z.object({
  kind: z.enum(["teacher", "student"]),
  identifier: z.string().trim().min(1).max(254),
  password: z.string().min(1).max(128),
});
export async function POST(
  request: Request,
  { params }: { params: Promise<{ action: string }> },
) {
  try {
    sameOrigin(request);
    const { action } = await params;
    const store = await cookies();
    if (action === "logout") {
      const token = store.get("school_student")?.value;
      if (token) {
        const { error } = await serviceClient().rpc("student_logout", {
          session_hash: hash(token),
        });
        if (error) throw error;
      }
      store.delete("school_student");
      await (await staffClient()).auth.signOut({ scope: "local" });
      return json({ ok: true });
    }
    if (action !== "login") return json({ error: "notFound" }, 404);
    const value = input.parse(await body(request));
    if (value.kind === "student" && !studentPortalEnabled())
      return json({ error: "forbidden" }, 403);
    const service = serviceClient();
    if (value.kind === "teacher") {
      const limits = await Promise.all([
        service.rpc("consume_limit", {
          bucket_key: bucket("teacher:" + value.identifier.toLowerCase()),
          max_attempts: 10,
        }),
        service.rpc("consume_limit", {
          bucket_key: bucket("teacher-ip:" + requestIp(request)),
          max_attempts: 30,
        }),
      ]);
      if (limits.some((r) => r.error || !r.data))
        return json({ error: "loginFailed" }, 401);
      const db = await staffClient();
      const { data, error } = await db.auth.signInWithPassword({
        email: value.identifier,
        password: value.password,
      });
      if (error || !data.user) return json({ error: "loginFailed" }, 401);
      const { data: profile } = await db
        .from("profiles")
        .select("role,active")
        .eq("id", data.user.id)
        .single();
      if (!profile?.active || !isStaff(profile.role)) {
        await db.auth.signOut({ scope: "local" });
        return json({ error: "loginFailed" }, 401);
      }
      const priorStudent = store.get("school_student")?.value;
      if (priorStudent) {
        const revoked = await service.rpc("student_logout", {
          session_hash: hash(priorStudent),
        });
        if (revoked.error) throw revoked.error;
        store.delete("school_student");
      }
      return json({ redirect: "/teacher" });
    }
    const token = randomBytes(32).toString("base64url");
    const { data, error } = await service.rpc("student_login", {
      number: value.identifier,
      pin: value.password,
      token_hash: hash(token),
      account_bucket: bucket("student:" + value.identifier),
      ip_bucket: bucket("student-ip:" + requestIp(request)),
    });
    if (error || !data) return json({ error: "loginFailed" }, 401);
    // A shared browser must never retain staff privileges after student sign-in.
    const previousStudent = store.get("school_student")?.value;
    if (previousStudent) {
      const revoked = await service.rpc("student_logout", {
        session_hash: hash(previousStudent),
      });
      if (revoked.error) throw revoked.error;
    }
    await (await staffClient()).auth.signOut({ scope: "local" });
    // Clear even stale staff chunks if the Auth service has already revoked them.
    store
      .getAll()
      .filter((c) => c.name.startsWith("sb-") && c.name.includes("auth-token"))
      .forEach((c) => store.delete(c.name));
    store.set("school_student", token, {
      httpOnly: true,
      secure: secureCookies(),
      sameSite: "strict",
      path: "/",
      maxAge: 8 * 60 * 60,
    });
    return json({ redirect: "/student" });
  } catch (error) {
    return failure(error);
  }
}
