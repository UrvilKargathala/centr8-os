import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { and, eq } from "drizzle-orm";
import { withOrgContext } from "@/db/withOrgContext";
import { userPreferences } from "@/db/schema";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";

const BUCKET = "avatars";
const MAX_SIZE = 2 * 1024 * 1024; // 2 MB

export async function POST(req: NextRequest) {
  try {
    const userId = await requireUserId(req);
    const orgId = req.nextUrl.searchParams.get("org_id");
    if (!orgId) throw new ApiError(400, "org_id is required");

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) throw new ApiError(400, "file is required");
    if (file.size > MAX_SIZE) throw new ApiError(400, "File too large (max 2 MB)");
    if (!file.type.startsWith("image/")) throw new ApiError(400, "Only image files allowed");

    const supabase = await createServerClient();

    // Ensure bucket exists (idempotent — errors if it already exists, which is fine)
    await supabase.storage.createBucket(BUCKET, { public: true }).catch(() => {});

    const ext = file.name.split(".").pop() ?? "png";
    const path = `${userId}.${ext}`;

    const arrayBuffer = await file.arrayBuffer();
    const { error: uploadErr } = await supabase.storage
      .from(BUCKET)
      .upload(path, arrayBuffer, { contentType: file.type, upsert: true });
    if (uploadErr) throw new ApiError(500, `Upload failed: ${uploadErr.message}`);

    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);
    const avatarUrl = urlData.publicUrl;

    await withOrgContext(userId, async (db) => {
      await db
        .insert(userPreferences)
        .values({ userId, orgId })
        .onConflictDoNothing({ target: [userPreferences.userId, userPreferences.orgId] });
      await db
        .update(userPreferences)
        .set({ avatarUrl, updatedAt: new Date() })
        .where(and(eq(userPreferences.userId, userId), eq(userPreferences.orgId, orgId)));
    });

    return NextResponse.json({ data: { avatarUrl } });
  } catch (err) {
    return handleApiError(err);
  }
}
