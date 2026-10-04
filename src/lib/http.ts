import "server-only";
import { NextResponse } from "next/server";
import { createHash, createHmac } from "node:crypto";
import { ZodError } from "zod";
export const json = (data: unknown, status = 200) =>
  NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
export function sameOrigin(request: Request) {
  const expected = process.env.APP_URL;
  if (!expected || request.headers.get("origin") !== new URL(expected).origin)
    throw new Error("FORBIDDEN");
}
export async function body(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) throw new Error("INVALID");
  const chunks: Uint8Array[] = [];
  let length = 0;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > 1024 * 1024) {
      await reader.cancel();
      throw new Error("TOO_LARGE");
    }
    chunks.push(value);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString());
  } catch {
    throw new Error("INVALID");
  }
}
export function hash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
export function bucket(value: string) {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error("CONFIGURATION");
  return createHmac("sha256", secret).update(value).digest("hex");
}
export function requestIp(request: Request) {
  // Vercel overwrites x-vercel-forwarded-for. Other deployments share a conservative bucket.
  return process.env.VERCEL === "1"
    ? request.headers.get("x-vercel-forwarded-for")?.split(",")[0].trim() ||
        "shared"
    : "local-or-shared";
}
export function failure(error: unknown) {
  const e = error as { message?: string; code?: string };
  if (e.message === "RATE_LIMIT") return json({ error: "tryLater" }, 429);
  if (e.message === "PUBLISHED_LOCKED")
    return json({ error: "publishedLocked" }, 409);
  if (e.message === "UNAUTHORIZED") return json({ error: "unauthorized" }, 401);
  if (e.message === "FORBIDDEN" || e.code === "42501")
    return json({ error: "forbidden" }, 403);
  if (e.message?.startsWith("DEPENDENCIES:"))
    return json({ error: "deleteLinked" }, 409);
  if (e.code === "40001") return json({ error: "conflict" }, 409);
  if (e.code === "23505") return json({ error: "duplicate" }, 409);
  if (e.message === "TOO_LARGE") return json({ error: "tooLarge" }, 413);
  if (
    error instanceof ZodError ||
    e.message === "INVALID" ||
    e.code === "23514" ||
    e.code === "22P02" ||
    e.code === "23503"
  )
    return json({ error: "invalid" }, 400);
  if (e.code === "P0001")
    return json(
      {
        error: e.message?.includes("immutable")
          ? "immutable"
          : e.message?.includes("has grades")
            ? "historyLocked"
            : "invalid",
      },
      400,
    );
  return json({ error: "serverError" }, 500);
}
