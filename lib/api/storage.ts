// Task attachments (Files view, project detail Tasks tab redesign).
//
// Important architecture note: this app's real data tables live in Neon,
// not Supabase's own Postgres — Supabase is Auth-only here (CLAUDE.md §2).
// That means Supabase Storage's RLS (which runs against Supabase's own
// database) has no visibility into org_memberships/tasks/permissions —
// all of that lives in Neon. So the "task-attachments" bucket is fully
// private with NO storage-level RLS policies; every access goes through
// these helpers using the service-role client, called only after our own
// requirePermission() check against Neon has passed (same authorization
// model as every other route in this app — just applied to file bytes
// instead of table rows).
import { supabaseAdminClient } from "./supabaseAdmin";
import { ApiError } from "./helpers";

const BUCKET = "task-attachments";

export async function uploadTaskAttachment(orgId: string, taskId: string, fileName: string, file: Buffer, mimeType?: string) {
  const path = `${orgId}/${taskId}/${crypto.randomUUID()}-${fileName}`;
  const supabase = supabaseAdminClient();
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: mimeType || "application/octet-stream",
  });
  if (error) throw new ApiError(502, `Upload failed: ${error.message}`);
  return path;
}

export async function signedDownloadUrl(path: string, expiresInSeconds = 300) {
  const supabase = supabaseAdminClient();
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, expiresInSeconds);
  if (error) throw new ApiError(502, `Failed to create download link: ${error.message}`);
  return data.signedUrl;
}

export async function deleteTaskAttachment(path: string) {
  const supabase = supabaseAdminClient();
  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  if (error) throw new ApiError(502, `Delete failed: ${error.message}`);
}
