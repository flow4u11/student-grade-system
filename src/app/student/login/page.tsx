import { Login } from "@/components/login";
import { studentPortalEnabled } from "@/lib/config";
import { redirect } from "next/navigation";
import { connection } from "next/server";
export default async function Page() {
  await connection();
  if (!studentPortalEnabled()) redirect("/login");
  return <Login kind="student" studentEnabled />;
}
