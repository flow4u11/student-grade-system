import { Login } from "@/components/login";
import { studentPortalEnabled } from "@/lib/config";
import { connection } from "next/server";
export default async function Page() {
  await connection();
  return <Login studentEnabled={studentPortalEnabled()} />;
}
