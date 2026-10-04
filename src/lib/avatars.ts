import "server-only";
import { serviceClient } from "./supabase/server";
export async function signedAvatar(
  path: string | null,
): Promise<string | null> {
  if (!path) return null;
  const result = await serviceClient()
    .storage.from("teacher-avatars")
    .createSignedUrl(path, 900);
  return result.data?.signedUrl || null;
}
