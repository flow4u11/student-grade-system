import { registrationSchema, loginBase } from "@/lib/accounts";
import { serviceClient } from "@/lib/supabase/server";
import {
  body,
  bucket,
  failure,
  hash,
  json,
  requestIp,
  sameOrigin,
} from "@/lib/http";
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const db = serviceClient();
    const limit = await db.rpc("consume_limit", {
      bucket_key: bucket("registration:" + requestIp(request)),
      max_attempts: 10,
    });
    if (limit.error || !limit.data) return json({ error: "tryLater" }, 429);
    const v = registrationSchema.parse(await body(request));
    const base = loginBase(
      v.login_first_name || v.first_name,
      v.login_last_name || v.last_name,
    );
    const r = await db.rpc("reserve_teacher_registration", {
      code_hash: hash(v.code),
      base_name: base,
      first_name: v.first_name,
      last_name: v.last_name,
      first_name_th: v.first_name_th || "",
      last_name_th: v.last_name_th || "",
    });
    if (r.error) return json({ error: "registrationDenied" }, 400);
    const reservation = r.data as { id: string; username: string };
    // Auth trigger creates a fixed TEACHER profile in the same transaction as the user.
    const created = await db.auth.admin.createUser({
      email: reservation.username,
      password: v.password,
      email_confirm: true,
      app_metadata: { school_registration: reservation.id },
    });
    if (created.error) {
      await db.rpc("cancel_teacher_registration", {
        reservation: reservation.id,
      });
      return json({ error: "registrationDenied" }, 400);
    }
    return json({ username: reservation.username });
  } catch (e) {
    if ((e as Error).message === "loginNameUnsupported")
      return json({ error: "loginNameUnsupported" }, 400);
    return failure(e);
  }
}
