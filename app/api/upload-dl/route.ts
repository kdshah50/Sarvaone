import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase, getUserIdFromRequest, idMatchVariantsForIn } from "@/lib/auth-server";
import { INE_PHOTOS_BUCKET, signedInePhotoUrl } from "@/lib/ine-storage";

const MAX_SIZE = 5 * 1024 * 1024; // 5 MB

/** POST multipart file — stores in same private bucket as legacy INE uploads; updates users.dl_photo_url */
export async function POST(req: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: "File too large (max 5 MB)" }, { status: 400 });
    }

    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (!allowed.includes(file.type)) {
      return NextResponse.json({ error: "Only JPEG, PNG, or WebP images allowed" }, { status: 400 });
    }

    const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
    const fileName = `dl-${userId}-${Date.now()}.${ext}`;

    const supabase = createAdminSupabase();
    const buf = Buffer.from(await file.arrayBuffer());

    const { error: uploadError } = await supabase.storage
      .from(INE_PHOTOS_BUCKET)
      .upload(fileName, buf, { contentType: file.type, upsert: true });

    if (uploadError) {
      console.error("[upload-dl] storage error:", uploadError);
      return NextResponse.json({ error: "Upload failed — storage bucket may not exist yet" }, { status: 500 });
    }

    const { error: updateError } = await supabase
      .from("users")
      .update({ dl_photo_url: fileName })
      .in("id", idMatchVariantsForIn(userId));

    if (updateError) {
      console.error("[upload-dl] user update error:", updateError);
      return NextResponse.json({ error: "Photo uploaded but failed to save URL" }, { status: 500 });
    }

    const displayUrl = await signedInePhotoUrl(supabase, fileName);
    return NextResponse.json({ ok: true, url: displayUrl ?? undefined, objectPath: fileName });
  } catch (e: unknown) {
    console.error("[upload-dl] error:", e);
    return NextResponse.json({ error: "Error al subir el archivo" }, { status: 500 });
  }
}
