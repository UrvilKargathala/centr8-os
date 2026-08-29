import { getAuthUser } from "@/lib/supabase/server";
import { withOrgContext } from "@/db/withOrgContext";
import { getDealDetail } from "@/lib/api/crm";
import DealDetailPageClient, { type DealDetailInitialData } from "./DealDetailPageClient";

export default async function DealDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { data } = await getAuthUser();
  const userId = data.user!.id;

  try {
    const initial = await withOrgContext(userId, async (db) => {
      const result = await getDealDetail(db, userId, id);
      if (!result) throw new Error("Deal not found");
      return result as unknown as DealDetailInitialData;
    });
    return <DealDetailPageClient initial={initial} />;
  } catch {
    return <DealDetailPageClient />;
  }
}
