import { getAuthUser } from "@/lib/supabase/server";
import { withOrgContext } from "@/db/withOrgContext";
import { getCurrentOrg } from "@/lib/org/currentOrg";
import { listGoogleMeetings, withGoogleCalendar } from "@/lib/api/googleMeet";
import { requirePermission } from "@/lib/api/permissions";
import { VideoPageClient, type VideoInitialData } from "./VideoPageClient";

export default async function VideoPage() {
  const { data } = await getAuthUser();
  const userId = data.user!.id;
  const { orgId } = await getCurrentOrg(userId);

  if (!orgId) return <VideoPageClient />;

  try {
    const initial = await withOrgContext(userId, async (db) => {
      await requirePermission(db, userId, orgId, "integration", "read");
      const now = new Date();
      const lookback = new Date(now.getTime() - 30 * 86400000).toISOString();
      const lookahead = new Date(now.getTime() + 90 * 86400000).toISOString();
      const nowIso = now.toISOString();

      const [upcoming, past] = await withGoogleCalendar(db, orgId, (accessToken, calendarId) =>
        Promise.all([
          listGoogleMeetings(accessToken, calendarId, { timeMin: nowIso, timeMax: lookahead }),
          listGoogleMeetings(accessToken, calendarId, { timeMin: lookback, timeMax: nowIso }),
        ]),
      );

      return { connected: true, upcoming, past: [...past].reverse() } as unknown as VideoInitialData;
    });
    return <VideoPageClient initial={initial} />;
  } catch (err) {
    const msg = err instanceof Error ? err.message.toLowerCase() : "";
    const isNotConnected = msg.includes("not connected") || msg.includes("connection expired");
    return <VideoPageClient initial={isNotConnected ? { connected: false, upcoming: [], past: [] } : undefined} />;
  }
}
