import { getAuthUser } from "@/lib/supabase/server";
import { withOrgContext } from "@/db/withOrgContext";
import { getCurrentOrg } from "@/lib/org/currentOrg";
import { assembleProfile, loadOrInitPreferences, listMySecurityLog } from "@/lib/api/me";
import ProfileSettingsPageClient, { type ProfileSettingsInitialData } from "./ProfileSettingsPageClient";

export default async function ProfileSettingsPage() {
  const { data } = await getAuthUser();
  const userId = data.user!.id;
  const { orgId } = await getCurrentOrg(userId);

  if (!orgId) return <ProfileSettingsPageClient />;

  try {
    const initial = await withOrgContext(userId, async (db) => {
      const [prefs, securityLog] = await Promise.all([
        loadOrInitPreferences(db, userId, orgId),
        listMySecurityLog(db, userId),
      ]);
      return { profile: assembleProfile(data.user, prefs), securityLog } as unknown as ProfileSettingsInitialData;
    });
    return <ProfileSettingsPageClient initial={initial} />;
  } catch {
    return <ProfileSettingsPageClient />;
  }
}
