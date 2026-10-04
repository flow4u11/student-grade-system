import { isStaff } from "@/lib/permissions";
import type { Database } from "@/lib/database.types";
import { secureCookies } from "@/lib/config";
import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
export async function staffClient() {
  const store = await cookies();
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => store.getAll(),
        setAll: (list) => {
          try {
            list.forEach(({ name, value, options }) =>
              store.set(name, value, {
                ...options,
                httpOnly: true,
                secure: secureCookies(),
                sameSite: "lax",
              }),
            );
          } catch {
            /* Server components are refreshed by proxy. */
          }
        },
      },
    },
  );
}
export function serviceClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
export async function requireStaff() {
  const db = await staffClient();
  const {
    data: { user },
    error,
  } = await db.auth.getUser();
  if (error || !user) throw new Error("UNAUTHORIZED");
  const { data: profile } = await db
    .from("profiles")
    .select("id,display_name,role,active,avatar_path")
    .eq("id", user.id)
    .single();
  if (!profile?.active || !isStaff(profile.role)) throw new Error("FORBIDDEN");
  return { db, profile };
}
