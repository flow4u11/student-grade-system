import { portalSchema } from "@/lib/validation";
import { studentPortalEnabled } from "@/lib/config";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { serviceClient } from "@/lib/supabase/server";
import { hash } from "@/lib/http";
import { StudentPortal } from "@/components/student-portal";
export default async function Page() {
  if (!studentPortalEnabled()) redirect("/login");
  const token = (await cookies()).get("school_student")?.value;
  if (!token) redirect("/login");
  const { data, error } = await serviceClient().rpc("student_portal", {
    session_hash: hash(token),
  });
  if (error) throw new Error("Portal temporarily unavailable");
  if (!data) redirect("/login");
  return <StudentPortal data={portalSchema.parse(data)} />;
}
