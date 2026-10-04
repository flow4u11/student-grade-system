import type { Database } from "@/lib/database.types";
import { secureCookies } from "@/lib/config";
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !request.cookies.getAll().some((c) => c.name.startsWith("sb-"))
  )
    return request.nextUrl.pathname.startsWith("/teacher")
      ? NextResponse.redirect(new URL("/login", request.url))
      : response;
  const db = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (list) => {
          list.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          list.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, {
              ...options,
              httpOnly: true,
              secure: secureCookies(),
              sameSite: "lax",
            }),
          );
        },
      },
    },
  );
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user && request.nextUrl.pathname.startsWith("/teacher")) {
    const redirect = NextResponse.redirect(new URL("/login", request.url));
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    return redirect;
  }
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
export const config = { matcher: ["/teacher/:path*", "/api/staff/:path*"] };
