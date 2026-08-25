import { createClient } from "@/lib/supabase/server";
import { withOrgContext } from "@/db/withOrgContext";
import { getAccountDetail } from "@/lib/api/crm";
import AccountDetailPageClient, { type AccountDetailInitialData } from "./AccountDetailPageClient";

export default async function AccountDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const userId = data.user!.id;

  try {
    const initial = await withOrgContext(userId, async (db) => {
      const result = await getAccountDetail(db, userId, id);
      if (!result) throw new Error("Account not found");
      return result as unknown as AccountDetailInitialData;
    });
    return <AccountDetailPageClient initial={initial} />;
  } catch {
    return <AccountDetailPageClient />;
  }
}
