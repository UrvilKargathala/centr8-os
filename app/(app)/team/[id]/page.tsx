import { getAuthUser } from "@/lib/supabase/server";
import { withOrgContext } from "@/db/withOrgContext";
import { getPerson, getPersonStats } from "@/lib/api/team";
import PersonDetailPageClient, { type PersonDetailInitialData } from "./PersonDetailPageClient";

export default async function PersonDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { data } = await getAuthUser();
  const userId = data.user!.id;

  try {
    const initial = await withOrgContext(userId, async (db) => {
      const [person, stats] = await Promise.all([getPerson(db, id), getPersonStats(db, id)]);
      return { person, stats } as unknown as PersonDetailInitialData;
    });
    return <PersonDetailPageClient initial={initial} />;
  } catch {
    return <PersonDetailPageClient />;
  }
}
