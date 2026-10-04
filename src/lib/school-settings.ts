import "server-only";
import { serviceClient } from "./supabase/server";
import { defaultBranding, type Branding } from "./branding";
export async function schoolBranding(): Promise<Branding> {
  try {
    const r = await serviceClient().rpc("school_branding");
    if (r.error || !r.data) return defaultBranding;
    return { ...defaultBranding, ...(r.data as Branding) };
  } catch {
    return defaultBranding;
  }
}
