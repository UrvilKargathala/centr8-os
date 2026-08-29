import { getAuthUser } from "@/lib/supabase/server";
import { withOrgContext } from "@/db/withOrgContext";
import { getCurrentOrg } from "@/lib/org/currentOrg";
import { getOrCreateSettings } from "@/lib/api/attendance";
import { requirePermission } from "@/lib/api/permissions";
import AttendanceSettingsPageClient, { type AttendanceSettingsData } from "./AttendanceSettingsPageClient";

export default async function AttendanceSettingsPage() {
  const { data } = await getAuthUser();
  const userId = data.user!.id;
  const { orgId } = await getCurrentOrg(userId);

  if (!orgId) return <AttendanceSettingsPageClient />;

  try {
    const initial = await withOrgContext(userId, async (db) => {
      await requirePermission(db, userId, orgId, "attendance", "view_own");
      return getOrCreateSettings(db, orgId);
    });
    return <AttendanceSettingsPageClient initial={initial as unknown as AttendanceSettingsData} />;
  } catch {
    return <AttendanceSettingsPageClient />;
  }
}
