import sharp from "sharp";
import { requireStaff, serviceClient } from "@/lib/supabase/server";
import { failure, json, sameOrigin } from "@/lib/http";
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const { db, profile } = await requireStaff();
    const reader = request.body?.getReader();
    if (!reader) throw new Error("INVALID");
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.byteLength;
      if (size > 3 * 1024 * 1024) {
        await reader.cancel();
        throw new Error("TOO_LARGE");
      }
      chunks.push(part.value);
    }
    const form = await new Response(Buffer.concat(chunks), {
      headers: { "Content-Type": request.headers.get("Content-Type") || "" },
    }).formData();
    const file = form.get("photo");
    if (
      !(file instanceof File) ||
      file.size > 2 * 1024 * 1024 ||
      file.size === 0
    )
      throw new Error("INVALID");
    const image = sharp(Buffer.from(await file.arrayBuffer()), {
      limitInputPixels: 25000000,
      animated: false,
    });
    const metadata = await image.metadata();
    if (!["jpeg", "png", "webp"].includes(metadata.format || ""))
      throw new Error("INVALID");
    const photo = await image
      .rotate()
      .resize(320, 320, { fit: "cover" })
      .jpeg({ quality: 85 })
      .toBuffer();
    const path = `${profile.id}/avatar.jpg`;
    const upload = await serviceClient()
      .storage.from("teacher-avatars")
      .upload(path, photo, {
        upsert: true,
        contentType: "image/jpeg",
        cacheControl: "60",
      });
    if (upload.error) throw upload.error;
    const saved = await db.rpc("set_teacher_photo", { path });
    if (saved.error) throw saved.error;
    return json({ ok: true });
  } catch (e) {
    if (
      e instanceof Error &&
      /image|format|corrupt|Input buffer/i.test(e.message)
    )
      return json({ error: "invalid" }, 400);
    return failure(e);
  }
}
