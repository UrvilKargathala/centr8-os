import { getAuthUser } from "@/lib/supabase/server";
import { withOrgContext } from "@/db/withOrgContext";
import { getDocumentDetail } from "@/lib/api/aiAssistant";
import DocumentDetailPageClient, { type DocumentDetailInitialData } from "./DocumentDetailPageClient";

export default async function DocumentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { data } = await getAuthUser();
  const userId = data.user!.id;

  try {
    const initial = await withOrgContext(userId, async (db) => {
      const result = await getDocumentDetail(db, userId, id);
      if (!result) throw new Error("Document not found");
      return result as unknown as DocumentDetailInitialData;
    });
    return <DocumentDetailPageClient initial={initial} />;
  } catch {
    return <DocumentDetailPageClient />;
  }
}
