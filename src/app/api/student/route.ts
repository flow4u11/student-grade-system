import { portalSchema } from "@/lib/validation";
import { studentPortalEnabled } from "@/lib/config";
import { cookies } from "next/headers";
import { serviceClient } from "@/lib/supabase/server";
import { failure, hash, json } from "@/lib/http";
export async function GET() {
  try {
    if (!studentPortalEnabled()) return json({ error: "forbidden" }, 403);
    const token = (await cookies()).get("school_student")?.value;
    if (!token) return json({ error: "unauthorized" }, 401);
    const { data, error } = await serviceClient().rpc("student_portal", {
      session_hash: hash(token),
    });
    if (error) throw error;
    return data
      ? json(portalSchema.parse(data))
      : json({ error: "unauthorized" }, 401);
  } catch (e) {
    return failure(e);
  }
}
