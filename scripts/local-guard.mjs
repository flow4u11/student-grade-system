export function assertLocal() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url || !["127.0.0.1", "localhost"].includes(new URL(url).hostname))
    throw new Error("Refusing: this operation is for LOCAL Supabase only.");
  return url;
}
