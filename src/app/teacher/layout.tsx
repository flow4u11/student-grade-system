import { StaffIdentity } from "@/components/staff-identity";
import { DataProvider } from "@/components/data";
import { Shell } from "@/components/shell";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/supabase/server";
export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  let profile;
  try {
    profile = (await requireStaff()).profile;
  } catch {
    redirect("/login");
  }
  return (
    <StaffIdentity profile={profile}>
      <DataProvider key={profile.id}>
        <Shell>{children}</Shell>
      </DataProvider>
    </StaffIdentity>
  );
}
