import { getAuthUser } from "@/lib/supabase/server";
import { withOrgContext } from "@/db/withOrgContext";
import { getCurrentOrg } from "@/lib/org/currentOrg";
import { getMyTimeTrackingWeek } from "@/lib/api/timeEntries";
import { listProjectNames } from "@/lib/api/projects";
import { listActivePeople } from "@/lib/api/team";
import { TimeTrackingPageClient, type TimeTrackingInitialData } from "./TimeTrackingPageClient";

// Mirrors the client's weekRange(0) — current week, Monday-start.
function currentWeekRange(): [string, string] {
  const today = new Date();
  const day = today.getDay();
  const monday = new Date(today);
  monday.setDate(today.getDate() - (day === 0 ? 6 : day - 1));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return [monday.toISOString().slice(0, 10), sunday.toISOString().slice(0, 10)];
}

// Seeds the default "My" tab, current week. Team tab and other weeks stay
// client-fetched, unchanged.
export default async function TimeTrackingPage() {
  const { data } = await getAuthUser();
  const userId = data.user!.id;
  const { orgId } = await getCurrentOrg(userId);

  if (!orgId) return <TimeTrackingPageClient />;

  try {
    const [startDate, endDate] = currentWeekRange();
    const initial = await withOrgContext(userId, async (db) => {
      const [{ entries, summary, submission }, projects, people] = await Promise.all([
        getMyTimeTrackingWeek(db, userId, orgId, startDate, endDate),
        listProjectNames(db, orgId),
        listActivePeople(db, orgId),
      ]);
      return { entries, summary, submission, projects, people } as unknown as TimeTrackingInitialData;
    });
    return <TimeTrackingPageClient initial={initial} />;
  } catch {
    return <TimeTrackingPageClient />;
  }
}
