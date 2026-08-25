import { createClient } from "@/lib/supabase/server";
import { withOrgContext } from "@/db/withOrgContext";
import { getCampaignFullDetail } from "@/lib/api/crm";
import CampaignDetailPageClient, { type CampaignDetailInitialData } from "./CampaignDetailPageClient";

export default async function CampaignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const userId = data.user!.id;

  try {
    const initial = await withOrgContext(userId, async (db) => {
      const result = await getCampaignFullDetail(db, userId, id);
      if (!result) throw new Error("Campaign not found");
      return result as unknown as CampaignDetailInitialData;
    });
    return <CampaignDetailPageClient initial={initial} />;
  } catch {
    return <CampaignDetailPageClient />;
  }
}
