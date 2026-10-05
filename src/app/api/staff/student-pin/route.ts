import { z } from "zod";
import { requireStaff } from "@/lib/supabase/server";
import { body, failure, json, sameOrigin } from "@/lib/http";

export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const { db } = await requireStaff();
    const value = z
      .object({
        student_id: z.uuid(),
        term_id: z.uuid(),
        pin: z.string().regex(/^\d{6,12}$/),
      })
      .strict()
      .parse(await body(request));
    const result = await db.rpc("reset_student_pin", {
      learner: value.student_id,
      term: value.term_id,
      pin: value.pin,
    });
    if (result.error) throw result.error;
    return json({ ok: true });
  } catch (error) {
    return failure(error);
  }
}
